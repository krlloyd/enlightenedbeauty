import type {
  Appointment,
  Client,
  GiftCard,
  Product,
  Sale,
  Service,
  Staff,
  WeekHours,
} from "./types";

const SEED_CLIENT_IDS = ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"];
const SEED_APPOINTMENT_IDS = ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9", "a10", "a11", "a12", "a13", "a14"];
const SEED_GIFT_CODE = "EB-KATE";
const DEPOSIT_MIN_DEFAULT = 100;
const AFFIRM_MIN_DEFAULT = 50;

export const BACKUP_CADENCES = ["off", "daily", "weekly"] as const;
export type BackupCadence = (typeof BACKUP_CADENCES)[number];
export type BackupKind = "manual" | "scheduled";

export type SalonPayload = {
  appointments: Appointment[];
  clients: Client[];
  products: Product[];
  sales: Sale[];
  giftCards: GiftCard[];
  staff: Staff[];
  services: Service[];
  hours: WeekHours;
  depositMin: number | null;
  affirmEnabled: boolean;
  affirmMin: number;
};

export type BusySlot = {
  staffId: string;
  start: string;
  durationMin: number;
};

export const CADENCE_LABEL: Record<BackupCadence, string> = {
  off: "Off",
  daily: "Every day",
  weekly: "Every week",
};

export function parseBackupCadence(value: unknown): BackupCadence {
  return typeof value === "string" && (BACKUP_CADENCES as readonly string[]).includes(value)
    ? (value as BackupCadence)
    : "daily";
}

export function hasSalonCatalog(payload: Partial<SalonPayload> | null | undefined) {
  return Boolean(payload?.staff?.length && payload?.services?.length);
}

export function pickSalonPayload(input: Partial<SalonPayload>): SalonPayload | null {
  if (!hasSalonCatalog(input)) return null;
  return {
    appointments: Array.isArray(input.appointments) ? input.appointments : [],
    clients: Array.isArray(input.clients) ? input.clients : [],
    products: Array.isArray(input.products) ? input.products : [],
    sales: Array.isArray(input.sales) ? input.sales : [],
    giftCards: Array.isArray(input.giftCards) ? input.giftCards : [],
    staff: input.staff ?? [],
    services: input.services ?? [],
    hours: input.hours ?? [],
    depositMin: input.depositMin === undefined ? DEPOSIT_MIN_DEFAULT : input.depositMin,
    affirmEnabled: input.affirmEnabled ?? true,
    affirmMin: typeof input.affirmMin === "number" ? input.affirmMin : AFFIRM_MIN_DEFAULT,
  };
}

export function stripDemoRecords(payload: SalonPayload): SalonPayload {
  const seedClients = new Set(SEED_CLIENT_IDS);
  const seedAppts = new Set(SEED_APPOINTMENT_IDS);
  const clients = payload.clients.filter((c) => !seedClients.has(c.id));
  const keep = new Set(clients.map((c) => c.id));
  return {
    ...payload,
    clients,
    appointments: payload.appointments.filter((a) => keep.has(a.clientId) && !seedAppts.has(a.id)),
    giftCards: payload.giftCards.filter((g) => g.code !== SEED_GIFT_CODE),
    sales: payload.sales.filter((s) => !s.clientId || keep.has(s.clientId)),
  };
}

export function backupIsDue(lastIso: string | null, cadence: BackupCadence, now = Date.now()) {
  if (cadence === "off") return false;
  if (!lastIso) return true;
  const last = Date.parse(lastIso);
  if (!Number.isFinite(last)) return true;
  const span = cadence === "daily" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  return now - last >= span;
}

export function busyFromAppointments(appointments: Appointment[]): BusySlot[] {
  return appointments
    .filter((a) => a.status !== "cancelled" && a.status !== "no-show" && a.status !== "completed")
    .map((a) => ({ staffId: a.staffId, start: a.start, durationMin: a.durationMin }));
}

export function asJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}
