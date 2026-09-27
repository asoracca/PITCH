import { fail, textField } from '../http';
import type { Store } from '../store';
import type { DirectMessage, DirectMessages } from '../../shared/pitch';

const allowed = `EXISTS(SELECT 1 FROM pitch_friendships f WHERE f.player_a=? AND f.player_b=? AND f.status='accepted')
  AND NOT EXISTS(SELECT 1 FROM pitch_blocks WHERE (player_id=? AND target_id=?) OR (player_id=? AND target_id=?))`;
/** Only accepted, unblocked friends can read or send this pair's messages. */
export async function directMessages(store:Store,self:string,target:string,before:string|null,body?:Record<string,unknown>):Promise<DirectMessages> {
  const [a,b]=[self,target].sort(), permission=[a,b,self,target,target,self];
  if(self===target || !await store.sql(`SELECT 1 WHERE ${allowed}`,...permission).first()) fail(403,'FRIENDS_REQUIRED','Messaging is available between accepted friends.');
  if(before!==null && (!/^\d+$/.test(before) || !Number.isSafeInteger(Number(before)) || Number(before)<1)) fail(400,'INVALID_CURSOR','Invalid message cursor.');
  if(body){
    const content=textField(body.content,'Message',1000),requestId=textField(body.requestId,'Request ID',80);
    const previous=await store.sql('SELECT recipient_id,content FROM pitch_messages WHERE sender_id=? AND request_id=?',self,requestId).first<{recipient_id:string;content:string}>();
    if(previous && (previous.recipient_id!==target || previous.content!==content)) fail(409,'REQUEST_REUSED','Send this message with a new request ID.');
    if(!previous){
      await store.limit(`pitch-direct-message:${self}`,20);
      await store.sql(`INSERT INTO pitch_messages(sender_id,recipient_id,request_id,content,created_at)
        SELECT ?,?,?,?,? WHERE ${allowed} ON CONFLICT(sender_id,request_id) DO NOTHING`,self,target,requestId,content,Date.now(),...permission).run();
      const saved=await store.sql('SELECT recipient_id,content FROM pitch_messages WHERE sender_id=? AND request_id=?',self,requestId).first<{recipient_id:string;content:string}>();
      if(!saved) fail(403,'FRIENDS_REQUIRED','This friendship changed. Message not sent.');
      if(saved.recipient_id!==target || saved.content!==content) fail(409,'REQUEST_REUSED','Send this message with a new request ID.');
    }
  }
  const rows=(await store.sql(`SELECT id,sender_id AS senderId,content,created_at AS createdAt FROM pitch_messages
    WHERE ((sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?)) AND id<? ORDER BY id DESC LIMIT 51`,self,target,target,self,before?Number(before):Number.MAX_SAFE_INTEGER).all<DirectMessage>()).results;
  const page=rows.slice(0,50);
  return {messages:page.reverse(),nextCursor:rows.length>50?page[0].id:null};
}
