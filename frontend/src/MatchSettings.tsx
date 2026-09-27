import { useEffect, useRef } from 'react'
import { Button } from './design'
export type MatchPreferences = { microphone:boolean; camera:boolean; spectators:boolean; fallback:boolean }
export const defaultMatchPreferences:MatchPreferences = {microphone:true,camera:true,spectators:false,fallback:true}
export function readMatchPreferences(account:string):MatchPreferences {
  try {const value=JSON.parse(localStorage.getItem(`pitch.match-settings.${account}`)||'null');return Object.fromEntries(Object.entries(defaultMatchPreferences).map(([key,fallback])=>[key,typeof value?.[key]==='boolean'?value[key]:fallback])) as MatchPreferences}
  catch{return {...defaultMatchPreferences}}
}
export function MatchSettings({preferences,onChange,onClose}:{preferences:MatchPreferences;onChange:(value:MatchPreferences)=>void;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null)
  useEffect(()=>{dialog.current?.showModal()},[])
  const items=[['microphone','Microphone','Start with your mic ready. Live in preparation and on your turn.'],['camera','Camera','Show your camera to round participants.'],['fallback','Automated judge','After 30 seconds without a judge. Unrated, text checks only. Peer feedback stays available.'],['spectators','Public rounds','Show names, submitted text and results when everyone agrees. Audio and video stay private.']] as const
  return <dialog ref={dialog} className="match-settings" aria-labelledby="match-settings-title" onCancel={event=>{event.preventDefault();onClose()}}>
    <header><h2 id="match-settings-title">Match settings</h2><Button variant="ghost" onClick={onClose}>Close</Button></header>
    <div className="match-setting-list">{items.map(([key,title,hint])=><label key={key}><span><strong>{title}</strong><small>{hint}</small></span><input type="checkbox" checked={preferences[key]} onChange={event=>onChange({...preferences,[key]:event.target.checked})}/></label>)}</div>
    <small>Saved on this device. Your browser still asks for camera and mic permission. PITCH does not record live calls.</small>
    <Button onClick={onClose}>Done</Button>
  </dialog>
}
