import { Link, createFileRoute } from "@tanstack/react-router";
import { PublicShell } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/catalog";
import { useSalon } from "@/lib/store";

export const Route = createFileRoute("/team")({ component: TeamPage });

function TeamPage() {
  const staff = useSalon((s) => s.staff);
  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">The floor</p>
        <h1 className="mt-1 font-serif text-4xl font-medium">Specialists</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Book a specific chair or take first available. Everyone on the floor takes their own book.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {staff.map((s) => (
            <article key={s.id} className="flex flex-col rounded-2xl bg-card p-6 shadow-[var(--shadow-border)] sm:flex-row sm:gap-6">
              <span className={`grid size-20 shrink-0 place-items-center rounded-full font-serif text-2xl ${s.chip}`}>
                {s.initials}
              </span>
              <div className="mt-4 sm:mt-0">
                <h2 className="font-serif text-2xl">{s.name}</h2>
                <p className="text-sm text-muted-foreground">{s.role}</p>
                <p className="mt-3 text-sm leading-relaxed">{s.bio}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  {s.specialties.map((id) => CATEGORIES.find((c) => c.id === id)?.label).join(" · ")}
                </p>
                <Button asChild size="sm" className="mt-4">
                  <Link to="/book" search={{ staff: s.id }}>
                    Book with {s.name.split(" ")[0]}
                  </Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </PublicShell>
  );
}
