import type { RoundResult, SpectatorRound, SpectatorList } from '../../shared/pitch';
import { fail } from '../http';
import type { Store } from '../store';
import type { Player } from '../types';
import { ageBand } from './auth';
import { scenarioFor, seats } from './game';
import { phaseAt } from './scenarios';
import type { Account, PitchRoom } from './types';

// Public visibility is granted only when all participants explicitly opt in before matching.
// Spectator reads never refresh a seat, join a queue, resolve a room, or reveal private ballots/tips.
export async function spectate(store: Store, player: Player, account: Account, code?: string): Promise<SpectatorRound | SpectatorList> {
  const now = Date.now();
  const filters = `r.is_public=1 AND r.band=? AND NOT EXISTS (
    SELECT 1 FROM pitch_seats s JOIN pitch_blocks b ON
      (b.player_id=? AND b.target_id=s.player_id) OR (b.target_id=? AND b.player_id=s.player_id)
    WHERE s.room_id=r.id)`;
  const rooms = (await store.sql(`SELECT r.* FROM pitch_rooms r WHERE ${filters}
    ${code ? 'AND r.code=?' : "AND r.status='active' AND r.started_at>?"}
    ORDER BY r.started_at DESC LIMIT 12`, ageBand(account.birth_date), player.id, player.id, code?.toUpperCase() ?? now - 240_000).all<PitchRoom>()).results;
  if (code && !rooms.length) fail(404, 'PUBLIC_ROUND_NOT_FOUND', 'This public round is not available to you.');
  const views = await Promise.all(rooms.map(async room => {
    const timedPhase = phaseAt(room.started_at, now);
    const phase = room.judging_mode === 'peer' && timedPhase.index === 5 ? {...timedPhase,label:'Exchange opponent feedback'} : timedPhase;
    const [members, responses] = await Promise.all([
      seats(store, room),
      store.sql(`SELECT player_id AS playerId,phase,content,created_at AS createdAt FROM pitch_responses
        WHERE room_id=? AND (phase<? OR ?!='active') ORDER BY phase`, room.id, phase.index, room.status).all<SpectatorRound['responses'][number]>(),
    ]);
    const result: RoundResult | null = room.result ? JSON.parse(room.result) : null;
    return { code: room.code, status: room.status, band: room.band, scenario: scenarioFor(room), serverTime: now, phase,
      participants: members.map(s => ({ id: s.player_id, name: s.name, role: s.role, slot: s.slot, left: !!s.left_at })),
      responses: responses.results, result: result ? { winnerId: result.winnerId, reason: result.reason, scores: result.scores } : null } satisfies SpectatorRound;
  }));
  return code ? views[0] : { rooms: views, serverTime: now };
}
