/**
 * Production HTTPS: 308 HTTP → HTTPS when a proxy reports x-forwarded-proto=http,
 * and HSTS on already-https traffic. Loopback and proto-less binds (live preview)
 * are left alone.
 */
import {
  httpsRedirectLocation,
  httpsResponseHeaders,
  viewFromHeaders,
} from "../../src/lib/https";

interface HttpsEvent {
  url: URL;
  req: { method: string; headers: Headers };
}

function withHttpsHeaders(response: Response, extra: Record<string, string>): Response {
  if (Object.keys(extra).length === 0) return response;
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(extra)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default async function httpsMiddleware(
  event: HttpsEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const view = viewFromHeaders(event.req.headers, event.url.href);
  const location = httpsRedirectLocation(view);
  if (location) {
    return new Response(null, {
      status: 308,
      headers: { Location: location },
    });
  }

  const extra = httpsResponseHeaders(view, { upgradeInsecure: true });
  const result = await next();
  if (result instanceof Response) return withHttpsHeaders(result, extra);
  return result;
}
