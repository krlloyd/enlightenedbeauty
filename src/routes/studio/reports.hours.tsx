import { createFileRoute } from "@tanstack/react-router";
import {
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hoursBooked } from "@/lib/format";
import { useSalon } from "@/lib/store";
import type { Appointment, Staff } from "@/lib/types";

export const Route = createFileRoute("/studio/reports/hours")({ component: HoursReportPage });

const STAFF_FILL: Record<string, string> = {
  elena: "#c6a25a",
  marcus: "#1c1814",
  amara: "#c45b6a",
  sofie: "#3d7a55",
  jules: "#7d4a8c",
};
const FALLBACK_FILL = ["#c46a4a", "#5c5348", "#8a7350", "#b0893d"];

type RangeKey = "day" | "week" | "month" | "year" | "custom";

const RANGE_LABEL: Record<RangeKey, string> = {
  day: "Today",
  week: "This week",
  month: "This month",
  year: "This year",
  custom: "Custom",
};

function staffFill(id: string, index: number) {
  return STAFF_FILL[id] ?? FALLBACK_FILL[index % FALLBACK_FILL.length];
}

function rangeBounds(key: RangeKey, from: string, to: string) {
  const now = new Date();
  if (key === "day") return { start: startOfDay(now), end: endOfDay(now) };
  if (key === "week") return { start: startOfWeek(now, { weekStartsOn: 0 }), end: endOfWeek(now, { weekStartsOn: 0 }) };
  if (key === "month") return { start: startOfMonth(now), end: endOfMonth(now) };
  if (key === "year") return { start: startOfYear(now), end: endOfYear(now) };
  const start = from ? startOfDay(parseISO(from)) : startOfMonth(now);
  const end = to ? endOfDay(parseISO(to)) : endOfDay(now);
  return start.getTime() <= end.getTime() ? { start, end } : { start: end, end: start };
}

function bookedInRange(appointments: Appointment[], start: Date, end: Date) {
  return appointments.filter((a) => {
    if (a.status === "cancelled") return false;
    return isWithinInterval(new Date(a.start), { start, end });
  });
}

function specialistHours(staff: Staff[], visits: Appointment[]) {
  return staff
    .map((st, i) => {
      const mine = visits.filter((a) => a.staffId === st.id);
      const minutes = mine.reduce((n, a) => n + a.durationMin, 0);
      return {
        id: st.id,
        name: st.name,
        short: st.name.split(" ")[0] ?? st.name,
        fill: staffFill(st.id, i),
        visits: mine.length,
        minutes,
        hours: Math.round((minutes / 60) * 10) / 10,
      };
    })
    .sort((a, b) => b.minutes - a.minutes);
}

function HoursReportPage() {
  const appointments = useSalon((s) => s.appointments);
  const staff = useSalon((s) => s.staff);

  const [range, setRange] = useState<RangeKey>("week");
  const [from, setFrom] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(() => format(new Date(), "yyyy-MM-dd"));

  const bounds = useMemo(() => rangeBounds(range, from, to), [range, from, to]);
  const visits = useMemo(() => bookedInRange(appointments, bounds.start, bounds.end), [appointments, bounds]);
  const hoursRows = useMemo(() => specialistHours(staff, visits), [staff, visits]);
  const floorMinutes = hoursRows.reduce((n, r) => n + r.minutes, 0);

  const series = useMemo(() => {
    const days = eachDayOfInterval(bounds);
    if (range === "year" || days.length > 45) {
      return eachMonthOfInterval(bounds).map((month) => {
        const start = startOfMonth(month);
        const end = endOfMonth(month);
        const row: Record<string, string | number> = { label: format(month, "MMM") };
        for (const st of staff) {
          row[st.id] =
            Math.round(
              (visits
                .filter((a) => a.staffId === st.id && isWithinInterval(new Date(a.start), { start, end }))
                .reduce((n, a) => n + a.durationMin, 0) /
                60) *
                10,
            ) / 10;
        }
        return row;
      });
    }
    return days.map((d) => {
      const start = startOfDay(d);
      const end = endOfDay(d);
      const row: Record<string, string | number> = { label: format(d, days.length > 10 ? "d" : "EEE d") };
      for (const st of staff) {
        row[st.id] =
          Math.round(
            (visits
              .filter((a) => a.staffId === st.id && isWithinInterval(new Date(a.start), { start, end }))
              .reduce((n, a) => n + a.durationMin, 0) /
              60) *
              10,
          ) / 10;
      }
      return row;
    });
  }, [bounds, range, staff, visits]);

  const rangeTitle =
    range === "custom"
      ? `${format(bounds.start, "MMM d")} – ${format(bounds.end, "MMM d, yyyy")}`
      : RANGE_LABEL[range];

  return (
    <section className="rounded-2xl bg-card p-5 shadow-[var(--shadow-border)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Booked hours</p>
          <h2 className="font-serif text-2xl">Hours by specialist</h2>
          <p className="mt-1 text-sm text-muted-foreground">{rangeTitle} · cancelled visits left off</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["day", "week", "month", "year", "custom"] as const).map((key) => (
            <Button key={key} size="sm" variant={range === key ? "ink" : "outline"} onClick={() => setRange(key)}>
              {RANGE_LABEL[key]}
            </Button>
          ))}
        </div>
      </div>
      {range === "custom" ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
          <span className="text-sm text-muted-foreground">to</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-secondary/60 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Floor hours</p>
          <p className="mt-1 font-serif text-3xl tabular-nums">{hoursBooked(floorMinutes)}</p>
        </div>
        <div className="rounded-xl bg-secondary/60 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Visits</p>
          <p className="mt-1 font-serif text-3xl tabular-nums">{visits.length}</p>
        </div>
        <div className="rounded-xl bg-secondary/60 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Busiest chair</p>
          <p className="mt-1 font-serif text-3xl">{hoursRows[0] && hoursRows[0].minutes > 0 ? hoursRows[0].short : "—"}</p>
        </div>
      </div>

      <div className="mt-6 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={hoursRows} layout="vertical" margin={{ left: 8, right: 12 }}>
            <CartesianGrid stroke="#e0d4c6" horizontal={false} />
            <XAxis type="number" tick={{ fill: "#74685f", fontSize: 12 }} axisLine={false} tickLine={false} unit=" hr" />
            <YAxis type="category" dataKey="short" tick={{ fill: "#74685f", fontSize: 12 }} axisLine={false} tickLine={false} width={72} />
            <Tooltip
              formatter={(v) => [`${Number(v ?? 0)} hr`, "Booked"]}
              contentStyle={{ background: "#fbf7f2", border: "1px solid #e0d4c6", borderRadius: 12 }}
            />
            <Bar dataKey="hours" radius={[0, 6, 6, 0]}>
              {hoursRows.map((row) => (
                <Cell key={row.id} fill={row.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {series.length > 1 ? (
        <div className="mt-6">
          <h3 className="font-serif text-xl">{range === "year" ? "By month" : "By day"}</h3>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series}>
                <CartesianGrid stroke="#e0d4c6" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#74685f", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#74685f", fontSize: 12 }} axisLine={false} tickLine={false} unit=" hr" />
                <Tooltip
                  formatter={(v, name) => [
                    `${Number(v ?? 0)} hr`,
                    staff.find((s) => s.id === name)?.name.split(" ")[0] ?? String(name ?? ""),
                  ]}
                  contentStyle={{ background: "#fbf7f2", border: "1px solid #e0d4c6", borderRadius: 12 }}
                />
                {staff.map((st, i) => (
                  <Bar key={st.id} dataKey={st.id} stackId="hours" fill={staffFill(st.id, i)} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <th className="py-3 pr-4 font-medium">Specialist</th>
              <th className="py-3 pr-4 font-medium">Visits</th>
              <th className="py-3 pr-4 font-medium">Hours booked</th>
              <th className="py-3 font-medium">Share</th>
            </tr>
          </thead>
          <tbody>
            {hoursRows.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0">
                <td className="py-3 pr-4">
                  <span className="inline-flex items-center gap-2 font-medium">
                    <span className="size-2.5 rounded-full" style={{ background: row.fill }} />
                    {row.name}
                  </span>
                </td>
                <td className="py-3 pr-4 tabular-nums">{row.visits}</td>
                <td className="py-3 pr-4 tabular-nums">{hoursBooked(row.minutes)}</td>
                <td className="py-3 tabular-nums">
                  {floorMinutes ? `${Math.round((row.minutes / floorMinutes) * 100)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="text-sm font-medium">
              <td className="pt-3 pr-4">Floor</td>
              <td className="pt-3 pr-4 tabular-nums">{visits.length}</td>
              <td className="pt-3 pr-4 tabular-nums">{hoursBooked(floorMinutes)}</td>
              <td className="pt-3">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
