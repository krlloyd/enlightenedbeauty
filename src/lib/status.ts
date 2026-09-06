import type { AppointmentStatus } from "./types";

export function statusMeta(status: AppointmentStatus) {
  switch (status) {
    case "booked":
      return { label: "Accepted", variant: "default" as const, chip: "appt-status-booked" };
    case "confirmed":
      return { label: "Confirmed", variant: "primary" as const, chip: "appt-status-confirmed" };
    case "arrived":
      return { label: "Show", variant: "success" as const, chip: "appt-status-arrived" };
    case "in-service":
      return { label: "In progress", variant: "success" as const, chip: "appt-status-service" };
    case "completed":
      return { label: "Complete", variant: "outline" as const, chip: "appt-status-done" };
    case "cancelled":
      return { label: "Cancelled", variant: "outline" as const, chip: "appt-status-cancelled" };
    case "no-show":
      return { label: "No-show", variant: "danger" as const, chip: "appt-status-noshow" };
  }
}

export const STATUS_LEGEND: AppointmentStatus[] = ["booked", "confirmed", "arrived", "in-service", "completed", "no-show"];
