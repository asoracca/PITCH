import { PITCH_API_VERSION, type PitchConfig, type PitchMe, type PitchQueue, type PitchHistory, type PitchLeaderboard } from '../../shared/pitch';
import { fail, jsonBody, sha256 } from '../http';
import { Store } from '../store';
import type { Env, Player } from '../types';
import { accountSession, ageBand, moderator, profile, requireAccount } from './auth';
import { enqueue, match } from './matchmaking';
import { roomFor, syncRoom, view, vote, leave, submitResponse, scenarioFor } from './game';
import { block, rateFeedback, report, reviewReports } from './safety';
import { voiceConfig, signals } from './voice';
import { PHASES, SCENARIOS } from './scenarios';
import type { Account, PitchRoom, QueueRow } from './types';

function method(request: Request, expected: string) { if (request.method !== expected) fail(405, 'METHOD_NOT_ALLOWED', `Use ${expected} for this endpoint.`); }
export const RULES = { version: 'pitch-elo-v2', initialRating: 1000, provisionalGames: 10, provisionalK: 32, establishedK: 16,
  floor: 100, forfeitWinMultiplier: 0.25, judgesPerRound: 3, contestantsPerRound: 2, judgedRoundsPerPriorityCredit: 2,
  queueTimeoutSeconds: 120, disconnectGraceSeconds: 60, firstLeaveBanSeconds: 300, repeatLeaveBanSeconds: 600, phases: PHASES,
  rubric: ['clarity', 'persuasiveness', 'composure'], scoreRange: [1, 5], aiEnabled: false };

async function queueView(store: Store, player: Player, account: Account): Promise<PitchQueue> {
  let row = await store.sql('SELECT * FROM pitch_queue WHERE player_id=?', player.id).first<QueueRow>();
  if (!row) return { status: 'idle', serverTime: Date.now() };
  if (!row.room_id && row.expires_at <= Date.now()) {
    await store.sql('DELETE FROM pitch_queue WHERE player_id=? AND room_id IS NULL AND expires_at<=?', player.id, Date.now()).run();
    return { status: 'expired', message: 'There were not enough compatible people. Try again or arrange a five-person playtest.', serverTime: Date.now() };
  }
  if (!row.room_id) {
    const band = ageBand(account.birth_date);
    if (band !== row.band) { await store.sql('DELETE FROM pitch_queue WHERE player_id=? AND room_id IS NULL', player.id).run(); return { status: 'idle', serverTime: Date.now() }; }
    await match(store, row.band);
    row = (await store.sql('SELECT * FROM pitch_queue WHERE player_id=?', player.id).first<QueueRow>())!;
  }
  if (row?.room_id) {
    const room = (await store.sql('SELECT * FROM pitch_rooms WHERE id=?', row.room_id).first<PitchRoom>())!;
    return { status: 'matched', room: await view(store, await syncRoom(store, room, player), player), serverTime: Date.now() };
  }
  return { status: 'waiting', mode: row.role, priority: !!row.priority, band: row.band, joinedAt: row.joined_at, expiresAt: row.expires_at, serverTime: Date.now(),
    message: 'Matching two contestants and three judges in your age band. Priority improves queue order; it cannot guarantee an instant match.' };
}

async function history(store: Store, player: Player): Promise<PitchHistory> {
  const rounds = (await store.sql(`SELECT r.*,e.before_rating,e.after_rating,e.delta,e.result AS player_result FROM pitch_rooms r
    JOIN pitch_rating_events e ON e.room_id=r.id WHERE e.player_id=? ORDER BY r.finished_at DESC LIMIT 50`, player.id).all<PitchRoom & {before_rating:number;after_rating:number;delta:number;player_result:string}>()).results;
  const feedback = (await store.sql(`SELECT b.id AS ballotId,b.room_id AS roomId,
    CASE WHEN r.a_id=? THEN b.a_tip ELSE b.b_tip END AS tip,
    CASE WHEN r.a_id=? THEN b.a_clarity ELSE b.b_clarity END AS clarity,
    CASE WHEN r.a_id=? THEN b.a_persuasiveness ELSE b.b_persuasiveness END AS persuasiveness,
    CASE WHEN r.a_id=? THEN b.a_composure ELSE b.b_composure END AS composure,
    f.value AS rating FROM pitch_ballots b JOIN pitch_rooms r ON r.id=b.room_id
    LEFT JOIN pitch_feedback_ratings f ON f.ballot_id=b.id AND f.player_id=?
    WHERE r.status='finished' AND (r.a_id=? OR r.b_id=?) ORDER BY r.finished_at DESC,b.id LIMIT 150`,
  player.id, player.id, player.id, player.id, player.id, player.id, player.id).all<{ballotId:string;roomId:string;tip:string;clarity:number;persuasiveness:number;composure:number;rating:string|null}>()).results;
  const tips = feedback.map(f => ({ ...f, tip: f.rating === 'abusive' ? '[Feedback hidden after your report]' : f.tip }));
  const usable = tips.filter(f => f.rating !== 'abusive');
  const averages = Object.fromEntries(['clarity', 'persuasiveness', 'composure'].map(k => [k, usable.length ? Math.round(usable.reduce((n, f) => n + Number(f[k as keyof typeof f]), 0) / usable.length * 10) / 10 : null]));
  return { history: rounds.map(r => ({ code: r.code, scenario: scenarioFor(r), result: r.player_result, before: r.before_rating, after: r.after_rating,
    delta: r.delta, finishedAt: r.finished_at, feedback: tips.filter(t => t.roomId === r.id) })), averages,
    scope: 'most_recent_50_rated_rounds', byCategory: ['career', 'conflict', 'money', 'leadership', 'social'].map(category => { const games = rounds.filter(r => scenarioFor(r).category === category); return { category, games: games.length, wins: games.filter(r => r.player_result === 'win').length, winRate: games.length ? Math.round(games.filter(r => r.player_result === 'win').length / games.length * 100) : null }; }) };
}

export async function pitchRoute(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url), path = url.pathname.replace(/\/$/, ''); const store = new Store(env);
  if (path === '/api/pitch/config') { method(request, 'GET'); return Response.json({ name: 'PITCH', apiVersion: PITCH_API_VERSION, rules: RULES, scenarios: SCENARIOS,
    capabilities: { emailPassword: true, googleSignIn: false, emailVerification: false, passwordRecovery: false,
      humanJudging: true, aiPractice: false, voice: true, voiceChanging: false, video: false, transcripts: false,
      customLobbies: false, tournaments: false, reporting: true, blocking: true, moderatorReviewConfigured: !!env.PITCH_MODERATOR_IDS?.trim() }
  } satisfies PitchConfig); }
  if (path === '/api/pitch/signup' || path === '/api/pitch/login') {
    method(request, 'POST');
    await store.limit(`pitch-auth-ip:${await sha256(request.headers.get('cf-connecting-ip') ?? 'local')}`, 30, 3_600_000);
    return Response.json(await accountSession(store, await jsonBody(request), path.endsWith('signup')), { status: path.endsWith('signup') ? 201 : 200 });
  }
  const player = await store.authenticate(request); const account = await requireAccount(store, player);
  await store.limit(`pitch-request:${player.id}`, 300);
  if (path === '/api/pitch/logout') { method(request, 'POST'); await store.sql('DELETE FROM sessions WHERE token_hash=?', await sha256(request.headers.get('authorization')!.slice(7))).run(); return Response.json({ signedOut: true }); }
  if (path === '/api/pitch/me') {
    method(request, 'GET'); const p = await profile(store, player.id);
    const active = await store.sql(`SELECT r.code FROM pitch_queue q JOIN pitch_rooms r ON r.id=q.room_id WHERE q.player_id=? AND r.status='active'`, player.id).first<{code:string}>();
    return Response.json({ player, ageBand: ageBand(account.birth_date), rating: { value: p.rating, games: p.games, provisional: p.games < 10, placementGamesRemaining: Math.max(0, 10 - p.games) },
      judge: { reliability: p.reliability, roundsCompleted: p.judged, progressToCredit: p.judged % 2 }, priorityCredits: p.priority_credits,
      bannedUntil: p.banned_until, moderator: moderator(store, player.id), activeRoom: active?.code ?? null,
      blockedPlayers: (await store.sql('SELECT target_id AS id FROM pitch_blocks WHERE player_id=?', player.id).all<{id:string}>()).results } satisfies PitchMe);
  }
  if (path === '/api/pitch/history') { method(request, 'GET'); return Response.json(await history(store, player)); }
  if (path === '/api/pitch/leaderboard') {
    method(request, 'GET'); const band = ageBand(account.birth_date); const today = new Date(); today.setUTCHours(0,0,0,0); today.setUTCDate(today.getUTCDate() - (today.getUTCDay() + 6) % 7);
    // Filter age bands before limiting, so other bands cannot crowd out this leaderboard.
    const bounds = band === '14–17' ? [14,17] : band === '18–22' ? [18,22] : [23,120];
    const date = new Date().toISOString().slice(0,10);
    // Weekly ranking measures earned Elo this UTC week; lifetime Elo is displayed alongside it.
    const rows = (await store.sql(`SELECT p.player_id AS playerId,n.name,p.rating,p.games,a.birth_date,SUM(e.delta) AS weeklyGain,COUNT(*) AS weeklyGames
      FROM pitch_profiles p JOIN players n ON n.id=p.player_id JOIN pitch_accounts a ON a.player_id=p.player_id JOIN pitch_rating_events e ON e.player_id=p.player_id
      WHERE e.created_at>=? AND p.banned_until<=?
      AND (CAST(strftime('%Y',?)-strftime('%Y',a.birth_date) AS INTEGER) - (strftime('%m-%d',?)<strftime('%m-%d',a.birth_date))) BETWEEN ? AND ?
      GROUP BY p.player_id ORDER BY weeklyGain DESC,p.rating DESC,p.player_id LIMIT 30`, today.getTime(), Date.now(), date, date, ...bounds).all<{playerId:string;name:string;rating:number;games:number;birth_date:string;weeklyGain:number;weeklyGames:number}>()).results;
    return Response.json({ band, weekStartsAt: today.getTime(), players: rows.filter(p => ageBand(p.birth_date) === band).slice(0, 30).map(({birth_date, ...p}) => p) } satisfies PitchLeaderboard);
  }
  if (path === '/api/pitch/queue') {
    if (request.method === 'POST') { await store.limit(`pitch-queue:${player.id}`, 20); const body = await jsonBody(request); await enqueue(store, player, account, body.mode ?? 'quick'); }
    else if (request.method === 'DELETE') await store.sql('DELETE FROM pitch_queue WHERE player_id=? AND room_id IS NULL', player.id).run();
    else method(request, 'GET');
    return Response.json(await queueView(store, player, account));
  }
  if (path === '/api/pitch/feedback') { method(request, 'POST'); return Response.json(await rateFeedback(store, player, await jsonBody(request))); }
  if (path === '/api/pitch/reports') {
    if (request.method !== 'GET') method(request, 'POST');
    return Response.json(await reviewReports(store, player, request.method === 'POST' ? await jsonBody(request) : undefined));
  }
  if (path === '/api/pitch/voice') { method(request, 'GET'); return Response.json(voiceConfig(store)); }
  const matched = /^\/api\/pitch\/rooms\/([A-Fa-f0-9]{8})(?:\/(vote|leave|response|signals|report|block))?$/.exec(path);
  if (!matched) fail(404, 'NOT_FOUND', 'PITCH endpoint not found.');
  let room = await roomFor(store, matched[1], player); const action = matched[2];
  // Signal polling does not need expensive round maintenance; its access check still requires a live seat.
  if (action === 'signals') {
    if (request.method !== 'GET') method(request, 'POST');
    return Response.json(await signals(store, room, player, url.searchParams.get('after'), request.method === 'POST' ? await jsonBody(request) : undefined));
  }
  room = await syncRoom(store, room, player);
  if (!action) { method(request, 'GET'); return Response.json(await view(store, room, player)); }
  method(request, 'POST');
  if (action === 'report') return Response.json(await report(store, room, player, await jsonBody(request)));
  if (action === 'block') return Response.json(await block(store, room, player, await jsonBody(request)));
  if (action === 'leave') await leave(store, room, player.id);
  if (action === 'vote') await vote(store, room, player, await jsonBody(request));
  if (action === 'response') await submitResponse(store, room, player, await jsonBody(request));
  room = await roomFor(store, room.code, player);
  return Response.json(await view(store, room, player));
}
