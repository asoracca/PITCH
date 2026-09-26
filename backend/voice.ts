import { fail, textField } from './http';
import { Store } from './store';
import type { Player, Room } from './types';

export function voiceConfig(store: Store) {
  let iceServers: unknown[] = [];
  if (store.env.VOICE_ICE_SERVERS) {
    try { iceServers = JSON.parse(store.env.VOICE_ICE_SERVERS); } catch { fail(503, 'VOICE_CONFIGURATION_ERROR', 'Voice connection settings are invalid.'); }
    if (!Array.isArray(iceServers)) fail(503, 'VOICE_CONFIGURATION_ERROR', 'Voice connection settings are invalid.');
  }
  return { transport: 'webrtc', iceServers, connectivityConfigured: iceServers.length > 0,
    audioProcessing: 'client', voiceChangerImplemented: false, signalingPollMs: 1500,
    message: 'Apply voice effects in the browser before attaching microphone tracks. This API exchanges connection messages only.' };
}
export async function sendSignal(store: Store, room: Room, player: Player, body: Record<string, unknown>) {
  store.playable(room);
  if (room.kind === 'bot' || !['waiting', 'active', 'judging'].includes(room.status)) fail(409, 'VOICE_UNAVAILABLE', 'Voice signaling is available in open human matches.');
  const target = textField(body.targetId, 'Target player', 100);
  if (target === player.id || ![room.host_id, room.guest_id, room.judge_id].includes(target)) fail(400, 'INVALID_TARGET', 'Select another person in this match.');
  if (!['offer', 'answer', 'candidate'].includes(body.kind as string)) fail(400, 'INVALID_SIGNAL', 'Use offer, answer, or candidate.');
  const payload = body.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) fail(400, 'INVALID_SIGNAL', 'payload must be a WebRTC message object.');
  const value = payload as Record<string, unknown>;
  if (body.kind === 'candidate') {
    if (typeof value.candidate !== 'string' || value.candidate.length > 2000) fail(400, 'INVALID_SIGNAL', 'A valid ICE candidate is required.');
  } else if (value.type !== body.kind || typeof value.sdp !== 'string' || !value.sdp || value.sdp.length > 6000) fail(400, 'INVALID_SIGNAL', 'A matching SDP offer or answer is required.');
  await store.limit(`voice:${player.id}`, 60);
  const now = Date.now();
  await store.env.DB.batch([
    store.sql('INSERT INTO voice_signals (room_id,sender_id,target_id,kind,payload,created_at) VALUES (?,?,?,?,?,?)', room.id, player.id, target, body.kind as string, JSON.stringify(payload), now),
    store.sql('DELETE FROM voice_signals WHERE id IN (SELECT id FROM voice_signals WHERE created_at<? LIMIT 500)', now - 600_000),
  ]);
}
export async function receiveSignals(store: Store, room: Room, player: Player, after: string | null) {
  if (after !== null && (!/^\d+$/.test(after) || !Number.isSafeInteger(Number(after)))) fail(400, 'INVALID_CURSOR', 'after must be a nonnegative integer.');
  const rows = (await store.sql(`SELECT id,sender_id AS senderId,kind,payload,created_at AS createdAt FROM voice_signals
    WHERE room_id=? AND target_id=? AND id>? AND created_at>? ORDER BY id LIMIT 100`, room.id, player.id, Number(after ?? 0), Date.now() - 600_000)
    .all<{id:number;senderId:string;kind:string;payload:string;createdAt:number}>()).results;
  return { signals: rows.map(r => ({ ...r, payload: JSON.parse(r.payload) })), cursor: rows.at(-1)?.id ?? Number(after ?? 0) };
}
