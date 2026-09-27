import { useEffect, useRef, useState } from 'react'
import { avatarChoices } from '../../shared/avatar'
import { Button, Icon, cosmeticItems, skinTones, hairColors, type EquippedItems } from './design'
import { WardrobeFigure, type WardrobeGroup, type WardrobeSelection } from './WardrobeFigure'
import './wardrobe.css'

const groups = [
  {key:'outfit',title:'Outfit',category:'Outfit'},
  {key:'accessory',title:'Accessory',category:'Accessories'},
  {key:'background',title:'Background',category:'Background'},
] as const
const labels: Record<string,string> = {
  'Varsity Pitch':'Persuasiveness', 'Game Show Glow':'Persuasiveness', 'The Closer':'Composure', 'Smart Casual':'Clarity',
  'None':'No accessories', 'Round Glasses':'Clarity', 'Focus Headphones':'Clarity', 'Great Communicator':'Persuasiveness', 'Day One Backpack':'Composure',
  'Midnight Arena':'Composure', 'Violet Voltage':'Persuasiveness', 'Flame Streak':'Persuasiveness', 'Leaderboard Elite':'Clarity',
}
const selection = (enabled:boolean):WardrobeSelection => ({style:enabled,outfit:enabled,accessory:enabled,background:enabled,skinTone:enabled,hairColor:enabled})
function normalized(look:EquippedItems):EquippedItems {
  return {...look,style:look.style||'masculine',skinTone:look.skinTone||'brown',hairColor:look.hairColor||'black',avatarEnabled:!!look.avatarEnabled}
}
function randomChoice(values:string[],current:string|undefined) {
  const alternatives=values.filter(value=>value!==current)
  return alternatives[Math.floor(Math.random()*alternatives.length)]||values[0]
}

export function Wardrobe({equipped,setEquipped,shop=false,onSave,saving=false}:{
  equipped:EquippedItems;setEquipped:(value:EquippedItems)=>void;shop?:boolean;onSave?:()=>void;saving?:boolean
}) {
  const [initial,setInitial]=useState(()=>normalized(equipped))
  const lastLook=useRef(equipped)
  const [selected,setSelected]=useState(()=>selection(!!equipped.avatarEnabled))
  // App can restore the saved avatar after this screen first mounts.
  useEffect(()=>{
    if(lastLook.current===equipped)return
    lastLook.current=equipped
    setInitial(normalized(equipped))
    setSelected(selection(!!equipped.avatarEnabled))
  },[equipped])
  function preview(next:EquippedItems){lastLook.current=next;setEquipped(next)}
  const total=Object.keys(selected).length
  const count=Object.values(selected).filter(Boolean).length
  const ready=count===total||!equipped.avatarEnabled
  function choose(key:WardrobeGroup,value:string) {
    const next={...selected,[key]:!(selected[key]&&normalized(equipped)[key]===value)}
    setSelected(next)
    preview({...normalized(equipped),[key]:value,avatarEnabled:Object.values(next).some(Boolean)})
  }
  function randomize(){
    const next=normalized(equipped)
    for(const key of Object.keys(avatarChoices) as WardrobeGroup[])next[key]=randomChoice(avatarChoices[key],equipped[key])
    setSelected(selection(true));preview({...next,avatarEnabled:true})
  }
  function reset(){setSelected(selection(!!initial.avatarEnabled));preview({...initial})}
  const background=selected.background?equipped.background:'none'
  const swatches=[{key:'skinTone',title:'Skin tone',values:skinTones},{key:'hairColor',title:'Hair color',values:hairColors}] as const
  return <section className="wardrobe" aria-labelledby="wardrobe-title">
    <header className="wardrobe-heading"><h1 id="wardrobe-title">{shop?'Try it on':'Your wardrobe'}</h1><div className="wardrobe-tools"><Button variant="ghost" disabled={saving} onClick={reset}>Reset</Button><Button variant="secondary" disabled={saving} onClick={randomize}><Icon name="spark" size={17}/>Randomize</Button></div></header>
    <div className="wardrobe-layout">
      <div className="wardrobe-rail">
        <fieldset className="wardrobe-group"><legend>Avatar style</legend><div className="wardrobe-options">{avatarChoices.style.map(style=><button type="button" className="wardrobe-option" key={style} aria-pressed={selected.style&&(equipped.style||'masculine')===style} disabled={saving} onClick={()=>choose('style',style)}><strong>{style==='feminine'?'Feminine':'Masculine'}</strong><span className="wardrobe-check" aria-hidden="true">{selected.style&&(equipped.style||'masculine')===style?<Icon name="check" size={15}/>:'+'}</span></button>)}</div></fieldset>
        {groups.map(group=><fieldset className="wardrobe-group" key={group.key}><legend>{group.title}</legend><div className="wardrobe-options">{cosmeticItems.filter(item=>item.category===group.category&&avatarChoices[group.key].includes(item.name)).map(item=><button type="button" className="wardrobe-option" key={item.id} aria-pressed={selected[group.key]&&equipped[group.key]===item.name} disabled={saving} onClick={()=>choose(group.key,item.name)}><span><strong>{item.name}</strong><small>{labels[item.name]}</small></span><span className="wardrobe-check" aria-hidden="true">{selected[group.key]&&equipped[group.key]===item.name?<Icon name="check" size={15}/>:'+'}</span></button>)}</div></fieldset>)}
        {swatches.map(group=><fieldset className="wardrobe-group wardrobe-palette" key={group.key}><legend>{group.title}</legend><div className="wardrobe-swatches">{group.values.map(value=><button type="button" key={value.id} className="wardrobe-swatch" disabled={saving} aria-label={`${group.title}: ${value.name}`} title={value.name} aria-pressed={selected[group.key]&&equipped[group.key]===value.id} onClick={()=>choose(group.key,value.id)}><span style={{backgroundColor:value.color}}/><Icon name="check" size={14}/></button>)}</div></fieldset>)}
      </div>
      <div className="wardrobe-live">
        <div className="wardrobe-preview" data-background={background}>
          <div className="wardrobe-preview-heading"><span>LIVE PREVIEW</span><output aria-live="polite" aria-atomic="true">{count} of {total} set</output></div>
          <WardrobeFigure look={equipped} selected={selected} count={count}/>
          <span className="wardrobe-preview-label">{count?selected.outfit?equipped.outfit:'Build your look':'No avatar'}</span>
        </div>
        <div className="wardrobe-save">
          {onSave&&<Button disabled={saving||!ready} onClick={onSave}>{saving?'Saving…':'Save avatar'}<Icon name="check" size={17}/></Button>}
          <Button variant="ghost" disabled={saving||!equipped.avatarEnabled} onClick={()=>{setSelected(selection(false));preview({...normalized(equipped),avatarEnabled:false})}}>Remove avatar</Button>
        </div>
        <p className="wardrobe-note">{!ready?`Choose all ${total} groups to save.`:'Free preview · Save to apply'}</p>
        <details className="wardrobe-details"><summary>About this look</summary><p>Skill labels are themes, not scores. Your look never affects judging. Reset restores the look you opened with.</p></details>
      </div>
    </div>
  </section>
}
