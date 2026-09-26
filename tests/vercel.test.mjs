import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { mkdtemp, rm, readFile, writeFile, cp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { migrate, config } from '../scripts/migrate-libsql.mjs';
import { libsqlDatabase } from '../build/node/libsql.js';
import { makeHandler } from '../build/node/vercel-handler.js';

async function setup(t) {
  const directory = await mkdtemp(join(tmpdir(), 'beef-vercel-'));
  const url = `file:${join(directory, 'test.db')}`;
  const client = createClient({ url });
  t.after(async () => { client.close(); await rm(directory, { recursive: true, force: true }); });
  await migrate(client);
  const DB = libsqlDatabase(client);
  const handler = makeHandler({ TURSO_DATABASE_URL: url, BEEF_LOCAL_DATABASE: '1' }, () => ({ client, DB }));
  async function api(path, session, body) {
    const request = new Request(`https://prototype.test/api/index?__beef_path=${encodeURIComponent(path)}`, {
      method: body === undefined ? 'GET' : 'POST', headers: { ...(session ? { authorization: `Bearer ${session.token}` } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const response = await handler(request); return { status: response.status, data: await response.json() };
  }
  async function ok(path, session, body) { const response = await api(path, session, body); assert.ok(response.status < 300, JSON.stringify(response)); return response.data; }
  return { directory, client, DB, handler, api, ok };
}

test('libSQL migrations are additive, repeatable and reject changed applied files', async t => {
  const f = await setup(t);
  assert.deepEqual(await migrate(f.client), []);
  const copy = join(f.directory, 'migrations'); await cp('drizzle', copy, { recursive: true });
  const file = join(copy, '0000_lying_stature.sql'); await writeFile(file, (await readFile(file, 'utf8')) + '\n-- changed\n');
  await assert.rejects(migrate(f.client, copy), /Previously applied migration changed/);
  assert.equal((await f.client.execute('SELECT COUNT(*) AS n FROM _beef_migrations')).rows[0].n, 2);
});

test('the Vercel route runs a complete human match with atomic ratings on libSQL', async t => {
  const f = await setup(t);
  const [a, b, judge] = await Promise.all(['A', 'B', 'Judge'].map(name => f.ok('sessions', null, { name })));
  assert.equal((await f.ok('health')).judging, 'not_configured');
  assert.equal((await f.api('me')).status, 401);
  await f.ok('queue', a, { mode: 'contestant' }); await f.ok('queue', b, { mode: 'contestant' });
  const { room } = await f.ok('queue', judge, { mode: 'judge' });
  for (let round = 0; round < 3; round++) {
    await f.ok(`rooms/${room.code}/arguments`, a, { round, content: `A round ${round}` });
    if (round === 0) assert.equal((await f.ok(`rooms/${room.code}`, b)).arguments.length, 0);
    await f.ok(`rooms/${room.code}/arguments`, b, { round, content: `B round ${round}` });
  }
  const verdict = { summary: 'A responded to the main objection.', scores: [a, b].map((p, i) => ({ playerId: p.player.id, reasoning: 8 - i, rebuttal: 8 - i, clarity: 8 - i, feedback: 'Use examples.', bestQuote: '' })) };
  await Promise.all([f.ok(`rooms/${room.code}/verdict`, judge, verdict), f.ok(`rooms/${room.code}/verdict`, judge, verdict)]);
  assert.equal((await f.ok('me', a)).rating.value, 1020);
  assert.equal((await f.ok('me', b)).rating.value, 980);
  assert.equal((await f.ok('me', judge)).priorityTickets, 1);
  assert.equal((await f.ok('ratings/me', a)).history.length, 1);
  assert.equal((await f.ok('leaderboard', a)).players[0].playerId, a.player.id);
  const changed = { ...verdict, scores: [...verdict.scores].map(s => ({ ...s, reasoning: 0 })) };
  await f.ok(`rooms/${room.code}/verdict`, judge, changed);
  assert.equal((await f.ok('me', a)).rating.value, 1020);
});

test('libSQL batches roll back all writes when a later statement fails', async t => {
  const { DB, client } = await setup(t);
  await assert.rejects(DB.batch([
    DB.prepare('INSERT INTO players (id,name,created_at) VALUES (?,?,?)').bind('rollback-test', 'Test', 1),
    DB.prepare('INSERT INTO player_ratings (player_id,rating,games,updated_at) VALUES (?,0,1,1)').bind('rollback-test'),
  ]));
  assert.equal((await client.execute("SELECT COUNT(*) AS n FROM players WHERE id='rollback-test'")).rows[0].n, 0);
});

test('missing configuration fails clearly and Vercel never uses temporary local storage or paid AI', async t => {
  assert.throws(() => config({ TURSO_DATABASE_URL: 'file:/tmp/transient.db', BEEF_LOCAL_DATABASE: '1', VERCEL: '1' }));
  assert.throws(() => config({ TURSO_DATABASE_URL: 'libsql://example.turso.io' }));
  for (const settings of [{}, { TURSO_DATABASE_URL: 'file:/tmp/transient.db', BEEF_LOCAL_DATABASE: '1', VERCEL: '1' }]) {
    const response = await makeHandler(settings)(new Request('https://prototype.test/api/health'));
    assert.equal(response.status, 503); assert.equal((await response.json()).error.code, 'DATABASE_NOT_CONFIGURED');
  }
  const f = await setup(t);
  const handler = makeHandler({ TURSO_DATABASE_URL: 'libsql://test.turso.io', TURSO_AUTH_TOKEN: 'test-only', VERCEL: '1', OPENAI_API_KEY: 'must-not-be-used', OPENAI_MODEL: 'must-not-be-used' }, () => ({ client: f.client, DB: f.DB }));
  const health = await handler(new Request('https://prototype.test/api/health'));
  assert.equal((await health.json()).judging, 'not_configured');
  const session = await f.ok('sessions', null, { name: 'No AI' });
  assert.equal((await f.api('practice', session, {})).data.error.code, 'AI_NOT_CONFIGURED');
});
