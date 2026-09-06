import { createServerFn } from "@tanstack/react-start";
import { staffBusy } from "./availability";
import { authMiddleware } from "./auth/middleware";
import { formatPhone } from "./format";
import {
  asJsonObject,
  backupIsDue,
  busyFromAppointments,
  hasSalonCatalog,
  parseBackupCadence,
  pickSalonPayload,
  stripDemoRecords,
  type BackupCadence,
  type BackupKind,
  type BusySlot,
  type SalonPayload,
} from "./salon-payload";
import { requireDeskMember, requireDeskOwner } from "./studio-members";
import type { Appointment, BookInput, Client } from "./types";
import { nid } from "./utils";

const SALON_ID = "salon";
const KEEP_BACKUPS = 30;

type StateRow = {
  production: boolean;
  backup_cadence: string;
  payload: unknown;
  updated_at: string;
};

type BackupRow = {
  id: string;
  kind: string;
  note: string;
  payload: unknown;
  created_at: string;
};

export type SalonDeskState = {
  production: boolean;
  backupCadence: BackupCadence;
  updatedAt: string | null;
  lastBackupAt: string | null;
  payload: SalonPayload | null;
};

export type BackupSummary = {
  id: string;
  kind: BackupKind;
  note: string;
  createdAt: string;
  clients: number;
  appointments: number;
};

function asBool(value: unknown) {
  return value === true || value === "t" || value === "true";
}

function asIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) return new Date(value).toISOString();
  return null;
}

function payloadFromUnknown(value: unknown): SalonPayload | null {
  return pickSalonPayload(asJsonObject(value) as Partial<SalonPayload>);
}

async function loadState(sql: Awaited<ReturnType<typeof import("./db").getSql>>) {
  await sql.query(`insert into salon_state (id) values ($1) on conflict (id) do nothing`, [SALON_ID]);
  const rows = await sql.query<StateRow>(
    `select production, backup_cadence, payload, updated_at from salon_state where id = $1 limit 1`,
    [SALON_ID],
  );
  const row = rows[0];
  if (!row) {
    return {
      production: false,
      backupCadence: "daily" as BackupCadence,
      updatedAt: null as string | null,
      payload: null as SalonPayload | null,
    };
  }
  return {
    production: asBool(row.production),
    backupCadence: parseBackupCadence(row.backup_cadence),
    updatedAt: asIso(row.updated_at),
    payload: payloadFromUnknown(row.payload),
  };
}

async function lastBackupAt(sql: Awaited<ReturnType<typeof import("./db").getSql>>) {
  const rows = await sql.query<{ created_at: string }>(
    `select created_at from salon_backups order by created_at desc limit 1`,
  );
  return asIso(rows[0]?.created_at);
}

async function writePayload(
  sql: Awaited<ReturnType<typeof import("./db").getSql>>,
  payload: SalonPayload,
  extra?: { production?: boolean; backupCadence?: BackupCadence },
) {
  const json = JSON.stringify(payload);
  if (extra?.production != null && extra.backupCadence) {
    await sql.query(
      `update salon_state set payload = $1::jsonb, production = $2, backup_cadence = $3, updated_at = now() where id = $4`,
      [json, extra.production, extra.backupCadence, SALON_ID],
    );
  } else if (extra?.production != null) {
    await sql.query(`update salon_state set payload = $1::jsonb, production = $2, updated_at = now() where id = $3`, [
      json,
      extra.production,
      SALON_ID,
    ]);
  } else if (extra?.backupCadence) {
    await sql.query(
      `update salon_state set payload = $1::jsonb, backup_cadence = $2, updated_at = now() where id = $3`,
      [json, extra.backupCadence, SALON_ID],
    );
  } else {
    await sql.query(`update salon_state set payload = $1::jsonb, updated_at = now() where id = $2`, [json, SALON_ID]);
  }
}

async function insertBackup(
  sql: Awaited<ReturnType<typeof import("./db").getSql>>,
  payload: SalonPayload,
  kind: BackupKind,
  note: string,
) {
  await sql.query(`insert into salon_backups (id, kind, note, payload) values ($1, $2, $3, $4::jsonb)`, [
    nid(),
    kind,
    note,
    JSON.stringify(payload),
  ]);
  const extra = await sql.query<{ id: string }>(
    `select id from salon_backups order by created_at desc offset $1`,
    [KEEP_BACKUPS],
  );
  for (const row of extra) {
    await sql.query(`delete from salon_backups where id = $1`, [row.id]);
  }
  try {
    const { pushCloudCopy } = await import("./salon-cloud");
    await pushCloudCopy(sql, payload, note);
  } catch (err) {
    console.warn("[salon-ops] cloud copy skipped", err);
  }
}

async function deskState(sql: Awaited<ReturnType<typeof import("./db").getSql>>): Promise<SalonDeskState> {
  const state = await loadState(sql);
  return {
    production: state.production,
    backupCadence: state.backupCadence,
    updatedAt: state.updatedAt,
    lastBackupAt: await lastBackupAt(sql),
    payload: state.payload,
  };
}

export const getSalonDesk = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<SalonDeskState> => {
    const { getSql } = await import("./db");
    const sql = await getSql();
    await requireDeskMember(sql, context.userId);
    return deskState(sql);
  });

export const saveSalonDesk = createServerFn({ method: "POST" })
  .validator((d: { payload: SalonPayload }) => {
    const payload = pickSalonPayload(d?.payload ?? {});
    if (!payload) throw new Error("Nothing to save.");
    return { payload };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<SalonDeskState> => {
    const { getSql } = await import("./db");
    const sql = await getSql();
    await requireDeskMember(sql, context.userId);
    await writePayload(sql, data.payload);
    return deskState(sql);
  });

export const setSalonLive = createServerFn({ method: "POST" })
  .validator((d: { production: boolean; payload?: SalonPayload; clearDemo?: boolean }) => ({
    production: Boolean(d?.production),
    payload: d?.payload ? pickSalonPayload(d.payload) : null,
    clearDemo: Boolean(d?.clearDemo),
  }))
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<SalonDeskState> => {
    const { getSql } = await import("./db");
    const sql = await getSql();
    await requireDeskOwner(sql, context.userId);
    const current = await loadState(sql);
    let payload = data.payload ?? current.payload;
    if (!payload) throw new Error("Save the desk once before going live.");
    if (data.production && data.clearDemo) {
      await insertBackup(sql, payload, "manual", "Before going live");
      payload = stripDemoRecords(payload);
    }
    await sql.query(`update salon_state set production = $1, payload = $2::jsonb, updated_at = now() where id = $3`, [
      data.production,
      JSON.stringify(payload),
      SALON_ID,
    ]);
    return deskState(sql);
  });

export const setBackupCadence = createServerFn({ method: "POST" })
  .validator((d: { cadence: BackupCadence }) => ({ cadence: parseBackupCadence(d?.cadence) }))
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<SalonDeskState> => {
    const { getSql } = await import("./db");
    const sql = await getSql();
    await requireDeskOwner(sql, context.userId);
    await sql.query(`update salon_state set backup_cadence = $1, updated_at = now() where id = $2`, [
      data.cadence,
      SALON_ID,
    ]);
    return deskState(sql);
  });

export const createSalonBackup = createServerFn({ method: "POST" })
  .validator((d: { payload?: SalonPayload; note?: string } | undefined) => ({
    payload: d?.payload ? pickSalonPayload(d.payload) : null,
    note: String(d?.note ?? "Manual backup").slice(0, 120),
  }))
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<{ id: string; createdAt: string }> => {
    const { getSql } = await import("./db");
    const sql = await getSql();
    await requireDeskOwner(sql, context.userId);
    const current = await loadState(sql);
    const payload = data.payload ?? current.payload;
    if (!payload) throw new Error("Nothing to back up yet.");
    await writePayload(sql, payload);
    await insertBackup(sql, payload, "manual", data.note);
    const last = await lastBackupAt(sql);
    return { id: "ok", createdAt: last ?? new Date().toISOString() };
  });

export const importSalonBackup = createServerFn({ method: "POST" })
  .validator((d: { payload: SalonPayload; note?: string }) => {
    const payload = pickSalonPayload(d?.payload ?? {});
    if (!payload) throw new Error("That file is not a salon backup.");
    return { payload, note: String(d?.note ?? "Imported JSON").slice(0, 120) };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<SalonDeskState> => {
    const { getSql } = await import("./db");
    const sql = await getSql();
    await requireDeskOwner(sql, context.userId);
    const current = await loadState(sql);
    if (current.payload) await insertBackup(sql, current.payload, "manual", "Before import");
    await writePayload(sql, data.payload);
    await insertBackup(sql, data.payload, "manual", data.note);
    return deskState(sql);
  });

export const runScheduledBackup = createServerFn({ method: "POST" })
  .validator((d: { payload?: SalonPayload } | undefined) => ({
    payload: d?.payload ? pickSalonPayload(d.payload) : null,
  }))
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<{ ran: boolean; lastBackupAt: string | null }> => {
    const { getSql } = await import("./db");
    const sql = await getSql();
    await requireDeskMember(sql, context.userId);
    const current = await loadState(sql);
    const last = await lastBackupAt(sql);
    if (!backupIsDue(last, current.backupCadence)) return { ran: false, lastBackupAt: last };
    const payload = data.payload ?? current.payload;
    if (!payload) return { ran: false, lastBackupAt: last };
    await writePayload(sql, payload);
    await insertBackup(sql, payload, "scheduled", current.backupCadence === "weekly" ? "Weekly" : "Daily");
    return { ran: true, lastBackupAt: await lastBackupAt(sql) };
  });

export const listSalonBackups = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<BackupSummary[]> => {
    const { getSql } = await import("./db");
    const sql = await getSql();
    await requireDeskOwner(sql, context.userId);
    const rows = await sql.query<BackupRow>(
      `select id, kind, note, payload, created_at from salon_backups order by created_at desc limit 30`,
    );
    return rows.map((row) => {
      const payload = payloadFromUnknown(row.payload);
      return {
        id: row.id,
        kind: row.kind === "scheduled" ? "scheduled" : "manual",
        note: row.note ?? "",
        createdAt: asIso(row.created_at) ?? new Date().toISOString(),
        clients: payload?.clients.length ?? 0,
        appointments: payload?.appointments.length ?? 0,
      };
    });
  });

export const getSalonBackup = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => {
    if (!d?.id) throw new Error("Missing backup.");
    return { id: String(d.id) };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<{ id: string; createdAt: string; payload: SalonPayload }> => {
    const { getSql } = await import("./db");
    const sql = await getSql();
    await requireDeskOwner(sql, context.userId);
    const rows = await sql.query<BackupRow>(
      `select id, kind, note, payload, created_at from salon_backups where id = $1 limit 1`,
      [data.id],
    );
    const row = rows[0];
    const payload = row ? payloadFromUnknown(row.payload) : null;
    if (!row || !payload) throw new Error("That backup is gone.");
    return { id: row.id, createdAt: asIso(row.created_at) ?? new Date().toISOString(), payload };
  });

export const restoreSalonBackup = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => {
    if (!d?.id) throw new Error("Missing backup.");
    return { id: String(d.id) };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<SalonDeskState> => {
    const { getSql } = await import("./db");
    const sql = await getSql();
    await requireDeskOwner(sql, context.userId);
    const current = await loadState(sql);
    if (current.payload) await insertBackup(sql, current.payload, "manual", "Before restore");
    const rows = await sql.query<BackupRow>(
      `select payload from salon_backups where id = $1 limit 1`,
      [data.id],
    );
    const payload = rows[0] ? payloadFromUnknown(rows[0].payload) : null;
    if (!payload) throw new Error("That backup is gone.");
    await writePayload(sql, payload);
    return deskState(sql);
  });

export const getPublicSalon = createServerFn({ method: "GET" }).handler(
  async (): Promise<{
    production: boolean;
    staff: SalonPayload["staff"] | null;
    services: SalonPayload["services"] | null;
    hours: SalonPayload["hours"] | null;
    products: SalonPayload["products"] | null;
    busy: BusySlot[];
  }> => {
    const { getSql } = await import("./db");
    const sql = await getSql();
    const state = await loadState(sql);
    if (!state.production || !state.payload || !hasSalonCatalog(state.payload)) {
      return { production: state.production, staff: null, services: null, hours: null, products: null, busy: [] };
    }
    return {
      production: true,
      staff: state.payload.staff,
      services: state.payload.services,
      hours: state.payload.hours,
      products: state.payload.products,
      busy: busyFromAppointments(state.payload.appointments),
    };
  },
);

export const recordPublicBooking = createServerFn({ method: "POST" })
  .validator((d: BookInput & { appointmentId?: string; clientId?: string }) => {
    const name = String(d?.name ?? "").trim();
    const phone = formatPhone(String(d?.phone ?? ""));
    const start = String(d?.start ?? "");
    const serviceId = String(d?.serviceId ?? "");
    const staffId = String(d?.staffId ?? "");
    if (!name || phone.replace(/\D/g, "").length < 10) throw new Error("Name and a 10-digit mobile are required.");
    if (!serviceId || !staffId || !start) throw new Error("Pick a service and a time.");
    if (Number.isNaN(Date.parse(start))) throw new Error("That time is not valid.");
    return {
      name,
      phone,
      email: String(d?.email ?? "").trim(),
      notes: String(d?.notes ?? "").trim(),
      serviceId,
      staffId,
      start,
      depositPaid: Boolean(d?.depositPaid),
      appointmentId: d?.appointmentId ? String(d.appointmentId) : "",
      clientId: d?.clientId ? String(d.clientId) : "",
    };
  })
  .handler(
    async ({
      data,
    }): Promise<{ ok: true; appointment: Appointment; client: Client } | { ok: false; error: string }> => {
      const { getSql } = await import("./db");
      const sql = await getSql();
      const state = await loadState(sql);
      if (!state.production || !state.payload) {
        return { ok: false, error: "Online booking is still in demo on this desk." };
      }
      const payload = structuredClone(state.payload);
      const svc = payload.services.find((s) => s.id === data.serviceId);
      const staff = payload.staff.find((s) => s.id === data.staffId);
      if (!svc || !staff) return { ok: false, error: "Choose a service and specialist." };
      if (!svc.staffIds.includes(staff.id)) return { ok: false, error: "That specialist does not offer this service." };
      const start = new Date(data.start);
      if (staffBusy(payload.appointments, staff.id, start, svc.durationMin)) {
        return { ok: false, error: "That time was just taken. Pick another slot." };
      }
      const key = data.phone.replace(/\D/g, "");
      let client = payload.clients.find((c) => c.phone.replace(/\D/g, "") === key);
      if (data.clientId) client = payload.clients.find((c) => c.id === data.clientId) ?? client;
      if (client) {
        client = {
          ...client,
          name: data.name || client.name,
          email: data.email || client.email,
          phone: data.phone || client.phone,
        };
        payload.clients = payload.clients.map((c) => (c.id === client!.id ? client! : c));
      } else {
        client = {
          id: data.clientId || nid(),
          name: data.name,
          phone: data.phone,
          email: data.email,
          notes: "",
          loyaltyPoints: 0,
          createdAt: new Date().toISOString(),
        };
        payload.clients = [client, ...payload.clients];
      }
      const appointment: Appointment = {
        id: data.appointmentId || nid(),
        clientId: client.id,
        staffId: staff.id,
        serviceId: svc.id,
        start: start.toISOString(),
        durationMin: svc.durationMin,
        status: "booked",
        notes: data.notes,
        depositPaid: data.depositPaid,
        createdAt: new Date().toISOString(),
      };
      payload.appointments = [...payload.appointments, appointment];
      await writePayload(sql, payload);
      return { ok: true, appointment, client };
    },
  );
