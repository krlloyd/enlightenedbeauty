import { addDays, addMinutes, format, isSameDay, setHours, setMinutes, startOfDay } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState, type MouseEvent } from "react";
import {
  CAL_END_HOUR,
  CAL_START_HOUR,
  PX_PER_MIN,
  calHeight,
  isOpenOn,
  minutesFromCalStart,
  nextOpenDay,
  salonHoursOn,
} from "@/lib/availability";
import { durationLabel, money, timeLabel } from "@/lib/format";
import { CATEGORIES } from "@/lib/catalog";
import { STATUS_LEGEND, statusMeta } from "@/lib/status";
import { appointmentsOn, clientById, useSalon } from "@/lib/store";
import type { Appointment } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AppointmentDrawer } from "./appointment-drawer";
import { WalkInDialog } from "./walk-in-dialog";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

export function CalendarBoard() {
  const appointments = useSalon((s) => s.appointments);
  const clients = useSalon((s) => s.clients);
  const staff = useSalon((s) => s.staff);
  const services = useSalon((s) => s.services);
  const weekHours = useSalon((s) => s.hours);
  const [day, setDay] = useState(() => nextOpenDay(new Date()));
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [walkIn, setWalkIn] = useState<{ staffId: string; start: Date } | null>(null);

  const dayAppts = useMemo(
    () => appointmentsOn(day, appointments).filter((a) => a.status !== "cancelled"),
    [appointments, day],
  );
  const height = calHeight();
  const hours = Array.from({ length: CAL_END_HOUR - CAL_START_HOUR }, (_, i) => CAL_START_HOUR + i);
  const now = new Date();
  const showNow = isSameDay(now, day);
  const nowTop = minutesFromCalStart(now) * PX_PER_MIN;
  const closed = !isOpenOn(day, weekHours);
  const openRange = salonHoursOn(day, weekHours);

  function onColumnClick(e: MouseEvent<HTMLDivElement>, staffId: string) {
    if (closed || !openRange) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-appt]")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const mins = Math.round(y / PX_PER_MIN / 15) * 15;
    const start = setMinutes(setHours(startOfDay(day), CAL_START_HOUR), 0);
    const at = addMinutes(start, mins);
    if (at.getHours() < openRange[0] || at.getHours() >= openRange[1]) return;
    setWalkIn({ staffId, start: at });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Book</p>
          <h1 className="font-serif text-3xl font-medium">{format(day, "EEEE, MMMM d")}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="size-10" onClick={() => setDay(addDays(day, -1))} aria-label="Previous day">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setDay(nextOpenDay(new Date(), weekHours))}>
            Today
          </Button>
          <Button variant="outline" size="icon" className="size-10" onClick={() => setDay(addDays(day, 1))} aria-label="Next day">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {closed ? (
        <div className="rounded-2xl bg-card px-5 py-10 text-center shadow-[var(--shadow-border)]">
          <p className="font-serif text-2xl">We're closed</p>
          <p className="mt-1 text-sm text-muted-foreground">{format(day, "EEEE")} is a rest day. Jump to the next open book.</p>
          <Button className="mt-4" onClick={() => setDay(nextOpenDay(addDays(day, 1), weekHours))}>
            Jump to next open day
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl shadow-[var(--shadow-border)]">
          <div className="flex min-w-[720px] bg-border">
            <div className="w-16 shrink-0 bg-background">
              <div className="h-12 border-b border-border bg-secondary/80" />
              <div className="relative" style={{ height }}>
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute right-2 text-[10px] text-muted-foreground"
                    style={{ top: (h - CAL_START_HOUR) * 60 * PX_PER_MIN - 6 }}
                  >
                    {format(setHours(startOfDay(day), h), "h a")}
                  </div>
                ))}
              </div>
            </div>
            {staff.map((st) => {
              const column = dayAppts.filter((a) => a.staffId === st.id);
              return (
                <div key={st.id} className="min-w-[160px] flex-1 bg-card">
                  <div className="flex h-12 items-center gap-2 border-b border-l border-border bg-secondary/80 px-3">
                    <span className={cn("grid size-7 place-items-center rounded-full text-[10px] font-medium", st.chip)}>
                      {st.initials}
                    </span>
                    <span className="truncate text-xs font-medium">{st.name.split(" ")[0]}</span>
                  </div>
                  <div
                    className="relative cursor-crosshair border-l border-border"
                    style={{ height }}
                    onClick={(e) => onColumnClick(e, st.id)}
                  >
                    {hours.map((h) => (
                      <div
                        key={h}
                        className="absolute inset-x-0 border-t border-border/70"
                        style={{ top: (h - CAL_START_HOUR) * 60 * PX_PER_MIN }}
                      />
                    ))}
                    {showNow && nowTop > 0 && nowTop < height ? (
                      <div className="absolute inset-x-0 z-10 border-t border-primary" style={{ top: nowTop }}>
                        <span className="absolute -top-1.5 -left-1 size-2 rounded-full bg-primary" />
                      </div>
                    ) : null}
                    {column.map((a) => {
                      const svc = services.find((s) => s.id === a.serviceId);
                      const client = clientById(clients, a.clientId);
                      const top = minutesFromCalStart(new Date(a.start)) * PX_PER_MIN;
                      const h = Math.max(a.durationMin * PX_PER_MIN - 4, 28);
                      const meta = statusMeta(a.status);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          data-appt
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(a);
                          }}
                          className={cn(
                            "absolute inset-x-1 overflow-hidden rounded-lg border-l-[6px] px-2 py-1 text-left shadow-[var(--shadow-border)]",
                            svc ? `appt-cat-${svc.category}` : "appt-cat-hair",
                            meta.chip,
                            a.status === "completed" && "opacity-80",
                          )}
                          style={{ top, height: h }}
                        >
                          <p className="truncate text-[11px] font-medium leading-tight">{client?.name ?? "Guest"}</p>
                          <p className="truncate text-[10px] opacity-80">{svc?.name}</p>
                          {h > 48 ? (
                            <p className="truncate text-[10px] opacity-70">
                              {timeLabel(a.start)} · {durationLabel(a.durationMin)}
                            </p>
                          ) : null}
                          {h > 64 ? (
                            <Badge variant={meta.variant} className="mt-1">
                              {meta.label}
                            </Badge>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2 text-[11px] text-muted-foreground">
        <ul className="flex flex-wrap gap-x-4 gap-y-2">
          {STATUS_LEGEND.map((status) => {
            const meta = statusMeta(status);
            return (
              <li key={status} className="flex items-center gap-1.5">
                <span className={cn("h-3 w-3.5 rounded-[3px] border-l-[6px] bg-card", meta.chip)} />
                {meta.label}
              </li>
            );
          })}
        </ul>
        <ul className="flex flex-wrap gap-x-4 gap-y-2">
          {CATEGORIES.map((cat) => (
            <li key={cat.id} className="flex items-center gap-1.5">
              <span className={cn("size-3 rounded-[3px]", `appt-cat-${cat.id}`)} />
              {cat.label}
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Click an empty slot to add a walk-in. Click a visit to check in or checkout.</p>

      <AppointmentDrawer appointment={selected} onClose={() => setSelected(null)} />
      <WalkInDialog open={!!walkIn} staffId={walkIn?.staffId} start={walkIn?.start} onClose={() => setWalkIn(null)} />
    </div>
  );
}

export function MiniAppt({ a }: { a: Appointment }) {
  const clients = useSalon((s) => s.clients);
  const services = useSalon((s) => s.services);
  const staff = useSalon((s) => s.staff);
  const client = clientById(clients, a.clientId);
  const svc = services.find((s) => s.id === a.serviceId);
  const st = staff.find((s) => s.id === a.staffId);
  const meta = statusMeta(a.status);
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div>
        <p className="font-medium">{client?.name}</p>
        <p className="text-sm text-muted-foreground">
          {svc?.name} · {st?.name.split(" ")[0]} · {timeLabel(a.start)}
        </p>
      </div>
      <div className="text-right">
        <Badge variant={meta.variant}>{meta.label}</Badge>
        <p className="mt-1 text-sm">{svc ? money(svc.price) : ""}</p>
      </div>
    </div>
  );
}
