import { ApiError, fail, jsonBody, sha256, textField } from './http';
import { Store, chooseTopic } from './store';
import { judgeRoom } from './judge';
import { PHASES, ROUND_SECONDS, TOPICS, FORMATS, TUTORIALS } from './topics';
import { credits, enqueue, formatFrom, queueStatus } from './matchmaking';
import { humanVerdict } from './human-judge';
import { createPractice, botTurn } from './practice';
import { receiveSignals, sendSignal, voiceConfig } from './voice';
import { RATING_RULES, ratingHistory, ratingSnapshot, summarizeRating } from './ratings';
import type { Env } from './types';

function method(request: Request, expected: string) {
  if (request.method !== expected) fail(405, 'METHOD_NOT_ALLOWED', `Use ${expected} for this endpoint.`);
}
function limitParam(url: URL): number {
  const value = url.searchParams.get('limit') ?? '20';
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 50) fail(400, 'INVALID_INPUT', 'limit must be an integer from 1 to 50.');
  return Number(value);
}
async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url); const path = url.pathname.replace(/\/$/, '') || '/';
  const store = new Store(env);
  if (path === '/' || path === '/api') {
    method(request, 'GET');
    return Response.json({ service: 'Beef debate backend', version: '1.1.0', health: '/api/health', topics: '/api/topics',
      documentation: 'https://github.com/cerlina-chen/Beef/blob/backend/quick-match/docs/backend.md',
      features: ['quick match', 'judge/contestant/priority queues', 'human verdicts', 'Beef Rating and rating history', 'custom private rooms', 'tutorials', 'AI practice integration', 'WebRTC signaling'],
      aiJudging: env.OPENAI_API_KEY && env.OPENAI_MODEL ? 'configured' : 'awaiting API key and model',
      frontend: 'This deployment serves the API. The existing Next.js frontend remains in beef/.' });
  }
  if (path === '/api/health') {
    method(request, 'GET'); await store.sql('SELECT COUNT(*) AS count FROM players').first();
    return Response.json({ status: 'ok', database: 'ready', judging: env.OPENAI_API_KEY && env.OPENAI_MODEL ? 'configured' : 'not_configured', serverTime: Date.now() });
  }
  if (path === '/api/topics') {
    method(request, 'GET'); return Response.json({ topics: TOPICS, formats: FORMATS, rules: { phases: PHASES, roundSeconds: ROUND_SECONDS,
      maxArgumentLength: 600, playersPerRoom: 2, rubric: { reasoning: 40, rebuttal: 40, clarity: 20 } } });
  }
  if (path === '/api/tutorials') { method(request, 'GET'); return Response.json({ tutorials: TUTORIALS }); }
  if (path === '/api/ratings/rules') { method(request, 'GET'); return Response.json(RATING_RULES); }
  if (path === '/api/sessions' && request.method === 'POST') {
    const ip = request.headers.get('cf-connecting-ip') ?? 'local';
    await store.limit(`session:${await sha256(ip)}`, 20, 3_600_000);
    const body = await jsonBody(request); const name = textField(body.name, 'Name', 24);
    if (/[\r\n\t]/.test(name)) fail(400, 'INVALID_INPUT', 'Name must fit on one line.');
    return Response.json(await store.createSession(name), { status: 201 });
  }
  const player = await store.authenticate(request);
  await store.limit(`request:${player.id}`, 120);
  if (path === '/api/sessions') {
    method(request, 'DELETE');
    await store.sql('DELETE FROM sessions WHERE token_hash=?', await sha256(request.headers.get('authorization')!.slice(7))).run();
    return new Response(null, { status: 204 });
  }
  if (path === '/api/me') {
    method(request, 'GET');
    return Response.json({ player, priorityTickets: await credits(store, player.id), rating: summarizeRating(await ratingSnapshot(store, player.id)) });
  }
  if (path === '/api/ratings/me') {
    method(request, 'GET'); const limit = limitParam(url);
    return Response.json({ rating: summarizeRating(await ratingSnapshot(store, player.id)), history: await ratingHistory(store, player.id, limit) });
  }
  if (path === '/api/voice') { method(request, 'GET'); return Response.json(voiceConfig(store)); }
  if (path === '/api/queue') {
    if (request.method === 'GET') return Response.json(await queueStatus(store, player));
    if (request.method === 'DELETE') {
      await store.sql('DELETE FROM queue_entries WHERE player_id=? AND room_id IS NULL', player.id).run();
      return Response.json(await queueStatus(store, player));
    }
    method(request, 'POST'); await store.limit(`queue:${player.id}`, 20);
    const body = await jsonBody(request);
    return Response.json(await enqueue(store, player, body.mode ?? 'quick', formatFrom(body.format)));
  }
  if (path === '/api/practice') {
    method(request, 'POST'); await store.limit(`create:${player.id}`, 10, 3_600_000);
    return Response.json(await store.view(await createPractice(store, player, await jsonBody(request)), player), { status: 201 });
  }
  if (path === '/api/leaderboard') { method(request, 'GET'); return Response.json({ players: await store.leaderboard(limitParam(url)), ranking: 'beef_rating', ratingVersion: RATING_RULES.version, scope: 'prototype_guest_sessions' }); }
  if (path === '/api/rooms') {
    if (request.method === 'GET') return Response.json({ rooms: await store.history(player, limitParam(url)) });
    method(request, 'POST'); await store.limit(`create:${player.id}`, 10, 3_600_000);
    const body = await jsonBody(request);
    const topic = body.topic === undefined ? chooseTopic(body) : textField(body.topic, 'Topic', 240);
    const room = await store.createRoom(player, topic, undefined, null, formatFrom(body.format));
    return Response.json(await store.view(room, player), { status: 201 });
  }
  const matched = /^\/api\/rooms\/([A-Za-z2-9]{6})(?:\/(join|start|arguments|advance|judge|verdict|bot-turn|signals|rematch|cancel))?$/.exec(path);
  if (!matched) fail(404, 'NOT_FOUND', 'API endpoint not found.');
  const code = matched[1].toUpperCase(); const action = matched[2];
  if (action === 'join') {
    method(request, 'POST'); await store.limit(`join:${player.id}`, 15);
    return Response.json(await store.view(await store.joinRoom(code, player), player));
  }
  let room = await store.room(code, player);
  if (!action) { method(request, 'GET'); return Response.json(await store.view(room, player)); }
  if (action === 'signals' && request.method === 'GET') return Response.json(await receiveSignals(store, room, player, url.searchParams.get('after')));
  method(request, 'POST');
  if (action === 'signals') { await sendSignal(store, room, player, await jsonBody(request)); return Response.json({ sent: true }, { status: 201 }); }
  if (action === 'bot-turn') await botTurn(store, room, player);
  if (action === 'verdict') await humanVerdict(store, room, player, await jsonBody(request));
  if (action === 'start') await store.start(room, player);
  if (action === 'advance') await store.advance(room);
  if (action === 'arguments') {
    const body = await jsonBody(request);
    if (!Number.isInteger(body.round) || (body.round as number) < 0 || (body.round as number) > 2) fail(400, 'INVALID_INPUT', 'round must be 0, 1, or 2.');
    await store.submit(room, player, body.round as number, textField(body.content, 'Argument', 600));
  }
  if (action === 'judge') {
    await store.limit(`judge-player:${player.id}`, 12, 3_600_000);
    await judgeRoom(store, room);
  }
  if (action === 'cancel') {
    if (room.host_id !== player.id) fail(403, 'HOST_REQUIRED', 'Only the host can cancel a waiting room.');
    const changed = await store.sql(`UPDATE rooms SET status='cancelled' WHERE id=? AND status='waiting'`, room.id).run();
    if (!changed.meta.changes && room.status !== 'cancelled') fail(409, 'MATCH_STARTED', 'A started match cannot be cancelled.');
  }
  if (action === 'rematch') {
    if (player.id === room.judge_id || room.kind === 'bot') fail(403, 'CONTESTANT_REQUIRED', 'Only human contestants can request a rematch. Use /api/practice for another bot match.');
    if (room.status !== 'finished') fail(409, 'MATCH_NOT_FINISHED', 'Finish this match before creating a rematch.');
    await store.limit(`create:${player.id}`, 10, 3_600_000);
    const wasFor = (room.host_id === player.id) === Boolean(room.host_for);
    const next = await store.createRoom(player, room.topic, wasFor ? 0 : 1, room.id, formatFrom(room.format));
    return Response.json(await store.view(next, player), { status: 201 });
  }
  room = await store.room(code, player);
  return Response.json(await store.view(room, player));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestId = crypto.randomUUID(); const origin = request.headers.get('origin');
    const ownOrigin = new URL(request.url).origin;
    const allowed = !origin || origin === ownOrigin || (env.CORS_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean).includes(origin);
    let response: Response;
    try {
      if (!allowed) fail(403, 'ORIGIN_NOT_ALLOWED', 'This frontend origin is not allowed.');
      if (request.method === 'OPTIONS') response = new Response(null, { status: 204 });
      else response = await route(request, env);
    } catch (error) {
      const known = error instanceof ApiError;
      if (!known) console.error(JSON.stringify({ requestId, code: 'BACKEND_FAILURE' }));
      response = Response.json({ error: { code: known ? error.code : 'SERVICE_UNAVAILABLE',
        message: known ? error.message : 'The service is temporarily unavailable. Please retry.', requestId } }, { status: known ? error.status : 503 });
    }
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('X-Request-Id', requestId);
    response.headers.set('Vary', 'Origin');
    if (response.status === 429) response.headers.set('Retry-After', '60');
    if (origin && allowed) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      response.headers.set('Access-Control-Max-Age', '600');
    }
    return response;
  },
};
