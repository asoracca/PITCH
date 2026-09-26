import { fail, textField } from './http';
import { Store } from './store';
import { calculateRating, ratingSnapshot, ratingStatements } from './ratings';
import type { Player, PlayerScore, Room, Verdict } from './types';

export async function humanVerdict(store: Store, room: Room, player: Player, body: Record<string, unknown>) {
  if (room.judge_id !== player.id) fail(403, 'JUDGE_REQUIRED', 'Only the assigned judge can submit the verdict.');
  if (room.status === 'finished') return;
  store.playable(room);
  if (room.status !== 'judging') fail(409, 'NOT_READY_TO_JUDGE', 'Wait for all debate rounds to finish.');
  const summary = textField(body.summary, 'Summary', 1000);
  if (!Array.isArray(body.scores) || body.scores.length !== 2) fail(400, 'INVALID_SCORES', 'Supply one score for each contestant.');
  const seen = new Set<string>(); const args = await store.arguments(room);
  if (!args.length) {
    await store.sql("UPDATE rooms SET status='cancelled' WHERE id=? AND status='judging'", room.id).run();
    return;
  }
  const scores: PlayerScore[] = body.scores.map((raw: unknown) => {
    if (!raw || typeof raw !== 'object') fail(400, 'INVALID_SCORES', 'Invalid score.');
    const score = raw as Record<string, unknown>; const id = score.playerId;
    if (typeof id !== 'string' || ![room.host_id, room.guest_id].includes(id) || seen.has(id)) fail(400, 'INVALID_SCORES', 'Score each contestant exactly once.');
    seen.add(id);
    for (const field of ['reasoning', 'rebuttal', 'clarity']) if (!Number.isInteger(score[field]) || (score[field] as number) < 0 || (score[field] as number) > 10) fail(400, 'INVALID_SCORES', 'Each category must be an integer from 0 to 10.');
    const active = args.some(a => a.player_id === id);
    const reasoning = active ? score.reasoning as number : 0; const rebuttal = active ? score.rebuttal as number : 0; const clarity = active ? score.clarity as number : 0;
    const quote = typeof score.bestQuote === 'string' ? score.bestQuote : '';
    return { playerId: id, reasoning, rebuttal, clarity, total: 4 * reasoning + 4 * rebuttal + 2 * clarity,
      feedback: textField(score.feedback, 'Feedback', 1000), bestQuote: args.some(a => a.player_id === id && a.content.includes(quote)) ? quote : '' };
  });
  const verdict: Verdict = { kind: 'human', model: null, rubricVersion: '1', judgedAt: Date.now(), summary, scores,
    winnerId: scores[0].total === scores[1].total ? null : scores[0].total > scores[1].total ? scores[0].playerId : scores[1].playerId };
  const snapshots = room.kind === 'public' ? await Promise.all(scores.map(s => ratingSnapshot(store, s.playerId))) : [];
  verdict.ratingChanges = snapshots.map((snapshot, i) => calculateRating(snapshot, snapshots[1 - i], verdict.winnerId));
  const commitId = crypto.randomUUID(); const now = Date.now();
  // Claim only if both ratings still match our snapshot. A stale attempt changes nothing.
  const ratingGuard = snapshots.map(() => `AND COALESCE((SELECT rating FROM player_ratings WHERE player_id=?),1000)=?
    AND COALESCE((SELECT games FROM player_ratings WHERE player_id=?),0)=?`).join(' ');
  await store.env.DB.batch([
    store.sql(`UPDATE rooms SET status='finished',verdict=?,finished_at=?,judge_lease=?
      WHERE id=? AND status='judging' AND expires_at>? ${ratingGuard}`, JSON.stringify(verdict), now, commitId, room.id, now,
    ...snapshots.flatMap(s => [s.playerId, s.rating, s.playerId, s.games])),
    ...scores.map(s => store.sql(`INSERT INTO score_events (room_id,player_id,score,result,created_at)
      SELECT id,?,?,?,? FROM rooms WHERE id=? AND judge_lease=? AND kind='public' ON CONFLICT(room_id,player_id) DO NOTHING`,
    s.playerId, s.total, verdict.winnerId === null ? 'draw' : verdict.winnerId === s.playerId ? 'win' : 'loss', Date.now(), room.id, commitId)),
    ...ratingStatements(store, room.id, commitId, verdict.ratingChanges, now),
    store.sql(`INSERT INTO judge_rewards (room_id,player_id,earned_at) SELECT id,judge_id,? FROM rooms
      WHERE id=? AND judge_lease=? AND kind='public' AND EXISTS (SELECT 1 FROM arguments WHERE room_id=?)
      ON CONFLICT(room_id) DO NOTHING`, Date.now(), room.id, commitId, room.id),
  ]);
  const saved = await store.room(room.code, player);
  store.playable(saved);
  if (saved.status !== 'finished') fail(409, 'RATING_CHANGED', 'Refresh the room and submit the verdict again.');
}
