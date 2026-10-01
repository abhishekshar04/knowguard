import { aiQuerySchema } from '@knowguard/validation';
import { type NextRequest, NextResponse } from 'next/server';

import { ApiError, apiStream } from '@/lib/api';
import { getSessionToken } from '@/lib/session';

const MAX_BODY_BYTES = 32 * 1024;

function error(status: number, code: string, message: string) {
  return NextResponse.json(
    { error: { code, message } },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

/**
 * BFF endpoint for Ask AI: forwards the question with the session's bearer token and streams the
 * API's Server-Sent Events back unchanged. The API does all authorization; this handler only
 * refuses cross-site requests (server actions get that check from Next.js, route handlers do not)
 * and malformed bodies.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== request.nextUrl.origin) {
    return error(403, 'FORBIDDEN', 'Cross-site requests are not allowed.');
  }
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return error(415, 'UNSUPPORTED_MEDIA_TYPE', 'Expected JSON.');
  }

  const token = await getSessionToken();
  if (!token) return error(401, 'UNAUTHENTICATED', 'Authentication is required.');

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return error(413, 'PAYLOAD_TOO_LARGE', 'The question is too long.');
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return error(400, 'VALIDATION_FAILED', 'The request is invalid.');
  }
  const parsed = aiQuerySchema.safeParse(json);
  if (!parsed.success)
    return error(400, 'VALIDATION_FAILED', 'Please enter a question (up to 4,000 characters).');

  try {
    const upstream = await apiStream('/ai/query', parsed.data, token, request.signal);
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (cause) {
    if (cause instanceof ApiError) {
      const res = error(cause.status, cause.code, cause.message);
      if (cause.retryAfterSeconds) res.headers.set('Retry-After', String(cause.retryAfterSeconds));
      return res;
    }
    if (request.signal.aborted) return error(499, 'CANCELLED', 'The request was cancelled.');
    return error(502, 'AI_UNAVAILABLE', 'The AI assistant is temporarily unavailable.');
  }
}
