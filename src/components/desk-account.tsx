import { useState } from "react";
import { signOut } from "@/lib/auth/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { lockStudioSession } from "@/lib/studio-lock";

/** Ends the Better Auth session and keeps the desk closed until they sign in again. */
export function DeskAccount() {
  const user = useCurrentUser();
  const [signingOut, setSigningOut] = useState(false);
  if (!user) return null;
  const label = user.displayName ?? user.primaryEmail ?? "Account";
  return (
    <div className="flex min-w-0 items-center gap-2">
      {user.profileImageUrl ? (
        <img src={user.profileImageUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
      ) : (
        <span className="grid h-8 w-8 place-items-center rounded-full bg-chrome-foreground/15 text-sm font-medium">
          {label.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="max-w-[7rem] truncate text-sm font-medium">{label}</span>
      <button
        type="button"
        disabled={signingOut}
        onClick={() => {
          lockStudioSession();
          setSigningOut(true);
          void signOut("/login").catch(() => setSigningOut(false));
        }}
        className="cursor-pointer text-sm underline-offset-4 opacity-70 hover:underline disabled:cursor-wait disabled:no-underline"
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
