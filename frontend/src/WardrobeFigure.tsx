import { appearanceColor } from '../../shared/avatar'
import type { CSSProperties } from 'react'
import { AvatarHair, hairColors, skinTones, type EquippedItems } from './design'

export type WardrobeGroup = 'style' | 'hairstyle' | 'outfit' | 'accessory' | 'background' | 'skinTone' | 'hairColor'
export type WardrobeSelection = Record<WardrobeGroup, boolean>

const suits = [
  { name: 'Varsity Pitch', jacket: 'var(--purple)', trousers: 'var(--sidebar)', detail: 'varsity' },
  { name: 'Game Show Glow', jacket: 'var(--orange)', trousers: 'var(--sidebar)', detail: 'glow' },
  { name: 'The Closer', jacket: 'var(--surface-3)', trousers: 'var(--sidebar)', detail: 'formal' },
  { name: 'Smart Casual', jacket: 'var(--lime)', trousers: 'var(--surface-3)', detail: 'casual' },
]

/** All outfit layers stay mounted so rapid changes can crossfade in either direction. */
export function WardrobeFigure({ look, selected, count }: { look: EquippedItems; selected: WardrobeSelection; count: number }) {
  const skin = skinTones.find(tone => tone.id === look.skinTone) || skinTones[3]
  const hair = hairColors.find(color => color.id === look.hairColor) || hairColors[0]
  const skinFill = selected.skinTone ? skin.color : '#adb6c6'
  const skinShade = selected.skinTone ? skin.shade : '#8792a5'
  const hairstyle = selected.hairstyle ? look.hairstyle||'Short' : 'Short'
  const hairFill = selected.hairColor ? hair.color : '#667287'
  const feminine = selected.style && look.style === 'feminine'
  const strength = count / Object.keys(selected).length
  const headStyle: CSSProperties = {transform:`translateY(${(1-strength)*5}px) rotate(${-8+strength*8}deg)`,transformOrigin:'100px 136px'}
  const active = (group: WardrobeGroup, value: string) => selected[group] && look[group] === value ? 1 : 0
  const label = count ? [
    feminine ? 'Feminine style' : 'Masculine style',
    selected.outfit ? look.outfit : 'No outfit',
    selected.accessory && look.accessory!=='None' ? look.accessory : 'No accessories',
    selected.background ? look.background : 'Plain background',
    selected.skinTone ? skin.name + ' skin' : 'Skin tone unset',
    selected.hairstyle ? hairstyle + ' hairstyle' : 'Hairstyle unset',
    selected.hairColor ? hair.name + ' hair' : 'Hair color unset',
    ...['jacketColor','shirtColor','trousersColor','shoeColor','accessoryColor','eyeColor','backgroundColor'].filter(key => look[key as keyof EquippedItems] && look[key as keyof EquippedItems]!=='default').map(key => `${key.replace('Color','')}: ${look[key as keyof EquippedItems]}`),
  ].join(', ') : 'No avatar selected. Neutral gray figure.'
  return <svg className="wardrobe-figure" viewBox="0 0 200 360" role="img" aria-label={label}>
    <ellipse cx="102" cy="341" rx="56" ry="8" fill="var(--bg)" opacity=".2" />
    <g className="wardrobe-idle">
      <g className="wardrobe-pose" style={{ transform: `rotate(${-5 + strength * 5}deg) translateY(${(1-strength)*5}px)`, transformOrigin: '100px 330px' }}>
        <g className="wardrobe-layer" style={{opacity:active('accessory','Day One Backpack')}}>
          <path d="M64 151Q38 145 35 180L35 223Q36 233 53 231L70 228Z" fill={appearanceColor(look.accessoryColor,"var(--orange)")} stroke="var(--sidebar)" strokeWidth="2.5"/>
          <path d="M42 191H61V221H42Z" fill="var(--sidebar)" opacity=".2"/>
        </g>
        <g className="wardrobe-head" style={headStyle}><AvatarHair hairstyle={hairstyle} color={hairFill} layer="back"/></g>
        <g className="wardrobe-layer" style={{opacity:selected.outfit?0:1}}>
          <path d="M69 237H99L96 323H68ZM101 237H130L139 323H111Z" fill="#737f93"/>
          <path d={feminine ? "M83 138L67 145Q55 148 51 163L36 237L50 241L69 180L77 212L66 243Q100 253 134 243L123 212L131 180L149 241L163 237L149 163Q145 149 133 145L116 138Z" : "M83 138L62 145Q50 146 46 162L34 237L50 241L66 182L64 243Q100 253 137 243L133 182L149 241L165 237L151 162Q148 148 134 145L116 138Z"} fill="#909bad" stroke="#606d82" strokeWidth="2"/>
        </g>
        {suits.map(suit=><g key={suit.name} className="wardrobe-layer wardrobe-outfit" data-outfit={suit.name} style={{opacity:active('outfit',suit.name)}}>
          <path d="M69 237H99L96 323H68ZM101 237H130L139 323H111Z" fill={appearanceColor(look.trousersColor,suit.trousers)}/>
          <path d="M84 257L81 315M116 258L124 315" fill="none" stroke="var(--muted)" opacity=".3" strokeWidth="1.5"/>
          <path d={feminine ? "M83 138L67 145Q55 148 51 163L36 237L50 241L69 180L77 212L66 243Q100 253 134 243L123 212L131 180L149 241L163 237L149 163Q145 149 133 145L116 138Z" : "M83 138L62 145Q50 146 46 162L34 237L50 241L66 182L64 243Q100 253 137 243L133 182L149 241L165 237L151 162Q148 148 134 145L116 138Z"} fill={appearanceColor(look.jacketColor,suit.jacket)} stroke="var(--sidebar)" strokeWidth="2.5" strokeLinejoin="round"/>
          <path d="M82 140H118L116 235H86Z" fill={appearanceColor(look.shirtColor,"var(--text)")}/>
          {suit.detail==='varsity'?<>
            <path d="M81 141L100 162L119 141M65 231H85M116 231H136M37 227L52 231M147 231L162 227" fill="none" stroke="var(--lime)" strokeWidth="6"/>
            <path d="M72 155V173M72 155H80Q87 164 72 164" stroke="var(--text)" strokeWidth="3" fill="none"/>
            <path d="M98 163V243" stroke="var(--sidebar)" strokeWidth="3"/>
          </>:<>
            <path d="M82 139L100 180L75 164L80 158L72 148ZM118 139L100 180L124 164L120 158L128 148Z" fill={suit.detail==='formal'?'var(--purple)':'var(--text)'} opacity={suit.detail==='formal'?'.8':'.72'}/>
            {suit.detail==='formal'&&!feminine&&<path d="M96 151H104L107 174L100 191L93 174Z" fill="var(--lime)"/>}
            {suit.detail==='glow'&&<path d="M128 171L129 176L134 177L129 179L128 184L126 179L121 177L126 176Z" fill="var(--text)"/>}
            <path d="M73 204L86 205M117 205L130 204" stroke="var(--sidebar)" strokeWidth="2" opacity=".6"/>
            <circle cx="101" cy="205" r="2" fill="var(--sidebar)"/><circle cx="102" cy="222" r="2" fill="var(--sidebar)"/>
          </>}
        </g>)}
        <path d="M35 237L49 241L46 252Q43 258 38 255L34 251ZM149 241L163 237L165 251Q161 258 155 255Z" fill={skinFill} stroke={skinShade} strokeWidth="1.5"/>
        <path d="M67 320H96V331Q81 336 61 333Q58 328 67 320ZM111 320H139L147 329Q151 335 138 335L112 331Z" fill={appearanceColor(look.shoeColor,"var(--sidebar)")} stroke="var(--muted)" strokeWidth="1.5"/>
        <path d="M63 332H94M113 331L145 334" stroke="var(--lime)" opacity={selected.outfit?'.7':'.2'} strokeWidth="2"/>
        <path d="M86 116H114V145L100 158L86 145Z" fill={skinShade}/>
        <g className="wardrobe-head" style={headStyle}>
          <ellipse cx="63" cy="94" rx="7" ry="11" fill={skinShade}/><ellipse cx="137" cy="94" rx="7" ry="11" fill={skinShade}/>
          <path d={feminine ? "M65 76Q64 38 99 38Q136 39 136 76L133 102Q124 132 100 133Q76 133 67 104Z" : "M63 76Q62 38 99 38Q138 39 138 76L135 102Q129 132 100 133Q71 133 65 104Z"} fill={skinFill}/>
          <AvatarHair hairstyle={hairstyle} color={hairFill} layer="front"/>
          <path d="M79 88L89 86M111 86L121 88" stroke="var(--sidebar)" strokeWidth="2.5" strokeLinecap="round" opacity=".7"/>
          <ellipse cx="84" cy="96" rx="2.5" ry={2.1+strength*.8} fill={appearanceColor(look.eyeColor,"var(--sidebar)")}/><ellipse cx="116" cy="96" rx="2.5" ry={2.1+strength*.8} fill={appearanceColor(look.eyeColor,"var(--sidebar)")}/>
          <path d="M100 99L97 107H102" stroke={skinShade} fill="none" strokeWidth="2" strokeLinecap="round"/>
          <path className="wardrobe-layer" d="M91 118Q100 119 109 117" opacity={1-strength} fill="none" stroke="var(--sidebar)" strokeWidth="2" strokeLinecap="round"/>
          <path className="wardrobe-layer" d="M90 116Q101 128 111 115" opacity={strength} fill="none" stroke="var(--sidebar)" strokeWidth="2.5" strokeLinecap="round"/>
          <g className="wardrobe-layer" style={{opacity:active('accessory','Round Glasses')}} fill="none" stroke={appearanceColor(look.accessoryColor,"var(--lime)")} strokeWidth="3.5"><circle cx="82" cy="97" r="13"/><circle cx="118" cy="97" r="13"/><path d="M95 97H105M63 93L69 96M131 96L137 93"/></g>
          <g className="wardrobe-layer" style={{opacity:active('accessory','Focus Headphones')}} fill={appearanceColor(look.accessoryColor,'var(--lime)')}><path d="M59 94V70Q60 29 100 30Q140 30 141 70V94" fill="none" stroke="var(--sidebar)" strokeWidth="9"/><rect x="54" y="78" width="12" height="31" rx="6"/><rect x="134" y="78" width="12" height="31" rx="6"/></g>
        </g>
        <g className="wardrobe-layer" style={{opacity:active('accessory','Great Communicator')}}><circle cx="126" cy="179" r="9" fill={appearanceColor(look.accessoryColor,"var(--lime)")}/><path d="M122 176H130V181H127L124 184V181H122Z" fill="var(--sidebar)"/></g>
        <path className="wardrobe-layer" style={{opacity:active('accessory','Day One Backpack')}} d="M66 147Q56 166 66 195" stroke={appearanceColor(look.accessoryColor,"var(--orange)")} strokeWidth="7" fill="none"/>
      </g>
    </g>
  </svg>
}
