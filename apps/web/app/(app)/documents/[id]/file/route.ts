import { type NextRequest, NextResponse } from 'next/server';

import { ApiError, apiFetchRaw } from '@/lib/api';
import { getSessionToken } from '@/lib/session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Only these may be shown inline; everything else is always a download. */
const INLINE_TYPES = new Set(['application/pdf', 'text/plain', 'text/markdown']);

/**
 * BFF file endpoint: streams a document (or a specific version) from the API to the browser.
 * The API authorizes the read. Inline viewing is limited to safe types and sandboxed by CSP so
 * a document can never run script in this origin.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const version = request.nextUrl.searchParams.get('version');
  if (!UUID.test(id) || (version !== null && !UUID.test(version))) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Not found.' } }, { status: 404 });
  }

  const token = await getSessionToken();
  if (!token) return NextResponse.redirect(new URL('/login', request.url));

  let upstream: Response;
  try {
    upstream = await apiFetchRaw(
      version ? `/documents/${id}/versions/${version}/download` : `/documents/${id}/download`,
      token,
    );
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 502;
    if (status === 401) return NextResponse.redirect(new URL('/auth/session-ended', request.url));
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'The requested document was not found.' } },
      { status: status === 404 || status === 403 ? 404 : 502 },
    );
  }

  const contentType = (upstream.headers.get('content-type') ?? 'application/octet-stream')
    .split(';')[0]!
    .trim();
  const inline = request.nextUrl.searchParams.get('inline') === '1' && INLINE_TYPES.has(contentType);
  const disposition = upstream.headers.get('content-disposition') ?? 'attachment';

  const headers = new Headers({
    'Content-Type': contentType.startsWith('text/') ? `${contentType}; charset=utf-8` : contentType,
    'Content-Disposition': inline ? disposition.replace(/^attachment/, 'inline') : disposition,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    // Documents are untrusted content. Text is served as a script-less, sandboxed unique origin.
    // PDFs are rendered by the browser's isolated PDF viewer, which a CSP sandbox would disable.
    'Content-Security-Policy':
      contentType === 'application/pdf'
        ? "default-src 'none'; object-src 'self'; frame-ancestors 'none'"
        : "sandbox; default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
  });
  const length = upstream.headers.get('content-length');
  if (length) headers.set('Content-Length', length);
  return new Response(upstream.body, { status: 200, headers });
}
