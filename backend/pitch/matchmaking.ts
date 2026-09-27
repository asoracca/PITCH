import { TOPICS } from '../../shared/pitch';
import { fail } from '../http';
import { Store } from '../store';
import type { Player } from '../types';
import { ageBand, profile } from './auth';
import { SCENARIOS } from './scenarios';
import type { Account, QueueRow } from './types';

export async function match(store: Store, _band: string) {
  const now=Date.now();
  const rows=(await store.sql(`SELECT q.*,p.rating,p.reliability,a.birth_date FROM pitch_queue q
    JOIN pitch_profiles p ON p.player_id=q.player_id JOIN pitch_accounts a ON a.player_id=q.player_id
    WHERE q.room_id IS NULL AND q.expires_at>? AND p.banned_until<=? AND (q.priority=0 OR p.priority_credits>0)
    ORDER BY q.priority DESC,q.joined_at LIMIT 80`,now,now).all<QueueRow>()).results.filter(r=>ageBand(r.birth_date,now));
  if(rows.length<2)return;
  const ids=rows.map(r=>r.player_id), marks=ids.map(()=>'?').join(',');
  const blocked=(await store.sql(`SELECT player_id,target_id FROM pitch_blocks WHERE player_id IN (${marks}) OR target_id IN (${marks})`,...ids,...ids).all<{player_id:string;target_id:string}>()).results;
  const compatible=(a:QueueRow,b:QueueRow)=>a.player_id!==b.player_id&&!blocked.some(r=>(r.player_id===a.player_id&&r.target_id===b.player_id)||(r.player_id===b.player_id&&r.target_id===a.player_id));
  const skill=(a:QueueRow,b:QueueRow)=>Math.abs(a.rating-b.rating)<=150+Math.floor(Math.max(now-a.joined_at,now-b.joined_at)/20000)*200;
  const categories=TOPICS.filter(t=>t.id!=='all').map(t=>t.id);
  // Rotate any-topic choices, so an unfiltered queue does not always get career scenarios.
  const offset=crypto.getRandomValues(new Uint8Array(1))[0]%categories.length;
  const topics=[...categories.slice(offset),...categories.slice(0,offset)];
  async function create(group:QueueRow[], category:string, peer:boolean) {
    const id=crypto.randomUUID(),code=id.replaceAll('-','').slice(0,8).toUpperCase();
    const bands=group.map(r=>ageBand(r.birth_date,now)!);
    // Mixed-age rooms use a scenario suitable for the youngest participant; age does not split the queue.
    const scenarioBand=bands.includes('14–17')?'14–17':bands.includes('18–22')?'18–22':'23+';
    const band=bands.every(b=>b===bands[0])?bands[0]:'Mixed ages';
    const library=SCENARIOS.filter(s=>s.band===scenarioBand&&s.category===category);
    const scenario=library[crypto.getRandomValues(new Uint32Array(1))[0]%library.length];
    const groupIds=group.map(r=>r.player_id), gMarks=group.map(()=>'?').join(',');
    const guard=group.map(()=>'(q.player_id=? AND q.ticket=?)').join(' OR ');
    await store.env.DB.batch([
      store.sql(`INSERT INTO pitch_rooms(id,code,band,scenario_id,scenario_json,a_id,b_id,started_at,is_public,judging_mode)
        SELECT ?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM pitch_queue q JOIN pitch_profiles p ON p.player_id=q.player_id
        WHERE (${guard}) AND q.room_id IS NULL AND q.expires_at>? AND p.banned_until<=? AND (q.priority=0 OR p.priority_credits>0)
        AND (q.category='all' OR q.category=?) ${peer?"AND q.allow_peer=1 AND q.role!='judge' AND q.joined_at<=?":''})=?
        AND NOT EXISTS(SELECT 1 FROM pitch_blocks WHERE player_id IN (${gMarks}) AND target_id IN (${gMarks}))`,
        id,code,band,scenario.id,JSON.stringify(scenario),group[0].player_id,group[1].player_id,now,group.every(r=>r.spectate_opt_in===1)?1:0,peer?'automated':'judged',
        ...group.flatMap(r=>[r.player_id,r.ticket]),now,now,category,...(peer?[now-120000]:[]),group.length,...groupIds,...groupIds),
      ...group.map((r,i)=>store.sql(`INSERT INTO pitch_seats(room_id,player_id,role,slot,last_seen) SELECT id,?,?,?,? FROM pitch_rooms WHERE id=?`,r.player_id,i<2?'contestant':'judge',i,now,id)),
      ...(!peer?group.slice(0,2).filter(r=>r.priority).map(r=>store.sql(`UPDATE pitch_profiles SET priority_credits=priority_credits-1 WHERE player_id=? AND EXISTS(SELECT 1 FROM pitch_rooms WHERE id=?)`,r.player_id,id)):[]),
      store.sql(`UPDATE pitch_queue SET room_id=? WHERE player_id IN (${gMarks}) AND EXISTS(SELECT 1 FROM pitch_rooms WHERE id=?)`,id,...groupIds,id),
    ]);
  }
  for(const topic of topics){
    const pool=rows.filter(r=>r.category==='all'||r.category===topic),contestants=pool.filter(r=>r.role!=='judge');
    for(const a of contestants)for(const b of contestants.filter(b=>compatible(a,b)&&skill(a,b))){
      const judges:QueueRow[]=[];
      for(const j of pool.filter(j=>j.role!=='contestant'&&compatible(a,j)&&compatible(b,j)).sort((a,b)=>b.reliability-a.reliability)){
        if(judges.every(other=>compatible(j,other)))judges.push(j);if(judges.length===3)break;
      }
      if(judges.length===3){const pair=crypto.getRandomValues(new Uint8Array(1))[0]%2?[a,b]:[b,a];await create([...pair,...judges],topic,false);return;}
      // Give a full panel a short chance to assemble; one human judge is enough.
      // Two available judges never create an even panel: the other stays queued.
      if(judges.length>=1 && a.joined_at<=now-15000 && b.joined_at<=now-15000){const pair=crypto.getRandomValues(new Uint8Array(1))[0]%2?[a,b]:[b,a];await create([...pair,judges[0]],topic,false);return;}
    }
  }
  for(const topic of topics){
    const pool=rows.filter(r=>(r.category==='all'||r.category===topic)&&r.role!=='judge'&&r.allow_peer===1&&r.joined_at<=now-120000);
    for(const a of pool){const b=pool.find(b=>compatible(a,b)&&skill(a,b));if(b){await create(crypto.getRandomValues(new Uint8Array(1))[0]%2?[a,b]:[b,a],topic,true);return;}}
  }
}

export async function enqueue(store: Store, player: Player, account: Account, mode: unknown, allowSpectators: unknown = false, allowPeer: unknown = false, category: unknown = 'all') {
  if (typeof allowSpectators !== 'boolean') fail(400, 'INVALID_SPECTATOR_CHOICE', 'Choose whether to allow spectators.');
  if (typeof allowPeer !== 'boolean') fail(400, 'INVALID_PEER_CHOICE', 'Choose whether to allow a two-player practice duel.');
  if (!TOPICS.some(t=>t.id===category)) fail(400,'INVALID_TOPIC','Choose a supported topic category.');
  const band = ageBand(account.birth_date);
  if (!band) fail(403, 'AGE_GATE', 'This prototype supports ages 14 and up.');
  const stats = await profile(store, player.id);
  if (stats.banned_until > Date.now()) fail(403, 'QUEUE_BANNED', `You can queue again at ${new Date(stats.banned_until).toISOString()}.`);
  if (!['quick', 'mixed', 'contestant', 'judge', 'priority'].includes(mode as string)) fail(400, 'INVALID_QUEUE', 'Choose quick, contestant, judge, or priority.');
  if (mode === 'priority' && !stats.priority_credits) fail(409, 'NO_PRIORITY_CREDIT', 'Complete two rounds as a judge to earn a priority credit.');
  const priority = (mode === 'quick' || mode === 'mixed' || mode === 'priority') && stats.priority_credits > 0 ? 1 : 0;
  const role = priority ? 'contestant' : mode === 'quick' || mode === 'mixed' ? 'mixed' : mode as string;
  const current = await store.sql('SELECT * FROM pitch_queue WHERE player_id=?', player.id).first<QueueRow>();
  if (current?.room_id) return;
  if (current && current.expires_at > Date.now()) { await match(store, band); return; }
  const now = Date.now();
  await store.sql(`INSERT INTO pitch_queue(player_id,ticket,role,priority,band,joined_at,expires_at,spectate_opt_in,allow_peer,category) VALUES(?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(player_id) DO UPDATE SET ticket=excluded.ticket,role=excluded.role,priority=excluded.priority,band=excluded.band,
    joined_at=excluded.joined_at,expires_at=excluded.expires_at,spectate_opt_in=excluded.spectate_opt_in,allow_peer=excluded.allow_peer,category=excluded.category WHERE pitch_queue.room_id IS NULL AND pitch_queue.expires_at<=?`,
  player.id, crypto.randomUUID(), role, priority, band, now, now + 150_000, allowSpectators ? 1 : 0, allowPeer && mode !== 'judge' && mode !== 'priority' ? 1 : 0, category as string, now).run();
  await match(store, band);
}
