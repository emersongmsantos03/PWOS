// Loaded only by the isolated calendar sync test; no real Google calls are allowed.
// Simula o Google Agenda com os eventos gravados em GCAL_TEST_STORE, para que o teste
// possa "editar pelo Google" alterando esse arquivo.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const originalFetch = globalThis.fetch;
const store = process.env.GCAL_TEST_STORE;
const load = () => existsSync(store) ? JSON.parse(readFileSync(store, 'utf8')) : [];
const save = (events) => writeFileSync(store, JSON.stringify(events, null, 2));
const reply = (payload, status = 200) => new Response(JSON.stringify(payload), { status });
const stamp = () => new Date(Date.now() + 1).toISOString();
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return originalFetch(input, init);
  if (url.hostname === 'oauth2.googleapis.com' && url.pathname === '/token') return reply({ access_token: 'fixture-access' });
  const match = url.hostname === 'www.googleapis.com' && url.pathname.match(/^\/calendar\/v3\/calendars\/primary\/events(?:\/([^/]+))?$/);
  if (!match) throw new Error('Unexpected external call in calendar test: ' + url.href);
  const events = load(), id = match[1] && decodeURIComponent(match[1]), method = init.method || 'GET';
  const body = init.body ? JSON.parse(init.body) : {};
  // Como o Google real: horário sem fuso e sem timeZone é recusado.
  const naive = (time) => time?.dateTime && !/(Z|[+-]\d{2}:\d{2})$/.test(time.dateTime) && !time.timeZone;
  if ((method === 'POST' || method === 'PATCH') && (naive(body.start) || naive(body.end))) return reply({ error: { message: 'Bad Request' } }, 400);
  // Como o Google real: evento excluído volta na lista só com id, status e updated.
  if (!id && method === 'GET') return reply({ items: events.map((item) => item.status === 'cancelled' ? { id: item.id, status: 'cancelled', updated: item.updated } : item) });
  if (!id && method === 'POST') {
    const event = { ...body, id: randomUUID().replace(/-/g, ''), status: body.status || 'confirmed', updated: stamp(), htmlLink: 'https://calendar.google.com/fixture' };
    save([...events, event]);
    return reply(event);
  }
  const event = events.find((item) => item.id === id);
  if (!event) return reply({ error: { message: 'Not Found' } }, 404);
  if (method === 'PATCH') { Object.assign(event, body, { updated: stamp() }); save(events); return reply(event); }
  if (method === 'DELETE') { Object.assign(event, { status: 'cancelled', updated: stamp() }); save(events); return new Response(null, { status: 204 }); }
  return reply({ error: { message: 'Unsupported' } }, 400);
};
