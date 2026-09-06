import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { can as roleCan, type StudioPermission } from "./roles";
import { getMyStudioAccess, type StudioMember } from "./studio-members";
import { StudioDeskSync } from "./use-salon-sync";

type StudioAccessValue = {
  member: StudioMember | null;
  isPending: boolean;
  can: (perm: StudioPermission) => boolean;
  reload: () => void;
};

const StudioAccessContext = createContext<StudioAccessValue | null>(null);

export function StudioAccessProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<StudioMember | null>(null);
  const [isPending, setPending] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setPending(true);
    getMyStudioAccess()
      .then((res) => {
        if (alive) setMember(res.member);
      })
      .catch(() => {
        if (alive) setMember(null);
      })
      .finally(() => {
        if (alive) setPending(false);
      });
    return () => {
      alive = false;
    };
  }, [tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  const can = useCallback((perm: StudioPermission) => roleCan(member?.role, perm), [member]);
  const value = useMemo(
    () => ({ member, isPending, can, reload }),
    [member, isPending, can, reload],
  );

  return (
    <StudioAccessContext.Provider value={value}>
      <StudioDeskSync enabled={!isPending && Boolean(member)} />
      {children}
    </StudioAccessContext.Provider>
  );
}

export function useStudioAccess() {
  const ctx = useContext(StudioAccessContext);
  if (!ctx) throw new Error("Studio access is only available in the studio.");
  return ctx;
}
