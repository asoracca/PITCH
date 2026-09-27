import { FriendMessages } from './FriendMessages'
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { FriendAction, FriendEntry, Player, FullPlayerProfile } from '../../shared/pitch'
import type { Pitch } from './usePitch'
import { AvatarBadge, Button, Icon } from './design'
import { demoPlayers } from './demo'

type Social = { message: (player:Player)=>void; selected: Player | null; pitch: Pitch; close: () => void; respond: (id: string, action: FriendAction) => Promise<void>; open: (player: Player) => void; refresh: () => Promise<void>; friends: FriendEntry[]; loading: boolean; error: string }
const SocialContext = createContext<Social | null>(null)

export function PlayerLink({player, children, className=''}: {player:Player; children:ReactNode; className?:string}) {
  const social = useContext(SocialContext)
  return <button type="button" className={`player-link ${className}`} aria-label={`View ${player.name}'s profile`} onClick={() => social?.open(player)}>{children}</button>
}

export function PlayerProfiles({p,children,navigationKey=0}: {p:Pitch;children:ReactNode;navigationKey?:number}) {
  const [messaging,setMessaging]=useState<Player|null>(null)
  const [selected,setSelected]=useState<Player|null>(null)
  const [friends,setFriends]=useState<FriendEntry[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState('')
  const pending=useRef<AbortController|null>(null)
  useEffect(()=>setSelected(null),[navigationKey])
  const account=p.me?.player.id
  const refresh=useCallback(async()=>{
    pending.current?.abort()
    if(!account){setLoading(false);return}
    const controller=new AbortController();pending.current=controller;setLoading(true)
    try{const result=await p.api.friends({signal:controller.signal});if(!controller.signal.aborted){setFriends(result.friends);setError('')}}
    catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Friends could not load.')}
    finally{if(!controller.signal.aborted)setLoading(false)}
  },[p.api,account])
  useEffect(()=>{setSelected(null);setMessaging(null);setFriends([]);setError('');void refresh();return()=>pending.current?.abort()},[refresh])
  useEffect(()=>{
    if(!account)return
    const update=()=>{if(document.visibilityState==='visible')void refresh()}
    const timer=setInterval(update,15000)
    window.addEventListener('focus',update)
    return()=>{clearInterval(timer);window.removeEventListener('focus',update)}
  },[account,refresh])
  async function respond(id:string,action:FriendAction){await p.api.friend(id,action);await refresh()}
  useEffect(()=>{const close=()=>setSelected(null);window.addEventListener('hashchange',close);return()=>window.removeEventListener('hashchange',close)},[])
  return <SocialContext.Provider value={{message:setMessaging,selected,pitch:p,close:()=>setSelected(null),respond,open:setSelected,refresh,friends,loading,error}}>{children}{messaging&&<FriendMessages key={messaging.id} p={p} player={messaging} onClose={()=>setMessaging(null)}/>}</SocialContext.Provider>
}

export function PlayerProfileContent({children}: {children:ReactNode}) {
  const social=useContext(SocialContext)
  return <><div hidden={!!social?.selected}>{children}</div>{social?.selected&&<PlayerPage key={social.selected.id} player={social.selected} p={social.pitch} onClose={social.close} onChange={social.refresh}/>}</>
}

function PlayerPage({player,p,onClose,onChange}:{player:Player;p:Pitch;onClose:()=>void;onChange:()=>Promise<void>}) {
  const social=useContext(SocialContext)
  const title=useId(),heading=useRef<HTMLHeadingElement>(null),request=useRef<AbortController|null>(null)
  const demo=demoPlayers.find(v=>v.playerId===player.id)
  const [profile,setProfile]=useState<FullPlayerProfile|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  useEffect(()=>{heading.current?.focus();heading.current?.scrollIntoView({block:'start'});return()=>request.current?.abort()},[])
  useEffect(()=>{
    if(demo)return
    const controller=new AbortController();request.current=controller
    p.api.playerProfile(player.id,{signal:controller.signal}).then(value=>{if(!controller.signal.aborted)setProfile(value)}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Profile unavailable.')})
    return()=>controller.abort()
  },[p.api,player.id,demo])
  async function change(action:FriendAction|'follow'|'unfollow'){
    if(busy)return
    const controller=new AbortController();request.current=controller;setBusy(true);setError('')
    try{
      if(action==='follow'||action==='unfollow'){
        const value=await p.api.follow(player.id,action==='follow',{signal:controller.signal});if(!controller.signal.aborted)setProfile(value)
      }else{
        const value=await p.api.friend(player.id,action,{signal:controller.signal});if(!controller.signal.aborted){setProfile(current=>current?{...current,...value}:current);await onChange()}
      }
    }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Please try again.')}
    finally{if(!controller.signal.aborted)setBusy(false)}
  }
  const current=profile?.player||player
  return <section className="public-profile page-stack" aria-labelledby={title}>
    <Button variant="ghost" className="profile-back" onClick={onClose}>← Back</Button>
    <header className="public-profile-hero"><AvatarBadge name={current.name} look={demo?.avatar||current.avatar} size="xl"/><div><h1 ref={heading} tabIndex={-1} id={title} className="display">{current.name}</h1>{demo?<span className="demo-badge">FICTIONAL PLAYER</span>:profile&&<><p>Joined {new Date(profile.joinedAt).toLocaleDateString(undefined,{month:'long',year:'numeric'})}{profile.ageBand?` · Ages ${profile.ageBand}`:''}</p><div className="profile-social-counts"><span><strong>{profile.followers}</strong> followers</span><span><strong>{profile.following}</strong> following</span></div></>}</div></header>
    {profile&&profile.friendship!=='self'&&<div className="friend-actions" aria-live="polite">
      <Button disabled={busy} variant={profile.isFollowing?'secondary':'primary'} onClick={()=>void change(profile.isFollowing?'unfollow':'follow')}>{profile.isFollowing?'Unfollow':'Follow'}</Button>
      {profile.friendship==='none'&&<Button variant="secondary" disabled={busy} onClick={()=>void change('request')}>Add friend</Button>}
      {profile.friendship==='outgoing'&&<><span>Request sent</span><Button variant="ghost" disabled={busy} onClick={()=>void change('cancel')}>Cancel request</Button></>}
      {profile.friendship==='incoming'&&<><span>Friend request</span><Button disabled={busy} onClick={()=>void change('accept')}>Accept</Button><Button variant="ghost" disabled={busy} onClick={()=>void change('decline')}>Decline</Button></>}
      {profile.friendship==='friends'&&<><strong>✓ Friends</strong><Button onClick={()=>social?.message(current)}>Message</Button><Button variant="ghost" disabled={busy} onClick={()=>void change('remove')}>Remove friend</Button></>}
    </div>}
    {error&&<p role="alert">{error}</p>}
    {!profile&&!demo&&!error&&<p role="status">Loading profile…</p>}
    {(profile||demo)&&<section><h2 className="heading">Statistics</h2><dl className="public-profile-stats">
      <div><Icon name="trophy"/><dt>Elo</dt><dd>{demo?.rating??profile!.rating}</dd></div>
      {profile&&<div><Icon name="fire"/><dt>Day streak</dt><dd>{profile.streak}</dd></div>}
      <div><Icon name="versus"/><dt>Rated rounds</dt><dd>{demo?.games??profile!.roundsPlayed}</dd></div>
      {profile&&<div><Icon name="gavel"/><dt>Rounds judged</dt><dd>{profile.roundsJudged}</dd></div>}
    </dl>{profile&&<small className="muted">Streak: completed rounds and saved practices, by UTC day.</small>}</section>}
    <section className="public-round-history"><h2 className="heading">Recent public rounds</h2>{profile?.recentRounds.length?<div>{profile.recentRounds.map(round=><article key={round.code}><div><strong>{round.title}</strong><span>{new Date(round.finishedAt).toLocaleDateString()} · {round.category}</span></div><strong className={round.delta==null?'':round.delta>=0?'positive':'negative'}>{round.result}{round.delta==null?'':` · ${round.delta>=0?'+':''}${round.delta} Elo`}</strong></article>)}</div>:<p>{demo?'Demo player. No real round history.':'No public rounds yet.'}</p>}</section>
  </section>
}

function FriendNotification({entry}: {entry:FriendEntry}) {
  const social=useContext(SocialContext)!
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  async function respond(action:FriendAction){
    if(busy)return
    setBusy(true);setError('')
    try{await social.respond(entry.player.id,action)}catch(e){setError(e instanceof Error?e.message:'Please retry.')}finally{setBusy(false)}
  }
  return <article className="friend-notification">
    <PlayerLink player={entry.player} className="friend-request-person"><AvatarBadge name={entry.player.name} look={entry.player.avatar}/><span><strong>{entry.player.name}</strong><small>Friend request</small></span></PlayerLink>
    <div className="hero-actions"><Button disabled={busy} onClick={()=>void respond('accept')}>Accept</Button><Button variant="ghost" disabled={busy} onClick={()=>void respond('decline')}>Decline</Button></div>
    {error&&<p role="alert">{error}</p>}
  </article>
}

export function FriendsPanel(){
  const social=useContext(SocialContext)
  const [tab,setTab]=useState<'friends'|'notifications'>('notifications')
  const refresh=social?.refresh
  useEffect(()=>{if(refresh)void refresh()},[refresh])
  if(!social)return null
  const incoming=social.friends.filter(v=>v.friendship==='incoming')
  const groups=[['friends','Friends'],['outgoing','Sent requests']] as const
  return <section className="friends-section">
    <div className="friends-heading"><div className="friend-tabs" role="group" aria-label="Profile social tabs"><Button variant={tab==='notifications'?'secondary':'ghost'} aria-pressed={tab==='notifications'} onClick={()=>setTab('notifications')}>Notifications <span className="notification-count" aria-label={`${incoming.length} friend requests`}>{incoming.length}</span></Button><Button variant={tab==='friends'?'secondary':'ghost'} aria-pressed={tab==='friends'} onClick={()=>setTab('friends')}>Friends</Button></div><Button variant="ghost" disabled={social.loading} onClick={()=>void social.refresh()}>Refresh</Button></div>
    {social.error&&<p role="alert">{social.error}</p>}
    {tab==='notifications'?<div aria-label="Friend notifications">{incoming.map(entry=><FriendNotification key={entry.player.id} entry={entry}/>)}{!incoming.length&&<p role="status">{social.loading?'Checking requests…':'No new friend requests.'}</p>}</div>:<div>
      {!social.friends.some(v=>v.friendship!=='incoming')&&<p>Click a player’s avatar to add them.</p>}
      {groups.map(([status,title])=>{const entries=social.friends.filter(v=>v.friendship===status);return entries.length?<div className="friend-group" key={status}><h3>{title} · {entries.length}</h3>{entries.map(v=><div className="friend-row" key={v.player.id}><PlayerLink player={v.player}><AvatarBadge name={v.player.name} look={v.player.avatar}/><span>{v.player.name}</span><span className="friend-row-meta">{status==='outgoing'?'Pending':`${v.rating} Elo`}</span><Icon name="arrow"/></PlayerLink>{status==='friends'&&<Button variant="secondary" onClick={()=>social.message(v.player)}>Message</Button>}</div>)}</div>:null})}
    </div>}
  </section>
}
