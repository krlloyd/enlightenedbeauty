import { useEffect, useRef } from "react";
import { getPublicSalon, getSalonDesk, runScheduledBackup, saveSalonDesk } from "./salon-ops";
import { pickSalonPayload } from "./salon-payload";
import { useSalon } from "./store";

let skipSave = false;
let lastSaved = "";

function markSaved(payload: string) {
  lastSaved = payload;
}

export function StudioDeskSync({ enabled }: { enabled: boolean }) {
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;

    void (async () => {
      try {
        const desk = await getSalonDesk();
        if (!alive) return;
        skipSave = true;
        useSalon.getState().applyDesk({ production: desk.production, payload: desk.payload });
        const snap = useSalon.getState().snapshot();
        if (snap) markSaved(JSON.stringify(snap));
        skipSave = false;
        if (!desk.payload) {
          const local = useSalon.getState().snapshot();
          if (local) {
            await saveSalonDesk({ data: { payload: local } });
            markSaved(JSON.stringify(local));
          }
        }
        const after = useSalon.getState().snapshot();
        if (after) await runScheduledBackup({ data: { payload: after } });
      } catch {
        skipSave = false;
      }
    })();

    const unsub = useSalon.subscribe(() => {
      if (skipSave) return;
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        const payload = pickSalonPayload(useSalon.getState());
        if (!payload) return;
        const key = JSON.stringify(payload);
        if (key === lastSaved) return;
        markSaved(key);
        void saveSalonDesk({ data: { payload } }).catch(() => {
          lastSaved = "";
        });
      }, 900);
    });

    return () => {
      alive = false;
      unsub();
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [enabled]);

  return null;
}

export function PublicSalonSync() {
  useEffect(() => {
    let alive = true;
    const path = typeof window !== "undefined" ? window.location.pathname : "";
    if (path.startsWith("/studio")) return;
    void getPublicSalon()
      .then((ops) => {
        if (!alive) return;
        skipSave = true;
        useSalon.getState().applyPublic(ops);
        skipSave = false;
      })
      .catch(() => {
        skipSave = false;
      });
    return () => {
      alive = false;
    };
  }, []);
  return null;
}
