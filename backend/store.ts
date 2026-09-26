import { fail, sha256, token } from './http';
import { PHASES, FORMATS, TOPICS, type Format } from './topics';
import { RATING_RULES } from './ratings';
import type { ArgumentRow, Env, Player, Room, RoomView, Verdict } from './types';

const DAY = 86_400_000;
export class Store {
  constructor(public env: Env) {}
  sql(query: string, ...args: (string | number | null)[]) { return this.env.DB.prepare(query).bind(...args); }

  async limit(key: string, max: number, windowMs = 60_000) {
    const now = Date.now(); const bucket = `${key}:${Math.floor(now / windowMs)}`;
    const row = await this.sql(`INSERT INTO rate_limits (key,hits,expires_at) VALUES (?,1,?)
      ON CONFLICT(key) DO UPDATE SET hits = hits + 1 RETURNING hits`, bucket, now + windowMs).first<{ hits: number }>();
    if (!row || row.hits > max) fail(429, 'RATE_LIMITED', 'Too many requests. Please try again later.');
  }
  async createSession(name: string) {
    const player = { id: crypto.randomUUID(), name }; const secret = token();
    const expiresAt = Date.now() + 30 * DAY;
    await this.env.DB.batch([
      this.sql('INSERT INTO players (id,name,created_at) VALUES (?,?,?)', player.id, name, Date.now()),
      this.sql('INSERT INTO sessions (token_hash,player_id,expires_at) VALUES (?,?,?)', await sha256(secret), player.id, expiresAt),
      this.sql('DELETE FROM rate_limits WHERE key IN (SELECT key FROM rate_limits WHERE expires_at < ? LIMIT 500)', Date.now()),
      this.sql('DELETE FROM sessions WHERE token_hash IN (SELECT token_hash FROM sessions WHERE expires_at < ? LIMIT 100)', Date.now()),
    ]);
    return { player, token: secret, expiresAt };
  }
  async authenticate(request: Request): Promise<Player> {
    const value = request.headers.get('authorization');
    if (!value || !/^Bearer [a-f0-9]{64}$/.test(value)) fail(401, 'UNAUTHORIZED', 'A valid player session is required.');
    const player = await this.sql(`SELECT p.id,p.name FROM sessions s JOIN players p ON p.id=s.player_id
      WHERE s.token_hash=? AND s.expires_at>?`, await sha256(value.slice(7)), Date.now()).first<Player>();
    if (!player) fail(401, 'UNAUTHORIZED', 'This session has expired or was signed out.');
    return player;
  }
  async room(code: string, player: Player): Promise<Room> {
    const room = await this.sql('SELECT * FROM rooms WHERE code=?', code.toUpperCase()).first<Room>();
    // Room codes authorize joining a waiting room; they never authorize reading its transcript.
    if (!room || ![room.host_id, room.guest_id, room.judge_id].includes(player.id)) fail(404, 'ROOM_NOT_FOUND', 'Room not found.');
    return room;
  }
  playable(room: Room) {
    if (room.expires_at <= Date.now() && room.status !== 'finished') fail(410, 'ROOM_EXPIRED', 'This room has expired. Create a new room.');
  }
  async createRoom(player: Player, topic: string, hostFor?: number, rematchOf: string | null = null, format: Format = 'classic'): Promise<Room> {
    const now = Date.now(); const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), n => alphabet[n % alphabet.length]).join('');
      const id = crypto.randomUUID();
      const result = await this.sql(`INSERT INTO rooms
        (id,code,host_id,host_for,topic,status,round,created_at,expires_at,rematch_of,format)
        VALUES (?,?,?,?,?,'waiting',0,?,?,?,?) ON CONFLICT(code) DO NOTHING`,
      id, code, player.id, hostFor ?? (crypto.getRandomValues(new Uint8Array(1))[0] % 2), topic, now, now + DAY, rematchOf, format).run();
      if (result.meta.changes) return this.room(code, player);
    }
    fail(503, 'ROOM_CREATION_FAILED', 'Please try creating a room again.');
  }
  async joinRoom(code: string, player: Player): Promise<Room> {
    const room = await this.sql('SELECT * FROM rooms WHERE code=?', code.toUpperCase()).first<Room>();
    if (!room) fail(404, 'ROOM_NOT_FOUND', 'Room not found.');
    this.playable(room);
    if (room.host_id === player.id || room.guest_id === player.id) return room;
    if (room.status !== 'waiting' || room.guest_id) fail(409, 'ROOM_UNAVAILABLE', 'This room is full or has already started.');
    if (room.rematch_of) {
      const previous = await this.sql('SELECT host_id,guest_id FROM rooms WHERE id=?', room.rematch_of).first<Room>();
      if (!previous || ![previous.host_id, previous.guest_id].includes(player.id)) fail(403, 'REMATCH_RESERVED', 'This rematch is reserved for the previous players.');
    }
    const changed = await this.sql(`UPDATE rooms SET guest_id=? WHERE id=? AND status='waiting'
      AND guest_id IS NULL AND expires_at>?`, player.id, room.id, Date.now()).run();
    if (!changed.meta.changes) fail(409, 'ROOM_UNAVAILABLE', 'Another player joined first.');
    return this.room(code, player);
  }
  async start(room: Room, player: Player) {
    this.playable(room);
    if (room.host_id !== player.id) fail(403, 'HOST_REQUIRED', 'Only the host can start this match.');
    if (room.status === 'active') return;
    const changed = await this.sql(`UPDATE rooms SET status='active',round=0,deadline=?
      WHERE id=? AND status='waiting' AND guest_id IS NOT NULL AND expires_at>?
      AND NOT EXISTS (SELECT 1 FROM rooms r WHERE r.id!=rooms.id AND r.status IN ('active','judging') AND r.expires_at>?
        AND (r.host_id IN (rooms.host_id,rooms.guest_id) OR r.guest_id IN (rooms.host_id,rooms.guest_id) OR r.judge_id IN (rooms.host_id,rooms.guest_id)))`,
    Date.now() + FORMATS[room.format as Format].roundSeconds[0] * 1000, room.id, Date.now(), Date.now()).run();
    if (!changed.meta.changes) fail(409, 'NOT_READY', 'Two available players must join a waiting room before it starts. Finish other active matches first.');
  }
  async advance(room: Room) {
    this.playable(room);
    if (room.status !== 'active') return;
    const now = Date.now(); const last = room.round === 2;
    // Compare-and-set makes simultaneous submissions and timeout requests advance only once.
    await this.sql(`UPDATE rooms SET round=?,deadline=?,status=?
      WHERE id=? AND status='active' AND round=? AND expires_at>?
      AND (deadline<=? OR (SELECT COUNT(*) FROM arguments WHERE room_id=? AND round=?)=2)`,
    last ? 2 : room.round + 1, last ? null : now + FORMATS[room.format as Format].roundSeconds[room.round + 1] * 1000,
    last ? 'judging' : 'active', room.id, room.round, now, now, room.id, room.round).run();
  }
  async submit(room: Room, player: Player, round: number, content: string) {
    this.playable(room);
    if (player.id === room.judge_id) fail(403, 'CONTESTANT_REQUIRED', 'The judge cannot submit contestant arguments.');
    const existing = await this.sql('SELECT content FROM arguments WHERE room_id=? AND player_id=? AND round=?', room.id, player.id, round).first<{content: string}>();
    if (existing) {
      if (existing.content !== content) fail(409, 'ARGUMENT_LOCKED', 'A submitted argument cannot be changed.');
      await this.advance(room); return;
    }
    if (room.status !== 'active' || room.round !== round) fail(409, 'ROUND_CHANGED', 'Refresh the room before submitting.');
    const now = Date.now();
    const changed = await this.sql(`INSERT INTO arguments (room_id,player_id,round,content,created_at)
      SELECT id,?,?,?,? FROM rooms WHERE id=? AND status='active' AND round=? AND deadline>? AND expires_at>?
      AND (host_id=? OR guest_id=?) ON CONFLICT(room_id,player_id,round) DO NOTHING`,
    player.id, round, content, now, room.id, round, now, now, player.id, player.id).run();
    if (!changed.meta.changes) {
      const duplicate = await this.sql('SELECT content FROM arguments WHERE room_id=? AND player_id=? AND round=?', room.id, player.id, round).first<{content: string}>();
      if (duplicate?.content === content) { await this.advance(room); return; }
      await this.advance(room);
      fail(409, 'ROUND_CLOSED', 'The round closed or your argument is already locked. Refresh the room.');
    }
    await this.advance(room);
  }
  async arguments(room: Room): Promise<ArgumentRow[]> {
    return (await this.sql('SELECT * FROM arguments WHERE room_id=? ORDER BY round,created_at,player_id', room.id).all<ArgumentRow>()).results;
  }
  async view(room: Room, player: Player): Promise<RoomView> {
    const [participants, args] = await Promise.all([
      this.sql('SELECT id,name FROM players WHERE id=? OR id=? OR id=?', room.host_id, room.guest_id, room.judge_id).all<Player>(), this.arguments(room),
    ]);
    const now = Date.now();
    const side = (id: string): 'for' | 'against' => ((id === room.host_id) === Boolean(room.host_for)) ? 'for' : 'against';
    return { id: room.id, code: room.code, topic: room.topic, status: room.status, round: room.round,
      phase: room.status === 'active' ? PHASES[room.round] : room.status, deadline: room.deadline,
      serverTime: now, expiresAt: room.expires_at, hostId: room.host_id, yourSide: player.id === room.judge_id ? null : side(player.id),
      yourRole: player.id === room.judge_id ? 'judge' : 'contestant', judgeId: room.judge_id, kind: room.kind, format: room.format,
      players: participants.results.map(p => ({ ...p, side: p.id === room.judge_id ? null : side(p.id), role: p.id === room.judge_id ? 'judge' : 'contestant', submitted: args.some(a => a.round === room.round && a.player_id === p.id) })),
      arguments: args.filter(a => a.player_id === player.id || a.round < room.round || room.status === 'judging' || room.status === 'finished' ||
        (room.status === 'active' && room.deadline !== null && room.deadline <= now))
        .map(a => ({ playerId: a.player_id, round: a.round, content: a.content, createdAt: a.created_at })),
      verdict: room.verdict ? JSON.parse(room.verdict) as Verdict : null,
      judgingAvailable: Boolean(room.judge_id || (this.env.OPENAI_API_KEY && this.env.OPENAI_MODEL)), rematchOf: room.rematch_of };
  }
  async history(player: Player, limit: number) {
    return (await this.sql(`SELECT id,code,topic,status,created_at AS createdAt,finished_at AS finishedAt
      FROM rooms WHERE host_id=? OR guest_id=? OR judge_id=? ORDER BY created_at DESC LIMIT ?`, player.id, player.id, player.id, limit).all()).results;
  }
  async leaderboard(limit: number) {
    const rows = (await this.sql(`SELECT p.id AS playerId,p.name,r.rating,r.games AS matches,
      SUM(e.result='win') AS wins,SUM(e.result='loss') AS losses,SUM(e.result='draw') AS draws,
      ROUND(AVG(s.score),1) AS averageScore
      FROM player_ratings r JOIN players p ON p.id=r.player_id JOIN rating_events e ON e.player_id=p.id
      JOIN score_events s ON s.room_id=e.room_id AND s.player_id=e.player_id
      WHERE r.games>0 GROUP BY p.id,p.name,r.rating,r.games
      ORDER BY r.rating DESC,r.games DESC,p.id ASC LIMIT ?`, limit).all<{playerId: string; name: string; rating: number; matches: number; wins: number; losses: number; draws: number; averageScore: number}>()).results;
    return rows.map(row => ({ ...row, provisional: row.matches < RATING_RULES.placementGames }));
  }
}

export function chooseTopic(body: Record<string, unknown>): string {
  if (body.topicId !== undefined) {
    const found = TOPICS.find(t => t.id === body.topicId);
    if (!found) fail(400, 'INVALID_TOPIC', 'Select a topic returned by /api/topics.');
    return found.text;
  }
  return TOPICS[crypto.getRandomValues(new Uint32Array(1))[0] % TOPICS.length].text;
}
