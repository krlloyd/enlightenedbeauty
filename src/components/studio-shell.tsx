import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  Clock,
  CreditCard,
  LayoutDashboard,
  Package,
  Receipt,
  RotateCcw,
  Scissors,
  Users,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { UserButton } from "@/lib/auth/gates";
import { useSalon } from "@/lib/store";
import { cn } from "@/lib/utils";
import { SalonLogo } from "./logo";
import { Button } from "./ui/button";

const ITEMS = [
  { to: "/studio", label: "Today", icon: LayoutDashboard },
  { to: "/studio/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/studio/clients", label: "Clients", icon: Users },
  { to: "/studio/menu", label: "Menu", icon: Scissors },
  { to: "/studio/pos", label: "Register", icon: Wallet },
  { to: "/studio/payments", label: "Payments", icon: CreditCard },
  { to: "/studio/inventory", label: "Stock", icon: Package },
  { to: "/studio/hours", label: "Hours", icon: Clock },
  {
    to: "/studio/reports",
    label: "Reports",
    icon: Receipt,
    children: [
      { to: "/studio/reports", label: "Overview" },
      { to: "/studio/reports/hours", label: "Hours by specialist" },
    ],
  },
] as const;

export function StudioShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const resetDemo = useSalon((s) => s.resetDemo);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-primary/35 bg-chrome px-3 text-chrome-foreground sm:h-[4.5rem] sm:px-5">
        <Link to="/" className="flex min-w-0 items-center gap-3" aria-label="Enlightened Beauty home">
          <SalonLogo variant="light" className="h-10 max-w-[12.5rem] sm:h-12 sm:max-w-[16rem]" />
          <span className="hidden text-[10px] uppercase tracking-[0.22em] text-primary sm:block">Studio</span>
        </Link>
        <div className="flex items-center gap-2">
          <div className="min-w-0 text-chrome-foreground [&_button]:text-chrome-foreground/80 [&_span]:max-w-[7rem] [&_span]:truncate [&_span]:text-chrome-foreground">
            <UserButton />
          </div>
          <Button asChild variant="ghost" size="sm" className="text-chrome-foreground hover:bg-chrome-foreground/10 hover:text-chrome-foreground">
            <Link to="/">Client site</Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-chrome-foreground/25 bg-transparent text-chrome-foreground hover:bg-chrome-foreground/10"
            onClick={() => {
              resetDemo();
              toast.success("Demo day restored");
            }}
          >
            <RotateCcw className="size-3.5" />
            Reset
          </Button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col lg:flex-row">
        <nav className="flex gap-1 overflow-x-auto border-b border-border/80 p-2 lg:w-52 lg:flex-col lg:overflow-visible lg:border-r lg:border-b-0 lg:p-3">
          {ITEMS.map((item) => {
            const childActive =
              "children" in item && item.children.some((c) => (c.to === item.to ? pathname === item.to || pathname === `${item.to}/` : pathname === c.to || pathname.startsWith(`${c.to}/`)));
            const active =
              item.to === "/studio"
                ? pathname === "/studio" || pathname === "/studio/"
                : "children" in item
                  ? childActive
                  : pathname === item.to;
            const Icon = item.icon;
            return (
              <div key={item.to} className="contents lg:block">
                <Link
                  to={item.to}
                  className={cn(
                    "flex min-h-11 shrink-0 items-center gap-2.5 rounded-xl px-3 text-sm text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground",
                    active && "bg-accent text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
                {"children" in item
                  ? item.children.map((child) => {
                      const on = child.to === item.to ? pathname === child.to || pathname === `${child.to}/` : pathname === child.to;
                      return (
                        <Link
                          key={child.to}
                          to={child.to}
                          className={cn(
                            "hidden min-h-9 items-center rounded-xl px-3 pl-9 text-sm text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground lg:flex",
                            on && "bg-accent text-foreground",
                          )}
                        >
                          {child.label}
                        </Link>
                      );
                    })
                  : null}
              </div>
            );
          })}
        </nav>
        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
