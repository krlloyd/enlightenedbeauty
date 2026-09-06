import {
  addDays,
  addMinutes,
  areIntervalsOverlapping,
  isBefore,
  isSameDay,
  setHours,
  setMinutes,
  startOfDay,
} from "date-fns";
import { WEEK_HOURS } from "./catalog";
import type { Appointment, Service, Staff, WeekHours } from "./types";

export const SLOT_MIN = 15;
export const CAL_START_HOUR = 8;
export const CAL_END_HOUR = 20;
export const PX_PER_MIN = 1.15;

export function isOpenOn(date: Date, week: WeekHours = WEEK_HOURS) {
  return week[date.getDay()] != null;
}

export function salonHoursOn(date: Date, week: WeekHours = WEEK_HOURS): [number, number] | null {
  return week[date.getDay()] ?? null;
}

export function nextOpenDay(from = new Date(), week: WeekHours = WEEK_HOURS) {
  let d = startOfDay(from);
  for (let i = 0; i < 14; i++) {
    if (isOpenOn(d, week) && (i > 0 || stillOpen(d, from, week))) return d;
    d = addDays(d, 1);
  }
  return d;
}

function stillOpen(day: Date, now: Date, week: WeekHours) {
  if (!isSameDay(day, now)) return true;
  const hours = salonHoursOn(day, week);
  if (!hours) return false;
  return now.getHours() < hours[1] - 1;
}

function apptInterval(a: Appointment) {
  const start = new Date(a.start);
  return { start, end: addMinutes(start, a.durationMin) };
}

export function isBlocked(a: Appointment) {
  return a.status !== "cancelled" && a.status !== "no-show";
}

export function staffBusy(
  appointments: Appointment[],
  staffId: string,
  start: Date,
  durationMin: number,
  ignoreId?: string,
) {
  const end = addMinutes(start, durationMin);
  return appointments.some((a) => {
    if (a.staffId !== staffId) return false;
    if (a.id === ignoreId) return false;
    if (!isBlocked(a)) return false;
    const iv = apptInterval(a);
    return areIntervalsOverlapping({ start, end }, iv, { inclusive: false });
  });
}

export function slotTimes(date: Date, staff: Staff, durationMin: number, week: WeekHours = WEEK_HOURS) {
  const hours = salonHoursOn(date, week);
  if (!hours) return [];
  const open = Math.max(hours[0], staff.startHour);
  const close = Math.min(hours[1], staff.endHour);
  const start = setMinutes(setHours(startOfDay(date), open), 0);
  const last = addMinutes(setMinutes(setHours(startOfDay(date), close), 0), -durationMin);
  const out: Date[] = [];
  let t = start;
  while (!isBefore(last, t)) {
    out.push(t);
    t = addMinutes(t, SLOT_MIN);
  }
  return out;
}

export type OpenSlot = { start: Date; staffId: string };

export function teamForService(staff: Staff[], service: Service) {
  return staff.filter((s) => service.staffIds.includes(s.id));
}

export function openSlots(
  appointments: Appointment[],
  date: Date,
  service: Service,
  team: Staff[],
  staffId: string | "any",
  week: WeekHours = WEEK_HOURS,
): OpenSlot[] {
  if (!isOpenOn(date, week)) return [];
  const pool = teamForService(team, service);
  const selected = staffId === "any" ? pool : pool.filter((s) => s.id === staffId);
  const seen = new Set<string>();
  const slots: OpenSlot[] = [];
  for (const st of selected) {
    for (const start of slotTimes(date, st, service.durationMin, week)) {
      if (staffBusy(appointments, st.id, start, service.durationMin)) continue;
      const key = start.toISOString();
      if (staffId === "any" && seen.has(key)) continue;
      seen.add(key);
      slots.push({ start, staffId: st.id });
    }
  }
  slots.sort((a, b) => a.start.getTime() - b.start.getTime());
  return slots;
}

export function upcomingDays(count = 14, from = new Date(), week: WeekHours = WEEK_HOURS) {
  const days: Date[] = [];
  let d = startOfDay(from);
  for (let i = 0; i < 28 && days.length < count; i++) {
    if (isOpenOn(d, week)) days.push(d);
    d = addDays(d, 1);
  }
  return days;
}

export const ACTIVE_STATUSES: Appointment["status"][] = ["booked", "confirmed", "arrived", "in-service"];

export function minutesFromCalStart(date: Date) {
  return date.getHours() * 60 + date.getMinutes() - CAL_START_HOUR * 60;
}

export function calHeight() {
  return (CAL_END_HOUR - CAL_START_HOUR) * 60 * PX_PER_MIN;
}
