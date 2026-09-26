import { PITCH_API_VERSION } from '../shared/pitch';
import type { Ballot, FeedbackRating, PitchConfig, PitchHistory, PitchLeaderboard, PitchMe, PitchQueue, PitchRoomView, QueueMode, ReportReason, Reports, Session, Signup, SignalPage, VoiceConfig, VoiceMessage } from '../shared/pitch';
export type * from '../shared/pitch';
export { PITCH_API_VERSION } from '../shared/pitch';

export class PitchApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); this.name = 'PitchApiError'; }
}
export interface RequestOptions { signal?: AbortSignal }
export interface WatchHandlers<T> { onUpdate: (value: T) => void; onError: (error: unknown) => void }

/** One instance per browser session. Instantiate inside a client component/provider, never as a shared server singleton. */
export class PitchApi {
  token: string | null = null;
  constructor(public origin = '', private fetcher: typeof fetch = (...args) => fetch(...args)) {}
  async request<T = unknown>(path: string, method = 'GET', body?: unknown, options: RequestOptions = {}): Promise<T> {
    // Only API-relative paths are accepted, so a room ID cannot redirect a bearer token elsewhere.
    if (!path.startsWith('/') || path.startsWith('//')) throw new TypeError('Use an API-relative path.');
    const token = this.token;
    const response = await this.fetcher(`${this.origin.replace(/\/$/, '')}/api/pitch${path}`, {
      method, signal: options.signal, cache: 'no-store',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new PitchApiError(response.status, 'HOST_SIGN_IN_REQUIRED', 'Open the protected website and sign in, or check the API origin.');
    }
    const data = await response.json() as T & { error?: { code: string; message: string } };
    if (!response.ok) {
      // Do not clear a newer session when a previous session's delayed request fails.
      if (response.status === 401 && token && this.token === token) this.token = null;
      throw new PitchApiError(response.status, data.error?.code ?? 'API_ERROR', data.error?.message ?? 'Request failed.');
    }
    return data;
  }
  async config(options?: RequestOptions) {
    const value = await this.request<PitchConfig>('/config', 'GET', undefined, options);
    if (value.apiVersion !== PITCH_API_VERSION) throw new PitchApiError(409, 'API_VERSION_MISMATCH', 'The frontend and backend API versions do not match.');
    return value;
  }
  async signup(details: Signup, options?: RequestOptions) {
    const session = await this.request<Session>('/signup', 'POST', details, options); this.token = session.token; return session;
  }
  async login(email: string, password: string, options?: RequestOptions) {
    const session = await this.request<Session>('/login', 'POST', { email, password }, options); this.token = session.token; return session;
  }
  async logout() {
    const token = this.token;
    try { await this.request('/logout', 'POST', {}); }
    finally { if (this.token === token) this.token = null; }
  }
  me(options?: RequestOptions) { return this.request<PitchMe>('/me', 'GET', undefined, options); }
  queue(mode?: QueueMode, options?: RequestOptions) { return this.request<PitchQueue>('/queue', mode ? 'POST' : 'GET', mode ? { mode } : undefined, options); }
  cancelQueue(options?: RequestOptions) { return this.request<PitchQueue>('/queue', 'DELETE', undefined, options); }
  room(code: string, options?: RequestOptions) { return this.request<PitchRoomView>(this.roomPath(code), 'GET', undefined, options); }
  vote(code: string, ballot: Ballot, options?: RequestOptions) { return this.request<PitchRoomView>(this.roomPath(code, '/vote'), 'POST', ballot, options); }
  respond(code: string, phase: number, content: string, options?: RequestOptions) { return this.request<PitchRoomView>(this.roomPath(code, '/response'), 'POST', { phase, content }, options); }
  leave(code: string, options?: RequestOptions) { return this.request<PitchRoomView>(this.roomPath(code, '/leave'), 'POST', {}, options); }
  history(options?: RequestOptions) { return this.request<PitchHistory>('/history', 'GET', undefined, options); }
  leaderboard(options?: RequestOptions) { return this.request<PitchLeaderboard>('/leaderboard', 'GET', undefined, options); }
  rateFeedback(ballotId: string, value: FeedbackRating) { return this.request<{ saved: true }>('/feedback', 'POST', { ballotId, value }); }
  report(code: string, targetId: string, reason: ReportReason, details: string) { return this.request<{ reported: true }>(this.roomPath(code, '/report'), 'POST', { targetId, reason, details }); }
  block(code: string, targetId: string) { return this.request<{ blocked: true; targetId: string }>(this.roomPath(code, '/block'), 'POST', { targetId }); }
  reports(options?: RequestOptions) { return this.request<Reports>('/reports', 'GET', undefined, options); }
  reviewReport(id: string, decision: 'upheld' | 'dismissed') { return this.request<Reports>('/reports', 'POST', { id, decision }); }
  voice(options?: RequestOptions) { return this.request<VoiceConfig>('/voice', 'GET', undefined, options); }
  signals(code: string, after = 0, options?: RequestOptions) { return this.request<SignalPage>(this.roomPath(code, `/signals?after=${encodeURIComponent(after)}`), 'GET', undefined, options); }
  sendSignal(code: string, targetId: string, message: VoiceMessage, options?: RequestOptions) { return this.request<{ sent: true }>(this.roomPath(code, '/signals'), 'POST', { targetId, ...message }, options); }
  watchQueue(handlers: WatchHandlers<PitchQueue>) { return this.watch(signal => this.queue(undefined, { signal }), handlers, value => value.status !== 'waiting'); }
  watchRoom(code: string, handlers: WatchHandlers<PitchRoomView>) { return this.watch(signal => this.room(code, { signal }), handlers, value => value.status !== 'active' || value.left); }
  private roomPath(code: string, suffix = '') { return `/rooms/${encodeURIComponent(code)}${suffix}`; }
  private watch<T>(read: (signal: AbortSignal) => Promise<T>, handlers: WatchHandlers<T>, finished: (value: T) => boolean) {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => { controller.abort(); clearTimeout(timer); };
    const tick = async () => {
      try {
        const value = await read(controller.signal);
        if (controller.signal.aborted) return;
        handlers.onUpdate(value);
        if (finished(value)) stop();
      } catch (error) {
        if (controller.signal.aborted) return;
        handlers.onError(error);
        if (error instanceof PitchApiError && [401, 403, 404].includes(error.status)) stop();
      } finally { if (!controller.signal.aborted) timer = setTimeout(() => { void tick(); }, 4000); }
    };
    void tick();
    return stop;
  }
}
