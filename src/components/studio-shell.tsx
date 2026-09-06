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
  Shield,
  SlidersHorizontal,
  Users,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { ROLE_LABEL, type StudioPermission } from "@/lib/roles";
import { useStudioAccess } from "@/lib/studio-access";
import { useSalon } from "@/lib/store";
import { cn } from "@/lib/utils";
import { DeskAccount } from "./desk-account";
import { Badge } from "./ui/badge";
import { SalonLogo } from "./logo";
import { Button } from "./ui/button";

const ITEMS: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  perm: StudioPermission;
  children?: { to: string; label: string }[];
}[] = [
  { to: "/studio", label: "Today", icon: LayoutDashboard, perm: "today" },
  { to: "/studio/calendar", label: "Calendar", icon: CalendarDays, perm: "calendar" },
  { to: "/studio/clients", label: "Clients", icon: Users, perm: "clients" },
  { to: "/studio/menu", label: "Menu", icon: Scissors, perm: "menu" },
  { to: "/studio/pos", label: "Register", icon: Wallet, perm: "pos" },
  { to: "/studio/payments", label: "Payments", icon: CreditCard, perm: "payments" },
  { to: "/studio/inventory", label: "Stock", icon: Package, perm: "inventory" },
  { to: "/studio/hours", label: "Hours", icon: Clock, perm: "hours" },
  {
    to: "/studio/reports",
    label: "Reports",
    icon: Receipt,
    perm: "reports",
    children: [
      { to: "/studio/reports", label: "Overview" },
      { to: "/studio/reports/hours", label: "Hours by specialist" },
    ],
  },
  { to: "/studio/access", label: "Access", icon: Shield, perm: "access" },
  { to: "/studio/settings", label: "Settings", icon: SlidersHorizontal, perm: "access" },
];

export function StudioShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const resetDemo = useSalon((s) => s.resetDemo);
  const production = useSalon((s) => s.production);
  const { member, can } = useStudioAccess();
  const nav = ITEMS.filter((item) => can(item.perm));

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-primary/35 bg-chrome px-3 text-chrome-foreground sm:h-[4.5rem] sm:px-5">
        <Link to="/" className="flex min-w-0 items-center gap-3" aria-label="Enlightened Beauty home">
          <SalonLogo variant="light" className="h-10 max-w-[12.5rem] sm:h-12 sm:max-w-[16rem]" />
          <span className="hidden text-[10px] uppercase tracking-[0.22em] text-primary sm:block">Studio</span>
        </Link>
        <div className="flex items-center gap-2">
          {member ? (
            <Badge variant="primary" className="hidden bg-primary/20 text-primary sm:inline-flex">
              {ROLE_LABEL[member.role]}
            </Badge>
          ) : null}
          <Badge variant={production ? "success" : "warning"} className="hidden sm:inline-flex">
            {production ? "Live" : "Demo"}
          </Badge>
          <div className="min-w-0 text-chrome-foreground">
            <DeskAccount />
          </div>
          <Button asChild variant="ghost" size="sm" className="text-chrome-foreground hover:bg-chrome-foreground/10 hover:text-chrome-foreground">
            <Link to="/">Client site</Link>
          </Button>
          {can("reset") && !production ? (
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
          ) : null}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col lg:flex-row">
        <nav className="flex gap-1 overflow-x-auto border-b border-border/80 p-2 lg:w-52 lg:flex-col lg:overflow-visible lg:border-r lg:border-b-0 lg:p-3">
          {nav.map((item) => {
            const childActive =
              "children" in item && item.children?.some((c) => (c.to === item.to ? pathname === item.to || pathname === `${item.to}/` : pathname === c.to || pathname.startsWith(`${c.to}/`)));
            const active =
              item.to === "/studio"
                ? pathname === "/studio" || pathname === "/studio/"
                : item.children
                  ? Boolean(childActive)
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
                {item.children
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
