export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function fail(status: number, code: string, message: string): never { throw new ApiError(status, code, message); }
export async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) fail(415, 'JSON_REQUIRED', 'Send an application/json body.');
  const reader = request.body?.getReader();
  if (!reader) fail(400, 'INVALID_JSON', 'A JSON object is required.');
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) { const part = await reader.read(); if (part.done) break; length += part.value.byteLength;
    if (length > 8192) { await reader.cancel(); fail(413, 'BODY_TOO_LARGE', 'Request body exceeds 8 KB.'); } chunks.push(part.value); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let value: unknown; try { value = JSON.parse(new TextDecoder().decode(bytes)); } catch { fail(400, 'INVALID_JSON', 'The request body is not valid JSON.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'INVALID_JSON', 'A JSON object is required.');
  return value as Record<string, unknown>;
}
export function textField(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string') fail(400, 'INVALID_INPUT', `${label} must be text.`);
  const cleaned = value.normalize('NFC').trim();
  if (!cleaned || cleaned.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(cleaned)) fail(400, 'INVALID_INPUT', `${label} must contain 1–${max} characters without control characters.`);
  return cleaned;
}
export async function sha256(value: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
export function token(): string { return Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join(''); }
