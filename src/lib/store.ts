import { addDays, addMinutes, format, isSameDay, setHours, setMinutes, startOfDay } from "date-fns";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { AFFIRM_MIN_DEFAULT } from "./affirm";
import { DEPOSIT_MIN_DEFAULT, DEPOSIT_RATE, PRODUCTS, SEED_CLIENTS, SERVICES, STAFF, TAX_RATE, WEEK_HOURS, chipForStaff, cloneHours, imageForCategory, imageForProduct, initialsFrom, isStaffChip, normalizeHours, serviceById, skuFromName } from "./catalog";
import { pickSalonPayload, stripDemoRecords, type BusySlot, type SalonPayload } from "./salon-payload";
import { ACTIVE_STATUSES, isOpenOn, nextOpenDay, staffBusy } from "./availability";
import type {
  Appointment,
  AppointmentStatus,
  CartLine,
  Client,
  GiftCard,
  PayMethod,
  PendingPay,
  Product,
  Sale,
  Service,
  ServiceCategory,
  Staff,
  Visitor,
  WeekHours,
  BookInput,
  CheckoutInput,
} from "./types";
import { nid } from "./utils";
import { matchClient, type ImportMode, type VagaroClientRow } from "./vagaro-import";

function atHour(day: Date, h: number, m = 0) {
  return setMinutes(setHours(startOfDay(day), h), m);
}

function buildSeedAppointments(now: Date): Appointment[] {
  const today = isOpenOn(now) ? startOfDay(now) : nextOpenDay(now);
  const yest = addDays(today, -1);
  const tom = addDays(today, 1);
  const later = addDays(today, 3);
  const mk = (
    id: string,
    clientId: string,
    staffId: string,
    serviceId: string,
    start: Date,
    status: AppointmentStatus,
    notes = "",
  ): Appointment => {
    const svc = serviceById(serviceId)!;
    return {
      id,
      clientId,
      staffId,
      serviceId,
      start: start.toISOString(),
      durationMin: svc.durationMin,
      status,
      notes,
      depositPaid: true,
      createdAt: addDays(start, -6).toISOString(),
    };
  };
  return [
    mk("a1", "c8", "elena", "balayage", atHour(today, 9, 0), "in-service", "Toner: beige pearl"),
    mk("a2", "c3", "marcus", "mens", atHour(today, 10, 0), "arrived"),
    mk("a3", "c4", "amara", "gel-mani", atHour(today, 10, 30), "confirmed"),
    mk("a4", "c6", "sofie", "facial", atHour(today, 11, 0), "confirmed"),
    mk("a5", "c1", "elena", "gloss", atHour(today, 13, 0), "booked"),
    mk("a6", "c2", "jules", "event-mu", atHour(today, 14, 0), "booked", "Rehearsal dinner"),
    mk("a7", "c7", "marcus", "cut", atHour(today, 15, 0), "booked"),
    mk("a8", "c5", "amara", "lash", atHour(today, 13, 30), "booked"),
    mk("a9", "c1", "marcus", "blowout", atHour(tom, 11, 0), "booked"),
    mk("a10", "c8", "elena", "roots", atHour(later, 9, 30), "booked"),
    mk("a11", "c6", "sofie", "glow", atHour(yest, 12, 0), "completed"),
    mk("a12", "c3", "marcus", "mens", atHour(addDays(today, -3), 16, 0), "completed"),
    mk("a13", "c4", "amara", "pedi", atHour(addDays(today, -2), 11, 0), "completed"),
    mk("a14", "c2", "jules", "brows", atHour(addDays(today, 4), 10, 0), "booked"),
  ];
}

function buildSeedSales(now: Date): Sale[] {
  const day = (offset: number, hour: number) => addDays(atHour(now, hour), offset);
  const rows: Sale[] = [];
  const push = (at: Date, items: Sale["items"], tip: number, clientId?: string, method: PayMethod = "card") => {
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
    rows.push({
      id: nid(),
      at: at.toISOString(),
      clientId,
      items,
      subtotal,
      tax,
      tip,
      total: subtotal + tax + tip,
      method,
    });
  };
  push(day(-1, 12), [{ kind: "service", refId: "glow", name: "Express glow facial", qty: 1, price: 85 }], 15, "c6");
  push(day(-2, 11), [{ kind: "service", refId: "pedi", name: "Spa pedicure", qty: 1, price: 62 }, { kind: "product", refId: "polish-nude", name: "Studio nude polish", qty: 1, price: 22 }], 10, "c4");
  push(day(-3, 16), [{ kind: "service", refId: "mens", name: "Precision men's cut", qty: 1, price: 55 }], 10, "c3", "cash");
  push(day(-4, 14), [{ kind: "service", refId: "cut", name: "Signature cut & shape", qty: 1, price: 85 }, { kind: "product", refId: "oil", name: "Salon hair oil", qty: 1, price: 42 }], 20, "c1");
  push(day(-5, 10), [{ kind: "service", refId: "gloss", name: "Gloss & tone", qty: 1, price: 95 }], 18, "c8");
  push(day(0, 9), [{ kind: "product", refId: "wash", name: "Daily wash", qty: 2, price: 32 }], 0, undefined, "card");
  return rows;
}

export type { BookInput, CheckoutInput };

export type StaffInput = {
  id?: string;
  name: string;
  role: string;
  bio: string;
  specialties: ServiceCategory[];
  startHour: number;
  endHour: number;
  serviceIds: string[];
  chip?: string;
};

export type ServiceInput = {
  id?: string;
  name: string;
  category: ServiceCategory;
  durationMin: number;
  price: number;
  description: string;
  staffIds: string[];
};

export type ProductInput = {
  id?: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  sku: string;
  description: string;
};

type State = {
  hydrated: boolean;
  production: boolean;
  appointments: Appointment[];
  clients: Client[];
  products: Product[];
  sales: Sale[];
  giftCards: GiftCard[];
  visitor: Visitor | null;
  staff: Staff[];
  services: Service[];
  hours: WeekHours;
  pendingPay: PendingPay | null;
  depositMin: number | null;
  affirmEnabled: boolean;
  affirmMin: number;
  hydrate: () => void;
  resetDemo: () => void;
  applyDesk: (input: { production: boolean; payload: SalonPayload | null }) => void;
  applyPublic: (input: {
    production: boolean;
    staff: Staff[] | null;
    services: Service[] | null;
    hours: WeekHours | null;
    products: Product[] | null;
    busy: BusySlot[];
  }) => void;
  clearDemoRecords: () => void;
  setProduction: (on: boolean) => void;
  snapshot: () => SalonPayload | null;
  applyBooked: (appointment: Appointment, client: Client, visitor?: Visitor) => void;
  setVisitor: (v: Visitor) => void;
  setPendingPay: (p: PendingPay | null) => void;
  setDepositMin: (min: number | null) => void;
  setAffirm: (input: { enabled?: boolean; min?: number }) => void;
  book: (input: BookInput) => { ok: true; appointment: Appointment } | { ok: false; error: string };
  cancel: (id: string) => void;
  reschedule: (id: string, start: string, staffId: string) => { ok: true } | { ok: false; error: string };
  setStatus: (id: string, status: AppointmentStatus) => void;
  updateNotes: (id: string, notes: string) => void;
  upsertClient: (c: Omit<Client, "id" | "createdAt" | "loyaltyPoints"> & { id?: string }) => Client;
  importClients: (
    rows: VagaroClientRow[],
    mode: ImportMode,
  ) => { added: number; updated: number; skipped: number };
  upsertStaff: (input: StaffInput) => { ok: true; staff: Staff } | { ok: false; error: string };
  removeStaff: (id: string) => { ok: true } | { ok: false; error: string };
  upsertService: (input: ServiceInput) => { ok: true; service: Service } | { ok: false; error: string };
  removeService: (id: string) => { ok: true } | { ok: false; error: string };
  upsertProduct: (input: ProductInput) => { ok: true; product: Product } | { ok: false; error: string };
  removeProduct: (id: string) => { ok: true } | { ok: false; error: string };
  adjustStock: (id: string, delta: number) => void;
  setHours: (hours: WeekHours) => { ok: true } | { ok: false; error: string };
  checkout: (input: CheckoutInput) => { ok: true; sale: Sale } | { ok: false; error: string };
  buyGift: (amount: number, from: string, to: string, method?: PayMethod) => GiftCard;
  buyProduct: (productId: string, qty: number, clientId?: string, method?: PayMethod) => { ok: true; sale: Sale } | { ok: false; error: string };
};

function applyStaffServices(services: Service[], staffId: string, serviceIds: string[]): Service[] {
  const want = new Set(serviceIds);
  return services.map((s) => {
    const has = s.staffIds.includes(staffId);
    const should = want.has(s.id);
    if (has === should) return s;
    return {
      ...s,
      staffIds: should ? [...s.staffIds, staffId] : s.staffIds.filter((id) => id !== staffId),
    };
  });
}

function hasLiveBook(appointments: Appointment[], pred: (a: Appointment) => boolean) {
  return appointments.some(
    (a) => pred(a) && ACTIVE_STATUSES.includes(a.status) && addMinutes(new Date(a.start), a.durationMin).getTime() > Date.now(),
  );
}

function findOrCreateClient(
  clients: Client[],
  name: string,
  phone: string,
  email: string,
): { clients: Client[]; client: Client } {
  const key = phone.replace(/\D/g, "");
  const existing = clients.find((c) => c.phone.replace(/\D/g, "") === key);
  if (existing) {
    const client = {
      ...existing,
      name: name || existing.name,
      email: email || existing.email,
    };
    return { clients: clients.map((c) => (c.id === client.id ? client : c)), client };
  }
  const client: Client = {
    id: nid(),
    name,
    phone,
    email,
    notes: "",
    loyaltyPoints: 0,
    createdAt: new Date().toISOString(),
  };
  return { clients: [client, ...clients], client };
}

function fresh() {
  const now = new Date();
  return {
    production: false,
    appointments: buildSeedAppointments(now),
    clients: SEED_CLIENTS.map((c) => ({ ...c })),
    products: PRODUCTS.map((p) => ({ ...p })),
    sales: buildSeedSales(now),
    giftCards: [
      {
        id: "g1",
        code: "EB-KATE",
        balance: 75,
        original: 75,
        from: "Jordan Hale",
        to: "Kate Hale",
        createdAt: addDays(now, -20).toISOString(),
      },
    ] satisfies GiftCard[],
    visitor: null as Visitor | null,
    staff: STAFF.map((s) => ({ ...s, specialties: [...s.specialties] })),
    services: SERVICES.map((s) => ({ ...s, staffIds: [...s.staffIds] })),
    hours: cloneHours(WEEK_HOURS),
    pendingPay: null as PendingPay | null,
    depositMin: DEPOSIT_MIN_DEFAULT as number | null,
    affirmEnabled: true,
    affirmMin: AFFIRM_MIN_DEFAULT,
  };
}

export const useSalon = create<State>()(
  persist(
    (set, get) => ({
      hydrated: false,
      ...fresh(),
      hydrate: () => set({ hydrated: true }),
      resetDemo: () => {
        if (get().production) return;
        set({ ...fresh(), hydrated: true });
      },
      snapshot: () => pickSalonPayload(get()),
      setProduction: (on) => set({ production: on }),
      clearDemoRecords: () => {
        const payload = pickSalonPayload(get());
        if (!payload) return;
        set({ ...stripDemoRecords(payload) });
      },
      applyDesk: (input) => {
        if (!input.payload) {
          set({ production: input.production });
          return;
        }
        set({ production: input.production, ...input.payload, hydrated: true });
      },
      applyPublic: (input) => {
        if (!input.production || !input.staff || !input.services || !input.hours) {
          set({ production: input.production });
          return;
        }
        const visitor = get().visitor;
        const key = visitor?.phone.replace(/\D/g, "") ?? "";
        const mine = key
          ? new Set(get().clients.filter((c) => c.phone.replace(/\D/g, "") === key).map((c) => c.id))
          : new Set<string>();
        const keep = get().appointments.filter((a) => mine.has(a.clientId));
        const taken = new Set(keep.map((a) => `${a.staffId}|${a.start}`));
        const holds: Appointment[] = input.busy
          .filter((b) => !taken.has(`${b.staffId}|${b.start}`))
          .map((b) => ({
            id: `busy-${b.staffId}-${b.start}`,
            clientId: "_hold",
            staffId: b.staffId,
            serviceId: "",
            start: b.start,
            durationMin: b.durationMin,
            status: "booked",
            notes: "",
            depositPaid: false,
            createdAt: b.start,
          }));
        set({
          production: true,
          staff: input.staff,
          services: input.services,
          hours: input.hours,
          products: input.products && input.products.length > 0 ? input.products : get().products,
          appointments: [...keep, ...holds],
        });
      },
      applyBooked: (appointment, client, visitor) => {
        const clients = get().clients.some((c) => c.id === client.id)
          ? get().clients.map((c) => (c.id === client.id ? client : c))
          : [client, ...get().clients];
        const holdId = `busy-${appointment.staffId}-${appointment.start}`;
        const appointments = get().appointments.some((a) => a.id === appointment.id)
          ? get().appointments.map((a) => (a.id === appointment.id ? appointment : a))
          : [...get().appointments.filter((a) => a.id !== holdId), appointment];
        set({ clients, appointments, visitor: visitor ?? get().visitor });
      },
      setVisitor: (v) => set({ visitor: v }),
      setPendingPay: (p) => set({ pendingPay: p }),
      setDepositMin: (min) => set({ depositMin: min == null ? null : Math.max(0, min) }),
      setAffirm: (input) =>
        set({
          affirmEnabled: input.enabled ?? get().affirmEnabled,
          affirmMin: input.min != null ? Math.max(0, input.min) : get().affirmMin,
        }),
      book: (input) => {
        const svc = get().services.find((s) => s.id === input.serviceId);
        const staff = get().staff.find((s) => s.id === input.staffId);
        if (!svc || !staff) return { ok: false, error: "Choose a service and specialist." };
        if (!svc.staffIds.includes(staff.id)) return { ok: false, error: "That specialist does not offer this service." };
        const start = new Date(input.start);
        if (staffBusy(get().appointments, staff.id, start, svc.durationMin)) {
          return { ok: false, error: "That time was just taken. Pick another slot." };
        }
        const { clients, client } = findOrCreateClient(get().clients, input.name, input.phone, input.email);
        const appointment: Appointment = {
          id: nid(),
          clientId: client.id,
          staffId: staff.id,
          serviceId: svc.id,
          start: start.toISOString(),
          durationMin: svc.durationMin,
          status: "booked",
          notes: input.notes ?? "",
          depositPaid: input.depositPaid ?? needsDeposit(svc.price, get().depositMin),
          createdAt: new Date().toISOString(),
        };
        set({
          clients,
          appointments: [...get().appointments, appointment],
          visitor: { name: input.name, phone: input.phone, email: input.email },
        });
        return { ok: true, appointment };
      },
      cancel: (id) =>
        set({
          appointments: get().appointments.map((a) => (a.id === id ? { ...a, status: "cancelled" } : a)),
        }),
      reschedule: (id, startIso, staffId) => {
        const appt = get().appointments.find((a) => a.id === id);
        if (!appt) return { ok: false, error: "Appointment not found." };
        const start = new Date(startIso);
        if (staffBusy(get().appointments, staffId, start, appt.durationMin, id)) {
          return { ok: false, error: "That time is no longer open." };
        }
        set({
          appointments: get().appointments.map((a) =>
            a.id === id ? { ...a, start: startIso, staffId, status: "booked" } : a,
          ),
        });
        return { ok: true };
      },
      setStatus: (id, status) =>
        set({
          appointments: get().appointments.map((a) => (a.id === id ? { ...a, status } : a)),
        }),
      updateNotes: (id, notes) =>
        set({
          appointments: get().appointments.map((a) => (a.id === id ? { ...a, notes } : a)),
        }),
      upsertClient: (c) => {
        if (c.id) {
          const next = get().clients.map((x) => (x.id === c.id ? { ...x, ...c } : x));
          set({ clients: next });
          return next.find((x) => x.id === c.id)!;
        }
        const created: Client = {
          id: nid(),
          name: c.name,
          phone: c.phone,
          email: c.email,
          notes: c.notes,
          loyaltyPoints: 0,
          createdAt: new Date().toISOString(),
        };
        set({ clients: [created, ...get().clients] });
        return created;
      },
      importClients: (rows, mode) => {
        const clients = [...get().clients];
        let added = 0;
        let updated = 0;
        let skipped = 0;
        for (const row of rows) {
          const match = matchClient(clients, row);
          if (match && mode === "skip") {
            skipped += 1;
            continue;
          }
          if (match && mode === "merge") {
            const i = clients.findIndex((c) => c.id === match.id);
            const notes =
              row.notes && !match.notes.includes(row.notes)
                ? [match.notes, row.notes].filter(Boolean).join(" · ")
                : match.notes;
            clients[i] = {
              ...match,
              name: row.name || match.name,
              phone: row.phone || match.phone,
              email: row.email || match.email,
              notes,
              loyaltyPoints: Math.max(match.loyaltyPoints, row.loyaltyPoints),
            };
            updated += 1;
            continue;
          }
          clients.unshift({
            id: nid(),
            name: row.name,
            phone: row.phone,
            email: row.email,
            notes: row.notes,
            loyaltyPoints: row.loyaltyPoints,
            createdAt: row.createdAt ?? new Date().toISOString(),
          });
          added += 1;
        }
        set({ clients });
        return { added, updated, skipped };
      },
      upsertStaff: (input) => {
        const name = input.name.trim();
        if (!name) return { ok: false, error: "Name is required." };
        if (input.specialties.length === 0) return { ok: false, error: "Pick at least one specialty." };
        if (input.endHour <= input.startHour) return { ok: false, error: "End time must be after start." };
        const current = get().staff;
        if (input.id) {
          const existing = current.find((s) => s.id === input.id);
          if (!existing) return { ok: false, error: "Specialist not found." };
          const next: Staff = {
            ...existing,
            name,
            role: input.role.trim() || "Specialist",
            bio: input.bio.trim(),
            initials: initialsFrom(name),
            specialties: input.specialties,
            chip: input.chip && isStaffChip(input.chip) ? input.chip : existing.chip,
            startHour: input.startHour,
            endHour: input.endHour,
          };
          set({
            staff: current.map((s) => (s.id === next.id ? next : s)),
            services: applyStaffServices(get().services, next.id, input.serviceIds),
          });
          return { ok: true, staff: next };
        }
        const created: Staff = {
          id: nid(),
          name,
          role: input.role.trim() || "Specialist",
          bio: input.bio.trim(),
          initials: initialsFrom(name),
          specialties: input.specialties,
          chip: input.chip && isStaffChip(input.chip) ? input.chip : chipForStaff(current),
          startHour: input.startHour,
          endHour: input.endHour,
        };
        set({
          staff: [...current, created],
          services: applyStaffServices(get().services, created.id, input.serviceIds),
        });
        return { ok: true, staff: created };
      },
      removeStaff: (id) => {
        if (hasLiveBook(get().appointments, (a) => a.staffId === id)) {
          return { ok: false, error: "Move or finish their upcoming visits first." };
        }
        set({
          staff: get().staff.filter((s) => s.id !== id),
          services: get().services.map((s) => ({ ...s, staffIds: s.staffIds.filter((sid) => sid !== id) })),
        });
        return { ok: true };
      },
      upsertService: (input) => {
        const name = input.name.trim();
        if (!name) return { ok: false, error: "Name is required." };
        if (input.durationMin < 15) return { ok: false, error: "Duration must be at least 15 minutes." };
        if (input.price <= 0) return { ok: false, error: "Set a price." };
        if (input.staffIds.length === 0) return { ok: false, error: "Assign at least one specialist." };
        const current = get().services;
        const image = imageForCategory(input.category);
        if (input.id) {
          const existing = current.find((s) => s.id === input.id);
          if (!existing) return { ok: false, error: "Service not found." };
          const next: Service = {
            ...existing,
            name,
            category: input.category,
            durationMin: input.durationMin,
            price: input.price,
            description: input.description.trim(),
            staffIds: input.staffIds,
            image,
          };
          set({ services: current.map((s) => (s.id === next.id ? next : s)) });
          return { ok: true, service: next };
        }
        const created: Service = {
          id: nid(),
          name,
          category: input.category,
          durationMin: input.durationMin,
          price: input.price,
          description: input.description.trim(),
          staffIds: input.staffIds,
          image,
        };
        set({ services: [...current, created] });
        return { ok: true, service: created };
      },
      removeService: (id) => {
        if (hasLiveBook(get().appointments, (a) => a.serviceId === id)) {
          return { ok: false, error: "This service still has upcoming visits." };
        }
        set({ services: get().services.filter((s) => s.id !== id) });
        return { ok: true };
      },
      upsertProduct: (input) => {
        const name = input.name.trim();
        if (!name) return { ok: false, error: "Name is required." };
        if (input.price <= 0) return { ok: false, error: "Set a price." };
        if (input.stock < 0) return { ok: false, error: "Stock cannot be negative." };
        const sku = (input.sku.trim() || skuFromName(name)).toUpperCase();
        const current = get().products;
        if (current.some((p) => p.sku === sku && p.id !== input.id)) {
          return { ok: false, error: "That SKU is already on the shelf." };
        }
        const category = input.category.trim() || "Hair";
        if (input.id) {
          const existing = current.find((p) => p.id === input.id);
          if (!existing) return { ok: false, error: "Product not found." };
          const next: Product = {
            ...existing,
            name,
            category,
            price: input.price,
            stock: Math.floor(input.stock),
            sku,
            description: input.description.trim(),
            image: imageForProduct(category),
          };
          set({ products: current.map((p) => (p.id === next.id ? next : p)) });
          return { ok: true, product: next };
        }
        const created: Product = {
          id: nid(),
          name,
          category,
          price: input.price,
          stock: Math.floor(input.stock),
          sku,
          description: input.description.trim(),
          image: imageForProduct(category),
        };
        set({ products: [...current, created] });
        return { ok: true, product: created };
      },
      removeProduct: (id) => {
        const existing = get().products.find((p) => p.id === id);
        if (!existing) return { ok: false, error: "Product not found." };
        set({ products: get().products.filter((p) => p.id !== id) });
        return { ok: true };
      },
      adjustStock: (id, delta) => {
        set({
          products: get().products.map((p) => (p.id === id ? { ...p, stock: Math.max(0, p.stock + delta) } : p)),
        });
      },
      setHours: (hours) => {
        const next = normalizeHours(hours);
        if (!next) return { ok: false, error: "Hours look incomplete." };
        if (next.every((h) => h == null)) return { ok: false, error: "Keep at least one day open." };
        for (const h of next) {
          if (h && h[1] <= h[0]) return { ok: false, error: "Close time must be after open." };
        }
        set({ hours: next });
        return { ok: true };
      },
      checkout: (input) => {
        if (input.items.length === 0) return { ok: false, error: "Add something to the ticket." };
        const subtotal = input.items.reduce((s, i) => s + i.price * i.qty, 0);
        const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
        let total = subtotal + tax + input.tip;
        const giftCards = get().giftCards.map((g) => ({ ...g }));
        if (input.method === "gift") {
          const code = (input.giftCode ?? "").trim().toUpperCase();
          const card = giftCards.find((g) => g.code === code);
          if (!card) return { ok: false, error: "Gift card not found." };
          if (card.balance <= 0) return { ok: false, error: "This card has no balance." };
          const used = Math.min(card.balance, total);
          card.balance = Math.round((card.balance - used) * 100) / 100;
          total = Math.round((total - used) * 100) / 100;
        }
        const products = get().products.map((p) => ({ ...p }));
        for (const line of input.items) {
          if (line.kind !== "product") continue;
          const p = products.find((x) => x.id === line.refId);
          if (!p) continue;
          if (p.stock < line.qty) return { ok: false, error: `${p.name} does not have enough stock.` };
          p.stock -= line.qty;
        }
        const sale: Sale = {
          id: nid(),
          at: new Date().toISOString(),
          clientId: input.clientId,
          appointmentId: input.appointmentId,
          items: input.items,
          subtotal,
          tax,
          tip: input.tip,
          total: input.method === "gift" ? subtotal + tax + input.tip : total,
          method: input.method,
          stripeId: input.stripeId,
        };
        const appointments = get().appointments.map((a) =>
          input.fulfill !== false && input.appointmentId && a.id === input.appointmentId
            ? { ...a, status: "completed" as const }
            : a,
        );
        const clients = get().clients.map((c) =>
          input.clientId && c.id === input.clientId
            ? { ...c, loyaltyPoints: c.loyaltyPoints + Math.floor(subtotal) }
            : c,
        );
        set({ sales: [sale, ...get().sales], products, appointments, clients, giftCards });
        return { ok: true, sale };
      },
      buyGift: (amount, from, to, method = "card") => {
        const card: GiftCard = {
          id: nid(),
          code: `EB-${format(new Date(), "mmss")}${Math.random().toString(36).slice(2, 4).toUpperCase()}`,
          balance: amount,
          original: amount,
          from,
          to,
          createdAt: new Date().toISOString(),
        };
        const sale: Sale = {
          id: nid(),
          at: new Date().toISOString(),
          items: [{ kind: "gift", refId: card.id, name: `Gift card · ${amount}`, qty: 1, price: amount }],
          subtotal: amount,
          tax: 0,
          tip: 0,
          total: amount,
          method,
        };
        set({ giftCards: [card, ...get().giftCards], sales: [sale, ...get().sales] });
        return card;
      },
      buyProduct: (productId, qty, clientId, method = "card") => {
        const p = get().products.find((x) => x.id === productId);
        if (!p) return { ok: false, error: "Product not found." };
        if (p.category === "Gift") {
          const card = get().buyGift(p.price, get().visitor?.name ?? "Guest", "Gift", method);
          return {
            ok: true,
            sale: {
              id: card.id,
              at: card.createdAt,
              items: [{ kind: "gift", refId: card.id, name: p.name, qty: 1, price: p.price }],
              subtotal: p.price,
              tax: 0,
              tip: 0,
              total: p.price,
              method,
            },
          };
        }
        return get().checkout({
          clientId,
          items: [{ kind: "product", refId: p.id, name: p.name, qty, price: p.price }],
          tip: 0,
          method,
        });
      },
    }),
    {
      name: "enlightened-beauty-v3",
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return localStorage;
      }),
      skipHydration: true,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return {
          ...current,
          ...p,
          production: Boolean(p.production),
          staff: p.staff && p.staff.length > 0 ? p.staff : current.staff,
          services: p.services && p.services.length > 0 ? p.services : current.services,
          hours: normalizeHours(p.hours) ?? current.hours,
          pendingPay: p.pendingPay ?? null,
          depositMin: migrateDepositMin(p),
          affirmEnabled: p.affirmEnabled ?? true,
          affirmMin: typeof p.affirmMin === "number" ? p.affirmMin : AFFIRM_MIN_DEFAULT,
        };
      },
      partialize: (s) => ({
        production: s.production,
        appointments: s.appointments,
        clients: s.clients,
        products: s.products,
        sales: s.sales,
        giftCards: s.giftCards,
        visitor: s.visitor,
        staff: s.staff,
        services: s.services,
        hours: s.hours,
        pendingPay: s.pendingPay,
        depositMin: s.depositMin,
        affirmEnabled: s.affirmEnabled,
        affirmMin: s.affirmMin,
      }),
    },
  ),
);

export function needsDeposit(price: number, min: number | null = useSalon.getState().depositMin) {
  if (min == null) return false;
  return price >= min;
}

export function depositFor(serviceId: string) {
  const svc = useSalon.getState().services.find((s) => s.id === serviceId) ?? serviceById(serviceId);
  if (!svc || !needsDeposit(svc.price)) return 0;
  return Math.round(svc.price * DEPOSIT_RATE);
}

function migrateDepositMin(p: Partial<State> & { requireDeposit?: boolean }) {
  if (p.depositMin === null) return null;
  if (typeof p.depositMin === "number" && Number.isFinite(p.depositMin)) return Math.max(0, p.depositMin);
  if (p.requireDeposit === false) return null;
  if (p.requireDeposit === true) return 0;
  return DEPOSIT_MIN_DEFAULT;
}

export function appointmentsOn(date: Date, appointments: Appointment[]) {
  return appointments.filter((a) => isSameDay(new Date(a.start), date));
}

export function clientById(clients: Client[], id: string) {
  return clients.find((c) => c.id === id);
}

export function endOfAppt(a: Appointment) {
  return addMinutes(new Date(a.start), a.durationMin);
}
