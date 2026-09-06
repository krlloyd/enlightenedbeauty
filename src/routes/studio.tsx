import { Outlet, createFileRoute } from "@tanstack/react-router";
import { StudioShell } from "@/components/studio-shell";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/studio")({
  component: StudioLayout,
});

function StudioLayout() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
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
  if (!user) return <RedirectToSignIn />;
  return (
    <StudioShell>
      <Outlet />
    </StudioShell>
  );
}
