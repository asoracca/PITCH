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
  async function publicMatch(participants) {
    const { a, b, j } = participants ?? { a: await player('A'), b: await player('B'), j: await player('Judge') };
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
  assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM rating_events').get().n, 2);
  assert.equal((await f.ok('/me', a)).rating.value, 1020);
  assert.equal((await f.ok('/me', b)).rating.value, 980);
  assert.equal((await f.ok('/me', a)).rating.games, 1);
  assert.equal((await f.ok('/me', j)).rating.games, 0);
  assert.deepEqual(result.verdict.ratingChanges.map(c => c.delta), [20, -20]);
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
  globalThis.fetch = async () => Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify({
    summary: 'Both players supported their claims.', scores: ['A', 'B'].map(label => ({ label, reasoning: 7, rebuttal: 7, clarity: 7, feedback: 'Add examples.', bestQuote: '' })),
  }) }] }] });
  assert.equal((await f.ok(`/rooms/${room.code}/judge`, a, {})).status, 'finished');
  assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM rating_events').get().n, 0);
  assert.equal((await f.ok('/me', a)).rating.value, 1000);
  assert.equal((await f.ok('/me', a)).rating.games, 0);
});

test('Beef placements, results, personal history and leaderboard stay consistent', async t => {
  const f = setup(t); const participants = { a: await f.player('A'), b: await f.player('B'), j: await f.player('Judge') };
  const { a, b, j } = participants;
  assert.deepEqual((await f.ok('/me', a)).rating, { value: 1000, games: 0, provisional: true, placementGamesRemaining: 5, version: 'br-v1' });
  assert.equal((await f.ok('/ratings/rules')).scoreMarginAffectsRating, false);
  assert.equal((await f.api('/ratings/me')).status, 401);
  for (let game = 0; game < 6; game++) {
    const { room } = await f.publicMatch(participants);
    await f.finishRounds(room, a, b);
    const finished = await f.ok(`/rooms/${room.code}/verdict`, j, f.verdict(a, b));
    const changes = finished.verdict.ratingChanges;
    assert.equal(changes[0].k, game < 5 ? 40 : 24);
    assert.equal(changes[0].gamesAfter, game + 1);
    assert.equal(changes[0].provisional, game < 4);
    assert.equal(changes[0].delta, -changes[1].delta);
  }
  const own = await f.ok('/ratings/me?limit=3', a);
  assert.equal(own.rating.games, 6); assert.equal(own.rating.provisional, false);
  assert.equal(own.history.length, 3); assert.deepEqual(own.history.map(e => e.gamesAfter), [6, 5, 4]);
  assert.equal(own.history[0].after, own.rating.value);
  assert.ok(own.history.every(e => e.opponentId === b.player.id));
  assert.equal((await f.ok('/ratings/me', j)).history.length, 0);
  assert.equal((await f.api('/ratings/me?limit=51', a)).status, 400);
  const leaderboard = await f.ok('/leaderboard', a);
  assert.equal(leaderboard.ranking, 'beef_rating'); assert.equal(leaderboard.players.length, 2);
  assert.equal(leaderboard.players[0].playerId, a.player.id); assert.equal(leaderboard.players[0].rating, own.rating.value);
  assert.equal(leaderboard.players[0].wins, 6); assert.equal(leaderboard.players[1].losses, 6);
});

test('draws are rated once; empty and private games have no rating effect', async t => {
  const f = setup(t); const { a, b, j, room } = await f.publicMatch();
  await f.finishRounds(room, a, b);
  const tied = f.verdict(a, b); Object.assign(tied.scores[1], { reasoning: 8, rebuttal: 8, clarity: 8 });
  const finished = await f.ok(`/rooms/${room.code}/verdict`, j, tied);
  assert.equal(finished.verdict.winnerId, null);
  assert.ok(finished.verdict.ratingChanges.every(e => e.delta === 0 && e.result === 'draw'));
  assert.equal((await f.ok('/me', a)).rating.games, 1);
  const empty = (await f.publicMatch({ a, b, j })).room;
  f.DB.sqlite.prepare("UPDATE rooms SET status='judging',round=2 WHERE id=?").run(empty.id);
  assert.equal((await f.ok(`/rooms/${empty.code}/verdict`, j, f.verdict(a, b))).status, 'cancelled');
  assert.equal((await f.ok('/me', a)).rating.games, 1);
  assert.equal((await f.ok('/me', j)).priorityTickets, 1);
  const privateRoom = await f.ok('/rooms', a, {});
  await f.ok(`/rooms/${privateRoom.code}/join`, b, {}); await f.ok(`/rooms/${privateRoom.code}/start`, a, {});
  await f.finishRounds(privateRoom, a, b);
  assert.equal((await f.api(`/rooms/${privateRoom.code}/verdict`, j, tied)).status, 404);
  assert.equal((await f.api(`/rooms/${privateRoom.code}/verdict`, a, tied)).status, 403);
  assert.equal((await f.ok('/me', a)).rating.games, 1);
});

test('a rating write failure rolls back the verdict, scores, ratings and judge reward together', async t => {
  const f = setup(t); const { a, b, j, room } = await f.publicMatch(); await f.finishRounds(room, a, b);
  f.DB.sqlite.exec("CREATE TRIGGER fail_rating BEFORE INSERT ON rating_events BEGIN SELECT RAISE(ABORT, 'test failure'); END");
  assert.equal((await f.api(`/rooms/${room.code}/verdict`, j, f.verdict(a, b))).status, 503);
  assert.equal((await f.ok(`/rooms/${room.code}`, a)).status, 'judging');
  for (const table of ['score_events', 'rating_events', 'player_ratings', 'judge_rewards']) {
    assert.equal(f.DB.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n, 0);
  }
  f.DB.sqlite.exec('DROP TRIGGER fail_rating');
  await f.ok(`/rooms/${room.code}/verdict`, j, f.verdict(a, b));
  assert.equal((await f.ok('/me', a)).rating.value, 1020);
});

test('stale rating snapshots cannot overwrite a newer rating', async t => {
  const f = setup(t); const { a, b, j, room } = await f.publicMatch(); await f.finishRounds(room, a, b);
  const batch = f.DB.batch;
  f.DB.batch = async statements => {
    if (statements.some(s => s.query.includes("SET status='finished'"))) {
      f.DB.batch = batch;
      f.DB.sqlite.prepare('INSERT INTO player_ratings (player_id,rating,games,updated_at) VALUES (?,1100,1,?)').run(a.player.id, Date.now());
    }
    return batch(statements);
  };
  const stale = await f.api(`/rooms/${room.code}/verdict`, j, f.verdict(a, b));
  assert.equal(stale.status, 409); assert.equal(stale.data.error.code, 'RATING_CHANGED');
  assert.equal((await f.ok(`/rooms/${room.code}`, a)).status, 'judging');
  assert.equal((await f.ok('/me', a)).rating.value, 1100);
  assert.equal(f.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM rating_events').get().n, 0);
  await f.ok(`/rooms/${room.code}/verdict`, j, f.verdict(a, b));
  assert.equal((await f.ok('/me', a)).rating.games, 2);
});
