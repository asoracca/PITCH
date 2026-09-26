import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index, primaryKey, check, uniqueIndex } from 'drizzle-orm/sqlite-core';

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
