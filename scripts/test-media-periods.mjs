import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { scryptSync, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..'),dir=mkdtempSync(join(tmpdir(),'pwos-periods-'));
const password=randomBytes(20).toString('hex');
mkdirSync(join(dir,'data')); symlinkSync(join(root,'dist'),join(dir,'dist'));
const write=(name,value)=>writeFileSync(join(dir,'data',name),JSON.stringify(value));
write('users.local.json',['reader','other','denied'].map(id=>({id,name:id,email:id+'@example.invalid',profile:'EMPLOYEE',roleId:'reader',permissionOverrides:{'media.view':id==='denied'?'DENY':'ALLOW','media.sync':'DENY'},salt:'test',passwordHash:scryptSync(password,'test',64).toString('hex'),mustChangePassword:false})));
write('roles.local.json',[{id:'reader',name:'Reader',level:1,permissions:['media.view']}]);
// Formato antigo (um único arquivo com todos os períodos): deve ser migrado na inicialização.
write('media-metric-snapshots.local.json',[{id:'META_ADS:2020-02-01:2020-02-01',platform:'META_ADS',since:'2020-02-01',until:'2020-02-01',syncedAt:'2020-02-02T00:00:00.000Z',schemaVersion:11,accounts:[],campaigns:[{id:'legacy'}]}]);
const calls=join(dir,'calls.log');writeFileSync(calls,'');
const env={...process.env,PW_OS_MASTER_EMAIL:'master@example.invalid',PW_OS_MASTER_INITIAL_PASSWORD:password,FIREBASE_ENABLED:'false',META_ADS_ACCESS_TOKEN:'fixture-meta',GOOGLE_ADS_CLIENT_ID:'fixture-client',GOOGLE_ADS_CLIENT_SECRET:'fixture-secret',GOOGLE_ADS_DEVELOPER_TOKEN:'fixture-developer',GOOGLE_ADS_REFRESH_TOKEN:'fixture-refresh',MEDIA_TEST_CALLS:calls};
const server=spawn(process.execPath,['--import',join(root,'scripts/fixtures/media-provider-fetch.mjs'),join(root,'node_modules/vite/bin/vite.js'),'preview','--config',join(root,'vite.config.ts'),'--host','127.0.0.1','--port','5199','--strictPort'],{cwd:dir,env,stdio:['ignore','pipe','pipe']});
let output='';server.stdout.on('data',x=>output+=x);server.stderr.on('data',x=>output+=x);
const base='http://127.0.0.1:5199/api';
const count=(provider,since)=>readFileSync(calls,'utf8').split('\n').filter(line=>line===provider+':'+since).length;
try {
  let ready=false;
  for(let i=0;i<100;i++){try{if((await fetch(base+'/health')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,200))}
  assert.ok(ready,output.slice(-2000));
  assert.ok(existsSync(join(dir,'data','media-metric-snapshots.local.json.migrated')),'The legacy single-file history is migrated on startup');
  const sessions={};
  for(const id of ['reader','other','denied']){
    const login=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:id+'@example.invalid',password})});
    assert.equal(login.status,200);sessions[id]={Cookie:login.headers.get('set-cookie').split(';')[0]};
  }
  const migrated=await fetch(base+'/media/history?platform=META_ADS&since=2020-02-01&until=2020-02-01',{headers:sessions.reader});
  assert.equal(migrated.status,200);assert.equal((await migrated.json()).campaigns[0].id,'legacy');
  const request=async(provider,since,extra='',user='reader')=>{
    const response=await fetch(base+'/media/'+provider+'/campaigns?since='+since+'&until='+since+extra,{headers:sessions[user]});
    return {status:response.status,payload:await response.json()};
  };
  for(const provider of ['meta']){  // O Google usa o histórico diário: ver test-google-daily.mjs
    assert.equal((await request(provider,'2026-08-01','','denied')).status,403);
    const first=await Promise.all([request(provider,'2026-08-01','&stored=1'),request(provider,'2026-08-01','','other')]);
    for(const result of first){
      assert.equal(result.status,200,JSON.stringify(result.payload));
      assert.equal(result.payload.since,'2026-08-01');assert.equal(result.payload.until,'2026-08-01');
      assert.equal(result.payload.campaigns[0].spend,1);assert.equal(result.payload.accounts.length,1);
      assert.equal(result.payload.campaigns[0].remainingBudget,null);
      assert.equal(result.payload.accounts[0].remainingBudget,provider==='google'?30:undefined);
    }
    assert.equal(count(provider,'2026-08-01'),1,'Concurrent readers share the provider load');
    const second=await request(provider,'2026-08-02');
    assert.equal(second.status,200);assert.equal(second.payload.campaigns[0].spend,2);
    const previous=await request(provider,'2026-08-01','','other');
    assert.equal(previous.payload.campaigns[0].spend,1);assert.equal(previous.payload.accounts[0].name,first[0].payload.accounts[0].name);
    assert.equal(count(provider,'2026-08-01'),1,'Switching periods reuses persistent history');
    assert.equal((await request(provider,'2026-08-03','&comparison=1')).status,200);
    assert.equal((await request(provider,'2026-08-02')).payload.campaigns[0].spend,2);
    assert.equal((await request(provider,'2026-08-02','&refresh=1&manual=1')).status,403);
    assert.equal((await request(provider,'2026-08-02','&refresh=1')).status,403);
    const failed=await request(provider,'2020-01-01');
    assert.equal(failed.status,502,'Never return a different period on provider errors');
    assert.equal(failed.payload.since,undefined);
    const historyPath=join(dir,'data','media-metric-snapshots',(provider==='meta'?'META_ADS':'GOOGLE_ADS')+'_2026-08-01_2026-08-01.json');
    const saved=JSON.parse(readFileSync(historyPath,'utf8'));
    saved.syncedAt='2021-01-01T00:00:00.000Z';
    writeFileSync(historyPath,JSON.stringify(saved));
    const expired=await request(provider,'2026-08-01');
    assert.equal(expired.status,200);
    assert.equal(expired.payload.cache?.status,'stale','A normal load never blocks on the provider; it serves the stale snapshot instantly');
    await new Promise(r=>setTimeout(r,600));
    assert.equal(count(provider,'2026-08-01'),1,'Reading a stale snapshot never calls the provider; only the daily job and the sync button do');
    // Current month and the dashboard's last seven days hydrate without any Master session.
    const today=new Date().toISOString().slice(0,10),month=today.slice(0,8)+'01';
    const monthResponse=await fetch(base+'/media/'+provider+'/campaigns?since='+month+'&until='+today,{headers:sessions.reader});
    assert.equal(monthResponse.status,200);
    assert.equal((await monthResponse.json()).until,today);
    const lastWeek=new Date(Date.now()-6*86400000).toISOString().slice(0,10);
    const dashboard=await fetch(base+'/media/'+provider+'/campaigns?since='+lastWeek+'&until='+today,{headers:sessions.reader});
    assert.equal(dashboard.status,200);
    const dashboardData=await dashboard.json();
    assert.equal(dashboardData.since,lastWeek);assert.equal(dashboardData.campaigns.length,1);

  }
  console.log('PASS: employee loads absent/current/comparison periods through shared backend credentials; exact persistent cache; concurrent requests deduplicated; view/sync restrictions and provider errors preserved.');
} finally {
  server.kill('SIGTERM');await new Promise(resolve=>{
    if(server.exitCode!==null||server.signalCode!==null)return resolve();
    server.once('exit',resolve);
  });
  rmSync(dir,{recursive:true,force:true});
}
