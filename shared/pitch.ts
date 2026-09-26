/** Public wire contract. Safe to import from browser code; contains no server/database imports. */
export const PITCH_API_VERSION = 'pitch.v1';
export type AgeBand = '14–17' | '18–22' | '23+';
export type QueueMode = 'quick' | 'contestant' | 'judge' | 'priority' | 'mixed';
export type Role = 'contestant' | 'judge';
export type FeedbackRating = 'helpful' | 'unhelpful' | 'abusive';
export type ReportReason = 'harassment' | 'unsafe-contact' | 'abusive-feedback' | 'cheating' | 'other';
export interface Player { id: string; name: string }
export interface Session { player: Player; token: string; expiresAt: number }
export interface Signup { name: string; email: string; password: string; birthDate: string; acceptedConduct: true }
export interface Rubric { clarity: number; persuasiveness: number; composure: number; tip: string }
export interface Ballot { winnerId: string; a: Rubric; b: Rubric }
export interface Scenario { id: string; band: string; category: string; title: string; prompt: string; goal: string; positions: string[] | null }
export interface Phase { key: string; label: string; seconds: number; speaker: number | null }
export interface RoomPhase extends Phase { index: number; deadline: number; expired: boolean }
export interface PitchConfig {
  name: string; apiVersion: typeof PITCH_API_VERSION;
  capabilities: {
    emailPassword: boolean; googleSignIn: boolean; emailVerification: boolean; passwordRecovery: boolean;
    humanJudging: boolean; aiPractice: boolean; voice: boolean; voiceChanging: boolean;
    video: boolean; transcripts: boolean; customLobbies: boolean; tournaments: boolean;
    reporting: boolean; blocking: boolean; moderatorReviewConfigured: boolean;
  };
  rules: {
    version: string; initialRating: number; provisionalGames: number; provisionalK: number; establishedK: number;
    floor: number; forfeitWinMultiplier: number; judgesPerRound: number; contestantsPerRound: number;
    judgedRoundsPerPriorityCredit: number; queueTimeoutSeconds: number; disconnectGraceSeconds: number;
    firstLeaveBanSeconds: number; repeatLeaveBanSeconds: number; phases: Phase[];
    rubric: string[]; scoreRange: number[]; aiEnabled: boolean;
  };
  scenarios: Scenario[];
}
export interface PitchMe {
  player: Player; ageBand: AgeBand | null;
  rating: { value: number; games: number; provisional: boolean; placementGamesRemaining: number };
  judge: { reliability: number; roundsCompleted: number; progressToCredit: number };
  priorityCredits: number; bannedUntil: number; moderator: boolean; activeRoom: string | null; blockedPlayers: { id: string }[];
}
export interface RatingChange {
  playerId: string; before: number; after: number; delta: number; gamesBefore: number; gamesAfter: number;
  k: number; expected: number; result: string;
}
export type RubricAverages = Record<string, number | null>;
export interface RoundResult {
  winnerId: string | null; reason: string; voteCount: number; ratingVersion: string; finishedAt: number;
  scores: { playerId: string; votes: number; averages: RubricAverages | null }[]; ratingChanges: RatingChange[];
}
export interface Feedback extends Rubric { ballotId: string; playerId: string; rating: string | null }
export interface PitchRoomView {
  id: string; code: string; status: 'active' | 'finished' | 'cancelled'; band: string; scenario: Scenario;
  yourPosition: string | null; serverTime: number; startedAt: number; phase: RoomPhase; role: Role; yourSlot: number; left: boolean;
  participants: (Player & { role: Role; slot: number; left: boolean; position: string | null; submitted: boolean })[];
  responses: { playerId: string; phase: number; content: string; createdAt: number }[];
  ballotSubmitted: boolean; ballotsReceived: number; result: RoundResult | null; feedback: Feedback[];
}
export type PitchQueue =
  | { status: 'idle'; serverTime: number }
  | { status: 'expired'; serverTime: number; message: string }
  | { status: 'waiting'; serverTime: number; mode: string; priority: boolean; band: string; joinedAt: number; expiresAt: number; message: string }
  | { status: 'matched'; serverTime: number; room: PitchRoomView };
export interface HistoryFeedback extends Rubric { ballotId: string; roomId: string; rating: string | null }
export interface PitchHistory {
  history: { code: string; scenario: Scenario; result: string; before: number; after: number; delta: number; finishedAt: number | null; feedback: HistoryFeedback[] }[];
  averages: RubricAverages; scope: string;
  byCategory: { category: string; games: number; wins: number; winRate: number | null }[];
}
export interface PitchLeaderboard {
  band: AgeBand | null; weekStartsAt: number;
  players: { playerId: string; name: string; rating: number; games: number; weeklyGain: number; weeklyGames: number }[];
}
export interface VoiceConfig {
  iceServers: { urls: string | string[]; username?: string; credential?: string }[];
  pollMs: number; recording: boolean; transport: string; relayConfigured: boolean;
}
export type VoiceMessage =
  | { kind: 'offer' | 'answer'; payload: { type: 'offer' | 'answer'; sdp: string } }
  | { kind: 'candidate'; payload: { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null; usernameFragment?: string | null } };
export type VoiceSignal = VoiceMessage & { id: number; senderId: string };
export interface SignalPage { signals: VoiceSignal[]; cursor: number }
export interface Reports {
  reports: { id: string; roomId: string; roomCode: string; reason: string; details: string; createdAt: number; targetId: string; targetName: string }[];
}
