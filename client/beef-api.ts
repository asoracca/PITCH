export type { RoomView, Verdict, Player, PlayerScore, RatingSummary, RatingChange } from '../backend/types';
import type { Player, RoomView, RatingSummary } from '../backend/types';

export class BeefApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
/** One instance per player. Tokens remain in memory unless the frontend explicitly persists them. */
export class BeefApi {
  token: string | null = null;
  constructor(public origin = '') {}
  async request<T = unknown>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const response = await fetch(`${this.origin.replace(/\/$/, '')}/api${path}`, {
      method, headers: { ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status === 204) return undefined as T;
    if (!response.headers.get('content-type')?.includes('application/json')) throw new BeefApiError(response.status, 'SIGN_IN_OR_API_REQUIRED', 'Open the private Site and sign in, or check the API origin.');
    const data = await response.json() as T & { error?: { code: string; message: string } };
    if (!response.ok) throw new BeefApiError(response.status, data.error?.code ?? 'API_ERROR', data.error?.message ?? 'Request failed.');
    return data;
  }
  async signIn(name: string) {
    const session = await this.request<{ player: Player; token: string; expiresAt: number }>('/sessions', 'POST', { name });
    this.token = session.token; return session;
  }
  async signOut() { await this.request('/sessions', 'DELETE'); this.token = null; }
  me() { return this.request<{ player: Player; priorityTickets: number; rating: RatingSummary }>('/me'); }
  quickGame(format = 'classic') { return this.request('/queue', 'POST', { mode: 'quick', format }); }
  room(code: string) { return this.request<RoomView>(`/rooms/${encodeURIComponent(code)}`); }
  argument(code: string, round: number, content: string) { return this.request<RoomView>(`/rooms/${encodeURIComponent(code)}/arguments`, 'POST', { round, content }); }
}
