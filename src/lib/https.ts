/** Client-facing HTTPS helpers. No Node APIs — safe in the browser bundle. */

export const HSTS_VALUE = "max-age=31536000; includeSubDomains";
export const UPGRADE_INSECURE_REQUESTS = "upgrade-insecure-requests";

export type HttpsView = {
  host: string;
  /** First value of X-Forwarded-Proto, or empty when the proxy did not set it. */
  forwardedProto: "http" | "https" | "";
  /** Path + query, always starting with `/`. */
  path: string;
};

export function firstHeaderValue(value: string | string[] | null | undefined): string {
  if (value == null) return "";
  const raw = Array.isArray(value) ? value[0] ?? "" : value;
  return raw.split(",")[0]?.trim() ?? "";
}

export function hostnameOf(hostHeader: string): string {
  const host = hostHeader.trim().toLowerCase();
  if (!host) return "";
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end >= 0 ? host.slice(1, end) : host;
  }
  const colon = host.lastIndexOf(":");
  if (colon > 0 && /^\d+$/.test(host.slice(colon + 1))) return host.slice(0, colon);
  return host;
}

export function isLoopbackHost(hostHeader: string): boolean {
  const name = hostnameOf(hostHeader);
  return (
    name === "localhost" ||
    name === "127.0.0.1" ||
    name === "::1" ||
    name === "0.0.0.0"
  );
}

export function isPreviewGuestHost(hostHeader: string): boolean {
  const name = hostnameOf(hostHeader);
  return name === "grok-sandbox.com" || name.endsWith(".grok-sandbox.com");
}

export function isLocalOrPreviewHost(hostHeader: string): boolean {
  return isLoopbackHost(hostHeader) || isPreviewGuestHost(hostHeader);
}

export function viewFromHeaders(
  headers: Headers,
  fallbackUrl = "",
): HttpsView {
  const incoming = fallbackUrl ? new URL(fallbackUrl) : null;
  const host =
    firstHeaderValue(headers.get("x-forwarded-host")) ||
    firstHeaderValue(headers.get("host")) ||
    incoming?.host ||
    "";
  const forwarded = firstHeaderValue(headers.get("x-forwarded-proto")).toLowerCase();
  const forwardedProto = forwarded === "https" || forwarded === "http" ? forwarded : "";
  const path = incoming ? `${incoming.pathname}${incoming.search}` : "/";
  return { host, forwardedProto, path: path.startsWith("/") ? path : `/${path}` };
}

export function httpsRedirectLocation(view: HttpsView): string | null {
  if (!view.host || isLocalOrPreviewHost(view.host)) return null;
  // Only when a TLS-terminating proxy says the client used HTTP. Missing proto
  // means a direct bind (live preview, smoke tests) — never redirect those.
  if (view.forwardedProto !== "http") return null;
  return `https://${view.host}${view.path}`;
}

export function publicOrigin(view: HttpsView, fallbackProtocol: "http" | "https" = "https"): string {
  if (!view.host) return "";
  if (isLoopbackHost(view.host)) {
    const proto = view.forwardedProto || fallbackProtocol;
    return `${proto}://${view.host}`;
  }
  return `https://${view.host}`;
}

export function httpsResponseHeaders(
  view: HttpsView,
  opts: { upgradeInsecure?: boolean } = {},
): Record<string, string> {
  if (view.forwardedProto !== "https") return {};
  const headers: Record<string, string> = {
    "Strict-Transport-Security": HSTS_VALUE,
  };
  if (opts.upgradeInsecure) {
    headers["Content-Security-Policy"] = UPGRADE_INSECURE_REQUESTS;
  }
  return headers;
}

export function publicOriginFromRequest(request: Request): string {
  const view = viewFromHeaders(request.headers, request.url);
  const fromUrl = new URL(request.url).protocol.replace(":", "");
  const fallback = fromUrl === "http" ? "http" : "https";
  return publicOrigin(view, fallback);
}
