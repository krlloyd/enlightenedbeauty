import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { CATEGORIES, STAFF_CHIPS, categoryLabel, chipForStaff } from "@/lib/catalog";
import { durationLabel, money } from "@/lib/format";
import { useSalon } from "@/lib/store";
import type { Service, ServiceCategory, Staff } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/studio/menu")({ component: MenuPage });

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8);
const DURATIONS = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240];

function hourLabel(h: number) {
  const am = h < 12;
  const n = h % 12 || 12;
  return `${n}:00 ${am ? "am" : "pm"}`;
}

function MenuPage() {
  const [tab, setTab] = useState<"staff" | "services">("staff");
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Floor</p>
          <h1 className="font-serif text-3xl font-medium">Menu</h1>
        </div>
        <div className="flex gap-2 rounded-full bg-secondary p-1">
          <Button size="sm" variant={tab === "staff" ? "ink" : "ghost"} onClick={() => setTab("staff")}>
            Specialists
          </Button>
          <Button size="sm" variant={tab === "services" ? "ink" : "ghost"} onClick={() => setTab("services")}>
            Services
          </Button>
        </div>
      </div>
      {tab === "staff" ? <StaffPanel /> : <ServicesPanel />}
    </div>
  );
}

function StaffPanel() {
  const staff = useSalon((s) => s.staff);
  const services = useSalon((s) => s.services);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);

  function startNew() {
    setEditing(null);
    setOpen(true);
  }

  return (
    <>
      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{staff.length} on the floor</p>
        <Button onClick={startNew}>Add specialist</Button>
      </div>
      <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-border)]">
        {staff.map((st) => {
          const offered = services.filter((s) => s.staffIds.includes(st.id));
          return (
            <li key={st.id}>
              <button
                type="button"
                onClick={() => {
                  setEditing(st);
                  setOpen(true);
                }}
                className="flex w-full flex-col gap-2 px-5 py-4 text-left sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className={cn("grid size-11 place-items-center rounded-full font-serif text-sm", st.chip)}>
                    {st.initials}
                  </span>
                  <div>
                    <p className="font-medium">{st.name}</p>
                    <p className="text-sm text-muted-foreground">{st.role}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    {hourLabel(st.startHour)}–{hourLabel(st.endHour)}
                  </span>
                  <Badge>{offered.length} services</Badge>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      <StaffDialog open={open} staff={editing} onClose={() => setOpen(false)} />
    </>
  );
}

function ServicesPanel() {
  const services = useSalon((s) => s.services);
  const staff = useSalon((s) => s.staff);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);

  const grouped = useMemo(
    () =>
      CATEGORIES.map((cat) => ({
        cat,
        items: services.filter((s) => s.category === cat.id),
      })).filter((g) => g.items.length > 0),
    [services],
  );

  return (
    <>
      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{services.length} on the menu</p>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>Add service</Button>
      </div>
      <div className="mt-4 space-y-6">
        {grouped.map(({ cat, items }) => (
          <section key={cat.id}>
            <h2 className="mb-2 font-serif text-2xl">{cat.label}</h2>
            <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-border)]">
              {items.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(s);
                      setOpen(true);
                    }}
                    className="flex w-full flex-col gap-1 px-5 py-4 text-left sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {durationLabel(s.durationMin)} ·{" "}
                        {staff
                          .filter((st) => s.staffIds.includes(st.id))
                          .map((st) => st.name.split(" ")[0])
                          .join(", ") || "Unassigned"}
                      </p>
                    </div>
                    <p className="font-serif text-2xl">{money(s.price)}</p>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <ServiceDialog open={open} service={editing} onClose={() => setOpen(false)} />
    </>
  );
}

function ToggleChip({
  on,
  children,
  onClick,
}: {
  on: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-10 rounded-full px-3.5 text-sm shadow-[var(--shadow-border)] transition-colors duration-150",
        on ? "bg-foreground text-background" : "bg-card hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

function StaffDialog({
  open,
  staff,
  onClose,
}: {
  open: boolean;
  staff: Staff | null;
  onClose: () => void;
}) {
  const services = useSalon((s) => s.services);
  const upsert = useSalon((s) => s.upsertStaff);
  const remove = useSalon((s) => s.removeStaff);
  const [form, setForm] = useState({
    name: "",
    role: "",
    bio: "",
    specialties: [] as ServiceCategory[],
    startHour: 9,
    endHour: 18,
    serviceIds: [] as string[],
    chip: STAFF_CHIPS[0] as string,
  });

  const primed = staff?.id ?? (open ? "new" : "");
  const allStaff = useSalon((s) => s.staff);
  useEffect(() => {
    if (!open) return;
    if (staff) {
      setForm({
        name: staff.name,
        role: staff.role,
        bio: staff.bio,
        specialties: [...staff.specialties],
        startHour: staff.startHour,
        endHour: staff.endHour,
        serviceIds: services.filter((s) => s.staffIds.includes(staff.id)).map((s) => s.id),
        chip: staff.chip,
      });
    } else {
      setForm({
        name: "",
        role: "",
        bio: "",
        specialties: ["hair"],
        startHour: 9,
        endHour: 18,
        serviceIds: services.filter((s) => s.category === "hair").map((s) => s.id),
        chip: chipForStaff(allStaff),
      });
    }
  }, [primed, open, staff, services, allStaff]);

  function toggleSpecialty(id: ServiceCategory) {
    setForm((f) => {
      const on = f.specialties.includes(id);
      const specialties = on ? f.specialties.filter((x) => x !== id) : [...f.specialties, id];
      const nextCats = new Set(specialties);
      const serviceIds = services.filter((s) => nextCats.has(s.category) || f.serviceIds.includes(s.id)).map((s) => s.id);
      return { ...f, specialties, serviceIds };
    });
  }

  function save(e: FormEvent) {
    e.preventDefault();
    const result = upsert({ ...form, id: staff?.id });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(staff ? "Specialist updated" : "Specialist added");
    onClose();
  }

  function drop() {
    if (!staff) return;
    const result = remove(staff.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Specialist removed");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={staff ? staff.name : "New specialist"} className="max-h-[min(88dvh,740px)] overflow-y-auto">
        <form onSubmit={save} className="mt-4 flex flex-col gap-3">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Avery Lane" />
          </Field>
          <Field label="Role">
            <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Colorist" />
          </Field>
          <Field label="Bio">
            <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="What they are known for." />
          </Field>
          <Field label="Calendar color">
            <div className="flex flex-wrap gap-2">
              {STAFF_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  aria-label={chip.replace("appt-", "")}
                  onClick={() => setForm({ ...form, chip })}
                  className={cn(
                    "size-8 rounded-full border-2 shadow-[var(--shadow-border)]",
                    chip,
                    form.chip === chip ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : "border-transparent",
                  )}
                />
              ))}
            </div>
          </Field>
          <Field label="Specialties">
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <ToggleChip key={c.id} on={form.specialties.includes(c.id)} onClick={() => toggleSpecialty(c.id)}>
                  {c.label}
                </ToggleChip>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts">
              <NativeSelect
                value={form.startHour}
                onChange={(e) => setForm({ ...form, startHour: Number(e.target.value) })}
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {hourLabel(h)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Ends">
              <NativeSelect value={form.endHour} onChange={(e) => setForm({ ...form, endHour: Number(e.target.value) })}>
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {hourLabel(h)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field label="Takes these services">
            <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
              {services.map((s) => (
                <ToggleChip
                  key={s.id}
                  on={form.serviceIds.includes(s.id)}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      serviceIds: f.serviceIds.includes(s.id)
                        ? f.serviceIds.filter((id) => id !== s.id)
                        : [...f.serviceIds, s.id],
                    }))
                  }
                >
                  {s.name}
                </ToggleChip>
              ))}
            </div>
          </Field>
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            {staff ? (
              <Button type="button" variant="ghost" className="mr-auto text-destructive" onClick={drop}>
                Remove
              </Button>
            ) : null}
            <Button type="button" variant="ghost" onClick={onClose}>
              Dismiss
            </Button>
            <Button type="submit" variant="ink">
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ServiceDialog({
  open,
  service,
  onClose,
}: {
  open: boolean;
  service: Service | null;
  onClose: () => void;
}) {
  const staff = useSalon((s) => s.staff);
  const upsert = useSalon((s) => s.upsertService);
  const remove = useSalon((s) => s.removeService);
  const [form, setForm] = useState({
    name: "",
    category: "hair" as ServiceCategory,
    durationMin: 60,
    price: 85,
    description: "",
    staffIds: [] as string[],
  });

  const primed = service?.id ?? (open ? "new" : "");
  useEffect(() => {
    if (!open) return;
    if (service) {
      setForm({
        name: service.name,
        category: service.category,
        durationMin: service.durationMin,
        price: service.price,
        description: service.description,
        staffIds: [...service.staffIds],
      });
    } else {
      const category: ServiceCategory = "hair";
      setForm({
        name: "",
        category,
        durationMin: 60,
        price: 85,
        description: "",
        staffIds: staff.filter((st) => st.specialties.includes(category)).map((st) => st.id),
      });
    }
  }, [primed, open, service, staff]);

  function save(e: FormEvent) {
    e.preventDefault();
    const result = upsert({ ...form, id: service?.id, price: Number(form.price) });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(service ? "Service updated" : "Service added");
    onClose();
  }

  function drop() {
    if (!service) return;
    const result = remove(service.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Service removed");
    onClose();
  }

  function setCategory(category: ServiceCategory) {
    setForm((f) => ({
      ...f,
      category,
      staffIds: f.staffIds.length
        ? f.staffIds
        : staff.filter((st) => st.specialties.includes(category)).map((st) => st.id),
    }));
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={service ? service.name : "New service"} className="max-h-[min(88dvh,740px)] overflow-y-auto">
        <form onSubmit={save} className="mt-4 flex flex-col gap-3">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Silk press" />
          </Field>
          <Field label="Category">
            <NativeSelect value={form.category} onChange={(e) => setCategory(e.target.value as ServiceCategory)}>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Duration">
              <NativeSelect
                value={form.durationMin}
                onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })}
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {durationLabel(d)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Price">
              <Input
                type="number"
                min={1}
                step="1"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              />
            </Field>
          </div>
          <Field label="Description">
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What the guest should expect."
            />
          </Field>
          <Field label="Who takes it">
            <div className="flex flex-wrap gap-2">
              {staff.map((st) => (
                <ToggleChip
                  key={st.id}
                  on={form.staffIds.includes(st.id)}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      staffIds: f.staffIds.includes(st.id)
                        ? f.staffIds.filter((id) => id !== st.id)
                        : [...f.staffIds, st.id],
                    }))
                  }
                >
                  {st.name.split(" ")[0]}
                </ToggleChip>
              ))}
            </div>
          </Field>
          {service ? (
            <p className="text-xs text-muted-foreground">{categoryLabel(service.category)} · existing bookings keep their original duration</p>
          ) : null}
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            {service ? (
              <Button type="button" variant="ghost" className="mr-auto text-destructive" onClick={drop}>
                Remove
              </Button>
            ) : null}
            <Button type="button" variant="ghost" onClick={onClose}>
              Dismiss
            </Button>
            <Button type="submit" variant="ink">
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
