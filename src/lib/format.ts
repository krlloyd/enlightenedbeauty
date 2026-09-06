import { format, parseISO } from "date-fns";

export function money(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  });
}

export function hoursBooked(min: number) {
  const h = Math.round((min / 60) * 10) / 10;
  return `${h.toLocaleString("en-US", { maximumFractionDigits: 1 })} hr`;
}

export function durationLabel(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

export function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export function whenLabel(iso: string) {
  return format(parseISO(iso), "EEE, MMM d · h:mm a");
}

export function timeLabel(iso: string) {
  return format(parseISO(iso), "h:mm a");
}

export function dateLabel(iso: string) {
  return format(parseISO(iso), "EEE, MMM d");
}
