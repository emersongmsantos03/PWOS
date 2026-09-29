// Espelho Agenda do PW OS <-> Google Agenda, contra um Google Agenda simulado.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { scryptSync, randomBytes, createHash, createCipheriv } from 'node:crypto';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '..'), dir = mkdtempSync(join(tmpdir(), 'pwos-calendar-'));
const password = randomBytes(20).toString('hex'), secret = randomBytes(20).toString('hex'), store = join(dir, 'google-calendar.json');
mkdirSync(join(dir, 'data')); symlinkSync(join(root, 'dist'), join(dir, 'dist'));
const write = (name, value) => writeFileSync(join(dir, 'data', name), JSON.stringify(value));
const encrypt = (token) => {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return { version: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64'), updatedAt: new Date().toISOString() };
};
write('users.local.json', [{ id: 'ana', name: 'Ana', email: 'ana@example.invalid', profile: 'EMPLOYEE', roleId: 'agenda', permissionOverrides: {}, salt: 'test', passwordHash: scryptSync(password, 'test', 64).toString('hex'), mustChangePassword: false }]);
write('roles.local.json', [{ id: 'agenda', name: 'Agenda', level: 1, permissions: ['calendar.view', 'calendar.create', 'calendar.edit', 'tasks.view', 'tasks.create', 'tasks.edit', 'tasks.delete'] }]);
write('user-email-connections.local.json', [{ userId: 'ana', method: 'GOOGLE', email: 'ana@example.invalid', senderName: 'Ana', refreshToken: encrypt('fixture-refresh'), scopes: 'openid email https://www.googleapis.com/auth/calendar.events', verifiedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]);
const env = { ...process.env, PW_OS_MASTER_EMAIL: 'master@example.invalid', PW_OS_MASTER_INITIAL_PASSWORD: password, FIREBASE_ENABLED: 'false', INTEGRATION_ENCRYPTION_KEY: secret, GOOGLE_ADS_CLIENT_ID: 'fixture-client', GOOGLE_ADS_CLIENT_SECRET: 'fixture-secret', GCAL_TEST_STORE: store };
const server = spawn(process.execPath, ['--import', join(root, 'scripts/fixtures/google-calendar-fetch.mjs'), join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--config', join(root, 'vite.config.ts'), '--host', '127.0.0.1', '--port', '5198', '--strictPort'], { cwd: dir, env, stdio: ['ignore', 'pipe', 'pipe'] });
let output = ''; server.stdout.on('data', (x) => output += x); server.stderr.on('data', (x) => output += x);
const base = 'http://127.0.0.1:5198/api', wait = (ms) => new Promise((r) => setTimeout(r, ms));
const google = () => JSON.parse(readFileSync(store, 'utf8'));
const editGoogle = (id, change) => { const events = google(); Object.assign(events.find((item) => item.id === id), change, { updated: new Date(Date.now() + 60000).toISOString() }); writeFileSync(store, JSON.stringify(events)); };
try {
  let ready = false;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(base + '/health')).ok) { ready = true; break; } } catch {} await wait(200); }
  assert.ok(ready, output.slice(-2000));
  const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ana@example.invalid', password }) });
  assert.equal(login.status, 200);
  const headers = { Cookie: login.headers.get('set-cookie').split(';')[0], 'Content-Type': 'application/json' };
  const api = async (path, method = 'GET', json) => { const response = await fetch(base + path, { method, headers, body: json ? JSON.stringify(json) : undefined }); return { status: response.status, payload: await response.json() }; };
  const tomorrow = new Date(Date.now() + 86400000); tomorrow.setMinutes(0, 0, 0);
  const hour = 3600000, iso = (ms) => new Date(ms).toISOString();

  // PW OS -> Google: compromisso e tarefa.
  const created = await api('/calendar/events', 'POST', { title: 'Alinhamento interno', startAt: iso(+tomorrow), endAt: iso(+tomorrow + hour) });
  assert.equal(created.status, 201, JSON.stringify(created.payload));
  const task = await api('/tasks', 'POST', { title: 'Enviar relatório', responsibleId: 'ana', dueAt: iso(+tomorrow + 3 * hour) });
  assert.equal(task.status, 201, JSON.stringify(task.payload));
  await wait(2500);
  const pushedEvent = google().find((item) => item.extendedProperties?.private?.pwOsEventId === created.payload.event.id);
  const pushedTask = google().find((item) => item.extendedProperties?.private?.pwOsTaskId === task.payload.task.id);
  assert.ok(pushedEvent, 'Compromisso criado no PW OS aparece no Google');
  assert.ok(pushedTask, 'Tarefa com prazo aparece no Google');
  assert.equal(pushedTask.summary, 'Tarefa: Enviar relatório');
  assert.equal(pushedTask.start.dateTime, iso(+tomorrow + 3 * hour));
  // Reunião agendada com um lead no CRM (tarefa do tipo reunião): chega como reunião, com o local.
  const crmMeeting = await api('/tasks', 'POST', { title: 'Diagnóstico com a Loja Centro', responsibleId: 'ana', dueAt: iso(+tomorrow + 7 * hour), type: 'MEETING', subtype: 'meeting', details: { meetingMode: 'ONLINE', meetingPlatform: 'GOOGLE_MEET', meetingLocation: 'https://meet.google.com/abc-defg-hij' } });
  assert.equal(crmMeeting.status, 201, JSON.stringify(crmMeeting.payload));
  await wait(2500);
  const pushedMeeting = google().find((item) => item.extendedProperties?.private?.pwOsTaskId === crmMeeting.payload.task.id);
  assert.equal(pushedMeeting?.summary, 'Reunião: Diagnóstico com a Loja Centro');
  assert.equal(pushedMeeting.location, 'https://meet.google.com/abc-defg-hij');

  // Formulário envia horário sem fuso: vale o horário de Brasília e o Google aceita.
  const pad = (n) => String(n).padStart(2, '0'), local = new Date(+tomorrow + 2 * hour - 3 * hour);
  const naiveStart = `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(local.getUTCHours())}:00`;
  const naive = await api('/calendar/events', 'POST', { title: 'Sem fuso', startAt: naiveStart, endAt: naiveStart.replace(/T(\d{2})/, (_, h) => 'T' + pad(Number(h) + 1)) });
  assert.equal(naive.status, 201, JSON.stringify(naive.payload));
  assert.equal(naive.payload.event.startAt, iso(+tomorrow + 2 * hour), 'Horário sem fuso é interpretado como Brasília');
  assert.ok(!naive.payload.event.googleSyncError, naive.payload.event.googleSyncError);
  assert.ok(google().some((item) => item.extendedProperties?.private?.pwOsEventId === naive.payload.event.id), 'Compromisso com horário sem fuso chega ao Google');

  // Google -> PW OS: mover compromisso e tarefa, criar evento só no Google.
  editGoogle(pushedEvent.id, { summary: 'Alinhamento (remarcado)', start: { dateTime: iso(+tomorrow + 5 * hour) }, end: { dateTime: iso(+tomorrow + 6 * hour) } });
  editGoogle(pushedTask.id, { start: { dateTime: iso(+tomorrow + 26 * hour) }, end: { dateTime: iso(+tomorrow + 26.5 * hour) } });
  writeFileSync(store, JSON.stringify([...google(), { id: 'onlygoogle', status: 'confirmed', summary: 'Dentista', updated: new Date().toISOString(), start: { dateTime: iso(+tomorrow + 8 * hour) }, end: { dateTime: iso(+tomorrow + 9 * hour) } }]));
  let agenda = await api('/calendar/events');
  assert.equal(agenda.status, 200);
  const moved = agenda.payload.events.find((item) => item.id === created.payload.event.id);
  assert.equal(moved.title, 'Alinhamento (remarcado)', 'Mudança de título no Google volta ao PW OS');
  assert.equal(moved.startAt, iso(+tomorrow + 5 * hour), 'Mudança de horário no Google volta ao PW OS');
  assert.ok(agenda.payload.events.some((item) => item.id === 'google:onlygoogle' && item.title === 'Dentista'), 'Evento criado no Google aparece no PW OS');
  assert.ok(!agenda.payload.events.some((item) => item.title.startsWith('Tarefa:')), 'Tarefa espelhada não aparece duplicada como evento do Google');
  const tasks = await api('/tasks');
  assert.equal(tasks.payload.tasks.find((item) => item.id === task.payload.task.id).dueAt, iso(+tomorrow + 26 * hour), 'Mover a tarefa no Google altera o prazo no PW OS');
  await wait(2500);
  assert.equal(google().find((item) => item.id === pushedTask.id).start.dateTime, iso(+tomorrow + 26 * hour), 'O PW OS não desfaz a mudança feita no Google');

  // PW OS -> Google: editar evento que nasceu no Google.
  const editedGoogle = await api('/calendar/events/google:onlygoogle', 'PATCH', { title: 'Dentista (confirmado)', startAt: iso(+tomorrow + 10 * hour), endAt: iso(+tomorrow + 11 * hour) });
  assert.equal(editedGoogle.status, 200, JSON.stringify(editedGoogle.payload));
  assert.equal(google().find((item) => item.id === 'onlygoogle').summary, 'Dentista (confirmado)');
  assert.equal(google().find((item) => item.id === 'onlygoogle').start.dateTime, iso(+tomorrow + 10 * hour));

  // Concluir e excluir tarefa no PW OS reflete no Google.
  assert.equal((await api('/tasks/' + task.payload.task.id, 'PATCH', { status: 'DONE' })).status, 200);
  await wait(2500);
  assert.equal(google().find((item) => item.id === pushedTask.id).summary, '✓ Tarefa: Enviar relatório');
  assert.equal((await api('/tasks/' + task.payload.task.id, 'DELETE')).status, 200);
  await wait(2500);
  assert.equal(google().find((item) => item.id === pushedTask.id).status, 'cancelled', 'Tarefa excluída sai do Google');

  // Excluir no Google remove o compromisso do PW OS (o cache foi limpo pela edição acima).
  editGoogle(pushedEvent.id, { status: 'cancelled' });
  agenda = await api('/calendar/events');
  assert.ok(!agenda.payload.events.some((item) => item.id === created.payload.event.id), 'Compromisso excluído no Google sai do PW OS');
  // Tarefa excluída no Google continua no PW OS (só perde o vínculo).
  const kept = await api('/tasks', 'POST', { title: 'Revisar criativos', responsibleId: 'ana', dueAt: iso(+tomorrow + 4 * hour) });
  await wait(2500);
  const keptEvent = google().find((item) => item.extendedProperties?.private?.pwOsTaskId === kept.payload.task.id);
  editGoogle(keptEvent.id, { status: 'cancelled' });
  assert.equal((await api('/calendar/events/google:onlygoogle', 'PATCH', { title: 'Dentista (confirmado)' })).status, 200); // limpa o cache da leitura
  await api('/calendar/events');
  assert.ok((await api('/tasks')).payload.tasks.some((item) => item.id === kept.payload.task.id && !item.archivedAt), 'Tarefa continua no PW OS');
  console.log('PASS: agenda do PW OS e Google Agenda espelhados nos dois sentidos (compromissos, tarefas e eventos do Google).');
} finally {
  server.kill('SIGTERM');
  await new Promise((resolve) => { if (server.exitCode !== null || server.signalCode !== null) return resolve(); server.once('exit', resolve); setTimeout(resolve, 3000); });
  rmSync(dir, { recursive: true, force: true });
}
