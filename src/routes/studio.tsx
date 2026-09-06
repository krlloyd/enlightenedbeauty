import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { DeskAccount } from "@/components/desk-account";
import { StudioLocked } from "@/components/studio-locked";
import { StudioShell } from "@/components/studio-shell";
import { Button } from "@/components/ui/button";
import { SalonLogo } from "@/components/logo";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { ROLE_LABEL, permissionForPath } from "@/lib/roles";
import { StudioAccessProvider, useStudioAccess } from "@/lib/studio-access";
import { unlockStudioSession } from "@/lib/studio-lock";
import { useClientReady, useStudioLock } from "@/lib/use-studio-lock";

export const Route = createFileRoute("/studio")({
  component: StudioLayout,
});

function StudioLayout() {
  const { user, isPending } = useCurrentUserState();
  const locked = useStudioLock();
  const ready = useClientReady();
  const unlockFlag = useRouterState({
    select: (s) => s.location.searchStr.includes("unlock=1"),
  });

  useEffect(() => {
    if (unlockFlag) unlockStudioSession();
  }, [unlockFlag]);

  if (isPending || !ready) return <StudioSkeleton />;
  if ((locked && !unlockFlag) || !user) return <RedirectToSignIn />;
  return (
    <StudioAccessProvider>
      <StudioGate />
    </StudioAccessProvider>
  );
}

function StudioGate() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { member, isPending, can } = useStudioAccess();
  if (isPending) return <StudioSkeleton />;
  if (!member) return <NoDeskAccess />;
  if (!can(permissionForPath(pathname))) {
    return (
      <StudioShell>
        <StudioLocked
          title="That's not in your role"
          detail={`Your ${ROLE_LABEL[member.role].toLowerCase()} login doesn't include this page. Ask the owner if you need it.`}
        />
      </StudioShell>
    );
  }
  return (
    <StudioShell>
      <Outlet />
    </StudioShell>
  );
}

function StudioSkeleton() {
  return (
    <div className="min-h-dvh bg-chrome">
      <div className="h-16 border-b border-primary/35 sm:h-[4.5rem]" />
      <div className="mx-auto max-w-[1400px] p-6">
        <div className="h-8 w-48 animate-pulse rounded-full bg-background/40" />
        <div className="mt-6 h-40 animate-pulse rounded-2xl bg-background/40" />
      </div>
    </div>
  );
}

function NoDeskAccess() {
  return (
    <div className="flex min-h-dvh flex-col bg-chrome text-chrome-foreground">
      <header className="flex h-16 items-center justify-between gap-3 px-4 sm:h-[4.5rem] sm:px-6">
        <Link to="/" aria-label="Enlightened Beauty home">
          <SalonLogo variant="light" className="h-10 max-w-[12.5rem] sm:h-12 sm:max-w-[16rem]" />
        </Link>
        <div className="text-chrome-foreground">
          <DeskAccount />
        </div>
      </header>
      <main className="grid flex-1 place-items-center px-4 py-16">
        <div className="w-full max-w-md text-center">
          <p className="text-[11px] uppercase tracking-[0.18em] text-primary">Studio</p>
          <h1 className="mt-3 font-serif text-3xl">This login isn't on the desk</h1>
          <p className="mt-3 text-sm text-chrome-foreground/70">
            Guests book from the public site. Staff need the owner to add their email under Access before the desk will open.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link to="/">Public site</Link>
            </Button>
            <Button asChild variant="outline" className="border-chrome-foreground/25 bg-transparent text-chrome-foreground hover:bg-chrome-foreground/10">
              <Link to="/book">Book a visit</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
