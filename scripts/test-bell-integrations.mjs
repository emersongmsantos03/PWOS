// Sino de notificações ligado a Creative Ops, CRM e Propostas.
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { scryptSync, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '..'), dir = mkdtempSync(join(tmpdir(), 'pwos-bell-'));
const password = randomBytes(20).toString('hex');
mkdirSync(join(dir, 'data')); symlinkSync(join(root, 'dist'), join(dir, 'dist'));
const write = (name, value) => writeFileSync(join(dir, 'data', name), JSON.stringify(value));
const person = (id, name) => ({ id, name, email: id + '@example.invalid', profile: 'EMPLOYEE', roleId: 'team', permissionOverrides: {}, salt: 'test', passwordHash: scryptSync(password, 'test', 64).toString('hex'), mustChangePassword: false });
write('users.local.json', [person('ana', 'Ana Lima'), person('bia', 'Bia Souza')]);
write('roles.local.json', [{ id: 'team', name: 'Equipe', level: 1, permissions: ['tasks.view', 'tasks.create', 'tasks.edit', 'tasks.assign', 'opportunities.view'] }]);
const now = new Date().toISOString(), tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const proposal = (id, status, extra) => ({ id, title: 'Plano ' + id, value: 1500, status, validUntil: '', notes: '', createdBy: 'ana', createdAt: now, ...extra });
write('crm-opportunities.local.json', [{
  id: 'lead1', name: 'Loja Centro', company: 'Loja Centro Ltda', email: '', phone: '', whatsapp: '', serviceInterest: 'Tráfego', potentialValue: 0,
  temperature: 'WARM', priority: 'MEDIUM', responsibleId: 'bia', responsibleName: 'Bia Souza', teamIds: [], tags: [], pipelineId: 'p', stageId: 's',
  status: 'OPEN', nextAction: 'Ligar para fechar', nextActionAt: '2020-01-10T09:30', stageEnteredAt: now, createdAt: now, updatedAt: now, activities: [],
  proposals: [proposal('assinada', 'ACCEPTED', { signedAt: now, customer: { name: 'Carlos', email: 'c@example.invalid', phone: '', document: '' } }), proposal('vencendo', 'SENT', { validUntil: tomorrow })],
}]);
const env = { ...process.env, PW_OS_MASTER_EMAIL: 'master@example.invalid', PW_OS_MASTER_INITIAL_PASSWORD: password, FIREBASE_ENABLED: 'false' };
const server = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--config', join(root, 'vite.config.ts'), '--host', '127.0.0.1', '--port', '5196', '--strictPort'], { cwd: dir, env, stdio: ['ignore', 'pipe', 'pipe'] });
let output = ''; server.stdout.on('data', (x) => output += x); server.stderr.on('data', (x) => output += x);
const base = 'http://127.0.0.1:5196/api', wait = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  let ready = false;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(base + '/health')).ok) { ready = true; break; } } catch {} await wait(200); }
  assert.ok(ready, output.slice(-2000));
  const session = async (id) => { const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: id + '@example.invalid', password }) }); assert.equal(login.status, 200); return { Cookie: login.headers.get('set-cookie').split(';')[0], 'Content-Type': 'application/json' }; };
  const ana = await session('ana'), bia = await session('bia');
  const api = async (headers, path, method = 'GET', json) => { const response = await fetch(base + path, { method, headers, body: json ? JSON.stringify(json) : undefined }); return { status: response.status, payload: await response.json() }; };

  const task = await api(ana, '/tasks', 'POST', { title: 'Criar anúncio de outubro', responsibleId: 'bia', dueAt: '2030-10-01T10:00' });
  assert.equal(task.status, 201, JSON.stringify(task.payload));
  assert.equal(task.payload.task.dueAt, '2030-10-01T13:00:00.000Z', 'Prazo da demanda é gravado com fuso de Brasília');
  const comment = await api(ana, `/tasks/${task.payload.task.id}/comments`, 'POST', { message: '@Bia Souza pode revisar o texto?' });
  assert.equal(comment.status, 201, JSON.stringify(comment.payload));

  const bell = (await api(bia, '/notifications')).payload.notifications, find = (type) => bell.find((item) => item.type === type);
  assert.ok(find('TASK_ASSIGNED'), 'Demanda atribuída por outra pessoa aparece no sino');
  assert.ok(find('TASK_MENTION'), 'Menção em demanda aparece no sino');
  assert.equal(find('CRM_NEXT_ACTION')?.createdAt, '2020-01-10T12:30:00.000Z', 'Próxima ação do CRM (com fuso corrigido) aparece no sino');
  assert.equal(find('CRM_NEXT_ACTION').targetUrl, '/crm?opportunity=lead1');
  assert.ok(find('PROPOSAL_SIGNED')?.message.includes('Carlos assinou'), 'Proposta assinada aparece no sino');
  assert.ok(find('PROPOSAL_EXPIRING'), 'Proposta perto de vencer aparece no sino');
  assert.ok(!(await api(ana, '/notifications')).payload.notifications.some((item) => item.type === 'TASK_ASSIGNED'), 'Quem criou a demanda não é avisado');
  console.log('PASS: sino avisa demandas atribuídas e menções (Creative Ops), próxima ação do CRM e propostas assinadas ou vencendo.');
} finally {
  server.kill('SIGTERM');
  await new Promise((resolve) => { if (server.exitCode !== null || server.signalCode !== null) return resolve(); server.once('exit', resolve); setTimeout(resolve, 3000); });
  rmSync(dir, { recursive: true, force: true });
}
