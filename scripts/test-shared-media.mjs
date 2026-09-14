import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { scryptSync, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '..');
const dir = mkdtempSync(join(tmpdir(), 'pwos-shared-media-test-'));
const password = randomBytes(20).toString('hex');
mkdirSync(join(dir, 'data'));
symlinkSync(join(root, 'dist'), join(dir, 'dist'));
const write = (name, value) => writeFileSync(join(dir, 'data', name), JSON.stringify(value));
write('users.local.json', [{ id: 'employee', name: 'Test employee', email: 'employee@example.invalid', profile: 'EMPLOYEE', role: 'Reader', roleId: 'reader', permissionOverrides: { 'media.view': 'ALLOW', 'media.sync': 'DENY' }, salt: 'test', passwordHash: scryptSync(password, 'test', 64).toString('hex'), mustChangePassword: false }]);
write('roles.local.json', [{ id: 'reader', name: 'Reader', level: 1, permissions: ['media.view'] }]);
const snapshot = { schemaVersion: 10, since: '2026-09-01', until: '2026-09-07', syncedAt: new Date().toISOString(), accounts: [{id:'google_shared',name:'Shared account'}], campaigns: [{ id: 'campaign', accountId:'google_shared', name: 'Shared campaign', spend: 10 }] };
write('google-dashboard-cache.local.json', snapshot);
const env = { ...process.env, PW_OS_MASTER_EMAIL: 'master@example.invalid', PW_OS_MASTER_INITIAL_PASSWORD: password, FIREBASE_ENABLED: 'false' };
const server = spawn(process.execPath, [join(root,'node_modules/vite/bin/vite.js'), 'preview', '--config', join(root,'vite.config.ts'), '--host','127.0.0.1','--port','5197','--strictPort'], {cwd:dir,env,stdio:['ignore','pipe','pipe']});
let output=''; server.stdout.on('data', x=>output+=x); server.stderr.on('data', x=>output+=x);
const base='http://127.0.0.1:5197/api';
try {
  let ready=false;
  for(let i=0;i<100;i++){try {if((await fetch(base+'/health')).ok){ready=true;break}}catch{} await new Promise(r=>setTimeout(r,200));}
  if(!ready)throw Error('Test server did not start: '+output.slice(-2000));
  for(const email of ['master@example.invalid','employee@example.invalid']){
    const login=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    assert.equal(login.status,200);
    const headers={Cookie:login.headers.get('set-cookie').split(';')[0]};
    let result=await fetch(base+'/media/google/campaigns?since=2026-09-01&until=2026-09-07&stored=1',{headers});
    assert.equal(result.status,200); let payload=await result.json();
    assert.equal(payload.campaigns[0].spend,10);
    // A sync replaces the shared source; both sessions must see it on next read.
    snapshot.campaigns[0].spend=20;write('google-dashboard-cache.local.json',snapshot);
    result=await fetch(base+'/media/google/campaigns?since=2026-09-01&until=2026-09-07',{headers});
    assert.equal((await result.json()).campaigns[0].spend,20);
    result=await fetch(base+'/media/google/campaigns?since=2026-09-04&until=2026-09-10&fetch_missing=1',{headers});
    assert.equal(result.status,503);payload=await result.json();assert.ok(payload.missingCredentials.length);
    if(email.startsWith('employee')){
      result=await fetch(base+'/media/google/campaigns?since=2026-09-01&until=2026-09-07&refresh=1&manual=1',{headers});
      assert.equal(result.status,403);
    }
    await fetch(base+'/auth/logout',{method:'POST',headers});
    snapshot.campaigns[0].spend=10;write('google-dashboard-cache.local.json',snapshot);
  }
  console.log('PASS: shared data for Master and employee; shared updates; personal periods; missing periods reach the backend connection; sync permission preserved.');
} finally {
  server.kill('SIGTERM');
  await new Promise(resolve=>server.once('exit',resolve));
  rmSync(dir,{recursive:true,force:true});
}
