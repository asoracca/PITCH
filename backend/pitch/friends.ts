import { fail } from '../http';
import type { Store } from '../store';
import { ageBand } from './auth';
import { storedAvatar } from '../../shared/avatar';
import type { FriendEntry, Friendship, PublicProfile } from '../../shared/pitch';

type ProfileRow = { id: string; name: string; avatar_json: string | null; birth_date: string; rating: number; games: number; judged: number };
type RelationRow = { status: string; requester_id: string };
const columns = 'n.id,n.name,p.avatar_json,a.birth_date,p.rating,p.games,p.judged';
const profileTables = 'players n JOIN pitch_profiles p ON p.player_id=n.id JOIN pitch_accounts a ON a.player_id=n.id';
const unblocked = 'NOT EXISTS (SELECT 1 FROM pitch_blocks b WHERE (b.player_id=? AND b.target_id=?) OR (b.player_id=? AND b.target_id=?))';
function relationship(row: RelationRow | null, self: string): Friendship {
  return !row ? 'none' : row.status === 'accepted' ? 'friends' : row.requester_id === self ? 'outgoing' : 'incoming';
}
function safeProfile(row: ProfileRow, relation: Friendship): PublicProfile {
  return { player: { id: row.id, name: row.name, avatar: storedAvatar(row.avatar_json) },
    ageBand: ageBand(row.birth_date), rating: row.rating, roundsPlayed: row.games, roundsJudged: row.judged, friendship: relation };
}
export async function playerProfile(store: Store, self: string, target: string): Promise<PublicProfile> {
  const row = await store.sql(`SELECT ${columns} FROM ${profileTables} WHERE n.id=? AND ${unblocked}`,
    target, self, target, target, self).first<ProfileRow>();
  if (!row) fail(404, 'PROFILE_NOT_FOUND', 'Profile unavailable.');
  const [a,b] = [self,target].sort();
  const relation = await store.sql('SELECT status,requester_id FROM pitch_friendships WHERE player_a=? AND player_b=?',a,b).first<RelationRow>();
  return safeProfile(row, self === target ? 'self' : relationship(relation,self));
}
export async function friends(store: Store, self: string): Promise<{ friends: FriendEntry[] }> {
  const rows = (await store.sql(`SELECT ${columns},f.status,f.requester_id,f.updated_at FROM pitch_friendships f
    JOIN players n ON n.id=CASE WHEN f.player_a=? THEN f.player_b ELSE f.player_a END
    JOIN pitch_profiles p ON p.player_id=n.id JOIN pitch_accounts a ON a.player_id=n.id
    WHERE (f.player_a=? OR f.player_b=?) AND NOT EXISTS (SELECT 1 FROM pitch_blocks b
      WHERE (b.player_id=? AND b.target_id=n.id) OR (b.player_id=n.id AND b.target_id=?))
    ORDER BY f.updated_at DESC`, self,self,self,self,self).all<ProfileRow & RelationRow & {updated_at:number}>()).results;
  return { friends: rows.map(row => ({...safeProfile(row,relationship(row,self)),updatedAt:row.updated_at})) };
}
export async function changeFriend(store: Store, self: string, target: string, action: unknown) {
  if (target === self) fail(400,'INVALID_FRIEND','Choose another player.');
  if (!['request','accept','decline','cancel','remove'].includes(String(action))) fail(400,'INVALID_ACTION','Choose a friend action.');
  await playerProfile(store,self,target);
  const [a,b] = [self,target].sort(), now = Date.now();
  const blockArgs = [self,target,target,self];
  if (action === 'request') {
    await store.limit(`pitch-friend-request:${self}`,30,86_400_000);
    await store.sql(`INSERT INTO pitch_friendships(player_a,player_b,requester_id,status,created_at,updated_at)
      SELECT ?,?,?,'pending',?,? WHERE ${unblocked} ON CONFLICT DO NOTHING`,a,b,self,now,now,...blockArgs).run();
  } else if (action === 'accept') {
    const changed = await store.sql(`UPDATE pitch_friendships SET status='accepted',updated_at=?
      WHERE player_a=? AND player_b=? AND status='pending' AND requester_id=? AND ${unblocked}`,now,a,b,target,...blockArgs).run();
    if (!changed.meta.changes) fail(409,'REQUEST_CHANGED','Request changed. Refresh and try again.');
  } else {
    const condition = action === 'remove' ? "status='accepted'" : "status='pending' AND requester_id=?";
    const args = action === 'remove' ? [] : [action === 'cancel' ? self : target];
    const changed = await store.sql(`DELETE FROM pitch_friendships WHERE player_a=? AND player_b=? AND ${condition}`,a,b,...args).run();
    if (!changed.meta.changes) fail(409,'REQUEST_CHANGED','Request changed. Refresh and try again.');
  }
  return playerProfile(store,self,target);
}
