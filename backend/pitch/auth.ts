import { fail, sha256, textField, token } from '../http';
import { Store } from '../store';
import type { Player } from '../types';
import type { Account, Profile } from './types';

export function ageBand(birthDate: string, now = Date.now()): '14–17' | '18–22' | '23+' | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const birth = new Date(`${birthDate}T00:00:00Z`);
  if (!Number.isFinite(birth.getTime()) || birth.toISOString().slice(0, 10) !== birthDate) return null;
  const today = new Date(now);
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  if (today.getUTCMonth() < birth.getUTCMonth() || (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate())) age--;
  return age >= 14 && age <= 17 ? '14–17' : age >= 18 && age <= 22 ? '18–22' : age >= 23 && age <= 120 ? '23+' : null;
}
async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  // 100,000 is supported by both runtimes; a long password and strict login limits are required.
  const result = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 100_000 }, key, 256);
  return Array.from(new Uint8Array(result), n => n.toString(16).padStart(2, '0')).join('');
}
function sameHash(a: string, b: string) { let diff = a.length ^ b.length; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ (b.charCodeAt(i) || 0); return diff === 0; }
export async function accountSession(store: Store, body: Record<string, unknown>, registration: boolean) {
  const email = textField(body.email, 'Email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'INVALID_EMAIL', 'Enter a valid email address.');
  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < 12 || password.length > 128) fail(400, 'INVALID_PASSWORD', 'Use a password with 12–128 characters.');
  await store.limit(`pitch-login:${await sha256(email)}`, 8, 60_000);
  const account = await store.sql('SELECT * FROM pitch_accounts WHERE email=?', email).first<Account>();
  let player: Player;
  const secret = token(); const expiresAt = Date.now() + 30 * 86_400_000; const now = Date.now();
  if (registration) {
    if (account) fail(409, 'ACCOUNT_EXISTS', 'An account already uses this email. Sign in instead.');
    const name = textField(body.name, 'Display name', 24);
    if (/[\r\n\t@]/.test(name)) fail(400, 'INVALID_NAME', 'Use a display name without contact details.');
    const birthDate = typeof body.birthDate === 'string' ? body.birthDate : '';
    if (!ageBand(birthDate)) fail(400, 'AGE_GATE', 'This prototype is for ages 14 and up. Enter your actual birth date.');
    if (body.acceptedConduct !== true) fail(400, 'CONDUCT_REQUIRED', 'Read and accept the prototype code of conduct and privacy notice.');
    player = { id: crypto.randomUUID(), name }; const salt = token(); const hash = await passwordHash(password, salt);
    try {
      await store.env.DB.batch([
        store.sql('INSERT INTO players(id,name,created_at) VALUES(?,?,?)', player.id, name, now),
        store.sql('INSERT INTO pitch_accounts(player_id,email,password_hash,password_salt,birth_date,accepted_at) VALUES(?,?,?,?,?,?)', player.id, email, hash, salt, birthDate, now),
        store.sql('INSERT INTO pitch_profiles(player_id) VALUES(?)', player.id),
        store.sql('INSERT INTO sessions(token_hash,player_id,expires_at) VALUES(?,?,?)', await sha256(secret), player.id, expiresAt),
      ]);
    } catch (error) {
      if (await store.sql('SELECT 1 FROM pitch_accounts WHERE email=?', email).first()) fail(409, 'ACCOUNT_EXISTS', 'An account already uses this email. Sign in instead.');
      throw error;
    }
  } else {
    // Hash missing users too, avoiding an early timing distinction.
    const hash = await passwordHash(password, account?.password_salt ?? 'pitch-missing-account-timing-pad');
    if (!account || !sameHash(hash, account.password_hash)) fail(401, 'LOGIN_FAILED', 'Email or password is incorrect.');
    player = (await store.sql('SELECT id,name FROM players WHERE id=?', account.player_id).first<Player>())!;
    await store.sql('INSERT INTO sessions(token_hash,player_id,expires_at) VALUES(?,?,?)', await sha256(secret), player.id, expiresAt).run();
  }
  return { player, token: secret, expiresAt };
}
export async function requireAccount(store: Store, player: Player) {
  const account = await store.sql('SELECT * FROM pitch_accounts WHERE player_id=?', player.id).first<Account>();
  if (!account) fail(403, 'ACCOUNT_REQUIRED', 'Create a PITCH account before joining a round.');
  return account;
}
export async function profile(store: Store, id: string): Promise<Profile> {
  const value = await store.sql('SELECT * FROM pitch_profiles WHERE player_id=?', id).first<Profile>();
  if (!value) fail(404, 'PROFILE_NOT_FOUND', 'PITCH profile not found.');
  return value;
}
export function moderator(store: Store, id: string) {
  return (store.env.PITCH_MODERATOR_IDS ?? '').split(',').map(s => s.trim()).includes(id);
}
