import type { Feedback } from '../../shared/pitch';
import { fail } from '../http';
import type { Store } from '../store';
import type { Player } from '../types';
import { cleanTip, seats } from './game';
import { phaseAt } from './scenarios';
import type { PeerFeedback, PitchRoom } from './types';
import { automatedResult } from './automated-judge';

export async function peerRows(store: Store, room: PitchRoom) {
  return (await store.sql('SELECT * FROM pitch_peer_feedback WHERE room_id=? ORDER BY created_at,id',room.id).all<PeerFeedback>()).results;
}
export function incomingPeerFeedback(rows: PeerFeedback[], playerId: string): Feedback[] {
  return rows.filter(row=>row.target_id===playerId).map(row=>({ballotId:row.id,playerId:row.target_id,clarity:row.clarity,persuasiveness:row.persuasiveness,composure:row.composure,
    tip:row.rating==='abusive'?'[Feedback hidden after your report]':row.tip,rating:row.rating}));
}
export async function finishPeer(store: Store, room: PitchRoom, cancelled = false) {
  if(room.status!=='active') return;
  const rows=await peerRows(store,room), members=await seats(store,room), phase=phaseAt(room.started_at);
  const left=members.some(s=>s.left_at); cancelled ||= left;
  if(!cancelled && (phase.index!==5 || (!phase.expired && rows.length<2))) return;
  const now=Date.now(), claim=crypto.randomUUID();
  const automated = room.judging_mode === 'automated' && !cancelled;
  const responses = automated ? (await store.sql('SELECT player_id,content FROM pitch_responses WHERE room_id=? ORDER BY phase',room.id).all<{player_id:string;content:string}>()).results : [];
  const result={winnerId:null,reason:cancelled?'peer_left':'peer_practice',voteCount:rows.length,scores:[],ratingChanges:[],finishedAt:now,ratingVersion:'unrated',...(automated ? automatedResult(room.a_id,room.b_id,responses) : {})};
  const guard='EXISTS(SELECT 1 FROM pitch_rooms WHERE id=? AND resolution_token=?)';
  await store.env.DB.batch([
    store.sql(`UPDATE pitch_rooms SET status=?,result=?,resolution_token=?,finished_at=? WHERE id=? AND status='active' AND judging_mode IN ('peer','automated')
      AND (SELECT COUNT(*) FROM pitch_peer_feedback WHERE room_id=?)=?
      AND (SELECT COUNT(*) FROM pitch_seats WHERE room_id=? AND left_at IS NOT NULL)=?`,cancelled?'cancelled':'finished',JSON.stringify(result),claim,now,room.id,room.id,rows.length,room.id,members.filter(s=>s.left_at).length),
    store.sql(`DELETE FROM pitch_queue WHERE room_id=? AND ${guard}`,room.id,room.id,claim),
    store.sql(`DELETE FROM pitch_signals WHERE room_id=? AND ${guard}`,room.id,room.id,claim),
  ]);
}
export async function submitPeerFeedback(store: Store, room: PitchRoom, player: Player, body: Record<string,unknown>) {
  const self=(await seats(store,room)).find(s=>s.player_id===player.id), phase=phaseAt(room.started_at);
  if (!self || self.role!=='contestant') fail(403,'CONTESTANT_REQUIRED','Only contestants can give opponent feedback.');
  if(await store.sql('SELECT 1 FROM pitch_peer_feedback WHERE room_id=? AND author_id=?',room.id,player.id).first()) return;
  if(room.status==='active' && (self.left_at || phase.index!==5)) fail(409,'FEEDBACK_CLOSED','Feedback opens after both speaking turns.');
  const target=room.a_id===player.id?room.b_id:room.a_id;
  if(await store.sql('SELECT 1 FROM pitch_blocks WHERE (player_id=? AND target_id=?) OR (player_id=? AND target_id=?)',player.id,target,target,player.id).first()) fail(403,'FEEDBACK_BLOCKED','Feedback unavailable for a blocked player.');
  const scores=['clarity','persuasiveness','composure'].map(key=>{const value=body[key];if(!Number.isInteger(value)||Number(value)<1||Number(value)>5) fail(400,'INVALID_SCORE','Give each skill a score from 1 to 5.');return Number(value);});
  const tip=cleanTip(body.tip), now=Date.now();
  const saved=await store.sql(`INSERT INTO pitch_peer_feedback(id,room_id,author_id,target_id,clarity,persuasiveness,composure,tip,created_at)
    SELECT ?,id,?,?,?,?,?,?,? FROM pitch_rooms WHERE id=? AND (status IN ('finished','cancelled') OR (status='active' AND started_at+180000<=?))
    AND EXISTS(SELECT 1 FROM pitch_seats WHERE room_id=? AND player_id=? AND role='contestant')
    AND NOT EXISTS(SELECT 1 FROM pitch_blocks WHERE (player_id=? AND target_id=?) OR (player_id=? AND target_id=?))
    ON CONFLICT(room_id,author_id) DO NOTHING`,crypto.randomUUID(),player.id,target,...scores,tip,now,room.id,now,room.id,player.id,player.id,target,target,player.id).run();
  if(!saved.meta.changes && !await store.sql('SELECT 1 FROM pitch_peer_feedback WHERE room_id=? AND author_id=?',room.id,player.id).first()) fail(409,'FEEDBACK_CLOSED','The feedback window closed.');
  if(room.judging_mode!=='judged') await finishPeer(store,room);
}
export async function ratePeerFeedback(store: Store, player: Player, id: string, value: string) {
  const row=await store.sql(`SELECT f.* FROM pitch_peer_feedback f JOIN pitch_rooms r ON r.id=f.room_id
    WHERE f.id=? AND f.target_id=? AND r.status IN ('finished','cancelled')`,id,player.id).first<PeerFeedback>();
  if(!row) return null;
  await store.env.DB.batch([
    store.sql('UPDATE pitch_peer_feedback SET rating=? WHERE id=? AND target_id=? AND rating IS NULL',value,id,player.id),
    ...(value==='abusive'?[store.sql(`INSERT INTO pitch_reports(id,room_id,reporter_id,target_id,reason,details,created_at)
      SELECT ?,?,?,?,'abusive-feedback',?,? WHERE EXISTS(SELECT 1 FROM pitch_peer_feedback WHERE id=? AND rating='abusive')
      ON CONFLICT(room_id,reporter_id,target_id) DO NOTHING`,crypto.randomUUID(),row.room_id,player.id,row.author_id,row.tip,Date.now(),id)]:[]),
  ]);
  return {saved:true};
}
