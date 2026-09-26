import type { PitchRoomView } from '../../shared/pitch';
import { fail, textField } from '../http';
import { Store } from '../store';
import type { Player } from '../types';
import { profile } from './auth';
import { phaseAt, SCENARIOS, type Scenario } from './scenarios';
import type { Ballot, PitchRoom, Profile, Seat } from './types';

export async function roomFor(store: Store, code: string, player: Player) {
  const room = await store.sql(`SELECT r.* FROM pitch_rooms r JOIN pitch_seats s ON s.room_id=r.id
    WHERE r.code=? AND s.player_id=?`, code.toUpperCase(), player.id).first<PitchRoom>();
  if (!room) fail(404, 'ROOM_NOT_FOUND', 'Round not found.');
  return room;
}
export async function seats(store: Store, room: PitchRoom) {
  return (await store.sql('SELECT s.*,p.name FROM pitch_seats s JOIN players p ON p.id=s.player_id WHERE s.room_id=? ORDER BY s.slot', room.id).all<Seat>()).results;
}
async function ballots(store: Store, room: PitchRoom) { return (await store.sql('SELECT * FROM pitch_ballots WHERE room_id=? ORDER BY created_at,id', room.id).all<Ballot>()).results; }
export function scenarioFor(room: PitchRoom): Scenario {
  const saved = JSON.parse(room.scenario_json || '{}');
  return saved.id ? saved : SCENARIOS.find(s => s.id === room.scenario_id) ?? { id: room.scenario_id, band: room.band, category: 'career', title: 'Earlier practice scenario', prompt: 'This round used an earlier prototype scenario.', goal: 'Practice a constructive response.', positions: null };
}

export function cleanTip(value: unknown) {
  const tip = textField(value, 'Feedback tip', 400);
  if (tip.length < 12) fail(400, 'TIP_TOO_SHORT', 'Give a specific tip with at least 12 characters.');
  const normalized = tip.normalize('NFKC').toLowerCase().replace(/[013@$]/g, c => ({'0':'o','1':'i','3':'e','@':'a','$':'s'}[c]!));
  if (/\b(fuck\w*|shit\w*|bitch\w*|asshole\w*|cunt\w*|idiot|moron|stupid|retard\w*|kys)\b|kill\s+yourself|you\s+should\s+die|\bhttps?:|\bwww\.|[^\s]+@[^\s]+\.[^\s]+|\b\d[\d ()+-]{7,}\d\b/i.test(normalized)) {
    fail(400, 'FEEDBACK_FILTERED', 'Keep feedback constructive, specific, and free of insults or contact details.');
  }
  return tip;
}
export function ratingChange(stats: Profile, opponent: Profile, actual: number, forfeit: boolean) {
  const k = stats.games < 10 ? 32 : 16;
  const expected = 1 / (1 + 10 ** ((opponent.rating - stats.rating) / 400));
  const gainFactor = forfeit && actual === 1 ? 0.25 : 1;
  const after = Math.max(100, Math.round(stats.rating + k * (actual - expected) * gainFactor));
  return { playerId: stats.player_id, before: stats.rating, after, delta: after - stats.rating, gamesBefore: stats.games,
    gamesAfter: stats.games + 1, k, expected, result: actual === 1 ? 'win' : actual === 0 ? 'loss' : 'draw' };
}

async function finish(store: Store, room: PitchRoom, forfeitPlayer: string | null = null, forceCancel = false) {
  if (room.status !== 'active') return;
  const [members, votes] = await Promise.all([seats(store, room), ballots(store, room)]);
  const phase = phaseAt(room.started_at);
  const judgesRemaining = members.filter(s => s.role === 'judge' && !s.left_at).length;
  if (!forfeitPlayer && !forceCancel && (phase.index !== 5 || (!phase.expired && votes.length < judgesRemaining))) return;
  if (forfeitPlayer && !members.some(s => s.player_id === forfeitPlayer && s.role === 'contestant' && s.left_at)) return;
  const cancelled = forceCancel || (!forfeitPlayer && votes.length < 2);
  if (!forfeitPlayer && !forceCancel && !phase.expired && votes.length < 2) return;
  let winnerId: string | null = null;
  let reason = cancelled ? 'insufficient_judges' : forfeitPlayer ? 'forfeit' : 'majority';
  if (forfeitPlayer) winnerId = forfeitPlayer === room.a_id ? room.b_id : room.a_id;
  const sums = (prefix: 'a' | 'b') => ({
    clarity: votes.reduce((n, v) => n + v[`${prefix}_clarity`], 0),
    persuasiveness: votes.reduce((n, v) => n + v[`${prefix}_persuasiveness`], 0),
    composure: votes.reduce((n, v) => n + v[`${prefix}_composure`], 0),
  });
  const aSum = sums('a'), bSum = sums('b');
  if (!cancelled && !forfeitPlayer) {
    const aVotes = votes.filter(v => v.winner_id === room.a_id).length;
    if (aVotes !== votes.length - aVotes) winnerId = aVotes > votes.length - aVotes ? room.a_id : room.b_id;
    else {
      const total = (s: typeof aSum) => s.clarity + s.persuasiveness + s.composure;
      winnerId = total(aSum) === total(bSum) ? null : total(aSum) > total(bSum) ? room.a_id : room.b_id;
      reason = winnerId ? 'rubric_tiebreak' : 'draw';
    }
  }
  const [a, b] = await Promise.all([profile(store, room.a_id), profile(store, room.b_id)]);
  const changes = cancelled ? [] : [ratingChange(a, b, winnerId === null ? 0.5 : winnerId === a.player_id ? 1 : 0, !!forfeitPlayer), ratingChange(b, a, winnerId === null ? 0.5 : winnerId === b.player_id ? 1 : 0, !!forfeitPlayer)];
  const result = { winnerId: cancelled ? null : winnerId, reason, voteCount: votes.length,
    scores: [a, b].map((p, i) => ({ playerId: p.player_id, votes: votes.filter(v => v.winner_id === p.player_id).length,
      averages: votes.length ? Object.fromEntries(Object.entries(i ? bSum : aSum).map(([k, n]) => [k, Math.round(n / votes.length * 10) / 10])) : null })),
    ratingChanges: changes, finishedAt: Date.now(), ratingVersion: 'pitch-elo-v2' };
  const claim = crypto.randomUUID(), now = Date.now();
  const guard = 'EXISTS(SELECT 1 FROM pitch_rooms WHERE id=? AND resolution_token=?)';
  // The room resolution, both rating entries, profile updates and judge credits commit together.
  // Snapshot predicates reject races with ballots, disconnects, or another finalizer.
  await store.env.DB.batch([
    store.sql(`UPDATE pitch_rooms SET status=?,result=?,resolution_token=?,finished_at=? WHERE id=? AND status='active'
      AND (SELECT COUNT(*) FROM pitch_ballots WHERE room_id=?)=?
      AND (SELECT COUNT(*) FROM pitch_seats WHERE room_id=? AND left_at IS NOT NULL)=?
      AND EXISTS(SELECT 1 FROM pitch_profiles WHERE player_id=? AND rating=? AND games=?)
      AND EXISTS(SELECT 1 FROM pitch_profiles WHERE player_id=? AND rating=? AND games=?)`,
    cancelled ? 'cancelled' : 'finished', JSON.stringify(result), claim, now, room.id, room.id, votes.length,
    room.id, members.filter(s => s.left_at).length, a.player_id, a.rating, a.games, b.player_id, b.rating, b.games),
    ...changes.map(c => store.sql(`INSERT INTO pitch_rating_events(room_id,player_id,before_rating,after_rating,delta,games_before,result,reason,created_at)
      SELECT ?,?,?,?,?,?,?,?,? WHERE ${guard}`, room.id, c.playerId, c.before, c.after, c.delta, c.gamesBefore, c.result, reason, now, room.id, claim)),
    ...changes.map(c => store.sql(`UPDATE pitch_profiles SET rating=?,games=games+1 WHERE player_id=? AND ${guard}`, c.after, c.playerId, room.id, claim)),
    ...(!cancelled && !forfeitPlayer ? votes.map(v => store.sql(`UPDATE pitch_profiles SET judged=judged+1,
      priority_credits=priority_credits+CASE WHEN judged%2=1 THEN 1 ELSE 0 END,
      reliability=MAX(0,MIN(100,reliability+?)) WHERE player_id=? AND ${guard}`,
    winnerId === null ? 0 : v.winner_id === winnerId ? 2 : -1, v.judge_id, room.id, claim)) : []),
    store.sql(`DELETE FROM pitch_queue WHERE room_id=? AND ${guard}`, room.id, room.id, claim),
    store.sql(`DELETE FROM pitch_signals WHERE room_id=? AND ${guard}`, room.id, room.id, claim),
  ]);
}

export async function leave(store: Store, room: PitchRoom, playerId: string) {
  const seat = await store.sql('SELECT * FROM pitch_seats WHERE room_id=? AND player_id=?', room.id, playerId).first<Seat>();
  if (!seat || seat.left_at || room.status !== 'active') return;
  // A judge who has submitted a valid ballot has completed their job.
  if (seat.role === 'judge' && await store.sql('SELECT 1 FROM pitch_ballots WHERE room_id=? AND judge_id=?', room.id, playerId).first()) return;
  const claim = crypto.randomUUID(), now = Date.now();
  await store.env.DB.batch([
    store.sql(`INSERT INTO pitch_leaves(room_id,player_id,claim,created_at) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM pitch_rooms WHERE id=? AND status='active')
      AND NOT EXISTS(SELECT 1 FROM pitch_ballots WHERE room_id=? AND judge_id=?) ON CONFLICT(room_id,player_id) DO NOTHING`, room.id, playerId, claim, now, room.id, room.id, playerId),
    store.sql(`UPDATE pitch_seats SET left_at=? WHERE room_id=? AND player_id=? AND EXISTS(SELECT 1 FROM pitch_leaves WHERE room_id=? AND player_id=? AND claim=?)`, now, room.id, playerId, room.id, playerId, claim),
    store.sql(`UPDATE pitch_profiles SET banned_until=MAX(banned_until,?+CASE WHEN (SELECT COUNT(*) FROM pitch_leaves WHERE player_id=? AND created_at>?)>1 THEN 600000 ELSE 300000 END),
      reliability=MAX(0,reliability-?) WHERE player_id=? AND EXISTS(SELECT 1 FROM pitch_leaves WHERE room_id=? AND player_id=? AND claim=?)`,
    now, playerId, now - 86_400_000, seat.role === 'judge' ? 10 : 0, playerId, room.id, playerId, claim),
  ]);
  if (seat.role === 'contestant') await finish(store, room, playerId);
}

export async function syncRoom(store: Store, room: PitchRoom, player: Player) {
  if (room.status !== 'active') return room;
  const now = Date.now();
  await store.sql(`UPDATE pitch_seats SET last_seen=? WHERE room_id=? AND player_id=? AND left_at IS NULL AND last_seen<?`, now, room.id, player.id, now - 10_000).run();
  const phase = phaseAt(room.started_at);
  const members = await seats(store, room);
  for (const member of members) {
    if (!member.left_at && (member.last_seen < now - 60_000 || (phase.expired && member.role === 'judge'))) await leave(store, room, member.player_id);
  }
  const refreshed = (await store.sql('SELECT * FROM pitch_rooms WHERE id=?', room.id).first<PitchRoom>())!;
  // Retry a resolution after a prior request won the leave write but disconnected before finishing.
  const forfeited = (await seats(store, refreshed)).find(s => s.role === 'contestant' && s.left_at);
  await finish(store, refreshed, forfeited?.player_id ?? null);
  return (await store.sql('SELECT * FROM pitch_rooms WHERE id=?', room.id).first<PitchRoom>())!;
}

export async function view(store: Store, room: PitchRoom, player: Player): Promise<PitchRoomView> {
  const [members, votes, responses, feedback] = await Promise.all([
    seats(store, room), ballots(store, room),
    store.sql('SELECT player_id AS playerId,phase,content,created_at AS createdAt FROM pitch_responses WHERE room_id=? ORDER BY phase', room.id).all<{playerId:string;phase:number;content:string;createdAt:number}>(),
    store.sql(`SELECT f.ballot_id,f.value FROM pitch_feedback_ratings f JOIN pitch_ballots b ON b.id=f.ballot_id WHERE b.room_id=? AND f.player_id=?`, room.id, player.id).all<{ballot_id:string;value:string}>(),
  ]);
  const phase = phaseAt(room.started_at); const self = members.find(s => s.player_id === player.id)!;
  const result = room.result ? JSON.parse(room.result) : null;
  const scenario = scenarioFor(room);
  return { id: room.id, code: room.code, status: room.status, band: room.band, scenario,
    yourPosition: self.role === 'contestant' ? scenario.positions?.[self.slot] ?? scenario.goal : null,
    serverTime: Date.now(), startedAt: room.started_at, phase, role: self.role, yourSlot: self.slot, left: !!self.left_at,
    participants: members.map(s => ({ id: s.player_id, name: s.name, role: s.role, slot: s.slot, left: !!s.left_at, position: s.role === 'contestant' ? scenario.positions?.[s.slot] ?? scenario.goal : null,
      submitted: s.role === 'judge' ? votes.some(v => v.judge_id === s.player_id) : responses.results.some(r => r.playerId === s.player_id && r.phase === phase.index) })),
    responses: responses.results.filter(r => r.playerId === player.id || r.phase < phase.index || room.status !== 'active'),
    ballotSubmitted: votes.some(v => v.judge_id === player.id), ballotsReceived: votes.length, result,
    feedback: result ? votes.flatMap(v => (self.role === 'contestant' ? [self.slot] : [0, 1]).map(slot => ({
      ballotId: v.id, playerId: slot === 0 ? room.a_id : room.b_id,
      tip: feedback.results.find(f => f.ballot_id === v.id)?.value === 'abusive' ? '[Feedback hidden after your report]' : slot === 0 ? v.a_tip : v.b_tip,
      clarity: slot === 0 ? v.a_clarity : v.b_clarity, persuasiveness: slot === 0 ? v.a_persuasiveness : v.b_persuasiveness,
      composure: slot === 0 ? v.a_composure : v.b_composure, rating: feedback.results.find(f => f.ballot_id === v.id)?.value ?? null,
    }))) : [] };
}

export async function vote(store: Store, room: PitchRoom, player: Player, body: Record<string, unknown>) {
  const self = (await seats(store, room)).find(s => s.player_id === player.id)!;
  if (self.role !== 'judge') fail(403, 'JUDGE_REQUIRED', 'Only assigned judges can score this round.');
  if (await store.sql('SELECT 1 FROM pitch_ballots WHERE room_id=? AND judge_id=?', room.id, player.id).first()) { await finish(store, room); return; }
  const phase = phaseAt(room.started_at);
  if (room.status !== 'active' || self.left_at || phase.index !== 5 || phase.expired) fail(409, 'VOTING_CLOSED', 'Scoring opens after the speaking turns and lasts 60 seconds.');
  if (![room.a_id, room.b_id].includes(body.winnerId as string)) fail(400, 'WINNER_REQUIRED', 'Pick one contestant as the winner.');
  function score(prefix: 'a' | 'b') {
    const obj = body[prefix] as Record<string, unknown> | undefined;
    if (!obj || typeof obj !== 'object') fail(400, 'INVALID_SCORE', 'Score both contestants.');
    const values = ['clarity', 'persuasiveness', 'composure'].map(k => { const n = obj[k]; if (!Number.isInteger(n) || (n as number) < 1 || (n as number) > 5) fail(400, 'INVALID_SCORE', 'Every rubric score must be an integer from 1 to 5.'); return n as number; });
    return [...values, cleanTip(obj.tip)];
  }
  const a = score('a'), b = score('b'), now = Date.now();
  const inserted = await store.sql(`INSERT INTO pitch_ballots(id,room_id,judge_id,winner_id,a_clarity,a_persuasiveness,a_composure,a_tip,b_clarity,b_persuasiveness,b_composure,b_tip,created_at)
    SELECT ?,id,?,?,?,?,?,?,?,?,?,?,? FROM pitch_rooms WHERE id=? AND status='active' AND started_at+180000<=? AND started_at+240000>?
    AND EXISTS(SELECT 1 FROM pitch_seats WHERE room_id=? AND player_id=? AND role='judge' AND left_at IS NULL)
    ON CONFLICT(room_id,judge_id) DO NOTHING`, crypto.randomUUID(), player.id, body.winnerId as string, ...a, ...b, now, room.id, now, now, room.id, player.id).run();
  if (!inserted.meta.changes && !await store.sql('SELECT 1 FROM pitch_ballots WHERE room_id=? AND judge_id=?', room.id, player.id).first()) fail(409, 'VOTING_CLOSED', 'The round closed. Refresh to see the result.');
  await finish(store, room);
}

export async function submitResponse(store: Store, room: PitchRoom, player: Player, body: Record<string, unknown>) {
  const phase = phaseAt(room.started_at); const slot = player.id === room.a_id ? 0 : player.id === room.b_id ? 1 : -1;
  if (room.status !== 'active' || phase.expired || phase.speaker !== slot || body.phase !== phase.index) fail(409, 'NOT_YOUR_TURN', 'You can submit a text response only during your speaking turn.');
  const content = textField(body.content, 'Response', 1200); const now = Date.now();
  const phaseStart = phase.deadline - phase.seconds * 1000;
  const result = await store.sql(`INSERT INTO pitch_responses(room_id,player_id,phase,content,created_at)
    SELECT id,?,?,?,? FROM pitch_rooms WHERE id=? AND status='active' AND ?>=? AND ?<?
    AND EXISTS(SELECT 1 FROM pitch_seats WHERE room_id=? AND player_id=? AND left_at IS NULL)
    ON CONFLICT(room_id,player_id,phase) DO NOTHING`, player.id, phase.index, content, now, room.id, now, phaseStart, now, phase.deadline, room.id, player.id).run();
  if (!result.meta.changes) fail(409, 'RESPONSE_LOCKED', 'This response is already submitted or the turn has closed.');
}
