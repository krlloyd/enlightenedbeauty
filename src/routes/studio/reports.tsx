import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/studio/reports")({
  component: ReportsLayout,
});

const TABS = [
  { to: "/studio/reports", label: "Overview", exact: true },
  { to: "/studio/reports/hours", label: "Hours by specialist", exact: false },
] as const;

function ReportsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Pulse</p>
      <h1 className="font-serif text-3xl font-medium">Reports</h1>
      <nav className="mt-5 flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const active = tab.exact
            ? pathname === tab.to || pathname === `${tab.to}/`
            : pathname === tab.to || pathname.startsWith(`${tab.to}/`);
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                "rounded-full px-3.5 py-2 text-sm transition-colors duration-150",
                active ? "bg-foreground text-background" : "bg-card text-muted-foreground shadow-[var(--shadow-border)] hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  );
}
