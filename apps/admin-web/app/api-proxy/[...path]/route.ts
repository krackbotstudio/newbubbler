import { type NextRequest, NextResponse } from 'next/server';

// Server-side: API_BASE_URL first (set on Vercel if needed), then NEXT_PUBLIC_API_URL.
// On Vercel, set both to the same value (e.g. https://bubbler-api.vercel.app/api) so this route can reach the API.
const getApiBase = (): string => {
  const raw =
    (process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003/api').trim();
  return raw.replace(/\/$/, '');
};

/** Ensure upstream URL always has /api prefix (backend expects /api/admin/...). */
function buildUpstreamUrl(base: string, pathSegments: string[], search: string): string {
  const path = pathSegments?.length ? pathSegments.join('/') : '';
  const baseWithApi = base.endsWith('/api') ? base : `${base}/api`;
  const fullPath = path ? `${baseWithApi}/${path}` : baseWithApi;
  return `${fullPath}${search}`;
}

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']);

/** Forward request to the real API (Render) so the browser stays same-origin. */
async function proxy(request: NextRequest, pathSegments: string[]) {
  const method = request.method;

  if (!ALLOWED_METHODS.has(method)) {
    console.error('[api-proxy] Unsupported method:', method);
    return NextResponse.json(
      { error: `Method ${method} not allowed` },
      { status: 405, headers: { Allow: Array.from(ALLOWED_METHODS).join(', ') } }
    );
  }

  const base = getApiBase();
  const url = buildUpstreamUrl(base, pathSegments, request.nextUrl.search);

  const headers = new Headers();
  const auth = request.headers.get('authorization');
  if (auth) headers.set('Authorization', auth);
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);

  let body: BodyInit | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    try {
      body = await request.text();
    } catch (e) {
      console.error('[api-proxy] Failed to read request body:', e);
    }
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body || undefined,
      signal: AbortSignal.timeout(65000),
    });

    const responseHeaders = new Headers();
    const contentTypeRes = res.headers.get('content-type');
    if (contentTypeRes) responseHeaders.set('Content-Type', contentTypeRes);
    const corsOrigin = res.headers.get('access-control-allow-origin');
    if (corsOrigin) responseHeaders.set('Access-Control-Allow-Origin', corsOrigin);

    const responseBody = await res.text();

    if (!res.ok) {
      console.error('[api-proxy] Upstream error:', res.status, method, url, responseBody.slice(0, 200));
    }

    return new NextResponse(responseBody, {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
    });
  } catch (e) {
    console.error('[api-proxy] Proxy error:', method, url, e);
    return NextResponse.json(
      { error: 'Proxy request failed', details: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }
}

async function handle(
  request: NextRequest,
  params: Promise<{ path: string[] }>
) {
  const { path } = await params;
  const pathSegments = Array.isArray(path) ? path : path ? [path] : [];
  return proxy(request, pathSegments);
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(request, ctx.params);
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(request, ctx.params);
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(request, ctx.params);
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(request, ctx.params);
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(request, ctx.params);
}

export async function OPTIONS(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(request, ctx.params);
}

export async function HEAD(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(request, ctx.params);
}
