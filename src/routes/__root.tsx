import { HeadContent, Outlet, Scripts, createRootRoute, useRouterState } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { HydrateGate } from "@/components/hydrate";
import { SessionKeepAlive } from "@/components/session-keep-alive";
import { AuthProvider } from "@/lib/auth/provider";
import { isLoopbackHost } from "@/lib/https";
import appCss from "../styles.css?url";

const APP_NAME = "Enlightened Beauty";
const PUBLIC_HOST = String(import.meta.env.VITE_PUBLIC_HOSTNAME ?? "").trim();

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "description", content: "Enlightened Beauty — book hair, color, skin, and nails in Marinette." },
      { name: "theme-color", content: "#0A0908" },
      { name: "referrer", content: "strict-origin-when-cross-origin" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600&family=Figtree:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap",
      },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: Root,
});

function HttpsCanonical() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.searchStr });
  const host = PUBLIC_HOST && !isLoopbackHost(PUBLIC_HOST) ? PUBLIC_HOST : "";
  if (!host) return null;
  return <link rel="canonical" href={`https://${host}${pathname}${search}`} />;
}

function Root() {
  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-dvh bg-background text-foreground">
        <HttpsCanonical />
        <PreviewHostBridge />
        <AuthProvider>
          <SessionKeepAlive />
          <HydrateGate>
            <Outlet />
          </HydrateGate>
        </AuthProvider>
        <Toaster position="bottom-right" richColors closeButton />
        <Scripts />
      </body>
    </html>
  );
}
