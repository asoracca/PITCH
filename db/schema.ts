import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real, index, primaryKey, check, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const players = sqliteTable('players', {
  id: text('id').primaryKey(), name: text('name').notNull(),
  createdAt: integer('created_at').notNull(),
});
export const sessions = sqliteTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  playerId: text('player_id').notNull().references(() => players.id),
  expiresAt: integer('expires_at').notNull(),
}, t => [index('idx_sessions_expires').on(t.expiresAt)]);
export const rooms = sqliteTable('rooms', {
  id: text('id').primaryKey(), code: text('code').notNull(),
  hostId: text('host_id').notNull().references(() => players.id),
  guestId: text('guest_id').references(() => players.id),
  judgeId: text('judge_id').references(() => players.id),
  kind: text('kind').notNull().default('private'),
  format: text('format').notNull().default('classic'),
  hostFor: integer('host_for').notNull(), topic: text('topic').notNull(),
  status: text('status').notNull().default('waiting'),
  round: integer('round').notNull().default(0), deadline: integer('deadline'),
  createdAt: integer('created_at').notNull(), expiresAt: integer('expires_at').notNull(),
  rematchOf: text('rematch_of'), judgeLease: text('judge_lease'), judgeUntil: integer('judge_until'),
  verdict: text('verdict'), finishedAt: integer('finished_at'),
}, t => [uniqueIndex('idx_rooms_code').on(t.code),
  index('idx_rooms_host_created').on(t.hostId, t.createdAt),
  index('idx_rooms_guest_created').on(t.guestId, t.createdAt),
  check('room_distinct_players', sql`${t.guestId} IS NULL OR ${t.guestId} != ${t.hostId}`),
  check('room_distinct_judge', sql`${t.judgeId} IS NULL OR (${t.judgeId} != ${t.hostId} AND ${t.judgeId} != ${t.guestId})`),
  check('room_valid_status', sql`${t.status} IN ('waiting','active','judging','finished','cancelled')`),
  check('room_valid_round', sql`${t.round} BETWEEN 0 AND 2`),
  check('room_valid_side', sql`${t.hostFor} IN (0,1)`)]);
export const argumentsTable = sqliteTable('arguments', {
  roomId: text('room_id').notNull().references(() => rooms.id),
  playerId: text('player_id').notNull().references(() => players.id),
  round: integer('round').notNull(), content: text('content').notNull(),
  createdAt: integer('created_at').notNull(),
}, t => [primaryKey({ columns: [t.roomId, t.playerId, t.round] }),
  check('argument_valid_round', sql`${t.round} BETWEEN 0 AND 2`),
  check('argument_content_length', sql`length(${t.content}) BETWEEN 1 AND 600`)]);
export const scoreEvents = sqliteTable('score_events', {
  roomId: text('room_id').notNull().references(() => rooms.id),
  playerId: text('player_id').notNull().references(() => players.id),
  score: integer('score').notNull(), result: text('result').notNull(), createdAt: integer('created_at').notNull(),
}, t => [primaryKey({ columns: [t.roomId, t.playerId] }),
  index('idx_score_events_player').on(t.playerId),
  check('score_bounds', sql`${t.score} BETWEEN 0 AND 100`),
  check('score_result', sql`${t.result} IN ('win','loss','draw')`)]);
export const rateLimits = sqliteTable('rate_limits', {
  key: text('key').primaryKey(), hits: integer('hits').notNull(), expiresAt: integer('expires_at').notNull(),
}, t => [index('idx_rate_limits_expires').on(t.expiresAt)]);

export const queueEntries = sqliteTable('queue_entries', {
  playerId: text('player_id').primaryKey().references(() => players.id),
  role: text('role').notNull(), priority: integer('priority').notNull().default(0),
  format: text('format').notNull(), joinedAt: integer('joined_at').notNull(), expiresAt: integer('expires_at').notNull(),
  roomId: text('room_id').references(() => rooms.id),
}, t => [index('idx_queue_match').on(t.format, t.roomId, t.expiresAt, t.priority, t.joinedAt),
  check('queue_role', sql`${t.role} IN ('judge','contestant','mixed')`)]);
export const judgeRewards = sqliteTable('judge_rewards', {
  roomId: text('room_id').primaryKey().references(() => rooms.id),
  playerId: text('player_id').notNull().references(() => players.id),
  earnedAt: integer('earned_at').notNull(), consumedBy: text('consumed_by').references(() => rooms.id),
}, t => [index('idx_judge_rewards_available').on(t.playerId, t.consumedBy, t.earnedAt)]);
export const voiceSignals = sqliteTable('voice_signals', {
  id: integer('id').primaryKey({ autoIncrement: true }), roomId: text('room_id').notNull().references(() => rooms.id),
  senderId: text('sender_id').notNull().references(() => players.id), targetId: text('target_id').notNull().references(() => players.id),
  kind: text('kind').notNull(), payload: text('payload').notNull(), createdAt: integer('created_at').notNull(),
}, t => [index('idx_voice_signals_room_target_id').on(t.roomId, t.targetId, t.id)]);

export const playerRatings = sqliteTable('player_ratings', {
  playerId: text('player_id').primaryKey().references(() => players.id),
  rating: integer('rating').notNull().default(1000), games: integer('games').notNull().default(0),
  updatedAt: integer('updated_at').notNull(),
}, t => [index('idx_player_ratings_ranking').on(t.rating, t.games),
  check('rating_floor', sql`${t.rating} >= 100`), check('rated_games_nonnegative', sql`${t.games} >= 0`)]);

export const ratingEvents = sqliteTable('rating_events', {
  roomId: text('room_id').notNull().references(() => rooms.id),
  playerId: text('player_id').notNull().references(() => players.id),
  opponentId: text('opponent_id').notNull().references(() => players.id), opponentRating: integer('opponent_rating').notNull(),
  beforeRating: integer('before_rating').notNull(), afterRating: integer('after_rating').notNull(),
  delta: integer('delta').notNull(), gamesBefore: integer('games_before').notNull(),
  result: text('result').notNull(), expectedScore: real('expected_score').notNull(), k: integer('k').notNull(),
  version: text('version').notNull(), createdAt: integer('created_at').notNull(),
}, t => [primaryKey({ columns: [t.roomId, t.playerId] }),
  uniqueIndex('idx_rating_events_player_game').on(t.playerId, t.gamesBefore),
  check('rating_event_floor', sql`${t.beforeRating} >= 100 AND ${t.afterRating} >= 100 AND ${t.opponentRating} >= 100`),
  check('rating_event_delta', sql`${t.afterRating} - ${t.beforeRating} = ${t.delta}`),
  check('rating_event_result', sql`${t.result} IN ('win','loss','draw')`),
  check('rating_event_expected', sql`${t.expectedScore} BETWEEN 0 AND 1`),
  check('rating_event_opponent', sql`${t.playerId} != ${t.opponentId}`),
  check('rating_event_games', sql`${t.gamesBefore} >= 0`)]);

// Pitch v2 preserves existing Beef matches and ratings in their original tables.
export const pitchAccounts = sqliteTable('pitch_accounts', {
  playerId: text('player_id').primaryKey().references(() => players.id), email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(), passwordSalt: text('password_salt').notNull(),
  birthDate: text('birth_date').notNull(), acceptedAt: integer('accepted_at').notNull(),
});
export const pitchProfiles = sqliteTable('pitch_profiles', {
  avatarJson: text('avatar_json'),
  playerId: text('player_id').primaryKey().references(() => players.id), rating: integer('rating').notNull().default(1000),
  games: integer('games').notNull().default(0), reliability: integer('reliability').notNull().default(75),
  judged: integer('judged').notNull().default(0), priorityCredits: integer('priority_credits').notNull().default(0), bannedUntil: integer('banned_until').notNull().default(0),
}, t => [check('pitch_profile_bounds', sql`${t.rating} >= 100 AND ${t.games} >= 0 AND ${t.reliability} BETWEEN 0 AND 100 AND ${t.priorityCredits} >= 0`)]);
export const pitchRooms = sqliteTable('pitch_rooms', {
  id: text('id').primaryKey(), code: text('code').notNull().unique(), band: text('band').notNull(), scenarioId: text('scenario_id').notNull(),
  aId: text('a_id').notNull().references(() => players.id), bId: text('b_id').notNull().references(() => players.id), startedAt: integer('started_at').notNull(),
  status: text('status').notNull().default('active'), result: text('result'), resolutionToken: text('resolution_token'), finishedAt: integer('finished_at'),
  scenarioJson: text('scenario_json').notNull().default('{}'),
  isPublic: integer('is_public').notNull().default(0),
  judgingMode: text('judging_mode').notNull().default('judged'),
}, t => [check('pitch_room_players', sql`${t.aId} != ${t.bId}`), check('pitch_room_status', sql`${t.status} IN ('active','finished','cancelled')`)]);
export const pitchSeats = sqliteTable('pitch_seats', {
  roomId: text('room_id').notNull().references(() => pitchRooms.id), playerId: text('player_id').notNull().references(() => players.id),
  role: text('role').notNull(), slot: integer('slot').notNull(), lastSeen: integer('last_seen').notNull(), leftAt: integer('left_at'),
}, t => [primaryKey({ columns: [t.roomId, t.playerId] }), uniqueIndex('pitch_seat_slot').on(t.roomId, t.slot), index('pitch_seat_player').on(t.playerId),
  check('pitch_seat_role', sql`(${t.role}='contestant' AND ${t.slot} IN (0,1)) OR (${t.role}='judge' AND ${t.slot} BETWEEN 2 AND 4)`)]);
export const pitchQueue = sqliteTable('pitch_queue', {
  playerId: text('player_id').primaryKey().references(() => players.id), ticket: text('ticket').notNull(), role: text('role').notNull(), priority: integer('priority').notNull(),
  band: text('band').notNull(), joinedAt: integer('joined_at').notNull(), expiresAt: integer('expires_at').notNull(), roomId: text('room_id').references(() => pitchRooms.id),
  spectateOptIn: integer('spectate_opt_in').notNull().default(0),
  allowPeer: integer('allow_peer').notNull().default(0),
  category: text('category').notNull().default('all'),
}, t => [index('pitch_queue_waiting').on(t.band, t.roomId, t.expiresAt), check('pitch_queue_role', sql`${t.role} IN ('contestant','judge','mixed')`)]);
export const pitchBallots = sqliteTable('pitch_ballots', {
  id: text('id').primaryKey(), roomId: text('room_id').notNull().references(() => pitchRooms.id), judgeId: text('judge_id').notNull().references(() => players.id),
  winnerId: text('winner_id').notNull().references(() => players.id),
  aClarity: integer('a_clarity').notNull(), aPersuasiveness: integer('a_persuasiveness').notNull(), aComposure: integer('a_composure').notNull(), aTip: text('a_tip').notNull(),
  bClarity: integer('b_clarity').notNull(), bPersuasiveness: integer('b_persuasiveness').notNull(), bComposure: integer('b_composure').notNull(), bTip: text('b_tip').notNull(), createdAt: integer('created_at').notNull(),
}, t => [uniqueIndex('pitch_ballot_once').on(t.roomId, t.judgeId), check('pitch_ballot_scores', sql`${t.aClarity} BETWEEN 1 AND 5 AND ${t.aPersuasiveness} BETWEEN 1 AND 5 AND ${t.aComposure} BETWEEN 1 AND 5 AND ${t.bClarity} BETWEEN 1 AND 5 AND ${t.bPersuasiveness} BETWEEN 1 AND 5 AND ${t.bComposure} BETWEEN 1 AND 5`)]);
export const pitchRatings = sqliteTable('pitch_rating_events', {
  roomId: text('room_id').notNull().references(() => pitchRooms.id), playerId: text('player_id').notNull().references(() => players.id),
  before: integer('before_rating').notNull(), after: integer('after_rating').notNull(), delta: integer('delta').notNull(), gamesBefore: integer('games_before').notNull(),
  result: text('result').notNull(), reason: text('reason').notNull(), createdAt: integer('created_at').notNull(),
}, t => [primaryKey({ columns: [t.roomId, t.playerId] }), uniqueIndex('pitch_player_game').on(t.playerId, t.gamesBefore), check('pitch_rating_integrity', sql`${t.after} >= 100 AND ${t.after}-${t.before}=${t.delta}`)]);
export const pitchLeaves = sqliteTable('pitch_leaves', {
  roomId: text('room_id').notNull().references(() => pitchRooms.id), playerId: text('player_id').notNull().references(() => players.id), claim: text('claim').notNull(), createdAt: integer('created_at').notNull(),
}, t => [primaryKey({ columns: [t.roomId, t.playerId] }), index('pitch_leaves_recent').on(t.playerId, t.createdAt)]);
export const pitchBlocks = sqliteTable('pitch_blocks', {
  playerId: text('player_id').notNull().references(() => players.id), targetId: text('target_id').notNull().references(() => players.id), createdAt: integer('created_at').notNull(),
}, t => [primaryKey({ columns: [t.playerId, t.targetId] }), check('pitch_block_other', sql`${t.playerId} != ${t.targetId}`)]);
export const pitchReports = sqliteTable('pitch_reports', {
  id: text('id').primaryKey(), roomId: text('room_id').notNull().references(() => pitchRooms.id), reporterId: text('reporter_id').notNull().references(() => players.id), targetId: text('target_id').notNull().references(() => players.id),
  reason: text('reason').notNull(), details: text('details').notNull(), status: text('status').notNull().default('pending'), createdAt: integer('created_at').notNull(), reviewedAt: integer('reviewed_at'), reviewerId: text('reviewer_id'),
}, t => [index('pitch_reports_review').on(t.status, t.createdAt), uniqueIndex('pitch_report_once').on(t.roomId, t.reporterId, t.targetId)]);
export const pitchFeedback = sqliteTable('pitch_feedback_ratings', {
  id: text('id').primaryKey(), ballotId: text('ballot_id').notNull().references(() => pitchBallots.id), playerId: text('player_id').notNull().references(() => players.id), value: text('value').notNull(), createdAt: integer('created_at').notNull(),
}, t => [uniqueIndex('pitch_feedback_once').on(t.ballotId, t.playerId), check('pitch_feedback_value', sql`${t.value} IN ('helpful','unhelpful','abusive')`)]);
export const pitchResponses = sqliteTable('pitch_responses', {
  roomId: text('room_id').notNull().references(() => pitchRooms.id), playerId: text('player_id').notNull().references(() => players.id), phase: integer('phase').notNull(), content: text('content').notNull(), createdAt: integer('created_at').notNull(),
}, t => [primaryKey({ columns: [t.roomId, t.playerId, t.phase] })]);
export const pitchPeerFeedback = sqliteTable('pitch_peer_feedback', {
  id: text('id').primaryKey(), roomId: text('room_id').notNull().references(() => pitchRooms.id),
  authorId: text('author_id').notNull().references(() => players.id), targetId: text('target_id').notNull().references(() => players.id),
  clarity: integer('clarity').notNull(), persuasiveness: integer('persuasiveness').notNull(), composure: integer('composure').notNull(),
  tip: text('tip').notNull(), rating: text('rating'), createdAt: integer('created_at').notNull(),
}, t => [uniqueIndex('pitch_peer_feedback_once').on(t.roomId, t.authorId), check('pitch_peer_feedback_target', sql`${t.authorId} != ${t.targetId}`),
  check('pitch_peer_feedback_scores', sql`${t.clarity} BETWEEN 1 AND 5 AND ${t.persuasiveness} BETWEEN 1 AND 5 AND ${t.composure} BETWEEN 1 AND 5`)]);
export const pitchSignals = sqliteTable('pitch_signals', {
  id: integer('id').primaryKey({ autoIncrement: true }), roomId: text('room_id').notNull().references(() => pitchRooms.id), senderId: text('sender_id').notNull().references(() => players.id),
  targetId: text('target_id').notNull().references(() => players.id), kind: text('kind').notNull(), payload: text('payload').notNull(), createdAt: integer('created_at').notNull(),
}, t => [index('pitch_signal_receive').on(t.roomId, t.targetId, t.id)]);

export const pitchChat = sqliteTable('pitch_chat', {
  id: integer('id').primaryKey({autoIncrement:true}), roomId: text('room_id').notNull().references(()=>pitchRooms.id),
  playerId: text('player_id').notNull().references(()=>players.id), requestId: text('request_id').notNull(),
  kind: text('kind').notNull(), content: text('content').notNull(), createdAt: integer('created_at').notNull(),
}, t=>[index('pitch_chat_room').on(t.roomId,t.id),uniqueIndex('pitch_chat_once').on(t.roomId,t.playerId,t.requestId),check('pitch_chat_kind',sql`${t.kind} IN ('message','reaction')`)]);

export const pitchPracticeLogs = sqliteTable('pitch_practice_logs', {
  id: text('id').notNull(), playerId: text('player_id').notNull().references(()=>players.id),
  scenarioId: text('scenario_id').notNull(), scenarioJson: text('scenario_json').notNull(),
  transcript: text('transcript').notNull(), feedback: text('feedback').notNull(), deliveryJson: text('delivery_json'),
  createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
}, t=>[primaryKey({columns:[t.playerId,t.id]}),index('pitch_practice_player_date').on(t.playerId,t.createdAt)]);

export const pitchFriendships = sqliteTable('pitch_friendships', {
  playerA: text('player_a').notNull().references(() => players.id),
  playerB: text('player_b').notNull().references(() => players.id),
  requesterId: text('requester_id').notNull().references(() => players.id),
  status: text('status').notNull().default('pending'),
  createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
}, t => [primaryKey({ columns: [t.playerA,t.playerB] }), index('pitch_friends_recipient').on(t.playerB),
  check('pitch_friend_pair',sql`${t.playerA} < ${t.playerB}`),
  check('pitch_friend_requester',sql`${t.requesterId} IN (${t.playerA},${t.playerB})`),
  check('pitch_friend_status',sql`${t.status} IN ('pending','accepted')`)]);

export const pitchFollows = sqliteTable('pitch_follows', {
  followerId: text('follower_id').notNull().references(() => players.id),
  followedId: text('followed_id').notNull().references(() => players.id),
  createdAt: integer('created_at').notNull(),
}, t => [primaryKey({columns:[t.followerId,t.followedId]}),index('pitch_followed').on(t.followedId),check('pitch_no_self_follow',sql`${t.followerId} != ${t.followedId}`)]);

export const pitchMessages = sqliteTable('pitch_messages', {
  id: integer('id').primaryKey({autoIncrement:true}),
  senderId:text('sender_id').notNull().references(()=>players.id), recipientId:text('recipient_id').notNull().references(()=>players.id),
  requestId:text('request_id').notNull(),content:text('content').notNull(),createdAt:integer('created_at').notNull(),
},t=>[uniqueIndex('pitch_message_once').on(t.senderId,t.requestId),index('pitch_message_pair').on(t.senderId,t.recipientId,t.id),check('pitch_message_other',sql`${t.senderId} != ${t.recipientId}`)]);
