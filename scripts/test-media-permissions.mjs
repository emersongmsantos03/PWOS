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
const cases = [
  { id: 'authorized', permissions: ['integrations.authorize'], authorize: true, revoke: false },
  { id: 'revoker', permissions: ['integrations.revoke'], authorize: false, revoke: true },
  { id: 'reader', permissions: ['integrations.view'], authorize: false, revoke: false },
  { id: 'denied', permissions: ['integrations.authorize'], overrides: {'integrations.authorize':'DENY'}, authorize: false, revoke: false },
  { id: 'override', permissions: [], overrides: {'integrations.authorize':'ALLOW'}, authorize: true, revoke: false },
  { id: 'client', profile: 'CLIENT', permissions: ['integrations.authorize', 'integrations.revoke'], authorize: false, revoke: false },
];
write('users.local.json', cases.map(c => ({ id:c.id, name:c.id, email:c.id+'@example.invalid', profile:c.profile || 'EMPLOYEE', role:c.id, roleId:c.id, permissionOverrides:c.overrides || {}, salt:'test', passwordHash:scryptSync(password,'test',64).toString('hex'), mustChangePassword:false })));
write('roles.local.json', cases.map(c => ({id:c.id,name:c.id,level:1,permissions:c.permissions})));
const snapshot = { schemaVersion: 10, since: '2026-09-01', until: '2026-09-07', syncedAt: new Date().toISOString(), accounts: [{id:'google_shared',name:'Shared account'}], campaigns: [{ id: 'campaign', accountId:'google_shared', name: 'Shared campaign', spend: 10 }] };
write('google-dashboard-cache.local.json', snapshot);
const env = { ...process.env, PW_OS_MASTER_EMAIL: 'master@example.invalid', PW_OS_MASTER_INITIAL_PASSWORD: password, FIREBASE_ENABLED: 'false' };
const server = spawn(process.execPath, [join(root,'node_modules/vite/bin/vite.js'), 'preview', '--config', join(root,'vite.config.ts'), '--host','127.0.0.1','--port','5198','--strictPort'], {cwd:dir,env,stdio:['ignore','pipe','pipe']});
let output=''; server.stdout.on('data', x=>output+=x); server.stderr.on('data', x=>output+=x);
const base='http://127.0.0.1:5198/api';
try {
  let ready=false;
  for(let i=0;i<100;i++){try {if((await fetch(base+'/health')).ok){ready=true;break}}catch{} await new Promise(r=>setTimeout(r,200));}
  if(!ready)throw Error('Test server did not start: '+output.slice(-2000));
  for(const c of [...cases, {id:'master',authorize:true,revoke:true}]) {
    const login=await fetch(base+(c.profile === 'CLIENT' ? '/client-auth/login' : '/auth/login'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:c.id+'@example.invalid',password})});
    assert.equal(login.status,200,c.id);
    const headers={Cookie:login.headers.get('set-cookie').split(';')[0]};
    for (const provider of ['google','meta']) {
      const status=await fetch(base+'/media/'+provider+'/token',{headers});
      if(c.profile !== 'CLIENT') {
        const payload=await status.json();
        assert.equal(payload.canManage,c.authorize,c.id);
        assert.equal(payload.canRevoke,c.revoke,c.id);
      }
      const start=await fetch(base+'/media/'+provider+'/oauth/start',{method:'POST',headers});
      assert.equal(start.status,c.profile === 'CLIENT' ? 401 : c.authorize ? 409 : 403,c.id+' start '+provider);
      const remove=await fetch(base+'/media/'+provider+'/token',{method:'DELETE',headers});
      assert.equal(remove.status,c.profile === 'CLIENT' ? 401 : c.revoke ? 200 : 403,c.id+' revoke '+provider);
      const reveal=await fetch(base+'/media/'+provider+'/token/reveal',{headers});
      assert.equal(reveal.status,c.profile === 'CLIENT' ? 401 : c.id === 'master' ? 404 : 403,c.id+' reveal');
    }
  }
  console.log('PASS: authorize/revoke roles, overrides, denied access, client exclusion and Master.');

} finally {
  server.kill('SIGTERM');
  await new Promise(resolve=>server.once('exit',resolve));
  rmSync(dir,{recursive:true,force:true});
}
