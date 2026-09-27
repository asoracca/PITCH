import { REACTIONS, type RoomChat, type ChatMessage } from '../../shared/pitch';
import { fail, textField } from '../http';
import type { Store } from '../store';
import type { Player } from '../types';
import { cleanTip, seats } from './game';
import type { PitchRoom } from './types';
export async function roomChat(store: Store, room: PitchRoom, player: Player, body?: Record<string,unknown>): Promise<RoomChat> {
  const members=await seats(store,room), self=members.find(s=>s.player_id===player.id);
  if(!self||self.role!=='contestant')fail(403,'CONTESTANT_CHAT','Opponent chat is only visible to the two contestants.');
  const other=members.find(s=>s.role==='contestant'&&s.player_id!==player.id)!;
  const blocked=await store.sql('SELECT 1 FROM pitch_blocks WHERE (player_id=? AND target_id=?) OR (player_id=? AND target_id=?)',player.id,other.player_id,other.player_id,player.id).first();
  const canSend=room.status==='active'&&!self.left_at&&!other.left_at&&!blocked&&Date.now()<room.started_at+240000;
  if(body){
    if(!canSend)fail(409,'CHAT_CLOSED','Chat is closed because the round ended, someone left or a player is blocked.');
    const kind=body.kind, content=textField(body.content,'Message',300), requestId=textField(body.requestId,'Request ID',80);
    if(kind!=='message'&&kind!=='reaction')fail(400,'INVALID_CHAT','Choose a message or reaction.');
    if(kind==='reaction'&&!REACTIONS.includes(content as typeof REACTIONS[number]))fail(400,'INVALID_REACTION','Choose one of the available reactions.');
    if(kind==='message')cleanTip(content+' '.repeat(Math.max(0,12-content.length))+' Keep it constructive.');
    if(!await store.sql('SELECT 1 FROM pitch_chat WHERE room_id=? AND player_id=? AND request_id=?',room.id,player.id,requestId).first()){
      await store.limit(`pitch-chat:${player.id}`,12);
      const now=Date.now();
      await store.sql(`INSERT INTO pitch_chat(room_id,player_id,request_id,kind,content,created_at)
        SELECT id,?,?,?,?,? FROM pitch_rooms WHERE id=? AND status='active' AND started_at+240000>?
        AND (SELECT COUNT(*) FROM pitch_seats WHERE room_id=? AND role='contestant' AND left_at IS NULL)=2
        AND NOT EXISTS(SELECT 1 FROM pitch_blocks WHERE (player_id=? AND target_id=?) OR (player_id=? AND target_id=?))
        ON CONFLICT(room_id,player_id,request_id) DO NOTHING`,player.id,requestId,kind,content,now,room.id,now,room.id,player.id,other.player_id,other.player_id,player.id).run();
      if(!await store.sql('SELECT 1 FROM pitch_chat WHERE room_id=? AND player_id=? AND request_id=?',room.id,player.id,requestId).first())fail(409,'CHAT_CLOSED','Chat closed before the message could be sent.');
    }
  }
  if(blocked)return {messages:[],canSend:false};
  const messages=(await store.sql(`SELECT id,player_id AS playerId,kind,content,created_at AS createdAt FROM pitch_chat WHERE room_id=? ORDER BY id DESC LIMIT 60`,room.id).all<ChatMessage>()).results.reverse();
  return {messages,canSend:!!canSend};
}
