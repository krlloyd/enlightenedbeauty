import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { PublicShell } from "@/components/site-header";
import { SalonLogo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { CATEGORIES, POLICIES, REVIEWS, SALON, hoursLabels } from "@/lib/catalog";
import { durationLabel, money } from "@/lib/format";
import { useSalon } from "@/lib/store";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const services = useSalon((s) => s.services);
  const staff = useSalon((s) => s.staff);
  const weekHours = useSalon((s) => s.hours);
  const preferred = ["cut", "balayage", "gel-mani", "facial"];
  const featured = preferred.flatMap((id) => {
    const hit = services.find((s) => s.id === id);
    return hit ? [hit] : [];
  });
  const extra = services.filter((s) => !featured.some((f) => f.id === s.id)).slice(0, Math.max(0, 4 - featured.length));
  const shown = [...featured, ...extra];

  return (
    <PublicShell>
      <section className="relative min-h-[calc(100dvh-4.25rem)] overflow-hidden sm:min-h-[78vh]">
        <img
          src="/images/hero.jpg"
          alt="Enlightened Beauty salon interior, empty chairs in morning light"
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-chrome/80 via-chrome/40 to-chrome/10" />
        <div className="relative mx-auto flex min-h-[calc(100dvh-4.25rem)] max-w-6xl flex-col justify-end px-4 py-8 sm:min-h-[78vh] sm:px-6 sm:py-20">
          <SalonLogo
            variant="light"
            className="reveal h-16 max-w-[min(92vw,24rem)] sm:h-24 sm:max-w-[30rem]"
          />
          <p className="reveal reveal-2 mt-5 text-[11px] uppercase tracking-[0.28em] text-primary">Marinette · by appointment</p>
          <h1 className="reveal reveal-3 mt-3 max-w-xl font-serif text-4xl font-medium leading-[1.05] text-chrome-foreground sm:text-6xl">
            The chair is yours.
          </h1>
          <p className="reveal reveal-4 mt-3 max-w-md text-sm text-chrome-foreground/80 sm:mt-4 sm:text-lg">
            Book color, cut, skin, and nails at Enlightened Beauty — a quiet salon on Merryman Street, open around the clock online.
          </p>
          <div className="reveal reveal-5 mt-6 flex flex-wrap gap-3 sm:mt-8">
            <Button asChild size="lg">
              <Link to="/book">
                Book a visit
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-chrome-foreground/35 bg-transparent text-chrome-foreground hover:bg-chrome-foreground/10">
              <Link to="/services">See the menu</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">The work</p>
            <h2 className="mt-1 font-serif text-3xl font-medium sm:text-4xl">A small salon, kept cozy</h2>
          </div>
          <Button asChild variant="ghost">
            <Link to="/services">Full menu</Link>
          </Button>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {CATEGORIES.map((c) => (
            <Link
              key={c.id}
              to="/book"
              search={{ service: services.find((s) => s.category === c.id)?.id }}
              className="group overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-border)]"
            >
              <img src={c.image} alt="" className="framed aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
              <p className="px-4 py-3 font-serif text-xl">{c.label}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-secondary/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Signature work</p>
            <h2 className="mt-1 font-serif text-3xl font-medium sm:text-4xl">Booked most often</h2>
            <p className="mt-3 max-w-sm text-muted-foreground">
              Deposits hold the slot. Reminders go out the night before. You can move or cancel from My visits.
            </p>
            <Button asChild className="mt-6" variant="ink">
              <Link to="/book">Start a booking</Link>
            </Button>
          </div>
          <ul className="divide-y divide-border">
            {shown.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {durationLabel(s.durationMin)} · {s.description.slice(0, 72)}…
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-serif text-2xl">{money(s.price)}</p>
                  <Link to="/book" search={{ service: s.id }} className="text-xs text-primary underline-offset-2 hover:underline">
                    Reserve
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">The floor</p>
            <h2 className="mt-1 font-serif text-3xl font-medium sm:text-4xl">Specialists</h2>
          </div>
          <Button asChild variant="ghost">
            <Link to="/team">All bios</Link>
          </Button>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {staff.map((s) => (
            <Link
              key={s.id}
              to="/book"
              search={{ staff: s.id }}
              className="rounded-2xl bg-card p-5 text-center shadow-[var(--shadow-border)] transition-shadow duration-150 hover:shadow-[var(--shadow-border-hover)]"
            >
              <span className={`mx-auto grid size-16 place-items-center rounded-full font-serif text-xl ${s.chip}`}>
                {s.initials}
              </span>
              <p className="mt-3 font-medium">{s.name}</p>
              <p className="text-sm text-muted-foreground">{s.role}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-foreground text-background">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-3">
          {REVIEWS.map((r) => (
            <blockquote key={r.name} className="rounded-2xl bg-background/5 p-6">
              <p className="font-serif text-xl leading-snug">“{r.quote}”</p>
              <footer className="mt-4 text-sm text-background/70">
                {r.name} · {r.service}
              </footer>
            </blockquote>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Salon rules</p>
          <h2 className="mt-1 font-serif text-3xl font-medium">How we keep the book honest</h2>
          <ul className="mt-6 space-y-5">
            {POLICIES.map((p) => (
              <li key={p.title}>
                <p className="font-medium">{p.title}</p>
                <p className="text-sm text-muted-foreground">{p.body}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-border)]">
          <img src="/images/spa.jpg" alt="Treatment room" className="framed h-48 w-full object-cover" />
          <div className="p-6">
            <p className="font-serif text-2xl">{SALON.address}</p>
            <p className="text-muted-foreground">{SALON.city}</p>
            <dl className="mt-4 space-y-2 text-sm">
              {hoursLabels(weekHours).map((h) => (
                <div key={h.day} className="flex justify-between gap-4">
                  <dt>{h.day}</dt>
                  <dd className="text-muted-foreground">{h.hours}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm">{SALON.phone}</p>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
