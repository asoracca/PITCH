export type QueueMode = 'quick' | 'contestant' | 'judge' | 'priority' | 'mixed';
export interface Session { player: { id: string; name: string }; token: string; expiresAt: number }
export interface Rubric { clarity: number; persuasiveness: number; composure: number; tip: string }
export interface Ballot { winnerId: string; a: Rubric; b: Rubric }
export class PitchApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

/** Create one instance per signed-in player. Never pass a database/hosting token here. */
export class PitchApi {
  token: string | null = null;
  constructor(public origin = '') {}
  async request<T = unknown>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const response = await fetch(`${this.origin.replace(/\/$/, '')}/api/pitch${path}`, {
      method, headers: { ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new PitchApiError(response.status, 'HOST_SIGN_IN_REQUIRED', 'Open the protected website and sign in, or check the API origin.');
    }
    const data = await response.json() as T & { error?: { code: string; message: string } };
    if (!response.ok) throw new PitchApiError(response.status, data.error?.code ?? 'API_ERROR', data.error?.message ?? 'Request failed.');
    return data;
  }
  config() { return this.request('/config'); }
  async signup(details: { name: string; email: string; password: string; birthDate: string; acceptedConduct: true }) {
    const session = await this.request<Session>('/signup', 'POST', details); this.token = session.token; return session;
  }
  async login(email: string, password: string) {
    const session = await this.request<Session>('/login', 'POST', { email, password }); this.token = session.token; return session;
  }
  async logout() { await this.request('/logout', 'POST', {}); this.token = null; }
  me() { return this.request('/me'); }
  queue(mode?: QueueMode) { return mode ? this.request('/queue', 'POST', { mode }) : this.request('/queue'); }
  cancelQueue() { return this.request('/queue', 'DELETE'); }
  room(code: string) { return this.request(`/rooms/${encodeURIComponent(code)}`); }
  vote(code: string, ballot: Ballot) { return this.request(`/rooms/${encodeURIComponent(code)}/vote`, 'POST', ballot); }
  leave(code: string) { return this.request(`/rooms/${encodeURIComponent(code)}/leave`, 'POST', {}); }
  history() { return this.request('/history'); }
  leaderboard() { return this.request('/leaderboard'); }
}
