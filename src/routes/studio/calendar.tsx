import { createFileRoute } from "@tanstack/react-router";
import { CalendarBoard } from "@/components/calendar-board";

export const Route = createFileRoute("/studio/calendar")({
  component: CalendarPage,
});

function CalendarPage() {
  return <CalendarBoard />;
}
