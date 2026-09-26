import { fail } from './http';
import { Store, chooseTopic } from './store';
import { FORMATS, type Format } from './topics';
import type { Player, Room } from './types';

interface QueueEntry { player_id: string; role: string; priority: number; format: Format; joined_at: number; expires_at: number; room_id: string | null }
export function formatFrom(value: unknown): Format {
  if (value === undefined) return 'classic';
  if (typeof value !== 'string' || !Object.hasOwn(FORMATS, value)) fail(400, 'INVALID_FORMAT', 'Choose classic, blitz, or extended.');
  return value as Format;
}
export async function credits(store: Store, playerId: string): Promise<number> {
  return (await store.sql('SELECT COUNT(*) AS count FROM judge_rewards WHERE player_id=? AND consumed_by IS NULL', playerId).first<{count:number}>())?.count ?? 0;
}
export async function enqueue(store: Store, player: Player, mode: unknown, format: Format) {
  if (!['quick', 'judge', 'contestant', 'priority'].includes(mode as string)) fail(400, 'INVALID_QUEUE', 'Choose quick, judge, contestant, or priority.');
  const existing = await store.sql('SELECT * FROM queue_entries WHERE player_id=?', player.id).first<QueueEntry>();
  if (existing && !existing.room_id && existing.expires_at > Date.now()) return queueStatus(store, player);
  const active = await store.sql(`SELECT id FROM rooms WHERE (host_id=? OR guest_id=? OR judge_id=?) AND status IN ('active','judging') AND expires_at>? LIMIT 1`, player.id, player.id, player.id, Date.now()).first();
  if (active) fail(409, 'ACTIVE_MATCH', 'Finish your current match before entering another queue.');
  const available = await credits(store, player.id);
  if (mode === 'priority' && !available) fail(409, 'PRIORITY_REQUIRED', 'Complete a public match as judge to earn a priority ticket.');
  const priority = (mode === 'priority' || mode === 'quick') && available > 0 ? 1 : 0;
  const role = priority ? 'contestant' : mode === 'quick' ? 'mixed' : mode === 'judge' ? 'judge' : 'contestant';
  const now = Date.now();
  await store.sql(`INSERT INTO queue_entries (player_id,role,priority,format,joined_at,expires_at,room_id)
    VALUES (?,?,?,?,?,?,NULL) ON CONFLICT(player_id) DO UPDATE SET role=excluded.role,priority=excluded.priority,
    format=excluded.format,joined_at=excluded.joined_at,expires_at=excluded.expires_at,room_id=NULL
    WHERE (queue_entries.room_id IS NULL AND queue_entries.expires_at<=?) OR queue_entries.room_id IN
    (SELECT id FROM rooms WHERE status IN ('finished','cancelled') OR expires_at<=?)`,
  player.id, role, priority, format, now, now + 120_000, now, now).run();
  return queueStatus(store, player);
}
export async function matchWaiting(store: Store, format: Format) {
  const now = Date.now(); const id = crypto.randomUUID();
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), v => alphabet[v % 32]).join('');
  // D1 batch is one transaction: selecting, reserving all three people, and spending tickets are atomic.
  // A dedicated judge takes precedence. Mixed quick-play users can fill either role, preventing three mixed users from deadlocking.
  const match = store.sql(`WITH eligible AS (
      SELECT q.* FROM queue_entries q WHERE q.room_id IS NULL AND q.expires_at>? AND q.format=?
      AND NOT EXISTS (SELECT 1 FROM rooms r WHERE r.status IN ('active','judging') AND r.expires_at>?
        AND (r.host_id=q.player_id OR r.guest_id=q.player_id OR r.judge_id=q.player_id))
    ), selected_judge AS (
      SELECT player_id FROM eligible WHERE role IN ('judge','mixed')
      ORDER BY CASE role WHEN 'judge' THEN 0 ELSE 1 END,joined_at,player_id LIMIT 1
    ), contestants AS (
      SELECT player_id,ROW_NUMBER() OVER (ORDER BY priority DESC,joined_at,player_id) AS position
      FROM eligible WHERE role IN ('contestant','mixed') AND player_id!=(SELECT player_id FROM selected_judge)
    ) INSERT INTO rooms (id,code,host_id,guest_id,judge_id,host_for,topic,kind,format,status,round,deadline,created_at,expires_at)
    SELECT ?,?,a.player_id,b.player_id,j.player_id,?,?,'public',?,'active',0,?,?,?
    FROM contestants a CROSS JOIN contestants b CROSS JOIN selected_judge j WHERE a.position=1 AND b.position=2
    ON CONFLICT(code) DO NOTHING`, now, format, now, id, code, crypto.getRandomValues(new Uint8Array(1))[0] % 2,
  chooseTopic({}), format, now + FORMATS[format].roundSeconds[0] * 1000 + 10_000, now, now + 86_400_000);
  await store.env.DB.batch([
    match,
    store.sql(`UPDATE queue_entries SET room_id=? WHERE player_id IN
      (SELECT host_id FROM rooms WHERE id=? UNION ALL SELECT guest_id FROM rooms WHERE id=? UNION ALL SELECT judge_id FROM rooms WHERE id=?)`, id, id, id, id),
    ...['host_id', 'guest_id'].map(column => store.sql(`UPDATE judge_rewards SET consumed_by=? WHERE room_id=(
      SELECT reward.room_id FROM judge_rewards reward JOIN rooms r ON r.${column}=reward.player_id
      JOIN queue_entries q ON q.player_id=reward.player_id AND q.room_id=r.id
      WHERE r.id=? AND q.priority=1 AND reward.consumed_by IS NULL ORDER BY reward.earned_at,reward.room_id LIMIT 1)`, id, id)),
  ]);
}
export async function queueStatus(store: Store, player: Player) {
  let entry = await store.sql('SELECT * FROM queue_entries WHERE player_id=?', player.id).first<QueueEntry>();
  if (!entry) return { status: 'idle', priorityTickets: await credits(store, player.id) };
  if (!entry.room_id && entry.expires_at > Date.now()) {
    await matchWaiting(store, entry.format);
    entry = (await store.sql('SELECT * FROM queue_entries WHERE player_id=?', player.id).first<QueueEntry>())!;
  }
  const priorityTickets = await credits(store, player.id);
  if (entry.room_id) {
    const room = await store.sql('SELECT * FROM rooms WHERE id=?', entry.room_id).first<Room>();
    return { status: 'matched', priorityTickets, room: room ? await store.view(room, player) : null };
  }
  return { status: entry.expires_at <= Date.now() ? 'timed_out' : 'waiting', role: entry.role, priority: Boolean(entry.priority),
    format: entry.format, joinedAt: entry.joined_at, expiresAt: entry.expires_at, serverTime: Date.now(),
    maxWaitSeconds: 120, priorityTickets };
}
