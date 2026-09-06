import { Link, createFileRoute } from "@tanstack/react-router";
import { isSameDay, startOfDay } from "date-fns";
import { AppointmentDrawer } from "@/components/appointment-drawer";
import { MiniAppt } from "@/components/calendar-board";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { nextOpenDay } from "@/lib/availability";
import { money } from "@/lib/format";
import { appointmentsOn, useSalon } from "@/lib/store";
import type { Appointment } from "@/lib/types";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/studio/")({ component: StudioHome });

function StudioHome() {
  const appointments = useSalon((s) => s.appointments);
  const sales = useSalon((s) => s.sales);
  const products = useSalon((s) => s.products);
  const clients = useSalon((s) => s.clients);
  const staff = useSalon((s) => s.staff);
  const weekHours = useSalon((s) => s.hours);
  const [selected, setSelected] = useState<Appointment | null>(null);

  const day = useMemo(() => {
    const now = new Date();
    return appointmentsOn(now, appointments).length ? startOfDay(now) : nextOpenDay(now, weekHours);
  }, [appointments, weekHours]);

  const today = appointmentsOn(day, appointments);
  const active = today.filter((a) => !["cancelled", "no-show"].includes(a.status));
  const completed = today.filter((a) => a.status === "completed");
  const inChair = today.filter((a) => a.status === "in-service" || a.status === "arrived");
  const todaySales = sales.filter((s) => isSameDay(new Date(s.at), day));
  const revenue = todaySales.reduce((n, s) => n + s.total, 0);
  const low = products.filter((p) => p.category !== "Gift" && p.stock <= 5);

  const occupancy = Math.min(
    100,
    Math.round((active.reduce((n, a) => n + a.durationMin, 0) / (Math.max(staff.length, 1) * 8 * 60)) * 100),
  );

  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Front desk</p>
      <h1 className="font-serif text-3xl font-medium">Today at the salon</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {active.length} on the book · {clients.length} clients in the file
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="On the book" value={String(active.length)} hint={`${completed.length} already through`} />
        <Stat label="In chair" value={String(inChair.length)} hint="Checked in or mid-service" />
        <Stat label="Taken today" value={money(revenue)} hint={`${todaySales.length} tickets`} />
        <Stat label="Floor fill" value={`${occupancy}%`} hint="Booked minutes vs open chairs" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
        <section className="rounded-2xl bg-card px-5 shadow-[var(--shadow-border)]">
          <div className="flex items-center justify-between py-4">
            <h2 className="font-serif text-2xl">The book</h2>
            <Button asChild size="sm" variant="outline">
              <Link to="/studio/calendar">Open calendar</Link>
            </Button>
          </div>
          {active.length === 0 ? (
            <p className="pb-6 text-sm text-muted-foreground">No visits this day. Click the calendar to add a walk-in.</p>
          ) : (
            <ul className="divide-y divide-border pb-2">
              {active
                .slice()
                .sort((a, b) => +new Date(a.start) - +new Date(b.start))
                .map((a) => (
                  <li key={a.id}>
                    <button type="button" className="w-full text-left" onClick={() => setSelected(a)}>
                      <MiniAppt a={a} />
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl bg-card p-5 shadow-[var(--shadow-border)]">
            <h2 className="font-serif text-2xl">Low stock</h2>
            {low.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Shelves are fine.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {low.map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-sm">
                    <span>{p.name}</span>
                    <Badge variant={p.stock === 0 ? "danger" : "warning"}>{p.stock} left</Badge>
                  </li>
                ))}
              </ul>
            )}
            <Button asChild size="sm" variant="ghost" className="mt-3 px-0">
              <Link to="/studio/inventory">Inventory</Link>
            </Button>
          </section>
          <section className="rounded-2xl bg-card p-5 shadow-[var(--shadow-border)]">
            <h2 className="font-serif text-2xl">Quick desk</h2>
            <div className="mt-3 flex flex-col gap-2">
              <Button asChild variant="ink">
                <Link to="/studio/pos">Open register</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/studio/menu">Edit menu</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/studio/hours">Hours</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/studio/clients">Client file</Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Demo seed includes Jordan Hale at (715) 555-0142 and a gift card code EB-KATE.
            </p>
          </section>
        </div>
      </div>
      <AppointmentDrawer appointment={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-border)]">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-3xl tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
