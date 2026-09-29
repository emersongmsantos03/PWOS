// Chamados: código sem repetição, prazo com fuso, histórico automático e notificações no sino.
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { scryptSync, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '..'), dir = mkdtempSync(join(tmpdir(), 'pwos-tickets-'));
const password = randomBytes(20).toString('hex');
mkdirSync(join(dir, 'data')); symlinkSync(join(root, 'dist'), join(dir, 'dist'));
const write = (name, value) => writeFileSync(join(dir, 'data', name), JSON.stringify(value));
const person = (id, name) => ({ id, name, email: id + '@example.invalid', profile: 'EMPLOYEE', roleId: 'support', permissionOverrides: {}, salt: 'test', passwordHash: scryptSync(password, 'test', 64).toString('hex'), mustChangePassword: false });
write('users.local.json', [person('ana', 'Ana Lima'), person('bia', 'Bia Souza')]);
write('roles.local.json', [{ id: 'support', name: 'Suporte', level: 1, permissions: ['tickets.view', 'tickets.create', 'tickets.edit', 'tickets.comment', 'tickets.assign', 'tickets.delete'] }]);
write('departments.local.json', [{ id: 'ti', name: 'TI', description: '', active: true, createdAt: new Date().toISOString() }]);
const env = { ...process.env, PW_OS_MASTER_EMAIL: 'master@example.invalid', PW_OS_MASTER_INITIAL_PASSWORD: password, FIREBASE_ENABLED: 'false' };
const server = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--config', join(root, 'vite.config.ts'), '--host', '127.0.0.1', '--port', '5197', '--strictPort'], { cwd: dir, env, stdio: ['ignore', 'pipe', 'pipe'] });
let output = ''; server.stdout.on('data', (x) => output += x); server.stderr.on('data', (x) => output += x);
const base = 'http://127.0.0.1:5197/api', wait = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  let ready = false;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(base + '/health')).ok) { ready = true; break; } } catch {} await wait(200); }
  assert.ok(ready, output.slice(-2000));
  const session = async (id) => { const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: id + '@example.invalid', password }) }); assert.equal(login.status, 200); return { Cookie: login.headers.get('set-cookie').split(';')[0], 'Content-Type': 'application/json' }; };
  const ana = await session('ana'), bia = await session('bia');
  const api = async (headers, path, method = 'GET', json) => { const response = await fetch(base + path, { method, headers, body: json ? JSON.stringify(json) : undefined }); return { status: response.status, payload: await response.json() }; };
  const year = new Date().getFullYear();

  const first = await api(ana, '/tickets', 'POST', { title: 'Acesso ao financeiro', departmentId: 'ti', assigneeId: 'bia', priority: 'HIGH', dueAt: '2020-01-10T09:30' });
  assert.equal(first.status, 201, JSON.stringify(first.payload));
  assert.equal(first.payload.ticket.dueAt, '2020-01-10T12:30:00.000Z', 'Prazo sem fuso é gravado como horário de Brasília');
  const second = await api(ana, '/tickets', 'POST', { title: 'Novo notebook', departmentId: 'ti', assigneeId: 'bia' });
  assert.equal((await api(ana, '/tickets/' + first.payload.ticket.id, 'DELETE')).status, 200);
  const third = await api(ana, '/tickets', 'POST', { title: 'Licença do Figma', departmentId: 'ti', assigneeId: 'bia' });
  assert.equal(second.payload.ticket.code, `CH-${year}-0002`);
  assert.equal(third.payload.ticket.code, `CH-${year}-0003`, 'Código não se repete depois de uma exclusão');

  // Bia recebe o chamado no sino; atraso também aparece.
  const late = await api(ana, '/tickets', 'POST', { title: 'Backup atrasado', departmentId: 'ti', assigneeId: 'bia', dueAt: '2020-01-10T09:30' });
  let bell = await api(bia, '/notifications');
  assert.ok(bell.payload.notifications.some((item) => item.type === 'TICKET_ASSIGNED' && item.targetUrl === '/chamados?ticket=' + third.payload.ticket.id), 'Novo chamado atribuído aparece no sino');
  assert.ok(bell.payload.notifications.some((item) => item.type === 'TICKET_LATE' && item.accountId === late.payload.ticket.id), 'Chamado atrasado aparece no sino');
  assert.ok(!(await api(ana, '/notifications')).payload.notifications.some((item) => item.type === 'TICKET_ASSIGNED'), 'Quem abriu não é notificado do próprio chamado');

  // Histórico automático e notificação para quem abriu.
  const changed = await api(bia, '/tickets/' + third.payload.ticket.id, 'PATCH', { status: 'IN_PROGRESS', priority: 'URGENT' });
  assert.equal(changed.status, 200);
  const history = changed.payload.ticket.comments.at(-1);
  assert.equal(history.kind, 'SYSTEM');
  assert.equal(history.message, 'alterou o status para Em andamento · alterou a prioridade para Urgente');
  bell = await api(ana, '/notifications');
  assert.ok(bell.payload.notifications.some((item) => item.type === 'TICKET_UPDATE' && item.message.startsWith('Bia Souza alterou o status')), 'Quem abriu é avisado da mudança');

  // Menção avisa a pessoa mencionada.
  assert.equal((await api(bia, '/tickets/' + third.payload.ticket.id + '/comments', 'POST', { message: '@Ana Lima pode confirmar o e-mail?' })).status, 201);
  bell = await api(ana, '/notifications');
  assert.ok(bell.payload.notifications.some((item) => item.type === 'TICKET_MENTION' && item.title === 'Bia Souza mencionou você'), 'Menção aparece no sino');
  console.log('PASS: chamados com código único, prazo com fuso, histórico automático e notificações (atribuição, atraso, atualização e menção).');
} finally {
  server.kill('SIGTERM');
  await new Promise((resolve) => { if (server.exitCode !== null || server.signalCode !== null) return resolve(); server.once('exit', resolve); setTimeout(resolve, 3000); });
  rmSync(dir, { recursive: true, force: true });
}
