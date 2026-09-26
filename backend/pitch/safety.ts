import { fail, textField } from '../http';
import { Store } from '../store';
import type { Player } from '../types';
import { moderator } from './auth';
import { seats } from './game';
import type { Ballot, PitchRoom } from './types';

export async function report(store: Store, room: PitchRoom, player: Player, body: Record<string, unknown>) {
  const target = textField(body.targetId, 'Reported participant', 100);
  if (target === player.id || !(await seats(store, room)).some(s => s.player_id === target)) fail(400, 'INVALID_TARGET', 'Choose another participant in this round.');
  const reason = textField(body.reason, 'Reason', 50);
  if (!['harassment', 'unsafe-contact', 'abusive-feedback', 'cheating', 'other'].includes(reason)) fail(400, 'INVALID_REASON', 'Choose a report category.');
  const details = textField(body.details, 'Details', 1000);
  await store.limit(`pitch-report:${player.id}`, 20, 86_400_000);
  const id = crypto.randomUUID();
  await store.sql(`INSERT INTO pitch_reports(id,room_id,reporter_id,target_id,reason,details,created_at) VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(room_id,reporter_id,target_id) DO NOTHING`, id, room.id, player.id, target, reason, details, Date.now()).run();
  return { reported: true };
}
export async function block(store: Store, room: PitchRoom, player: Player, body: Record<string, unknown>) {
  const target = textField(body.targetId, 'Blocked participant', 100);
  if (target === player.id || !(await seats(store, room)).some(s => s.player_id === target)) fail(400, 'INVALID_TARGET', 'Choose another participant in this round.');
  await store.sql('INSERT INTO pitch_blocks(player_id,target_id,created_at) VALUES(?,?,?) ON CONFLICT DO NOTHING', player.id, target, Date.now()).run();
  return { blocked: true, targetId: target };
}
export async function rateFeedback(store: Store, player: Player, body: Record<string, unknown>) {
  const ballotId = textField(body.ballotId, 'Feedback ID', 100);
  if (!['helpful', 'unhelpful', 'abusive'].includes(body.value as string)) fail(400, 'INVALID_RATING', 'Choose helpful, unhelpful, or abusive.');
  const row = await store.sql(`SELECT b.*,r.a_id,r.b_id FROM pitch_ballots b JOIN pitch_rooms r ON r.id=b.room_id
    WHERE b.id=? AND r.status IN ('finished','cancelled') AND (r.a_id=? OR r.b_id=?)`, ballotId, player.id, player.id).first<Ballot & { a_id:string;b_id:string }>();
  if (!row) fail(404, 'FEEDBACK_NOT_FOUND', 'Only the recipient can rate completed-round feedback.');
  const claim = crypto.randomUUID(); const now = Date.now(); const value = body.value as string;
  await store.env.DB.batch([
    store.sql(`INSERT INTO pitch_feedback_ratings(id,ballot_id,player_id,value,created_at) VALUES(?,?,?,?,?) ON CONFLICT(ballot_id,player_id) DO NOTHING`, claim, ballotId, player.id, value, now),
    store.sql(`UPDATE pitch_profiles SET reliability=MAX(0,MIN(100,reliability+?)) WHERE player_id=? AND EXISTS(SELECT 1 FROM pitch_feedback_ratings WHERE id=?)`, value === 'helpful' ? 1 : value === 'abusive' ? -3 : -1, row.judge_id, claim),
    ...(value === 'abusive' ? [store.sql(`INSERT INTO pitch_reports(id,room_id,reporter_id,target_id,reason,details,created_at)
      SELECT ?,?,?,?,'abusive-feedback',?,? WHERE EXISTS(SELECT 1 FROM pitch_feedback_ratings WHERE id=?) ON CONFLICT(room_id,reporter_id,target_id) DO NOTHING`,
    crypto.randomUUID(), row.room_id, player.id, row.judge_id, player.id === row.a_id ? row.a_tip : row.b_tip, now, claim)] : []),
  ]);
  return { saved: true };
}
export async function reviewReports(store: Store, player: Player, body?: Record<string, unknown>) {
  if (!moderator(store, player.id)) fail(403, 'MODERATOR_REQUIRED', 'Only a configured moderator can review reports.');
  if (body) {
    const id = textField(body.id, 'Report ID', 100);
    if (!['upheld', 'dismissed'].includes(body.decision as string)) fail(400, 'INVALID_DECISION', 'Choose upheld or dismissed.');
    const now = Date.now();
    await store.env.DB.batch([
      store.sql(`UPDATE pitch_reports SET status=?,reviewed_at=?,reviewer_id=? WHERE id=? AND status='pending'`, body.decision as string, now, player.id, id),
      store.sql(`UPDATE pitch_profiles SET banned_until=MAX(banned_until,?+86400000)
        WHERE player_id=(SELECT target_id FROM pitch_reports WHERE id=? AND status='upheld')
        AND (SELECT COUNT(*) FROM pitch_reports r WHERE r.target_id=pitch_profiles.player_id AND r.status='upheld')>=2`, now, id),
    ]);
  }
  return { reports: (await store.sql(`SELECT r.id,r.room_id AS roomId,m.code AS roomCode,r.reason,r.details,r.created_at AS createdAt,
    r.target_id AS targetId,p.name AS targetName FROM pitch_reports r JOIN pitch_rooms m ON m.id=r.room_id JOIN players p ON p.id=r.target_id
    WHERE r.status='pending' ORDER BY r.created_at LIMIT 100`).all()).results };
}
