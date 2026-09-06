import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { SalonLogo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { unlockStudioSession } from "@/lib/studio-lock";
import { deskIsClaimed, getMyStudioAccess } from "@/lib/studio-members";
import { resetSiteData } from "@/lib/site-reset";
import { clearBrowserSiteData } from "@/lib/site-reset-client";
import { useClientReady, useStudioLock } from "@/lib/use-studio-lock";

export const Route = createFileRoute("/login")({
  loader: () => deskIsClaimed(),
  staleTime: 0,
  gcTime: 0,
  component: LoginPage,
});

function LoginPage() {
  const initial = Route.useLoaderData();
  const { user, isPending } = useCurrentUserState();
  const locked = useStudioLock();
  const ready = useClientReady();
  const navigate = useNavigate();
  const [claimed, setClaimed] = useState(initial.claimed);
  const [mode, setMode] = useState<"in" | "up">(initial.claimed ? "in" : "up");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    let alive = true;
    void deskIsClaimed()
      .then((res) => {
        if (!alive) return;
        setClaimed(res.claimed);
        if (!res.claimed) setMode("up");
      })
      .catch(() => {
        if (alive) setClaimed(initial.claimed);
      });
    return () => {
      alive = false;
    };
  }, [initial.claimed]);

  if (isPending || !ready) {
    return (
      <main className="grid min-h-dvh place-items-center bg-chrome px-4">
        <div className="h-10 w-48 animate-pulse rounded-full bg-chrome-foreground/10" />
      </main>
    );
  }

  const activeUser = locked ? null : user;
  const firstTime = !claimed;
  const signingUp = firstTime && mode === "up";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!authEnabled) return;
    setError("");
    setBusy(true);
    try {
      if (signingUp) {
        const res = await authClient.signUp.email({
          name: name.trim() || "Staff",
          email: email.trim(),
          password,
          callbackURL: "/studio",
        });
        if (res.error) throw new Error(res.error.message || "Could not create the account.");
      } else {
        const res = await authClient.signIn.email({
          email: email.trim(),
          password,
          callbackURL: "/studio",
        });
        if (res.error) throw new Error(res.error.message || "Email or password did not match.");
      }
      unlockStudioSession();
      try {
        await getMyStudioAccess();
      } catch {
        /* first login writes the owner row */
      }
      window.location.assign("/studio");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      setBusy(false);
    }
  }

  async function startOver() {
    setBusy(true);
    setError("");
    try {
      await resetSiteData();
      clearBrowserSiteData();
      window.location.assign("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset the desk.");
      setBusy(false);
    }
  }

  function openDesk() {
    unlockStudioSession();
    void navigate({ to: "/studio" });
  }

  const who = activeUser?.displayName ?? activeUser?.primaryEmail ?? "this account";
  const first = who.split(" ")[0] || "this account";

  return (
    <main className="grid min-h-dvh place-items-center bg-chrome px-4 py-10 text-chrome-foreground">
      <div className="w-full max-w-sm">
        <a href="/" className="flex justify-center">
          <SalonLogo variant="light" className="h-12 max-w-[16rem]" />
        </a>
        <h1 className="mt-8 text-center font-serif text-3xl">Studio login</h1>
        <p className="mt-2 text-center text-sm text-chrome-foreground/70">
          {firstTime
            ? "First sign-in becomes the owner. After that, only email and password."
            : "Staff only. The owner adds logins under Access."}
        </p>

        {!authEnabled ? (
          <p className="mt-6 text-center text-sm text-chrome-foreground/60">Sign-in is disabled.</p>
        ) : (
          <>
            {activeUser && !firstTime ? (
              <div className="mt-8 rounded-2xl bg-chrome-foreground/8 p-4 text-center">
                <p className="text-sm text-chrome-foreground/70">Already signed in.</p>
                <p className="mt-1 font-medium">{who}</p>
                <Button type="button" className="mt-4 w-full" onClick={openDesk}>
                  Open desk as {first}
                </Button>
              </div>
            ) : null}

            <form onSubmit={(e) => void submit(e)} className="mt-8 space-y-3">
              {activeUser && !firstTime ? (
                <p className="text-center text-xs text-chrome-foreground/55">Or sign in as someone else</p>
              ) : null}
              {signingUp ? (
                <Field label="Name">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    className="bg-chrome-foreground/10 text-chrome-foreground placeholder:text-chrome-foreground/40"
                  />
                </Field>
              ) : null}
              <Field label="Email">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="bg-chrome-foreground/10 text-chrome-foreground placeholder:text-chrome-foreground/40"
                />
              </Field>
              <Field label="Password">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={signingUp ? "new-password" : "current-password"}
                  required
                  minLength={8}
                  className="bg-chrome-foreground/10 text-chrome-foreground placeholder:text-chrome-foreground/40"
                />
              </Field>
              {error ? <p className="text-sm text-red-300">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={busy} variant={activeUser ? "outline" : "default"}>
                {busy ? "Please wait…" : signingUp ? "Create account" : "Sign in"}
              </Button>
            </form>
            {firstTime ? (
              <button
                type="button"
                className="mt-3 w-full text-center text-sm text-chrome-foreground/70 underline-offset-4 hover:underline"
                onClick={() => {
                  setMode(mode === "in" ? "up" : "in");
                  setError("");
                }}
              >
                {mode === "in" ? "Need an account? Create one" : "Already on the book? Sign in"}
              </button>
            ) : null}

            {firstTime ? (
              <>
                <div className="mt-8 flex items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-chrome-foreground/40">
                  <span className="h-px flex-1 bg-chrome-foreground/15" />
                  or
                  <span className="h-px flex-1 bg-chrome-foreground/15" />
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  {GROK_PROVIDERS.map((p) => (
                    <Button
                      key={p.providerId}
                      type="button"
                      variant="outline"
                      className="w-full border-chrome-foreground/25 bg-transparent text-chrome-foreground hover:bg-chrome-foreground/10"
                      onClick={() => {
                        void signIn(p.providerId, { callbackURL: "/studio?unlock=1" });
                      }}
                    >
                      Continue with {p.label}
                    </Button>
                  ))}
                </div>
              </>
            ) : null}

            <button
              type="button"
              className="mt-8 w-full text-center text-xs text-chrome-foreground/45 underline-offset-4 hover:text-chrome-foreground/70 hover:underline"
              disabled={busy}
              onClick={() => setConfirmReset(true)}
            >
              Start over — clear logins and sample data
            </button>
          </>
        )}
      </div>
      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent title="Start over?">
          <p className="mt-3 text-sm text-muted-foreground">
            This clears every staff login, the book, and live mode. First sign-in becomes the owner again.
          </p>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmReset(false)}>
              Keep logins
            </Button>
            <Button type="button" disabled={busy} onClick={() => void startOver()}>
              {busy ? "Clearing…" : "Clear everything"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
