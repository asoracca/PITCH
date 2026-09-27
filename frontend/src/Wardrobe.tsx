import { useEffect, useRef, useState } from 'react'
import { avatarChoices, appearanceColors, appearanceColorKeys, appearanceColor } from '../../shared/avatar'
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
const selection = (enabled:boolean):WardrobeSelection => ({style:enabled,hairstyle:enabled,outfit:enabled,accessory:enabled,background:enabled,skinTone:enabled,hairColor:enabled})
function normalized(look:EquippedItems):EquippedItems {
  return {...look,style:look.style||'masculine',hairstyle:look.hairstyle||'Short',skinTone:look.skinTone||'brown',hairColor:look.hairColor||'black',avatarEnabled:!!look.avatarEnabled}
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
    for(const key of Object.keys(avatarChoices) as (keyof typeof avatarChoices)[])next[key]=randomChoice(avatarChoices[key],equipped[key])
    setSelected(selection(true));preview({...next,avatarEnabled:true})
  }
  function reset(){setSelected(selection(!!initial.avatarEnabled));preview({...initial})}
  const background=selected.background?equipped.background:'none'
  const colorLabels = {jacketColor:'Jacket',shirtColor:'Shirt',trousersColor:'Trousers',shoeColor:'Shoes',accessoryColor:'Accessory',eyeColor:'Eyes',backgroundColor:'Background'}
  const swatches=[{key:'skinTone',title:'Skin tone',values:skinTones},{key:'hairColor',title:'Hair color',values:hairColors}] as const
  return <section className="wardrobe" aria-labelledby="wardrobe-title">
    <header className="wardrobe-heading"><h1 id="wardrobe-title">{shop?'Try it on':'Your wardrobe'}</h1><div className="wardrobe-tools"><Button variant="ghost" disabled={saving} onClick={reset}>Reset</Button><Button variant="secondary" disabled={saving} onClick={randomize}><Icon name="spark" size={17}/>Randomize</Button></div></header>
    <div className="wardrobe-layout">
      <div className="wardrobe-rail">
        <fieldset className="wardrobe-group"><legend>Avatar style</legend><div className="wardrobe-options">{avatarChoices.style.map(style=><button type="button" className="wardrobe-option" key={style} aria-pressed={selected.style&&(equipped.style||'masculine')===style} disabled={saving} onClick={()=>choose('style',style)}><strong>{style==='feminine'?'Feminine':'Masculine'}</strong><span className="wardrobe-check" aria-hidden="true">{selected.style&&(equipped.style||'masculine')===style?<Icon name="check" size={15}/>:'+'}</span></button>)}</div></fieldset>
        <fieldset className="wardrobe-group"><legend>Hairstyle</legend><div className="wardrobe-options">{avatarChoices.hairstyle.map(hairstyle=><button type="button" className="wardrobe-option" key={hairstyle} aria-pressed={selected.hairstyle&&(equipped.hairstyle||'Short')===hairstyle} disabled={saving} onClick={()=>choose('hairstyle',hairstyle)}><strong>{hairstyle}</strong><span className="wardrobe-check" aria-hidden="true">{selected.hairstyle&&(equipped.hairstyle||'Short')===hairstyle?<Icon name="check" size={15}/>:'+'}</span></button>)}</div></fieldset>
        {groups.map(group=><fieldset className="wardrobe-group" key={group.key}><legend>{group.title}</legend><div className="wardrobe-options">{cosmeticItems.filter(item=>item.category===group.category&&avatarChoices[group.key].includes(item.name)).map(item=><button type="button" className="wardrobe-option" key={item.id} aria-pressed={selected[group.key]&&equipped[group.key]===item.name} disabled={saving} onClick={()=>choose(group.key,item.name)}><span><strong>{item.name}</strong><small>{labels[item.name]}</small></span><span className="wardrobe-check" aria-hidden="true">{selected[group.key]&&equipped[group.key]===item.name?<Icon name="check" size={15}/>:'+'}</span></button>)}</div></fieldset>)}
        <details className="wardrobe-color-details" open><summary>Colours</summary><div className="wardrobe-color-rows">{appearanceColorKeys.map(key=><fieldset className="wardrobe-group wardrobe-palette" key={key}><legend>{colorLabels[key]}</legend><div className="wardrobe-swatches">{appearanceColors.map(color=><button type="button" className="wardrobe-swatch" key={color.id} disabled={saving} aria-label={`${colorLabels[key]}: ${color.name}`} title={color.name} aria-pressed={(equipped[key]||'default')===color.id} onClick={()=>preview({...normalized(equipped),[key]:color.id})}><span style={{background:color.color||'conic-gradient(#88f4f5,#a78bfa,#ff9e45,#88f4f5)'}}/><Icon name="check" size={14}/></button>)}</div></fieldset>)}</div></details>
        <section className="wardrobe-pro"><div className="wardrobe-pro-heading"><h2>Pro looks</h2><span>PREVIEW</span></div><p>PITCH Pro · $6/month or $48/year. Free to try and save now.</p><div className="wardrobe-options">
          <button type="button" className="wardrobe-option pro-neon" disabled={saving} onClick={()=>{setSelected(selection(true));preview({...normalized(equipped),outfit:'The Closer',accessory:'Focus Headphones',background:'Violet Voltage',jacketColor:'navy',shirtColor:'cream',trousersColor:'black',shoeColor:'black',accessoryColor:'cyan',eyeColor:'default',backgroundColor:'default',hairColor:'violet',avatarEnabled:true})}}><span><strong>Neon Closer</strong><small>Try Pro look</small></span><Icon name="spark"/></button>
          <button type="button" className="wardrobe-option pro-solar" disabled={saving} onClick={()=>{setSelected(selection(true));preview({...normalized(equipped),outfit:'Game Show Glow',accessory:'Round Glasses',background:'Flame Streak',jacketColor:'orange',shirtColor:'cream',trousersColor:'navy',shoeColor:'black',accessoryColor:'cream',eyeColor:'brown',backgroundColor:'default',hairColor:'silver',avatarEnabled:true})}}><span><strong>Solar Glow</strong><small>Try Pro look</small></span><Icon name="spark"/></button>
        </div><a href="#Plans">View plans</a></section>
        {swatches.map(group=><fieldset className="wardrobe-group wardrobe-palette" key={group.key}><legend>{group.title}</legend><div className="wardrobe-swatches">{group.values.map(value=><button type="button" key={value.id} className="wardrobe-swatch" disabled={saving} aria-label={`${group.title}: ${value.name}`} title={value.name} aria-pressed={selected[group.key]&&equipped[group.key]===value.id} onClick={()=>choose(group.key,value.id)}><span style={{backgroundColor:value.color}}/><Icon name="check" size={14}/></button>)}</div></fieldset>)}
      </div>
      <div className="wardrobe-live">
        <div className="wardrobe-preview" data-background={background} style={{backgroundColor:appearanceColor(equipped.backgroundColor,'')||undefined}}>
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
