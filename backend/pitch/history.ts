import type { RoundHistoryPage } from '../../shared/pitch';
import { fail } from '../http';
import type { Store } from '../store';
import { scenarioFor } from './game';
import type { PitchRoom } from './types';

/** All completed seats are durable, even when no rating event was awarded. */
export async function roundHistory(store: Store, playerId: string, cursor: string | null = null): Promise<RoundHistoryPage> {
  const parsed = cursor && /^(\d{1,16}):([a-zA-Z0-9-]{1,100})$/.exec(cursor);
  if (cursor && !parsed) fail(400, 'INVALID_CURSOR', 'Reload round history and retry.');
  const before = parsed ? Number(parsed[1]) : null;
  const rows = (await store.sql(`SELECT r.*,s.role,a.name AS a_name,b.name AS b_name,
    e.result AS player_result,e.delta,COALESCE(r.finished_at,r.started_at) AS log_time
    FROM pitch_rooms r JOIN pitch_seats s ON s.room_id=r.id
    JOIN players a ON a.id=r.a_id JOIN players b ON b.id=r.b_id
    LEFT JOIN pitch_rating_events e ON e.room_id=r.id AND e.player_id=s.player_id
    WHERE s.player_id=? AND r.status IN ('finished','cancelled')
    ${parsed ? 'AND (COALESCE(r.finished_at,r.started_at) < ? OR (COALESCE(r.finished_at,r.started_at) = ? AND r.id < ?))' : ''}
    ORDER BY log_time DESC,r.id DESC LIMIT 51`, playerId, ...(parsed ? [before, before, parsed[2]] : [])).all<PitchRoom & {
      role: 'contestant' | 'judge'; a_name: string; b_name: string; player_result: string | null; delta: number | null; log_time: number;
    }>()).results;
  const page=rows.slice(0,50), last=page.at(-1);
  return {
    rounds: page.map(r=>({code:r.code,scenario:scenarioFor(r),role:r.role,status:r.status as 'finished'|'cancelled',judgingMode:r.judging_mode,
      finishedAt:r.log_time,contestants:[{id:r.a_id,name:r.a_name},{id:r.b_id,name:r.b_name}],
      result:r.player_result ?? (r.status==='cancelled'?'Cancelled':r.role==='judge'?'Judged':'Unrated'),delta:r.delta})),
    nextCursor:rows.length>50 && last ? `${last.log_time}:${last.id}` : null,
  };
}
