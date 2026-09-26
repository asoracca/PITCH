import worker from '../backend/worker';
import { connectDatabase } from './libsql';
import type { Env } from '../backend/types';

type Settings = Record<string, string | undefined>;

export function makeHandler(settings: Settings, connect = connectDatabase) {
  let connection: ReturnType<typeof connectDatabase> | undefined;
  return async (request: Request): Promise<Response> => {
    try {
      const databaseUrl = settings.TURSO_DATABASE_URL;
      const authToken = settings.TURSO_AUTH_TOKEN;
      const remote = databaseUrl && /^(libsql|https):\/\//.test(databaseUrl);
      const local = databaseUrl?.startsWith('file:') && settings.BEEF_LOCAL_DATABASE === '1' && !settings.VERCEL;
      if (!databaseUrl || (!remote && !local) || (remote && !authToken)) {
        return Response.json({ error: { code: 'DATABASE_NOT_CONFIGURED', message: 'The database is not connected yet. Please try again after setup.' } },
          { status: 503, headers: { 'Cache-Control': 'no-store' } });
      }
      connection ??= connect(databaseUrl, authToken);
      const url = new URL(request.url);
      const route = url.searchParams.get('__beef_path');
      if (url.pathname === '/api/index' && route !== null) url.pathname = `/api/${route}`;
      url.searchParams.delete('__beef_path');
      const headers = new Headers(request.headers);
      // Only trust Vercel's own forwarding header for per-IP limits; never accept a spoofed Cloudflare header.
      headers.delete('cf-connecting-ip');
      if (settings.VERCEL) {
        const ip = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim();
        if (ip) headers.set('cf-connecting-ip', ip);
      }
      const env: Env = { DB: connection.DB, CORS_ORIGINS: settings.CORS_ORIGINS, VOICE_ICE_SERVERS: settings.VOICE_ICE_SERVERS, PITCH_MODERATOR_IDS: settings.PITCH_MODERATOR_IDS };
      // Paid AI is deliberately not configured for the no-cost prototype.
      return worker.fetch(new Request(url, { method: request.method, headers,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body, duplex: 'half' } as RequestInit), env);
    } catch {
      return Response.json({ error: { code: 'DATABASE_UNAVAILABLE', message: 'The service is temporarily unavailable. Please retry.' } },
        { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
  };
}
