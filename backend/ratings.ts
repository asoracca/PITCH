import type { Store } from './store';
import type { RatingChange, RatingSummary } from './types';

export const RATING_RULES = {
  name: 'Beef Rating', version: 'br-v1', algorithm: 'elo', startingRating: 1000,
  minimumRating: 100, placementGames: 5, placementK: 40, establishedK: 24, scale: 400,
  scope: 'public_human_debates', pool: 'all_formats',
  expectedScoreFormula: '1 / (1 + 10 ** ((opponentRating - rating) / 400))',
  changeFormula: 'round(K * (result - expectedScore)), limited by the minimum rating',
  results: { win: 1, draw: 0.5, loss: 0 },
  scoreMarginAffectsRating: false,
} as const;

export interface RatingSnapshot { playerId: string; rating: number; games: number }

export function summarizeRating(snapshot: RatingSnapshot): RatingSummary {
  return { value: snapshot.rating, games: snapshot.games, provisional: snapshot.games < RATING_RULES.placementGames,
    placementGamesRemaining: Math.max(0, RATING_RULES.placementGames - snapshot.games), version: RATING_RULES.version };
}

export async function ratingSnapshot(store: Store, playerId: string): Promise<RatingSnapshot> {
  const row = await store.sql('SELECT rating,games FROM player_ratings WHERE player_id=?', playerId)
    .first<{ rating: number; games: number }>();
  return { playerId, rating: row?.rating ?? RATING_RULES.startingRating, games: row?.games ?? 0 };
}

export function calculateRating(player: RatingSnapshot, opponent: RatingSnapshot, winnerId: string | null): RatingChange {
  const result = winnerId === null ? 'draw' : winnerId === player.playerId ? 'win' : 'loss';
  const outcome = RATING_RULES.results[result];
  const expectedScore = 1 / (1 + 10 ** ((opponent.rating - player.rating) / RATING_RULES.scale));
  const k = player.games < RATING_RULES.placementGames ? RATING_RULES.placementK : RATING_RULES.establishedK;
  const raw = k * (outcome - expectedScore);
  // Round half away from zero so mirrored wins/losses round consistently.
  const after = Math.max(RATING_RULES.minimumRating, player.rating + Math.sign(raw) * Math.round(Math.abs(raw)));
  return { playerId: player.playerId, opponentId: opponent.playerId, opponentRating: opponent.rating,
    before: player.rating, after, delta: after - player.rating, gamesBefore: player.games, gamesAfter: player.games + 1,
    result, expectedScore, k, provisional: player.games + 1 < RATING_RULES.placementGames, version: RATING_RULES.version };
}

/** Used in the same D1 transaction as the verdict. The room claim gates every write. */
export function ratingStatements(store: Store, roomId: string, commitId: string, changes: RatingChange[], now: number) {
  return changes.flatMap(change => [
    store.sql(`INSERT INTO rating_events
      (room_id,player_id,opponent_id,opponent_rating,before_rating,after_rating,delta,games_before,result,expected_score,k,version,created_at)
      SELECT id,?,?,?,?,?,?,?,?,?,?,?,? FROM rooms WHERE id=? AND judge_lease=? AND status='finished' AND kind='public'`,
    change.playerId, change.opponentId, change.opponentRating, change.before, change.after, change.delta,
    change.gamesBefore, change.result, change.expectedScore, change.k, change.version, now, roomId, commitId),
    store.sql(`INSERT INTO player_ratings (player_id,rating,games,updated_at)
      SELECT ?,?,?,? FROM rooms WHERE id=? AND judge_lease=? AND status='finished' AND kind='public'
      ON CONFLICT(player_id) DO UPDATE SET rating=excluded.rating,games=excluded.games,updated_at=excluded.updated_at`,
    change.playerId, change.after, change.gamesAfter, now, roomId, commitId),
  ]);
}

export async function ratingHistory(store: Store, playerId: string, limit: number) {
  return (await store.sql(`SELECT e.room_id AS roomId,r.code AS roomCode,r.format,e.opponent_id AS opponentId,
    p.name AS opponentName,e.opponent_rating AS opponentRating,e.before_rating AS before,e.after_rating AS after,
    e.delta,e.games_before+1 AS gamesAfter,e.result,e.expected_score AS expectedScore,e.k,e.version,e.created_at AS createdAt
    FROM rating_events e JOIN rooms r ON r.id=e.room_id JOIN players p ON p.id=e.opponent_id
    WHERE e.player_id=? ORDER BY e.games_before DESC LIMIT ?`, playerId, limit).all()).results;
}
