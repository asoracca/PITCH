import { useEffect, useRef, useState } from 'react'
import type { DirectMessage, Player } from '../../shared/pitch'
import type { Pitch } from './usePitch'
import { AvatarBadge, Button } from './design'

export function FriendMessages({p,player,onClose}:{p:Pitch;player:Player;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null),log=useRef<HTMLDivElement>(null)
  const [messages,setMessages]=useState<DirectMessage[]>([]),[cursor,setCursor]=useState<number|null>(null)
  const [draft,setDraft]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const pending=useRef<AbortController|null>(null),retry=useRef<{content:string;id:string}|null>(null)
  function merge(incoming:DirectMessage[]){setMessages(current=>[...new Map([...current,...incoming].map(m=>[m.id,m])).values()].sort((a,b)=>a.id-b.id))}
  useEffect(()=>{dialog.current?.showModal();return()=>pending.current?.abort()},[])
  useEffect(()=>{
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>,initial=true
    async function poll(){
      try {const value=await p.api.messages(player.id,undefined,{signal:controller.signal});if(!controller.signal.aborted){merge(value.messages);if(initial){setCursor(value.nextCursor);initial=false}}}
      catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Messages unavailable.')}
      if(!controller.signal.aborted)timer=setTimeout(()=>void poll(),3000)
    }
    void poll();return()=>{controller.abort();clearTimeout(timer)}
  },[p.api,player.id])
  const last=messages.at(-1)?.id
  useEffect(()=>{if(log.current)log.current.scrollTop=log.current.scrollHeight},[last])
  async function send(){
    if(busy||!draft.trim())return
    const content=draft.trim();if(retry.current?.content!==content)retry.current={content,id:crypto.randomUUID()}
    const controller=new AbortController();pending.current=controller;setBusy(true);setError('')
    try{const value=await p.api.sendMessage(player.id,content,retry.current.id,{signal:controller.signal});if(!controller.signal.aborted){merge(value.messages);setDraft('');retry.current=null}}
    catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Message failed. Retry to send.')}
    finally{if(!controller.signal.aborted)setBusy(false)}
  }
  async function older(){
    if(!cursor||busy)return
    setBusy(true);const controller=new AbortController();pending.current=controller
    try{const value=await p.api.messages(player.id,cursor,{signal:controller.signal});if(!controller.signal.aborted){merge(value.messages);setCursor(value.nextCursor)}}
    catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Could not load older messages.')}
    finally{if(!controller.signal.aborted)setBusy(false)}
  }
  return <dialog ref={dialog} className="friend-messages" aria-label={`Messages with ${player.name}`} onCancel={event=>{event.preventDefault();onClose()}}>
    <header><AvatarBadge name={player.name} look={player.avatar}/><div><h2>{player.name}</h2><small>Private conversation</small></div><Button variant="ghost" onClick={onClose}>Close</Button></header>
    <div ref={log} className="friend-message-log" role="log" aria-live="polite" aria-label="Friend messages" tabIndex={0}>
      {cursor&&<Button disabled={busy} variant="ghost" onClick={()=>void older()}>Older messages</Button>}
      {messages.map(message=><article key={message.id} className={`chat-message${message.senderId===p.me!.player.id?' mine':''}`}><strong>{message.senderId===p.me!.player.id?'You':player.name}</strong><p>{message.content}</p><time>{new Date(message.createdAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</time></article>)}
      {!messages.length&&!error&&<p>Say hello 👋</p>}
    </div>
    {error&&<p role="alert">{error}</p>}
    <form className="chat-compose" onSubmit={event=>{event.preventDefault();void send()}}><input autoFocus aria-label={`Message ${player.name}`} value={draft} disabled={busy} maxLength={1000} placeholder="Message…" onChange={event=>setDraft(event.target.value)}/><Button type="submit" disabled={busy||!draft.trim()}>{busy?'Sending…':'Send'}</Button></form>
  </dialog>
}
