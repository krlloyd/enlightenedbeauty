import { Link, useRouterState } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useState, type ReactNode } from "react";
import { SALON, hoursLabels } from "@/lib/catalog";
import { useSalon } from "@/lib/store";
import { useStudioLock } from "@/lib/use-studio-lock";
import { cn } from "@/lib/utils";
import { SalonLogo } from "./logo";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/services", label: "Menu" },
  { to: "/team", label: "Team" },
  { to: "/shop", label: "Shop" },
  { to: "/visits", label: "My visits" },
] as const;

export function SiteHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const locked = useStudioLock();
  const studioTo = locked ? "/login" : "/studio";

  return (
    <header className="sticky top-0 z-40 border-b border-primary/35 bg-chrome text-chrome-foreground">
      <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between gap-3 px-4 sm:h-20 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center" aria-label="Enlightened Beauty home">
          <SalonLogo variant="light" />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "rounded-full px-3.5 py-2 text-sm text-chrome-foreground/70 transition-colors duration-150 hover:text-chrome-foreground",
                pathname === item.to && "bg-chrome-foreground/10 text-chrome-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hidden text-chrome-foreground hover:bg-chrome-foreground/10 hover:text-chrome-foreground sm:inline-flex"
          >
            <Link to={studioTo}>Studio</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/book">Book</Link>
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="size-10 border-chrome-foreground/25 bg-transparent text-chrome-foreground hover:bg-chrome-foreground/10 lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" title={SALON.name}>
              <div className="mt-6 flex flex-col gap-1">
                {NAV.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-3 py-3 text-base hover:bg-accent"
                  >
                    {item.label}
                  </Link>
                ))}
                <Link to="/book" onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 text-base hover:bg-accent">
                  Book a visit
                </Link>
                <Link to={studioTo} onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 text-base hover:bg-accent">
                  Studio desk
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const weekHours = useSalon((s) => s.hours);
  const labels = hoursLabels(weekHours);
  return (
    <footer className="border-t border-primary/35 bg-chrome text-chrome-foreground">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <SalonLogo variant="light" className="h-14 max-w-[18rem] sm:h-16" />
          <p className="mt-3 max-w-xs text-sm text-chrome-foreground/70">{SALON.tagline}</p>
        </div>
        <div className="text-sm">
          <p className="text-[11px] uppercase tracking-[0.2em] text-primary">Visit</p>
          <p className="mt-2">{SALON.address}</p>
          <p>{SALON.city}</p>
          <p className="mt-2">{SALON.phone}</p>
          <p>{SALON.email}</p>
        </div>
        <div className="text-sm">
          <p className="text-[11px] uppercase tracking-[0.2em] text-primary">Desk</p>
          <div className="mt-2 space-y-1 text-chrome-foreground/80">
            {labels.map((h) => (
              <p key={h.day}>
                {h.day} · {h.hours}
              </p>
            ))}
          </div>
          <p className="mt-3 text-chrome-foreground/60">Cancel free up to 12 hours before.</p>
        </div>
      </div>
    </footer>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
