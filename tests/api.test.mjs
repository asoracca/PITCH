import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import { database } from './d1.mjs';

function setup(t, config = {}) {
  const DB = database(); t.after(() => DB.sqlite.close());
  const env = { DB, ...config };
  async function api(path, session, body, method = body === undefined ? 'GET' : 'POST', headers = {}) {
    const response = await worker.fetch(new Request(`https://beef.test/api${path}`, { method,
      headers: { ...(session ? { authorization: `Bearer ${session.token}` } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body) }), env);
    return { status: response.status, data: response.status === 204 ? null : await response.json(), headers: response.headers };
  }
  async function ok(path, session, body, method) {
    const response = await api(path, session, body, method);
    assert.ok(response.status < 300, JSON.stringify(response)); return response.data;
  }
  const player = async name => ok('/sessions', null, { name });
  async function publicMatch() {
    const a = await player('A'), b = await player('B'), j = await player('Judge');
    await ok('/queue', a, { mode: 'contestant' }); await ok('/queue', b, { mode: 'contestant' });
    const matched = await ok('/queue', j, { mode: 'judge' }); assert.equal(matched.status, 'matched');
    return { a, b, j, room: matched.room };
  }
  async function finishRounds(room, a, b) {
    for (let round = 0; round < 3; round++) {
      await ok(`/rooms/${room.code}/arguments`, a, { round, content: `A argument ${round}` });
      await ok(`/rooms/${room.code}/arguments`, b, { round, content: `B argument ${round}` });
    }
  }
  const verdict = (a, b) => ({ summary: 'A explained their case more clearly.', scores: [a, b].map((p, i) => ({ playerId: p.player.id, reasoning: 8 - i, rebuttal: 8 - i, clarity: 8 - i, feedback: 'Use concrete examples.', bestQuote: 'invented quote' })) });
  return { DB, env, api, ok, player, publicMatch, finishRounds, verdict };
}

test('sessions are hashed, revocable, isolated and origin checked', async t => {
  const f = setup(t); const a = await f.player('Alice');
  assert.equal((await f.api('/me')).status, 401);
  assert.notEqual(f.DB.sqlite.prepare('SELECT token_hash FROM sessions').get().token_hash, a.token);
  assert.equal((await f.api('/me', a, undefined, 'GET', { origin: 'https://evil.test' })).status, 403);
  assert.equal((await f.api('/sessions', a, undefined, 'DELETE')).status, 204);
  assert.equal((await f.api('/me', a)).status, 401);
});

test('private rooms conceal current arguments, enforce rounds, and block outsiders', async t => {
  const f = setup(t); const a = await f.player('A'), b = await f.player('B'), stranger = await f.player('C');
  const room = await f.ok('/rooms', a, { topic: 'Custom debate topic', format: 'blitz' });
  await f.ok(`/rooms/${room.code}/join`, b, {});
  assert.equal((await f.api(`/rooms/${room.code}`, stranger)).status, 404);
  assert.equal((await f.api(`/rooms/${room.code}/start`, b, {})).status, 403);
  await f.ok(`/rooms/${room.code}/start`, a, {});
  const submitted = await f.ok(`/rooms/${room.code}/arguments`, a, { round: 0, content: 'Opening case.' });
  assert.equal(submitted.arguments.length, 1);
  assert.equal((await f.ok(`/rooms/${room.code}`, b)).arguments.length, 0);
  assert.equal((await f.api(`/rooms/${room.code}/arguments`, a, { round: 0, content: 'Changed case.' })).status, 409);
  assert.equal((await f.api(`/rooms/${room.code}/arguments`, b, { round: 1, content: 'Too soon.' })).status, 409);
  await f.ok(`/rooms/${room.code}/arguments`, b, { round: 0, content: 'Response.' });
  assert.equal((await f.ok(`/rooms/${room.code}`, b)).round, 1);
  f.DB.sqlite.prepare('UPDATE rooms SET deadline=? WHERE id=?').run(Date.now() - 1, room.id);
  await Promise.all([f.ok(`/rooms/${room.code}/advance`, a, {}), f.ok(`/rooms/${room.code}/advance`, b, {})]);
  assert.equal((await f.ok(`/rooms/${room.code}`, a)).round, 2);
});

test('human results, scores and judge tickets are atomic and idempotent', async t => {
  const f = setup(t); const { a, b, j, room } = await f.publicMatch();
  assert.equal(room.kind, 'public'); assert.equal(room.yourRole, 'judge'); assert.equal(room.yourSide, null);
  assert.equal(new Set(room.players.map(p => p.id)).size, 3);
  assert.equal((await f.api(`/rooms/${room.code}/arguments`, j, { round: 0, content: 'Cheat' })).status, 403);
  await f.finishRounds(room, a, b);
  assert.equal((await f.api(`/rooms/${room.code}/judge`, a, {})).data.error.code, 'HUMAN_JUDGE_ASSIGNED');
  assert.equal((await f.api(`/rooms/${room.code}/verdict`, a, f.verdict(a, b))).status, 403);
  await Promise.all([f.ok(`/rooms/${room.code}/verdict`, j, f.verdict(a, b)), f.ok(`/rooms/${room.code}/verdict`, j, f.verdict(a, b))]);
  const result = await f.ok(`/rooms/${room.code}`, a);
  assert.equal(result.status, 'finished'); assert.equal(result.verdict.winnerId, a.player.id);
  assert.equal(result.verdict.scores[0].bestQuote, '');
  assert.equal((await f.ok('/me', j)).priorityTickets, 1);
  assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM score_events').get().n, 2);
  const rematch = await f.ok(`/rooms/${room.code}/rematch`, a, {});
  assert.notEqual(rematch.yourSide, result.yourSide);
  assert.equal((await f.api(`/rooms/${room.code}/rematch`, j, {})).status, 403);
  const stranger = await f.player('Stranger');
  assert.equal((await f.api(`/rooms/${rematch.code}/join`, stranger, {})).status, 403);
  // A ticket is held during waiting/cancellation, then consumed only at successful matching.
  await f.ok('/queue', j, { mode: 'priority' }); assert.equal((await f.ok('/me', j)).priorityTickets, 1);
  await f.ok('/queue', j, undefined, 'DELETE'); assert.equal((await f.ok('/me', j)).priorityTickets, 1);
  await f.ok('/queue', a, { mode: 'contestant' }); await f.ok('/queue', b, { mode: 'contestant' });
  await f.ok('/queue', j, { mode: 'priority' });
  const next = await f.ok('/queue', stranger, { mode: 'judge' });
  assert.ok(next.room.players.some(p => p.id === j.player.id && p.role === 'contestant'));
  assert.equal((await f.ok('/me', j)).priorityTickets, 0);
});

test('quick queue can fill all roles, timeout is explicit, and unearned priority is rejected', async t => {
  const f = setup(t); const players = await Promise.all(['A', 'B', 'C'].map(f.player));
  assert.equal((await f.api('/queue', players[0], { mode: 'priority' })).status, 409);
  await f.ok('/queue', players[0], {});
  f.DB.sqlite.prepare('UPDATE queue_entries SET expires_at=0 WHERE player_id=?').run(players[0].player.id);
  assert.equal((await f.ok('/queue', players[0])).status, 'timed_out');
  for (const p of players) await f.ok('/queue', p, {});
  const q = await f.ok('/queue', players[0]); assert.equal(q.status, 'matched');
  assert.equal(q.room.players.filter(p => p.role === 'judge').length, 1);
  assert.equal((await f.api('/queue', players[0], {})).status, 409);
  const cancelled = await f.ok('/queue', players[0], undefined, 'DELETE'); assert.equal(cancelled.status, 'matched');
});

test('voice messages only reach intended room member; AI cannot pretend to be configured', async t => {
  const f = setup(t); const { a, b, j, room } = await f.publicMatch();
  const outsider = await f.player('Outsider');
  const signal = { targetId: b.player.id, kind: 'offer', payload: { type: 'offer', sdp: 'v=0\r\n' } };
  await f.ok(`/rooms/${room.code}/signals`, a, signal);
  assert.equal((await f.ok(`/rooms/${room.code}/signals`, b)).signals.length, 1);
  assert.equal((await f.ok(`/rooms/${room.code}/signals`, j)).signals.length, 0);
  assert.equal((await f.api(`/rooms/${room.code}/signals`, outsider)).status, 404);
  assert.equal((await f.api(`/rooms/${room.code}/signals`, a, { ...signal, targetId: outsider.player.id })).status, 400);
  assert.equal((await f.api('/practice', a, {})).data.error.code, 'AI_NOT_CONFIGURED');
  assert.equal((await f.ok('/voice', a)).voiceChangerImplemented, false);
  assert.equal((await f.ok('/tutorials')).tutorials.length, 3);
});

test('AI practice uses completed rounds only and malformed AI verdicts do not finish matches', async t => {
  const f = setup(t, { OPENAI_API_KEY: 'test-only', OPENAI_MODEL: 'test-model' });
  const a = await f.player('Practice'); const room = await f.ok('/practice', a, {});
  const original = globalThis.fetch; let input;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (_url, options) => {
    input = JSON.parse(options.body);
    return Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: 'A friendly opposing argument.' }] }] });
  };
  await f.ok(`/rooms/${room.code}/arguments`, a, { round: 0, content: 'Hidden current argument' });
  await f.ok(`/rooms/${room.code}/bot-turn`, a, {});
  assert.ok(!input.input.includes('Hidden current argument'));
  for (let round = 1; round < 3; round++) {
    await f.ok(`/rooms/${room.code}/bot-turn`, a, {});
    await f.ok(`/rooms/${room.code}/arguments`, a, { round, content: `Practice argument ${round}` });
  }
  globalThis.fetch = async () => Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: '{"scores":[]}' }] }] });
  assert.equal((await f.api(`/rooms/${room.code}/judge`, a, {})).status, 502);
  assert.equal((await f.ok(`/rooms/${room.code}`, a)).status, 'judging');
  assert.equal(f.DB.sqlite.prepare('SELECT judge_lease FROM rooms WHERE id=?').get(room.id).judge_lease, null);
  assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM score_events').get().n, 0);
});
