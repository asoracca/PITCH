import { useEffect, useRef, useState } from 'react'
import { REACTIONS, type PitchRoomView, type RoomChat } from '../../shared/pitch'
import type { Pitch } from './usePitch'
import { Button } from './design'

export function OpponentChat({ p, room }: { p: Pitch; room: PitchRoomView }) {
  const self=p?.me?.player.id||'you', opponent=room?.participants.find(v=>v.role==='contestant'&&v.id!==self)
  const [chat,setChat]=useState<RoomChat>({messages:[],canSend:false}),[draft,setDraft]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const pending=useRef<AbortController|null>(null),sequence=useRef(0)
  const [expanded,setExpanded]=useState(true)
  const blocked=!!opponent&&!!p?.me?.blockedPlayers.some(v=>v.id===opponent.id)
  useEffect(()=>{
    const desktop=window.matchMedia('(min-width: 1100px)')
    const update=()=>setExpanded(desktop.matches)
    update();desktop.addEventListener('change',update)
    return()=>desktop.removeEventListener('change',update)
  },[])
  useEffect(()=>{
    sequence.current++
    setChat({messages:[],canSend:false});setDraft('');setError('');setBusy(false)
    return()=>{sequence.current++;pending.current?.abort()}
  },[room.code])
  useEffect(()=>{
    if(room.role!=='contestant')return
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>
    async function poll(){
      const request=++sequence.current
      try{const result=await p!.api.chat(room!.code,{signal:controller.signal});if(!controller.signal.aborted&&request===sequence.current){setChat(result);setError('')}}catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Chat could not load.')}
      if(!controller.signal.aborted&&room!.status==='active')timer=setTimeout(()=>void poll(),3000)
    }
    void poll();return()=>{controller.abort();clearTimeout(timer)}
  },[p?.api,room?.code,room?.status,blocked])
  async function send(kind:'message'|'reaction',content:string){
    if(busy||!content.trim())return
    setError('')
    if(!p||!room)return
    setBusy(true);const controller=new AbortController();pending.current=controller;const request=++sequence.current
    try{const result=await p.api.sendChat(room.code,kind,content.trim(),crypto.randomUUID(),{signal:controller.signal});if(!controller.signal.aborted){if(request===sequence.current)setChat(result);setDraft('')}}catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Message failed. Try again.')}finally{if(!controller.signal.aborted)setBusy(false)}
  }
  if(room.role!=='contestant')return null
  const canSend=chat.canSend&&!blocked&&(!room||room.status==='active'&&!room.left)
  return <details className="opponent-chat" open={expanded} onToggle={event=>setExpanded(event.currentTarget.open)}>
    <summary className="opponent-chat-heading"><span><span className="opponent-chat-title">Opponent chat</span><small>Private · not judged</small></span><span className="chat-toggle" aria-hidden="true">{expanded?'−':'+'}</span></summary>
    <div className="opponent-chat-body">
    <div className="chat-log" role="log" aria-live="polite" aria-label="Opponent conversation" tabIndex={0}>{blocked?<p>Chat hidden for this blocked participant.</p>:chat.messages.length?chat.messages.map(m=><article className={m.playerId===self?'chat-message mine':'chat-message'} key={m.id}><strong>{m.playerId===self?'You':opponent?.name||'Opponent'}</strong><p className={m.kind==='reaction'?'chat-reaction':''}>{m.content}</p></article>):<p>Say hello 👋</p>}</div>
    <div className="reaction-buttons" role="group" aria-label="React to your opponent">{REACTIONS.map((emoji,i)=><button type="button" key={emoji} disabled={!canSend||busy} aria-label={['Applause','Thumbs up','Good idea','Handshake','Great effort','Smile'][i]} onClick={()=>void send('reaction',emoji)}>{emoji}</button>)}</div>
    <form className="chat-compose" onSubmit={e=>{e.preventDefault();void send('message',draft)}}><input aria-label="Message your opponent" value={draft} onChange={e=>setDraft(e.target.value)} maxLength={300} disabled={!canSend||busy} placeholder="Message…"/><Button type="submit" disabled={!canSend||busy||!draft.trim()}>Send</Button></form>
    {error&&<p role="alert">{error}</p>}{!canSend&&<p>Chat closed · messages remain private.</p>}
    </div>
  </details>
}
