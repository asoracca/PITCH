export interface AvatarLook { outfit: string; accessory: string; background: string; skinTone: string; hairColor: string; avatarEnabled: boolean }
export const avatarChoices = {
  outfit: ['Varsity Pitch','Game Show Glow','The Closer','Smart Casual'],
  accessory: ['Round Glasses','Focus Headphones','Great Communicator','Day One Backpack'],
  background: ['Midnight Arena','Violet Voltage','Flame Streak','Leaderboard Elite'],
  skinTone: ['light','warm','tan','brown','deep','rich'], hairColor: ['black','brown','auburn','blond','silver','violet'],
}
export function readAvatar(value: unknown): AvatarLook | null {
  if (!value || typeof value !== 'object') return null
  const data=value as Record<string,unknown>
  if(typeof data.avatarEnabled!=='boolean')return null
  const result: Record<string,unknown>={avatarEnabled:data.avatarEnabled}
  for(const key of Object.keys(avatarChoices) as (keyof typeof avatarChoices)[]) {
    if(typeof data[key]!=='string'||!avatarChoices[key].includes(data[key] as string))return null
    result[key]=data[key]
  }
  return result as unknown as AvatarLook
}
export function storedAvatar(json: string | null | undefined): AvatarLook | null {
  try {return readAvatar(JSON.parse(json||'null'))}catch{return null}
}
