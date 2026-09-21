// Histórico diário do Google Ads: períodos montados a partir de dias salvos, sem novas
// consultas ao Google, e comportamento com a cota diária esgotada.
// Usa servidores e dados temporários e substitui as APIs externas por respostas simuladas.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { scryptSync, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const password = randomBytes(20).toString('hex');
const brtDay = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(date);
const addDays = (day, amount) => { const d = new Date(day + 'T12:00:00-03:00'); d.setUTCDate(d.getUTCDate() + amount); return brtDay(d); };
const today = brtDay(new Date());
const daysBack = (n) => addDays(today, -n);
const sumOfDays = (from, to) => { let total = 0; for (let d = from; d <= to; d = addDays(d, 1)) total += Number(d.slice(-2)); return total; };

const start = async (port, extraEnv = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'pwos-gdaily-'));
  mkdirSync(join(dir, 'data')); symlinkSync(join(root, 'dist'), join(dir, 'dist'));
  const write = (name, value) => writeFileSync(join(dir, 'data', name), JSON.stringify(value));
  const account = (id, overrides) => ({ id, name: id, email: id + '@example.invalid', profile: 'EMPLOYEE', roleId: 'reader', permissionOverrides: overrides, salt: 'test', passwordHash: scryptSync(password, 'test', 64).toString('hex'), mustChangePassword: false });
  write('users.local.json', [
    account('reader', { 'media.view': 'ALLOW', 'media.sync': 'DENY' }),
    account('syncer', { 'media.view': 'ALLOW', 'media.sync': 'ALLOW' }),
    account('denied', { 'media.view': 'DENY', 'media.sync': 'DENY' }),
  ]);
  write('roles.local.json', [{ id: 'reader', name: 'Reader', level: 1, permissions: ['media.view'] }]);
  const calls = join(dir, 'calls.log'); writeFileSync(calls, '');
  const env = { ...process.env, PW_OS_MASTER_EMAIL: 'master@example.invalid', PW_OS_MASTER_INITIAL_PASSWORD: password, FIREBASE_ENABLED: 'false', GOOGLE_ADS_CLIENT_ID: 'fixture-client', GOOGLE_ADS_CLIENT_SECRET: 'fixture-secret', GOOGLE_ADS_DEVELOPER_TOKEN: 'fixture-developer', GOOGLE_ADS_REFRESH_TOKEN: 'fixture-refresh', MEDIA_TEST_CALLS: calls, ...extraEnv };
  const server = spawn(process.execPath, ['--import', join(root, 'scripts/fixtures/media-provider-fetch.mjs'), join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--config', join(root, 'vite.config.ts'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: dir, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const state = { output: '' };
  server.stdout.on('data', (x) => state.output += x); server.stderr.on('data', (x) => state.output += x);
  const base = `http://127.0.0.1:${port}/api`;
  let ready = false;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(base + '/health')).ok) { ready = true; break; } } catch {} await new Promise((r) => setTimeout(r, 200)); }
  assert.ok(ready, state.output.slice(-2000));
  const sessions = {};
  for (const id of ['reader', 'syncer', 'denied']) {
    const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: id + '@example.invalid', password }) });
    assert.equal(login.status, 200); sessions[id] = { Cookie: login.headers.get('set-cookie').split(';')[0] };
  }
  const get = async (path, user = 'reader') => { const response = await fetch(base + path, { headers: sessions[user] }); return { status: response.status, payload: await response.json() }; };
  const callLines = () => readFileSync(calls, 'utf8').split('\n').filter(Boolean);
  const stop = async () => {
    server.kill('SIGTERM');
    await new Promise((resolveExit) => { if (server.exitCode !== null || server.signalCode !== null) return resolveExit(); server.once('exit', resolveExit); });
    rmSync(dir, { recursive: true, force: true });
  };
  return { dir, get, callLines, stop, state };
};

// ---------- 1) Períodos montados a partir dos dias salvos ----------
let a = await start(5196);
try {
  // O botão Sincronizar faz a coleta leve dos dias recentes (ou aguarda a coleta diária em andamento).
  const first = await a.get(`/media/google/campaigns?since=${daysBack(9)}&until=${daysBack(5)}&refresh=1&manual=1`, 'syncer');
  assert.equal(first.status, 200, JSON.stringify(first.payload));
  assert.equal(first.payload.campaigns[0].spend, sumOfDays(daysBack(9), daysBack(5)));
  const baseline = a.callLines().length;
  assert.ok(baseline > 0, 'a coleta consultou o Google');

  const cases = [
    [daysBack(9), daysBack(9)],
    [daysBack(9), daysBack(5)],
    [daysBack(19), daysBack(1)],
    [daysBack(2), today],
    [today, today],
  ];
  for (const [since, until] of cases) {
    const result = await a.get(`/media/google/campaigns?since=${since}&until=${until}`);
    assert.equal(result.status, 200, `${since}..${until}: ${JSON.stringify(result.payload)}`);
    assert.equal(result.payload.since, since); assert.equal(result.payload.until, until);
    assert.equal(result.payload.cache.status, 'stored');
    const campaign = result.payload.campaigns[0];
    assert.equal(campaign.spend, sumOfDays(since, until > today ? today : until), `${since}..${until}`);
    assert.equal(campaign.reach, -1, 'alcance não soma entre dias');
    assert.equal(campaign.accountId, 'google_123');
    assert.equal(result.payload.accounts[0].remainingBudget, 30);
  }
  // Outro usuário lê o mesmo dado.
  assert.equal((await a.get(`/media/google/campaigns?since=${daysBack(9)}&until=${daysBack(5)}`, 'syncer')).payload.campaigns[0].spend, first.payload.campaigns[0].spend);
  // O histórico usado no comparativo também sai dos dias salvos.
  const history = await a.get(`/media/history?platform=GOOGLE_ADS&since=${daysBack(9)}&until=${daysBack(5)}`);
  assert.equal(history.status, 200); assert.equal(history.payload.source, 'DATABASE');
  assert.equal(history.payload.campaigns[0].spend, first.payload.campaigns[0].spend);
  assert.equal(a.callLines().length, baseline, 'Ler períodos nunca consulta o Google');

  // Permissões: quem só visualiza não sincroniza; sem media.view nada é entregue.
  assert.equal((await a.get(`/media/google/campaigns?since=${daysBack(9)}&until=${daysBack(5)}&refresh=1`)).status, 403);
  assert.equal((await a.get(`/media/google/campaigns?since=${daysBack(9)}&until=${daysBack(5)}`, 'denied')).status, 403);
  // Um segundo clique imediato respeita o intervalo mínimo e não chama o Google.
  assert.equal((await a.get(`/media/google/campaigns?since=${daysBack(9)}&until=${daysBack(5)}&refresh=1&manual=1`, 'syncer')).status, 200);
  assert.equal(a.callLines().length, baseline, 'O intervalo mínimo entre sincronizações manuais é respeitado');

  // Fora do histórico salvo, o período nunca devolve dados de outro intervalo.
  const outside = await a.get('/media/google/campaigns?since=2020-01-01&until=2020-01-02');
  assert.equal(outside.status, 502); assert.equal(outside.payload.since, undefined);

  // O arquivo de histórico guarda um registro por dia coletado.
  const stored = JSON.parse(readFileSync(join(a.dir, 'data', 'google-daily-history.local.json'), 'utf8'));
  assert.ok(stored.syncedDays[daysBack(9)] && stored.syncedDays[daysBack(1)], 'dias recentes salvos');
  assert.equal(stored.quotaBlockedUntil, null);
  console.log('PASS 1/2: períodos diferentes saem dos dias salvos, sem nova consulta ao Google; permissões e intervalo manual preservados.');
} finally { await a.stop(); }

// ---------- 2) Cota diária esgotada ----------
const b = await start(5195, { MEDIA_TEST_GOOGLE_QUOTA: '1' });
try {
  const blocked = await b.get(`/media/google/campaigns?since=${daysBack(9)}&until=${daysBack(5)}&refresh=1&manual=1`, 'syncer');
  assert.equal(blocked.status, 429, JSON.stringify(blocked.payload));
  assert.equal(blocked.payload.code, 'GOOGLE_QUOTA_BLOCKED');
  assert.match(blocked.payload.message, /bloqueou novas consultas até \d{2}\/\d{2} às \d{2}:\d{2}/);
  assert.ok(blocked.payload.retryAfterSeconds > 50000);
  const quotaCalls = () => b.callLines().filter((line) => line === 'google-quota:x').length;
  assert.equal(quotaCalls(), 1, 'Uma única consulta descobre o bloqueio; não há repetição inútil');
  // Nenhum outro usuário ou período volta a chamar o Google enquanto durar o bloqueio.
  for (const user of ['reader', 'syncer']) {
    const again = await b.get(`/media/google/campaigns?since=${daysBack(3)}&until=${today}`, user);
    assert.equal(again.status, 429); assert.equal(again.payload.code, 'GOOGLE_QUOTA_BLOCKED');
  }
  assert.equal((await b.get(`/media/google/campaigns?since=${daysBack(9)}&until=${daysBack(5)}&refresh=1&manual=1`, 'syncer')).status, 429);
  assert.equal(quotaCalls(), 1, 'O bloqueio evita novas chamadas');
  const stored = JSON.parse(readFileSync(join(b.dir, 'data', 'google-daily-history.local.json'), 'utf8'));
  assert.ok(Date.parse(stored.quotaBlockedUntil) - Date.now() > 50_000_000, 'o horário de liberação fica salvo');
  assert.match(b.state.output, /Cota diária esgotada \(Number of operations for Basic\/Explorer access · DEVELOPER\)/, 'o log informa qual cota esgotou');
  console.log('PASS 2/2: cota esgotada é detectada com uma única chamada, salva até quando dura e bloqueia novas consultas com mensagem clara.');
} finally { await b.stop(); }
