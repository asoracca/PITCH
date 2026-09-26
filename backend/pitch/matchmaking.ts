import { fail } from '../http';
import { Store } from '../store';
import type { Player } from '../types';
import { ageBand, profile } from './auth';
import { SCENARIOS } from './scenarios';
import type { Account, QueueRow } from './types';

export async function match(store: Store, band: string) {
  const now = Date.now();
  const rows = (await store.sql(`SELECT q.*,p.rating,p.reliability,a.birth_date FROM pitch_queue q
    JOIN pitch_profiles p ON p.player_id=q.player_id JOIN pitch_accounts a ON a.player_id=q.player_id
    WHERE q.band=? AND q.room_id IS NULL AND q.expires_at>? AND p.banned_until<=?
    AND (q.priority=0 OR p.priority_credits>0) ORDER BY q.priority DESC,q.joined_at LIMIT 80`, band, now, now).all<QueueRow>()).results.filter(r => ageBand(r.birth_date, now) === band);
  if (rows.length < 5) return;
  const ids = rows.map(r => r.player_id); const marks = ids.map(() => '?').join(',');
  const blocked = (await store.sql(`SELECT player_id,target_id FROM pitch_blocks WHERE player_id IN (${marks}) OR target_id IN (${marks})`, ...ids, ...ids).all<{player_id:string;target_id:string}>()).results;
  const compatible = (a: QueueRow, b: QueueRow) => a.player_id !== b.player_id && !blocked.some(r => (r.player_id === a.player_id && r.target_id === b.player_id) || (r.player_id === b.player_id && r.target_id === a.player_id));
  const contestants = rows.filter(r => r.role !== 'judge');
  for (const a of contestants) {
    const opponents = contestants.filter(b => compatible(a, b) && Math.abs(a.rating - b.rating) <= 150 + Math.floor(Math.max(now - a.joined_at, now - b.joined_at) / 20_000) * 200);
    for (const b of opponents) {
      const judges: QueueRow[] = [];
      const pool = rows.filter(j => j.role !== 'contestant' && compatible(a, j) && compatible(b, j))
        .sort((x, y) => (y.reliability + (now - y.joined_at) / 2000) - (x.reliability + (now - x.joined_at) / 2000));
      for (const j of pool) if (judges.every(other => compatible(j, other))) { judges.push(j); if (judges.length === 3) break; }
      if (judges.length !== 3) continue;
      const contestantsInOrder = crypto.getRandomValues(new Uint8Array(1))[0] % 2 ? [a, b] : [b, a];
      const group = [...contestantsInOrder, ...judges];
      const roomId = crypto.randomUUID(); const code = roomId.replaceAll('-', '').slice(0, 8).toUpperCase();
      const library = SCENARIOS.filter(s => s.band === band);
      const scenario = library[crypto.getRandomValues(new Uint32Array(1))[0] % library.length];
      const groupIds = group.map(r => r.player_id); const gMarks = group.map(() => '?').join(',');
      const guard = group.map(() => '(q.player_id=? AND q.ticket=?)').join(' OR ');
      const result = await store.env.DB.batch([
        store.sql(`INSERT INTO pitch_rooms(id,code,band,scenario_id,scenario_json,a_id,b_id,started_at)
          SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM pitch_queue q JOIN pitch_profiles p ON p.player_id=q.player_id
          WHERE (${guard}) AND q.room_id IS NULL AND q.expires_at>? AND p.banned_until<=? AND (q.priority=0 OR p.priority_credits>0))=5
          AND NOT EXISTS(SELECT 1 FROM pitch_blocks WHERE player_id IN (${gMarks}) AND target_id IN (${gMarks}))`,
        roomId, code, band, scenario.id, JSON.stringify(scenario), group[0].player_id, group[1].player_id, now, ...group.flatMap(r => [r.player_id, r.ticket]), now, now, ...groupIds, ...groupIds),
        ...group.map((r, index) => store.sql(`INSERT INTO pitch_seats(room_id,player_id,role,slot,last_seen)
          SELECT id,?,?,?,? FROM pitch_rooms WHERE id=?`, r.player_id, index < 2 ? 'contestant' : 'judge', index, now, roomId)),
        ...group.slice(0, 2).filter(r => r.priority).map(r => store.sql(`UPDATE pitch_profiles SET priority_credits=priority_credits-1
          WHERE player_id=? AND EXISTS(SELECT 1 FROM pitch_rooms WHERE id=?)`, r.player_id, roomId)),
        store.sql(`UPDATE pitch_queue SET room_id=? WHERE player_id IN (${gMarks}) AND EXISTS(SELECT 1 FROM pitch_rooms WHERE id=?)`, roomId, ...groupIds, roomId),
      ]);
      if (result[0].meta.changes) return;
      // Another worker claimed this group. Let the next poll use a fresh candidate snapshot.
      return;
    }
  }
}

export async function enqueue(store: Store, player: Player, account: Account, mode: unknown) {
  const band = ageBand(account.birth_date);
  if (!band) fail(403, 'AGE_GATE', 'This prototype supports ages 14 and up.');
  const stats = await profile(store, player.id);
  if (stats.banned_until > Date.now()) fail(403, 'QUEUE_BANNED', `You can queue again at ${new Date(stats.banned_until).toISOString()}.`);
  if (!['quick', 'mixed', 'contestant', 'judge', 'priority'].includes(mode as string)) fail(400, 'INVALID_QUEUE', 'Choose quick, contestant, judge, or priority.');
  if (mode === 'priority' && !stats.priority_credits) fail(409, 'NO_PRIORITY_CREDIT', 'Complete two rounds as a judge to earn a priority credit.');
  const priority = (mode === 'quick' || mode === 'mixed' || mode === 'priority') && stats.priority_credits > 0 ? 1 : 0;
  const role = priority ? 'contestant' : mode === 'quick' || mode === 'mixed' ? 'mixed' : mode as string;
  const current = await store.sql('SELECT * FROM pitch_queue WHERE player_id=?', player.id).first<QueueRow>();
  if (current?.room_id) return;
  if (current && current.expires_at > Date.now()) { await match(store, band); return; }
  const now = Date.now();
  await store.sql(`INSERT INTO pitch_queue(player_id,ticket,role,priority,band,joined_at,expires_at) VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(player_id) DO UPDATE SET ticket=excluded.ticket,role=excluded.role,priority=excluded.priority,band=excluded.band,
    joined_at=excluded.joined_at,expires_at=excluded.expires_at WHERE pitch_queue.room_id IS NULL AND pitch_queue.expires_at<=?`,
  player.id, crypto.randomUUID(), role, priority, band, now, now + 120_000, now).run();
  await match(store, band);
}
