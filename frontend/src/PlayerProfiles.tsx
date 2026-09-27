import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { FriendAction, FriendEntry, Player, PublicProfile } from '../../shared/pitch'
import type { Pitch } from './usePitch'
import { AvatarBadge, Button, Icon } from './design'
import { demoPlayers } from './demo'

type Social = { open: (player: Player) => void; refresh: () => Promise<void>; friends: FriendEntry[]; loading: boolean; error: string }
const SocialContext = createContext<Social | null>(null)

export function PlayerLink({player, children, className=''}: {player:Player; children:ReactNode; className?:string}) {
  const social = useContext(SocialContext)
  return <button type="button" className={`player-link ${className}`} aria-label={`View ${player.name}'s profile`} onClick={() => social?.open(player)}>{children}</button>
}

export function PlayerProfiles({p,children}: {p:Pitch;children:ReactNode}) {
  const [selected,setSelected]=useState<Player|null>(null)
  const [friends,setFriends]=useState<FriendEntry[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState('')
  const pending=useRef<AbortController|null>(null)
  const account=p.me?.player.id
  const refresh=useCallback(async()=>{
    pending.current?.abort()
    if(!account){setLoading(false);return}
    const controller=new AbortController();pending.current=controller;setLoading(true)
    try{const result=await p.api.friends({signal:controller.signal});if(!controller.signal.aborted){setFriends(result.friends);setError('')}}
    catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Friends could not load.')}
    finally{if(!controller.signal.aborted)setLoading(false)}
  },[p.api,account])
  useEffect(()=>{setSelected(null);setFriends([]);setError('');void refresh();return()=>pending.current?.abort()},[refresh])
  return <SocialContext.Provider value={{open:setSelected,refresh,friends,loading,error}}>
    {children}
    {selected&&<PlayerDialog key={`${account}:${selected.id}`} player={selected} p={p} onClose={()=>setSelected(null)} onChange={refresh}/>}
  </SocialContext.Provider>
}

function PlayerDialog({player,p,onClose,onChange}:{player:Player;p:Pitch;onClose:()=>void;onChange:()=>Promise<void>}) {
  const dialog=useRef<HTMLDialogElement>(null),title=useId(),request=useRef<AbortController|null>(null)
  const demo=demoPlayers.find(v=>v.playerId===player.id)
  const [profile,setProfile]=useState<PublicProfile|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  useEffect(()=>{
    const node=dialog.current;node?.showModal()
    return()=>{request.current?.abort();node?.close()}
  },[])
  useEffect(()=>{
    if(demo)return
    const controller=new AbortController();request.current=controller
    p.api.playerProfile(player.id,{signal:controller.signal}).then(value=>{if(!controller.signal.aborted)setProfile(value)}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Profile unavailable.')})
    return()=>controller.abort()
  },[p.api,player.id,demo])
  async function change(action:FriendAction){
    if(busy)return
    const controller=new AbortController();request.current=controller;setBusy(true);setError('')
    try{const value=await p.api.friend(player.id,action,{signal:controller.signal});if(!controller.signal.aborted){setProfile(value);await onChange()}}
    catch(e){if(!controller.signal.aborted){setError(e instanceof Error?e.message:'Please try again.');try{const value=await p.api.playerProfile(player.id,{signal:controller.signal});if(!controller.signal.aborted)setProfile(value)}catch{/* Keep the action error visible. */}}}
    finally{if(!controller.signal.aborted)setBusy(false)}
  }
  const current=profile?.player||player
  return <dialog ref={dialog} className="player-dialog" aria-labelledby={title} onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget){const box=e.currentTarget.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)onClose()}}}>
    <button type="button" className="icon-button profile-close" aria-label="Close profile" onClick={onClose}><Icon name="close"/></button>
    <div className="player-profile-heading"><AvatarBadge name={current.name} look={demo?.avatar||current.avatar} size="xl"/><div><h2 id={title} className="heading">{current.name}</h2>{demo?<span className="demo-badge">DEMO</span>:profile?.ageBand&&<span>Ages {profile.ageBand}</span>}</div></div>
    {(profile||demo)&&<dl className="player-stats"><div><dt>Elo</dt><dd>{demo?.rating??profile!.rating}</dd></div><div><dt>Rated rounds</dt><dd>{demo?.games??profile!.roundsPlayed}</dd></div>{profile&&<div><dt>Judged</dt><dd>{profile.roundsJudged}</dd></div>}</dl>}
    {demo?<p>Fictional player. Friend requests are for real accounts.</p>:!profile&&!error?<p role="status">Loading profile…</p>:profile&&<div className="friend-actions" aria-live="polite">
      {profile.friendship==='none'&&<Button disabled={busy} onClick={()=>void change('request')}>Add friend</Button>}
      {profile.friendship==='outgoing'&&<><span>Request sent</span><Button variant="ghost" disabled={busy} onClick={()=>void change('cancel')}>Cancel request</Button></>}
      {profile.friendship==='incoming'&&<><span>Wants to be friends</span><Button disabled={busy} onClick={()=>void change('accept')}>Accept</Button><Button variant="ghost" disabled={busy} onClick={()=>void change('decline')}>Decline</Button></>}
      {profile.friendship==='friends'&&<><strong>✓ Friends</strong><Button variant="ghost" disabled={busy} onClick={()=>void change('remove')}>Remove friend</Button></>}
      {profile.friendship==='self'&&<span>Your public profile</span>}
    </div>}
    {error&&<p role="alert">{error}</p>}
  </dialog>
}

export function FriendsPanel(){
  const social=useContext(SocialContext)
  const refresh=social?.refresh
  useEffect(()=>{if(refresh)void refresh()},[refresh])
  if(!social)return null
  const groups=[['incoming','Requests'],['friends','Friends'],['outgoing','Sent requests']] as const
  return <section className="friends-section">
    <div className="friends-heading"><h2 className="heading">Friends</h2><Button variant="ghost" disabled={social.loading} onClick={()=>void social.refresh()}>Refresh</Button></div>
    {social.loading&&!social.friends.length?<p role="status">Loading friends…</p>:!social.friends.length&&!social.error?<p>Open a player’s profile to add them.</p>:null}
    {social.error&&<p role="alert">{social.error}</p>}
    {groups.map(([status,title])=>{const entries=social.friends.filter(v=>v.friendship===status);return entries.length?<div className="friend-group" key={status}><h3>{title} · {entries.length}</h3>{entries.map(v=><PlayerLink player={v.player} className="friend-row" key={v.player.id}><AvatarBadge name={v.player.name} look={v.player.avatar}/><span>{v.player.name}</span><span className="friend-row-meta">{status==='incoming'?'Respond':status==='outgoing'?'Pending':`${v.rating} Elo`}</span><Icon name="arrow"/></PlayerLink>)}</div>:null})}
  </section>
}
