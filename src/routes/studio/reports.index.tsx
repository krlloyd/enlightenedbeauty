import { createFileRoute } from "@tanstack/react-router";
import { addDays, format, startOfDay } from "date-fns";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { categoryLabel } from "@/lib/catalog";
import { money } from "@/lib/format";
import { useSalon } from "@/lib/store";

export const Route = createFileRoute("/studio/reports/")({ component: ReportsOverview });

const SLICE = ["#c6a25a", "#0a0908", "#8a7350", "#d4c4a0", "#5c5348", "#b0893d"];

function ReportsOverview() {
  const sales = useSalon((s) => s.sales);
  const appointments = useSalon((s) => s.appointments);
  const services = useSalon((s) => s.services);

  const days = Array.from({ length: 7 }, (_, i) => addDays(startOfDay(new Date()), i - 6));
  const revenue = days.map((d) => {
    const total = sales
      .filter((s) => format(new Date(s.at), "yyyy-MM-dd") === format(d, "yyyy-MM-dd"))
      .reduce((n, s) => n + s.total, 0);
    return { day: format(d, "EEE"), total: Math.round(total * 100) / 100 };
  });

  const mixMap = new Map<string, number>();
  for (const a of appointments.filter((x) => x.status === "completed")) {
    const svc = services.find((s) => s.id === a.serviceId);
    if (!svc) continue;
    mixMap.set(svc.category, (mixMap.get(svc.category) ?? 0) + svc.price);
  }
  const mix = [...mixMap.entries()].map(([k, v]) => ({ name: categoryLabel(k), value: v }));

  const weekTotal = revenue.reduce((n, r) => n + r.total, 0);
  const tips = sales.reduce((n, s) => n + s.tip, 0);

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-border)]">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">7-day take</p>
          <p className="mt-1 font-serif text-3xl tabular-nums">{money(weekTotal)}</p>
        </div>
        <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-border)]">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Tips on file</p>
          <p className="mt-1 font-serif text-3xl tabular-nums">{money(tips)}</p>
        </div>
        <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-border)]">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Tickets</p>
          <p className="mt-1 font-serif text-3xl tabular-nums">{sales.length}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-serif text-2xl">Revenue</h2>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenue}>
                <CartesianGrid stroke="#e0d4c6" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: "#74685f", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#74685f", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => money(v)}
                  contentStyle={{ background: "#fbf7f2", border: "1px solid #e0d4c6", borderRadius: 12 }}
                />
                <Bar dataKey="total" fill="#c6a25a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="rounded-2xl bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-serif text-2xl">Completed mix</h2>
          <div className="mt-4 h-56">
            {mix.length === 0 ? (
              <p className="grid h-full place-items-center text-sm text-muted-foreground">Complete a few visits to see mix.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={mix} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={3}>
                    {mix.map((_, i) => (
                      <Cell key={mix[i].name} fill={SLICE[i % SLICE.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => money(v)}
                    contentStyle={{ background: "#fbf7f2", border: "1px solid #e0d4c6", borderRadius: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
