import { useEffect, type ReactNode } from "react";
import { useSalon } from "@/lib/store";

export function HydrateGate({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (useSalon.persist.hasHydrated()) {
      useSalon.getState().hydrate();
      return;
    }
    const unsub = useSalon.persist.onFinishHydration(() => {
      useSalon.getState().hydrate();
    });
    void useSalon.persist.rehydrate();
    return unsub;
  }, []);

  return children;
}
