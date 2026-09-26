import type { Database } from './database';
export interface Env {
  DB: Database;
  ASSETS?: { fetch(request: Request): Promise<Response> };
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  CORS_ORIGINS?: string;
  VOICE_ICE_SERVERS?: string;
}
export type RoomStatus = 'waiting' | 'active' | 'judging' | 'finished' | 'cancelled';
export interface Room {
  id: string; code: string; host_id: string; guest_id: string | null;
  judge_id: string | null; kind: 'private' | 'public' | 'bot'; format: string;
  host_for: number; topic: string; status: RoomStatus; round: number;
  deadline: number | null; created_at: number; expires_at: number;
  rematch_of: string | null; judge_lease: string | null; judge_until: number | null;
  verdict: string | null; finished_at: number | null;
}
export interface Player { id: string; name: string }
export interface ArgumentRow { room_id: string; player_id: string; round: number; content: string; created_at: number }
export interface PlayerScore { playerId: string; reasoning: number; rebuttal: number; clarity: number; total: number; feedback: string; bestQuote: string }
export interface RatingSummary { value: number; games: number; provisional: boolean; placementGamesRemaining: number; version: 'br-v1' }
export interface RatingChange {
  playerId: string; opponentId: string; opponentRating: number; before: number; after: number; delta: number;
  gamesBefore: number; gamesAfter: number; result: 'win' | 'loss' | 'draw'; expectedScore: number; k: number;
  provisional: boolean; version: 'br-v1';
}
export interface Verdict { winnerId: string | null; summary: string; scores: PlayerScore[]; judgedAt: number; model: string | null; rubricVersion: '1'; kind: 'ai' | 'human'; ratingChanges?: RatingChange[] }
export interface RoomView {
  id: string; code: string; topic: string; status: RoomStatus;
  round: number; phase: string; deadline: number | null; serverTime: number;
  expiresAt: number; hostId: string; yourSide: 'for' | 'against' | null; yourRole: 'contestant' | 'judge';
  judgeId: string | null; kind: string; format: string;
  players: { id: string; name: string; side: 'for' | 'against' | null; role: 'contestant' | 'judge'; submitted: boolean }[];
  arguments: { playerId: string; round: number; content: string; createdAt: number }[];
  verdict: Verdict | null; judgingAvailable: boolean; rematchOf: string | null;
}
