import { useEffect } from "react";
import { authClient, authEnabled } from "@/lib/auth/client";

/** Stay under the 5-minute session cookie cache so expiry is extended in the DB. */
const REFRESH_EVERY_MS = 4 * 60 * 1000;

async function refreshSession() {
  try {
    await authClient.getSession({
      query: { disableCookieCache: true },
    });
  } catch {
    /* signed out or offline — next tick retries */
  }
}

/** Keeps the Better Auth session token alive while the studio tab is open. */
export function SessionKeepAlive() {
  useEffect(() => {
    if (!authEnabled) return;

    void refreshSession();
    const tick = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshSession();
    }, REFRESH_EVERY_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshSession();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  return null;
}
