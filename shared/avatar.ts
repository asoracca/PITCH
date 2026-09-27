export const appearanceColors = [
  {id:'default',name:'Original',color:''}, {id:'navy',name:'Navy',color:'#1b2439'},
  {id:'cyan',name:'Cyan',color:'#88f4f5'}, {id:'purple',name:'Purple',color:'#a78bfa'},
  {id:'orange',name:'Orange',color:'#ff9e45'}, {id:'cream',name:'Cream',color:'#f5f3ee'},
  {id:'black',name:'Black',color:'#161723'}, {id:'silver',name:'Silver',color:'#b8beca'},
  {id:'brown',name:'Brown',color:'#754933'}, {id:'green',name:'Green',color:'#42dd96'},
]
export const appearanceColorKeys = ['jacketColor','shirtColor','trousersColor','shoeColor','accessoryColor','eyeColor','backgroundColor'] as const
export type AppearanceColorKey = typeof appearanceColorKeys[number]
export type AppearanceColors = Partial<Record<AppearanceColorKey,string>>
export function appearanceColor(value:string|undefined,fallback:string){return appearanceColors.find(color=>color.id===value)?.color||fallback}
const palette = appearanceColors.map(color=>color.id)
export interface AvatarLook extends AppearanceColors { outfit: string; accessory: string; background: string; skinTone: string; hairColor: string; avatarEnabled: boolean; style?: string; hairstyle?: string }
export const avatarChoices = {
  jacketColor:palette,shirtColor:palette,trousersColor:palette,shoeColor:palette,accessoryColor:palette,eyeColor:palette,backgroundColor:palette,
  style: ['masculine','feminine'],
  hairstyle: ['Short','Bob','Long','Curls','Ponytail','Buzz cut'],
  outfit: ['Varsity Pitch','Game Show Glow','The Closer','Smart Casual'],
  accessory: ['None','Round Glasses','Focus Headphones','Great Communicator','Day One Backpack'],
  background: ['Midnight Arena','Violet Voltage','Flame Streak','Leaderboard Elite'],
  skinTone: ['light','warm','tan','brown','deep','rich'], hairColor: ['black','brown','auburn','blond','silver','violet'],
}
export function readAvatar(value: unknown): AvatarLook | null {
  if (!value || typeof value !== 'object') return null
  const data=value as Record<string,unknown>
  if(typeof data.avatarEnabled!=='boolean')return null
  const result: Record<string,unknown>={avatarEnabled:data.avatarEnabled}
  for(const key of Object.keys(avatarChoices) as (keyof typeof avatarChoices)[]) {
    if((key==='style'||key==='hairstyle'||appearanceColorKeys.includes(key as AppearanceColorKey)) && data[key]===undefined)continue
    if(typeof data[key]!=='string'||!avatarChoices[key].includes(data[key] as string))return null
    result[key]=data[key]
  }
  return result as unknown as AvatarLook
}
export function storedAvatar(json: string | null | undefined): AvatarLook | null {
  try {return readAvatar(JSON.parse(json||'null'))}catch{return null}
}
