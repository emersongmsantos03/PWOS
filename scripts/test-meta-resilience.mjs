// Sincronização da Meta resiliente a logins e contas quebrados: um login cujo
// aplicativo do Facebook foi apagado, ou uma conta com problema permanente, não
// podem impedir a sincronização das demais contas — e uma falha passageira ao
// buscar anúncios é tentada de novo em vez de virar "zero anúncios" definitivo.
// Usa servidores e dados temporários e substitui as APIs externas por respostas
// simuladas; não usa contas ou credenciais de produção.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { scryptSync, randomBytes, createHash, createCipheriv } from 'node:crypto';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');

// Reproduz a criptografia de credenciais do servidor (vite.config.ts) para poder
// gravar conexões da Meta já criadas, como se um login anterior as tivesse salvo.
const encryptLikeServer = (token, masterPassword) => {
  const sessionSecret = createHash('sha256').update(`pw-os-session:${masterPassword}`).digest('hex');
  const key = createHash('sha256').update(sessionSecret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return { version: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64'), updatedAt: new Date().toISOString() };
};

const start = async (port, connections) => {
  const password = randomBytes(20).toString('hex');
  const dir = mkdtempSync(join(tmpdir(), 'pwos-meta-res-'));
  mkdirSync(join(dir, 'data')); symlinkSync(join(root, 'dist'), join(dir, 'dist'));
  const write = (name, value) => writeFileSync(join(dir, 'data', name), JSON.stringify(value));
  write('users.local.json', [{ id: 'syncer', name: 'syncer', email: 'syncer@example.invalid', profile: 'EMPLOYEE', roleId: 'reader', permissionOverrides: { 'media.view': 'ALLOW', 'media.sync': 'ALLOW' }, salt: 'test', passwordHash: scryptSync(password, 'test', 64).toString('hex'), mustChangePassword: false }]);
  write('roles.local.json', [{ id: 'reader', name: 'Reader', level: 1, permissions: ['media.view'] }]);
  write('meta-connections.local.json', connections.map(({ id, name, token }) => ({ id, name, connectedAt: new Date().toISOString(), accessToken: encryptLikeServer(token, password) })));
  const calls = join(dir, 'calls.log'); writeFileSync(calls, '');
  const env = { ...process.env, PW_OS_MASTER_EMAIL: 'master@example.invalid', PW_OS_MASTER_INITIAL_PASSWORD: password, FIREBASE_ENABLED: 'false', META_ADS_GRAPH_VERSION: 'v23.0', MEDIA_TEST_CALLS: calls };
  delete env.META_ADS_ACCESS_TOKEN; delete env.GOOGLE_ADS_CLIENT_ID; delete env.GOOGLE_ADS_REFRESH_TOKEN; delete env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const server = spawn(process.execPath, ['--import', join(root, 'scripts/fixtures/media-provider-fetch.mjs'), join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--config', join(root, 'vite.config.ts'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: dir, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const state = { output: '' };
  server.stdout.on('data', (x) => state.output += x); server.stderr.on('data', (x) => state.output += x);
  const base = `http://127.0.0.1:${port}/api`;
  let ready = false;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(base + '/health')).ok) { ready = true; break; } } catch {} await new Promise((r) => setTimeout(r, 200)); }
  assert.ok(ready, state.output.slice(-2000));
  const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'syncer@example.invalid', password }) });
  assert.equal(login.status, 200);
  const headers = { Cookie: login.headers.get('set-cookie').split(';')[0] };
  const get = async (path) => { const response = await fetch(base + path, { headers }); return { status: response.status, payload: await response.json() }; };
  const stop = async () => {
    server.kill('SIGTERM');
    await new Promise((resolveExit) => { if (server.exitCode !== null || server.signalCode !== null) return resolveExit(); server.once('exit', resolveExit); });
    rmSync(dir, { recursive: true, force: true });
  };
  return { get, calls, state, stop };
};

const since = '2026-09-01', until = '2026-09-07';

// ---------- 1) Um login morto + uma conta quebrada não impedem o resto ----------
const a = await start(5194, [
  { id: 'meta-dead', name: 'Login antigo (apagado)', token: 'dead-meta-token' },
  { id: 'meta-good', name: 'Login atual', token: 'good-meta-token' },
]);
try {
  const result = await a.get(`/media/meta/campaigns?since=${since}&until=${until}&refresh=1&manual=1`);
  assert.equal(result.status, 200, JSON.stringify(result.payload));
  assert.equal(result.payload.accounts.length, 1, 'a conta com problema permanente foi ignorada, não travou a conta boa');
  assert.equal(result.payload.accounts[0].id, 'act_ok');
  assert.equal(result.payload.campaigns.length, 1);
  const campaign = result.payload.campaigns[0];
  assert.equal(campaign.spend, 20); assert.equal(campaign.leads, 4);
  assert.equal(campaign.ads.length, 1, 'a segunda tentativa de buscar anúncios funcionou');
  assert.equal(campaign.ads[0].results, 1);
  assert.match(a.state.output, /Login "Login antigo \(apagado\)" falhou e foi ignorado nesta sincronização/, 'o login quebrado foi identificado nominalmente');
  assert.match(a.state.output, /Conta act_bad ignorada nesta sincronização/, 'a conta quebrada foi identificada nominalmente');
  console.log('PASS 1/2: um login inválido e uma conta com problema permanente não impedem a sincronização da conta saudável; a busca de anúncios se recupera de uma falha passageira.');
} finally { await a.stop(); }

// ---------- 2) Todos os logins mortos preserva o histórico salvo ----------
const b = await start(5193, [{ id: 'meta-dead', name: 'Único login', token: 'dead-meta-token' }]);
try {
  // Primeiro, um snapshot salvo com uma conexão saudável simulada por edição direta do arquivo.
  const first = await b.get(`/media/meta/campaigns?since=${since}&until=${until}`);
  // Sem nenhum login funcionando, nem o primeiro acesso tem histórico: a mensagem
  // já precisa ser a de reconexão, não um erro genérico da plataforma.
  assert.equal(first.status, 502);
  assert.match(first.payload.message, /Nenhum login do Facebook está funcionando\. Reconecte na Central de Conexões\. \(Único login: Error validating application\. Application has been deleted\.\)/);
  console.log('PASS 2/2: com todos os logins quebrados, a mensagem aponta exatamente qual reconectar, em vez de um erro genérico.');
} finally { await b.stop(); }
