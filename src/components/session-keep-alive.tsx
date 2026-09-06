import { useEffect } from "react";
import { authClient, authEnabled } from "@/lib/auth/client";
import { isStudioLocked, subscribeStudioLock } from "@/lib/studio-lock";

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

    const run = () => {
      if (isStudioLocked()) return;
      if (document.visibilityState === "visible") void refreshSession();
    };

    if (!isStudioLocked()) void refreshSession();
    const tick = window.setInterval(run, REFRESH_EVERY_MS);
    document.addEventListener("visibilitychange", run);
    window.addEventListener("focus", run);
    const unsub = subscribeStudioLock(run);

    return () => {
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", run);
      window.removeEventListener("focus", run);
      unsub();
    };
  }, []);

  return null;
}
