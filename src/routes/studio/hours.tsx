import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { cloneHours, DAY_NAMES, formatClock, formatRange } from "@/lib/catalog";
import { useSalon } from "@/lib/store";
import type { WeekHours } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/studio/hours")({ component: HoursPage });

const CLOCK = Array.from({ length: 13 }, (_, i) => i + 8);

function HoursPage() {
  const hours = useSalon((s) => s.hours);
  const setHours = useSalon((s) => s.setHours);
  const [draft, setDraft] = useState<WeekHours>(() => cloneHours(hours));

  useEffect(() => {
    setDraft(cloneHours(hours));
  }, [hours]);

  function setDay(index: number, next: [number, number] | null) {
    setDraft((curr) => curr.map((h, i) => (i === index ? next : h)));
  }

  function save() {
    const result = setHours(draft);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Hours updated");
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Desk</p>
          <h1 className="font-serif text-3xl font-medium">Hours</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Closed days skip the book. Open hours bound every chair and the public booking calendar.
          </p>
        </div>
        <Button variant="ink" onClick={save}>
          Save hours
        </Button>
      </div>

      <ul className="mt-6 divide-y divide-border overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-border)]">
        {DAY_NAMES.map((name, i) => {
          const range = draft[i] ?? null;
          const open = range != null;
          return (
            <li key={name} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDay(i, open ? null : [9, 17])}
                  className={cn(
                    "min-h-10 rounded-full px-3.5 text-sm shadow-[var(--shadow-border)]",
                    open ? "bg-foreground text-background" : "bg-secondary text-muted-foreground",
                  )}
                >
                  {open ? "Open" : "Closed"}
                </button>
                <p className="font-medium">{name}</p>
              </div>
              {open && range ? (
                <div className="flex items-center gap-2">
                  <NativeSelect
                    className="w-32"
                    value={range[0]}
                    onChange={(e) => setDay(i, [Number(e.target.value), range[1]])}
                  >
                    {CLOCK.map((h) => (
                      <option key={h} value={h}>
                        {formatClock(h)}
                      </option>
                    ))}
                  </NativeSelect>
                  <span className="text-sm text-muted-foreground">to</span>
                  <NativeSelect
                    className="w-32"
                    value={range[1]}
                    onChange={(e) => setDay(i, [range[0], Number(e.target.value)])}
                  >
                    {CLOCK.map((h) => (
                      <option key={h} value={h}>
                        {formatClock(h)}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{formatRange(null)}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
