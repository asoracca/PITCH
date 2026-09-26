import { useEffect, useRef, useState } from 'react'
import { REACTIONS, type ChatMessage, type PitchRoomView, type RoomChat } from '../../shared/pitch'
import type { Pitch } from './usePitch'
import { Button } from './design'

export function OpponentChat({ p, room, demo=false, resetKey=0 }: { p?: Pitch; room?: PitchRoomView; demo?: boolean; resetKey?: number }) {
  const self=p?.me?.player.id||'you', opponent=room?.participants.find(v=>v.role==='contestant'&&v.id!==self)
  const [chat,setChat]=useState<RoomChat>({messages:[],canSend:demo}),[draft,setDraft]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const pending=useRef<AbortController|null>(null),sequence=useRef(0),timers=useRef<ReturnType<typeof setTimeout>[]>([])
  const blocked=!!opponent&&!!p?.me?.blockedPlayers.some(v=>v.id===opponent.id)
  useEffect(()=>{
    sequence.current++
    setChat({messages:demo?[{id:1,playerId:'demo',kind:'message',content:'Good luck! Let’s practice together. 👋',createdAt:Date.now()}]:[],canSend:demo});setDraft('');setError('');setBusy(false)
    return()=>{sequence.current++;pending.current?.abort();timers.current.forEach(clearTimeout);timers.current=[]}
  },[room?.code,demo,resetKey])
  useEffect(()=>{
    if(demo||!p||!room||room.role!=='contestant')return
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>
    async function poll(){
      const request=++sequence.current
      try{const result=await p!.api.chat(room!.code,{signal:controller.signal});if(!controller.signal.aborted&&request===sequence.current){setChat(result);setError('')}}catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Chat could not load.')}
      if(!controller.signal.aborted&&room!.status==='active')timer=setTimeout(()=>void poll(),3000)
    }
    void poll();return()=>{controller.abort();clearTimeout(timer)}
  },[p?.api,room?.code,room?.status,demo,blocked])
  async function send(kind:'message'|'reaction',content:string){
    if(busy||!content.trim())return
    setError('')
    if(demo){
      const now=Date.now();setChat(c=>({...c,messages:[...c.messages,{id:now,playerId:self,kind,content:content.trim(),createdAt:now}].slice(-60)}));setDraft('');setBusy(true)
      const timer=setTimeout(()=>{setChat(c=>({...c,messages:[...c.messages,{id:Date.now(),playerId:'demo',kind:kind==='reaction'?'reaction':'message',content:kind==='reaction'?'👏':['Thanks! I’m ready for the next turn.','Good point—let’s hear both sides.','Nice practice. One clear example can make a big difference.'][Math.floor(Math.random()*3)],createdAt:Date.now()} as ChatMessage].slice(-60)}));setBusy(false)},1000)
      timers.current.push(timer);return
    }
    if(!p||!room)return
    setBusy(true);const controller=new AbortController();pending.current=controller;const request=++sequence.current
    try{const result=await p.api.sendChat(room.code,kind,content.trim(),crypto.randomUUID(),{signal:controller.signal});if(!controller.signal.aborted){if(request===sequence.current)setChat(result);setDraft('')}}catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Message failed. Try again.')}finally{if(!controller.signal.aborted)setBusy(false)}
  }
  if(!demo&&room?.role!=='contestant')return null
  const canSend=(demo||chat.canSend)&&!blocked&&(!room||room.status==='active'&&!room.left)
  return <section className="panel opponent-chat form-stack">
    <h2 className="heading">{demo?'Demo chat with Maya':'Opponent chat'}</h2>
    <p>{demo?'Maya’s messages and reactions are scripted demo replies, not a real person or AI.':'Just you and your opponent. Chat is separate from judged responses and hidden from judges and spectators.'}</p>
    <div className="chat-log" role="log" aria-live="polite" aria-label="Opponent conversation">{blocked?<p>Chat hidden for this blocked participant.</p>:chat.messages.length?chat.messages.map(m=><article className={m.playerId===self?'chat-message mine':'chat-message'} key={m.id}><strong>{m.playerId===self?'You':demo?'Maya · DEMO':opponent?.name||'Opponent'}</strong><p className={m.kind==='reaction'?'chat-reaction':''}>{m.content}</p></article>):<p>Say hello or send a supportive reaction.</p>}</div>
    <div className="reaction-buttons" role="group" aria-label="React to your opponent">{REACTIONS.map((emoji,i)=><button type="button" key={emoji} disabled={!canSend||busy} aria-label={['Applause','Thumbs up','Good idea','Handshake','Great effort','Smile'][i]} onClick={()=>void send('reaction',emoji)}>{emoji}</button>)}</div>
    <form className="chat-compose" onSubmit={e=>{e.preventDefault();void send('message',draft)}}><label>Message your opponent<input value={draft} onChange={e=>setDraft(e.target.value)} maxLength={300} disabled={!canSend||busy} placeholder="Keep it friendly…"/></label><Button type="submit" disabled={!canSend||busy||!draft.trim()}>Send</Button></form>
    {error&&<p role="alert">{error}</p>}{!canSend&&<p>Chat is closed. Previous messages remain available to participants.</p>}
    {!demo&&<small>Keep personal contact details out of chat. Use this round’s report or block controls if needed.</small>}
  </section>
}
