import { Navigate, createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { SalonLogo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (isPending) {
    return (
      <main className="grid min-h-dvh place-items-center bg-chrome px-4">
        <div className="h-10 w-48 animate-pulse rounded-full bg-chrome-foreground/10" />
      </main>
    );
  }
  if (user) return <Navigate to="/studio" />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!authEnabled) return;
    setError("");
    setBusy(true);
    try {
      if (mode === "up") {
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
      window.location.assign("/studio");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-chrome px-4 py-10 text-chrome-foreground">
      <div className="w-full max-w-sm">
        <a href="/" className="flex justify-center">
          <SalonLogo variant="light" className="h-12 max-w-[16rem]" />
        </a>
        <h1 className="mt-8 text-center font-serif text-3xl">Studio login</h1>
        <p className="mt-2 text-center text-sm text-chrome-foreground/70">Staff only. Guests book from the public site.</p>

        {!authEnabled ? (
          <p className="mt-6 text-center text-sm text-chrome-foreground/60">Sign-in is disabled.</p>
        ) : (
          <>
            <form onSubmit={(e) => void submit(e)} className="mt-8 space-y-3">
              {mode === "up" ? (
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
                  autoComplete={mode === "up" ? "new-password" : "current-password"}
                  required
                  minLength={8}
                  className="bg-chrome-foreground/10 text-chrome-foreground placeholder:text-chrome-foreground/40"
                />
              </Field>
              {error ? <p className="text-sm text-red-300">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Please wait…" : mode === "up" ? "Create staff account" : "Sign in"}
              </Button>
            </form>
            <button
              type="button"
              className="mt-3 w-full text-center text-sm text-chrome-foreground/70 underline-offset-4 hover:underline"
              onClick={() => {
                setMode(mode === "in" ? "up" : "in");
                setError("");
              }}
            >
              {mode === "in" ? "New desk? Create a staff account" : "Already on the book? Sign in"}
            </button>

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
                  onClick={() => signIn(p.providerId, { callbackURL: "/studio" })}
                >
                  Continue with {p.label}
                </Button>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
