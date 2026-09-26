import { fail, textField } from '../http';
import { Store } from '../store';
import type { Player } from '../types';
import { seats } from './game';
import type { PitchRoom } from './types';

export function voiceConfig(store: Store) {
  let iceServers: unknown = [{ urls: 'stun:stun.l.google.com:19302' }];
  if (store.env.VOICE_ICE_SERVERS) { try { iceServers = JSON.parse(store.env.VOICE_ICE_SERVERS); } catch { fail(503, 'VOICE_CONFIG', 'Voice configuration is invalid.'); } }
  if (!Array.isArray(iceServers)) fail(503, 'VOICE_CONFIG', 'Voice configuration is invalid.');
  return { iceServers, pollMs: 2000, recording: false, transport: 'peer-to-peer',
    relayConfigured: iceServers.some(s => JSON.stringify(s).includes('turn:') || JSON.stringify(s).includes('turns:')) };
}
export async function signals(store: Store, room: PitchRoom, player: Player, after: string | null, body?: Record<string, unknown>) {
  const members = await seats(store, room); const self = members.find(s => s.player_id === player.id)!;
  if (room.status !== 'active' || self.left_at) fail(409, 'VOICE_CLOSED', 'Voice and video connections close when you leave or the round ends.');
  if (body) {
    const targetId = textField(body.targetId, 'Audio recipient', 100);
    const target = members.find(s => s.player_id === targetId && !s.left_at);
    if (!target || targetId === player.id || (target.role === 'judge' && self.role === 'judge')) fail(400, 'INVALID_TARGET', 'Audio is only shared with participants in this round.');
    const kind = body.kind as string; const payload = body.payload as Record<string, unknown> | undefined;
    if (!['offer', 'answer', 'candidate'].includes(kind) || !payload || typeof payload !== 'object') fail(400, 'INVALID_SIGNAL', 'Invalid audio connection message.');
    if (kind === 'candidate' ? typeof payload.candidate !== 'string' || payload.candidate.length > 2000 : payload.type !== kind || typeof payload.sdp !== 'string' || payload.sdp.length > 24000) fail(400, 'INVALID_SIGNAL', 'Invalid voice or video connection message.');
    await store.limit(`pitch-signal:${player.id}`, 150);
    const now = Date.now();
    await store.env.DB.batch([
      store.sql(`INSERT INTO pitch_signals(room_id,sender_id,target_id,kind,payload,created_at) SELECT id,?,?,?,?,? FROM pitch_rooms WHERE id=? AND status='active'`, player.id, targetId, kind, JSON.stringify(payload), now, room.id),
      store.sql('DELETE FROM pitch_signals WHERE id IN (SELECT id FROM pitch_signals WHERE created_at<? LIMIT 100)', now - 300_000),
    ]);
    return { sent: true };
  }
  if (after !== null && (!/^\d+$/.test(after) || !Number.isSafeInteger(Number(after)))) fail(400, 'INVALID_CURSOR', 'Invalid signal cursor.');
  const rows = (await store.sql(`SELECT id,sender_id AS senderId,kind,payload FROM pitch_signals WHERE room_id=? AND target_id=? AND id>? AND created_at>? ORDER BY id LIMIT 100`,
  room.id, player.id, Number(after ?? 0), Date.now() - 300_000).all<{id:number;senderId:string;kind:string;payload:string}>()).results;
  return { signals: rows.map(r => ({ ...r, payload: JSON.parse(r.payload) })), cursor: rows.at(-1)?.id ?? Number(after ?? 0) };
}
