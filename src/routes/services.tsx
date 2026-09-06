import { Link, createFileRoute } from "@tanstack/react-router";
import { PublicShell } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/catalog";
import { durationLabel, money } from "@/lib/format";
import { useSalon } from "@/lib/store";

export const Route = createFileRoute("/services")({ component: ServicesPage });

function ServicesPage() {
  const services = useSalon((s) => s.services);
  const staff = useSalon((s) => s.staff);
  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Menu</p>
        <h1 className="mt-1 font-serif text-4xl font-medium">What we do</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Prices are starting points. Color and extensions are quoted after we see the hair in the chair.
        </p>
        <div className="mt-10 space-y-14">
          {CATEGORIES.map((cat) => {
            const items = services.filter((s) => s.category === cat.id);
            if (items.length === 0) return null;
            return (
              <section key={cat.id} className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
                <div>
                  <img src={cat.image} alt="" className="framed aspect-[4/3] w-full rounded-2xl object-cover" />
                  <h2 className="mt-4 font-serif text-3xl">{cat.label}</h2>
                </div>
                <ul className="divide-y divide-border rounded-2xl bg-card px-5 shadow-[var(--shadow-border)]">
                  {items.map((s) => (
                    <li key={s.id} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-start sm:justify-between">
                      <div className="max-w-md">
                        <p className="font-medium">{s.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {durationLabel(s.durationMin)} · {staff.filter((x) => s.staffIds.includes(x.id)).map((x) => x.name.split(" ")[0]).join(", ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                        <p className="font-serif text-2xl">{money(s.price)}</p>
                        <Button asChild size="sm">
                          <Link to="/book" search={{ service: s.id }}>
                            Book
                          </Link>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </PublicShell>
  );
}
