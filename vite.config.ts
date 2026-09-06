import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import basicSsl from '@vitejs/plugin-basic-ssl';
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
// @ts-expect-error JS plugin alongside the TS vite config
import { grokPwaPlugin } from "./scripts/grok-pwa-plugin.mjs";
// @ts-expect-error JS plugin alongside the TS vite config
import { appEnvPlugin } from "./scripts/app-env-plugin.mjs";
import { isMigrationFile } from "./scripts/migration-plan.mjs";
import {
  firstHeaderValue,
  httpsRedirectLocation,
  httpsResponseHeaders,
  type HttpsView,
} from "./src/lib/https.ts";
const extraIps = [
  '127.0.0.1',
  '0.0.0.0',
  'localhost',
  // LAN / phone / other machines — add yours here
  '192.168.1.1',
  '192.168.0.1',
  '10.0.0.1',
  // example phone or extra host:
  '192.168.0.62',
  'cachyserver.local',
]



/** The files `src/lib/db.ts` globs — same directory, same non-recursive scope. */
function hasGlobbedMigrations(root: string): boolean {
  try {
    return readdirSync(join(root, "migrations")).some(isMigrationFile);
  } catch {
    return false;
  }
}

function httpsViewFromNode(req: IncomingMessage): HttpsView {
  const host =
    firstHeaderValue(req.headers["x-forwarded-host"]) || firstHeaderValue(req.headers.host) || "";
  const forwarded = firstHeaderValue(req.headers["x-forwarded-proto"]).toLowerCase();
  const forwardedProto = forwarded === "https" || forwarded === "http" ? forwarded : "";
  const path = req.url && req.url.startsWith("/") ? req.url : `/${req.url ?? ""}`;
  return { host, forwardedProto, path };
}

function httpsConnect(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) {
  if (req.headers.upgrade) {
    next();
    return;
  }
  const view = httpsViewFromNode(req);
  const location = httpsRedirectLocation(view);
  if (location) {
    res.statusCode = 308;
    res.setHeader("Location", location);
    res.end();
    return;
  }
  for (const [key, value] of Object.entries(httpsResponseHeaders(view))) {
    if (!res.getHeader(key)) res.setHeader(key, value);
  }
  next();
}

/**
 * HTTPS for the live preview / vite preview bind. Redirects only when a proxy
 * reports x-forwarded-proto=http on a non-loopback host — loopback HTTP on
 * :8080 / :8081 stays as-is so the preview contract is unchanged.
 */
function httpsEnforcePlugin(): Plugin {
  return {
    name: "enlightened-beauty:https",
    configureServer(server) {
      server.middlewares.use(httpsConnect);
    },
    configurePreviewServer(server) {
      server.middlewares.use(httpsConnect);
    },
  };
}

/**
 * Finish PGLite bootstrap during dev-server setup (before traffic). Vite awaits
 * async `configureServer` hooks. Production: `src/lib/db` kicks `ensureDbReady`
 * on import.
 *
 * Vite awaiting the hook puts this on time-to-first-render, so an app with no
 * migrations — no schema to apply — skips it entirely rather than paying for a
 * PGLite instance it never queries.
 */
function pgliteBootstrapPlugin(): Plugin {
  return {
    name: "app-builder:pglite-bootstrap",
    apply: "serve",
    async configureServer(server) {
      if (!hasGlobbedMigrations(server.config.root)) return;
      try {
        const mod = (await server.ssrLoadModule("/src/lib/db.ts")) as {
          ensureDbReady?: () => Promise<void>;
        };
        if (typeof mod.ensureDbReady === "function") {
          await mod.ensureDbReady();
        }
      } catch (err) {
        console.error("[app-builder] DB bootstrap failed:", err);
        throw err;
      }
    },
  };
}

/**
 * Live-preview OAuth popup — handled HERE so the agent never has to create a
 * `/auth/popup` route (and cannot break it by scaffolding a React page that
 * paints the full app shell in the popup).
 *
 * `signIn` (client.ts) opens `/auth/popup?providerId=…` in a top-level window.
 * This middleware runs before TanStack Start, calls `handleAuthPopupRequest`,
 * and returns the 302 / completion HTML. Deployed apps do not use the popup
 * (full-page OAuth redirect), so `apply: "serve"` is enough.
 */
function authPopupPlugin(): Plugin {
  return {
    name: "app-builder:auth-popup",
    apply: "serve",
    configureServer(server) {
      // Register immediately (not in a returned post-hook) so we run BEFORE
      // TanStack Start / the SPA HTML fallback. A model-authored
      // `src/routes/auth/popup.tsx` React page must never win this path.
      server.middlewares.use(async (req, res, next) => {
        try {
          const rawUrl = req.url ?? "";
          const pathOnly = rawUrl.split("?", 1)[0] ?? "";
          if (pathOnly !== "/auth/popup") {
            next();
            return;
          }
          if ((req.method ?? "GET").toUpperCase() !== "GET") {
            res.statusCode = 405;
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.end("Method Not Allowed");
            return;
          }

          const host = String(
            req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:8080",
          );
          const proto = String(
            req.headers["x-forwarded-proto"] ??
              ((req.socket as { encrypted?: boolean } | undefined)?.encrypted ? "https" : "http"),
          );
          const requestHeaders = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (value === undefined) continue;
            if (Array.isArray(value)) {
              for (const v of value) requestHeaders.append(key, v);
            } else {
              requestHeaders.set(key, value);
            }
          }
          // Ensure Host is the public preview host so Better Auth's dynamic
          // baseURL / redirect_uri match the popup origin.
          if (!requestHeaders.has("host")) requestHeaders.set("host", host);

          const request = new Request(`${proto}://${host}${rawUrl}`, {
            method: "GET",
            headers: requestHeaders,
          });

          const mod = (await server.ssrLoadModule("/src/lib/auth/popup.server.ts")) as {
            handleAuthPopupRequest: (req: Request) => Promise<Response>;
          };
          const response = await mod.handleAuthPopupRequest(request);

          res.statusCode = response.status;
          // Preserve multiple Set-Cookie headers (OAuth state + session).
          const setCookies =
            typeof response.headers.getSetCookie === "function"
              ? response.headers.getSetCookie()
              : [];
          response.headers.forEach((value, key) => {
            if (key.toLowerCase() === "set-cookie") return;
            res.setHeader(key, value);
          });
          for (const cookie of setCookies) {
            res.appendHeader("set-cookie", cookie);
          }
          const body = Buffer.from(await response.arrayBuffer());
          res.end(body);
        } catch (err) {
          console.error("[app-builder] /auth/popup handler failed:", err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.end("auth popup failed");
          }
        }
      });
    },
  };
}

const projectRoot = dirname(fileURLToPath(import.meta.url));

// ExcelJS's package "main" is the Node build (fs/stream). Point Vite at the
// official browser UMD so client import() doesn't pull Node builtins, and
// prebundle it so the first Vagaro .xlsx upload doesn't 504 on a stale dep.
const exceljsBrowser = resolve(projectRoot, "node_modules/exceljs/dist/exceljs.min.js");

// `0.0.0.0:8080` is the live-preview contract — don't change host/port.
// The dev server starts once `src/router.tsx` and `src/routes/` exist — see
// AGENTS.md § "First scaffold".
export default defineConfig(({ command, isPreview }) => ({
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: false,
    allowedHosts: extraIps,	
    https: {
       key: fs.readFileSync("./localhost-key.pem"),
       cert: fs.readFileSync("./localhost.pem"),
     },
  },
  preview: {
    host: "127.0.0.1",
    port: 8081,
    strictPort: false,
    allowedHosts: extraIps,
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      exceljs: exceljsBrowser,
    },
  },
  optimizeDeps: {
    include: ["exceljs"],
    needsInterop: ["exceljs"],
  },
  ssr: {
    external: ["exceljs"],
  },
  plugins: [
    httpsEnforcePlugin(),
    basicSsl(),
    pgliteBootstrapPlugin(),
    // Before tanstackStart so /auth/popup never falls through to the SPA.
    authPopupPlugin(),
    // Dev-only /__app-env, read by scripts/check-auth-invariant.mjs.
    appEnvPlugin(),
    // PWA head + ?install=1 tutorial page; runs before Start/Nitro.
    grokPwaPlugin(),
    tailwindcss(),
    tanstackStart(),
    ...(command === "build" || isPreview
      ? [
          nitro({
            preset: "vercel",
            // Auto-registers server/middleware/* (the PWA install page +
            // manifest + head-tag middleware). Nitro v3 defaults serverDir to
            // false, so removing this silently unwires /?install=1 on deploys.
            serverDir: "./server",
            routeRules: {
              "/**": {
                headers: {
                  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
                },
              },
            },
          }),
        ]
      : []),
    viteReact(),
  ],
}));
