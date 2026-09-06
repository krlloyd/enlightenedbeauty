import { Link, useNavigate } from "@tanstack/react-router";
import { format, isSameDay, startOfDay } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { openSlots, teamForService, upcomingDays } from "@/lib/availability";
import { affirmEligible } from "@/lib/affirm";
import { CATEGORIES, DEPOSIT_RATE } from "@/lib/catalog";
import { durationLabel, formatPhone, money } from "@/lib/format";
import { depositFor, needsDeposit, useSalon } from "@/lib/store";
import { beginAffirmCheckout, beginStripeCheckout } from "@/lib/pending-pay";
import { AffirmMark } from "./affirm-mark";
import { AffirmPromo } from "./affirm-promo";
import { AffirmTag } from "./affirm-tag";
import { StripeMark } from "./stripe-mark";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Input, NativeSelect, Textarea } from "./ui/input";
import { Field } from "./ui/label";

export function BookingFlow({
  initialService,
  initialStaff,
}: {
  initialService?: string;
  initialStaff?: string;
}) {
  const navigate = useNavigate();
  const appointments = useSalon((s) => s.appointments);
  const visitor = useSalon((s) => s.visitor);
  const book = useSalon((s) => s.book);
  const depositMin = useSalon((s) => s.depositMin);
  const affirmEnabled = useSalon((s) => s.affirmEnabled);
  const affirmMin = useSalon((s) => s.affirmMin);
  const services = useSalon((s) => s.services);
  const staff = useSalon((s) => s.staff);
  const weekHours = useSalon((s) => s.hours);

  const [serviceId, setServiceId] = useState(initialService && services.some((s) => s.id === initialService) ? initialService : "");
  const [staffId, setStaffId] = useState<"any" | string>(
    initialStaff && staff.some((s) => s.id === initialStaff) ? initialStaff : "any",
  );
  const [day, setDay] = useState(() => upcomingDays(1)[0] ?? startOfDay(new Date()));
  const [slotIso, setSlotIso] = useState<string>("");
  const [assignedStaff, setAssignedStaff] = useState<string>("");
  const [name, setName] = useState(visitor?.name ?? "");
  const [phone, setPhone] = useState(visitor?.phone ?? "");
  const [email, setEmail] = useState(visitor?.email ?? "");
  const [notes, setNotes] = useState("");
  const [weekStart, setWeekStart] = useState(0);

  const [paying, setPaying] = useState(false);

  const service = services.find((s) => s.id === serviceId);
  const takeDeposit = service ? needsDeposit(service.price, depositMin) : false;
  const depositDue = service ? depositFor(service.id) : 0;
  const offerAffirm = takeDeposit && affirmEligible(depositDue, affirmEnabled, affirmMin);
  const specialists = service ? teamForService(staff, service) : staff;
  const days = upcomingDays(16, new Date(), weekHours);
  const visibleDays = days.slice(weekStart, weekStart + 7);

  const slots = useMemo(() => {
    if (!service) return [];
    return openSlots(appointments, day, service, staff, staffId, weekHours);
  }, [appointments, day, service, staff, staffId, weekHours]);

  const groupedSlots = useMemo(() => {
    const map = new Map<string, { iso: string; staffId: string }[]>();
    for (const s of slots) {
      const key = format(s.start, "h:mm a");
      const arr = map.get(key) ?? [];
      arr.push({ iso: s.start.toISOString(), staffId: s.staffId });
      map.set(key, arr);
    }
    return [...map.entries()];
  }, [slots]);

  function chooseSlot(iso: string, sid: string) {
    setSlotIso(iso);
    setAssignedStaff(staffId === "any" ? sid : staffId);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!service || !slotIso) {
      toast.error("Pick a service and a time.");
      return;
    }
    const who = assignedStaff || (staffId === "any" ? "" : staffId);
    if (!who) {
      toast.error("Pick a time so we can assign a chair.");
      return;
    }
    if (!name.trim() || phone.replace(/\D/g, "").length < 10) {
      toast.error("Name and a 10-digit mobile are required.");
      return;
    }
    const payload = {
      serviceId: service.id,
      staffId: who,
      start: slotIso,
      name: name.trim(),
      phone: formatPhone(phone),
      email: email.trim(),
      notes: notes.trim(),
    };
    if (!takeDeposit) {
      const booked = book({ ...payload, depositPaid: false });
      if (!booked.ok) {
        toast.error(booked.error);
        return;
      }
      toast.success("You're on the books. Pay in the chair.");
      void navigate({ to: "/visits" });
      return;
    }
    await payDeposit("stripe", payload);
  }

  async function payDeposit(provider: "stripe" | "affirm", payload: Parameters<typeof book>[0]) {
    if (!service) return;
    const deposit = depositDue;
    setPaying(true);
    try {
      if (provider === "affirm") {
        const result = beginAffirmCheckout({
          kind: "deposit",
          amount: deposit,
          description: `Deposit · ${service.name}`,
          cancelPath: "/book",
          book: { ...payload, depositPaid: true },
        });
        await navigate({ to: "/pay/affirm", search: { pid: result.pid } });
        return;
      }
      const result = await beginStripeCheckout({
        kind: "deposit",
        amount: deposit,
        description: `Deposit · ${service.name}`,
        cancelPath: "/book",
        book: { ...payload, depositPaid: true },
      });
      if (result.mode === "demo") {
        await navigate({ to: "/pay", search: { pid: result.pid } });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout could not start.");
      setPaying(false);
    }
  }

  const specialist = staff.find((s) => s.id === (assignedStaff || (staffId === "any" ? "" : staffId)));

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="rounded-2xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-6">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">The menu</p>
        <h1 className="mt-1 font-serif text-3xl font-medium">Reserve a chair</h1>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">
          {depositMin == null
            ? "Pick a service, then a time. No deposit — you pay in the chair."
            : depositMin === 0
              ? `Pick a service, then a time. A deposit of ${Math.round(DEPOSIT_RATE * 100)}% holds the slot; the rest is due in the chair.`
              : `Pick a service, then a time. Services ${money(depositMin)} and up take a ${Math.round(DEPOSIT_RATE * 100)}% deposit; everything else is paid in the chair.`}
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <span key={c.id} className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
              {c.label}
            </span>
          ))}
        </div>

        <ul className="mt-4 divide-y divide-border">
          {services.map((s) => {
            const on = s.id === serviceId;
            const due = needsDeposit(s.price, depositMin) ? Math.round(s.price * DEPOSIT_RATE) : 0;
            const qualifies = due > 0 && affirmEligible(due, affirmEnabled, affirmMin);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    setServiceId(s.id);
                    setSlotIso("");
                    setAssignedStaff("");
                    if (staffId !== "any" && !s.staffIds.includes(staffId)) setStaffId("any");
                  }}
                  className={cn(
                    "flex w-full items-start justify-between gap-4 py-4 text-left transition-colors duration-150",
                    on ? "text-foreground" : "text-foreground/90",
                  )}
                >
                  <span>
                    <span className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          on ? "bg-primary" : "bg-border",
                        )}
                      />
                      <span className="font-medium">{s.name}</span>
                      {qualifies ? <AffirmTag /> : null}
                    </span>
                    <span className="mt-1 block pl-4 text-sm text-muted-foreground">
                      {durationLabel(s.durationMin)} · {teamForService(staff, s).map((x) => x.name.split(" ")[0]).join(", ")}
                      {due ? ` · deposit ${money(due)}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 font-serif text-xl">{money(s.price)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <aside className="lg:sticky lg:top-24 h-fit rounded-2xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-6">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <h2 className="font-serif text-2xl font-medium">Your visit</h2>

          <Field label="Specialist">
            <NativeSelect
              value={staffId}
              onChange={(e) => {
                setStaffId(e.target.value);
                setSlotIso("");
                setAssignedStaff("");
              }}
              disabled={!service}
            >
              <option value="any">First available</option>
              {specialists.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.role}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Date</p>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={weekStart === 0}
                  onClick={() => setWeekStart((n) => Math.max(0, n - 7))}
                  aria-label="Earlier days"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={weekStart + 7 >= days.length}
                  onClick={() => setWeekStart((n) => n + 7)}
                  aria-label="Later days"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {visibleDays.map((d) => {
                const on = isSameDay(d, day);
                return (
                  <button
                    key={d.toISOString()}
                    type="button"
                    onClick={() => {
                      setDay(d);
                      setSlotIso("");
                    }}
                    className={cn(
                      "flex min-h-16 min-w-12 flex-1 flex-col items-center justify-center rounded-xl px-2 py-2 text-xs transition-colors duration-150",
                      on ? "bg-foreground text-background" : "bg-secondary text-foreground hover:bg-accent",
                    )}
                  >
                    <span className="uppercase tracking-wider opacity-70">{format(d, "EEE")}</span>
                    <span className="font-serif text-lg leading-none">{format(d, "d")}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Available times
            </p>
            {!service ? (
              <p className="text-sm text-muted-foreground">Choose a service on the left.</p>
            ) : groupedSlots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open chairs this day. Try another date or specialist.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {groupedSlots.map(([label, opts]) => {
                  const on = opts.some((o) => o.iso === slotIso);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => chooseSlot(opts[0].iso, opts[0].staffId)}
                      className={cn(
                        "min-h-10 rounded-xl px-3 text-sm shadow-[var(--shadow-border)] transition-colors duration-150",
                        on ? "bg-foreground text-background" : "bg-card hover:bg-accent",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <Field label="Your name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jordan Hale" autoComplete="name" />
          </Field>
          <Field label="Mobile">
            <Input
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="(715) 555-0142"
              inputMode="tel"
              autoComplete="tel"
            />
          </Field>
          <Field label="Email">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@mail.test"
              type="email"
              autoComplete="email"
            />
          </Field>
          <Field label="Notes for the chair">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Allergies, references, parking…" />
          </Field>

          {service && slotIso ? (
            <div className="rounded-xl bg-secondary/70 px-4 py-3 text-sm">
              <p className="font-medium">{service.name}</p>
              <p className="text-muted-foreground">
                {format(new Date(slotIso), "EEE, MMM d · h:mm a")}
                {specialist ? ` · ${specialist.name}` : ""}
              </p>
              <p className="mt-1">
                {takeDeposit
                  ? `${money(service.price)} · deposit ${money(depositDue)} due now`
                  : `${money(service.price)} due in the chair`}
              </p>
              {offerAffirm ? <div className="mt-2"><AffirmPromo amount={depositDue} /></div> : null}
            </div>
          ) : null}

          <Button type="submit" variant="ink" className="w-full" disabled={paying}>
            {takeDeposit && service
              ? paying
                ? "Opening checkout…"
                : `Pay ${money(depositDue)} deposit with Stripe`
              : "Confirm booking"}
          </Button>
          {offerAffirm ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={paying}
              onClick={() => {
                if (!service || !slotIso) {
                  toast.error("Pick a service and a time.");
                  return;
                }
                const who = assignedStaff || (staffId === "any" ? "" : staffId);
                if (!who || !name.trim() || phone.replace(/\D/g, "").length < 10) {
                  toast.error("Name and a 10-digit mobile are required.");
                  return;
                }
                void payDeposit("affirm", {
                  serviceId: service.id,
                  staffId: who,
                  start: slotIso,
                  name: name.trim(),
                  phone: formatPhone(phone),
                  email: email.trim(),
                  notes: notes.trim(),
                });
              }}
            >
              <AffirmMark className="h-4 w-auto" />
              Pay over time
            </Button>
          ) : null}
          {takeDeposit ? (
            <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <StripeMark className="h-3.5 w-auto" />
              Secure card checkout · rest due in the chair
            </p>
          ) : (
            <p className="text-center text-xs text-muted-foreground">No card taken now. Pay when you sit.</p>
          )}
          <p className="text-center text-xs text-muted-foreground">
            Already booked?{" "}
            <Link to="/visits" className="underline underline-offset-2">
              See your visits
            </Link>
          </p>
        </form>
      </aside>
    </div>
  );
}
