import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { makeHandler } from './vercel-handler';

/** The teammate's local Next.js server and Vercel use the same game handler. */
export function createApiListener(settings: Record<string, string | undefined>) {
  const handle = makeHandler(settings);
  return async (request: IncomingMessage, response: ServerResponse): Promise<boolean> => {
    const path = request.url ?? '/';
    if (!/^\/api(?:\/|\?|$)/.test(path)) return false;
    try {
      const host = request.headers.host ?? 'localhost';
      const url = new URL(path, `http://${host}`);
      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      }
      const init = { method: request.method, headers,
        body: ['GET', 'HEAD'].includes(request.method ?? 'GET') ? undefined : Readable.toWeb(request), duplex: 'half' } as RequestInit;
      const result = await handle(new Request(url, init));
      response.statusCode = result.status;
      result.headers.forEach((value, key) => response.setHeader(key, value));
      response.end(Buffer.from(await result.arrayBuffer()));
    } catch {
      response.writeHead(500, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(JSON.stringify({ error: { code: 'LOCAL_SERVER_ERROR', message: 'The local API could not handle this request.' } }));
    }
    return true;
  };
}
