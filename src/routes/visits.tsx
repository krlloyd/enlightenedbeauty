import { Link, createFileRoute } from "@tanstack/react-router";
import { isAfter } from "date-fns";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PublicShell } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { durationLabel, formatPhone, money, whenLabel } from "@/lib/format";
import { statusMeta } from "@/lib/status";
import { clientById, endOfAppt, useSalon } from "@/lib/store";

export const Route = createFileRoute("/visits")({ component: VisitsPage });

function VisitsPage() {
  const appointments = useSalon((s) => s.appointments);
  const clients = useSalon((s) => s.clients);
  const visitor = useSalon((s) => s.visitor);
  const setVisitor = useSalon((s) => s.setVisitor);
  const cancel = useSalon((s) => s.cancel);
  const services = useSalon((s) => s.services);
  const staffList = useSalon((s) => s.staff);

  const [phone, setPhone] = useState(visitor?.phone ?? "");
  const [name, setName] = useState(visitor?.name ?? "");

  const digits = (visitor?.phone ?? phone).replace(/\D/g, "");
  const mine = useMemo(() => {
    if (digits.length < 10) return [];
    const matches = clients.filter((c) => c.phone.replace(/\D/g, "") === digits).map((c) => c.id);
    return appointments
      .filter((a) => matches.includes(a.clientId))
      .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
  }, [appointments, clients, digits]);

  const upcoming = mine.filter((a) => a.status !== "cancelled" && a.status !== "completed" && isAfter(endOfAppt(a), new Date()));
  const past = mine.filter((a) => !upcoming.includes(a));

  function lookup(e: FormEvent) {
    e.preventDefault();
    if (phone.replace(/\D/g, "").length < 10) {
      toast.error("Enter the mobile used to book.");
      return;
    }
    setVisitor({ name: name || "Guest", phone: formatPhone(phone), email: visitor?.email ?? "" });
    toast.success("Visits loaded");
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Your book</p>
        <h1 className="mt-1 font-serif text-4xl font-medium">My visits</h1>
        <p className="mt-3 text-muted-foreground">Look up with the mobile number on the booking. Cancel free up to 12 hours prior.</p>

        <form onSubmit={lookup} className="mt-6 grid gap-3 rounded-2xl bg-card p-4 shadow-[var(--shadow-border)] sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jordan Hale" />
          </Field>
          <Field label="Mobile">
            <Input value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="(715) 555-0142" />
          </Field>
          <Button type="submit" variant="ink" className="sm:mb-0">
            Find visits
          </Button>
        </form>

        {digits.length < 10 ? (
          <p className="mt-8 text-sm text-muted-foreground">
            Try a demo number from the book:{" "}
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => {
                setPhone("(715) 555-0142");
                setName("Jordan Hale");
                setVisitor({ name: "Jordan Hale", phone: "(715) 555-0142", email: "jordan.hale@mail.test" });
              }}
            >
              (715) 555-0142
            </button>
          </p>
        ) : mine.length === 0 ? (
          <div className="mt-10 rounded-2xl bg-card px-6 py-12 text-center shadow-[var(--shadow-border)]">
            <p className="font-serif text-2xl">No visits on this number</p>
            <Button asChild className="mt-4">
              <Link to="/book">Book one</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-10 space-y-8">
            <section>
              <h2 className="font-serif text-2xl">Upcoming</h2>
              {upcoming.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Nothing ahead. The chairs are open.</p>
              ) : (
                <ul className="mt-3 divide-y divide-border rounded-2xl bg-card px-5 shadow-[var(--shadow-border)]">
                  {upcoming.map((a) => {
                    const svc = services.find((s) => s.id === a.serviceId);
                    const staff = staffList.find((s) => s.id === a.staffId);
                    const meta = statusMeta(a.status);
                    return (
                      <li key={a.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-medium">{svc?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {whenLabel(a.start)} · {staff?.name} · {durationLabel(a.durationMin)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              cancel(a.id);
                              toast("Visit cancelled");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            <section>
              <h2 className="font-serif text-2xl">History</h2>
              <ul className="mt-3 divide-y divide-border">
                {past.map((a) => {
                  const svc = services.find((s) => s.id === a.serviceId);
                  const staff = staffList.find((s) => s.id === a.staffId);
                  const meta = statusMeta(a.status);
                  const client = clientById(clients, a.clientId);
                  return (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                      <div>
                        <p className="text-sm font-medium">{svc?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {whenLabel(a.start)} · {staff?.name.split(" ")[0]}
                          {client ? ` · ${client.loyaltyPoints} pts` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                        <p className="mt-1 text-sm">{svc ? money(svc.price) : ""}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        )}
      </div>
    </PublicShell>
  );
}
