import { createServerFn } from "@tanstack/react-start";
import { hashPassword } from "better-auth/crypto";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  isStudioRole,
  parseStudioRole,
  type StudioRole,
} from "./roles";

export type StudioMember = {
  id: string;
  email: string;
  name: string;
  role: StudioRole;
  staffId: string | null;
};

export type StudioMemberRow = StudioMember & {
  userId: string | null;
  pending: boolean;
};

type MemberRecord = {
  id: string;
  user_id: string | null;
  email: string;
  name: string;
  role: string;
  staff_id: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SELECT_MEMBER = `id, user_id, email, name, role, staff_id`;

function normalizeEmail(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function asMember(row: MemberRecord): StudioMember {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: parseStudioRole(row.role),
    staffId: row.staff_id,
  };
}

function asRow(row: MemberRecord): StudioMemberRow {
  return {
    ...asMember(row),
    userId: row.user_id,
    pending: !row.user_id,
  };
}

class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

async function loadAuthUser(sql: Awaited<ReturnType<typeof import("./db").getSql>>, userId: string) {
  const rows = await sql<{ id: string; email: string; name: string }>`
    select id, email, name from "user" where id = ${userId} limit 1
  `;
  return rows[0] ?? null;
}

async function findMember(
  sql: Awaited<ReturnType<typeof import("./db").getSql>>,
  userId: string,
  email: string,
) {
  const fromId = await sql.query<MemberRecord>(
    `select ${SELECT_MEMBER} from studio_members where user_id = $1 limit 1`,
    [userId],
  );
  if (fromId[0]) return fromId[0];
  if (!email) return null;
  const fromEmail = await sql.query<MemberRecord>(
    `select ${SELECT_MEMBER} from studio_members where lower(email) = $1 limit 1`,
    [email],
  );
  return fromEmail[0] ?? null;
}

async function ownerCount(sql: Awaited<ReturnType<typeof import("./db").getSql>>) {
  const rows = await sql<{ n: number }>`select count(*)::int as n from studio_members where role = ${"owner"}`;
  return rows[0]?.n ?? 0;
}

async function requireOwner(
  sql: Awaited<ReturnType<typeof import("./db").getSql>>,
  userId: string,
) {
  const access = await resolveMember(sql, userId);
  if (!access || access.role !== "owner") throw new ForbiddenError("Only the owner can change desk access.");
  return access;
}

async function resolveMember(
  sql: Awaited<ReturnType<typeof import("./db").getSql>>,
  userId: string,
): Promise<StudioMember | null> {
  const authUser = await loadAuthUser(sql, userId);
  const email = normalizeEmail(authUser?.email);
  const existing = await findMember(sql, userId, email);
  if (existing) {
    if (!existing.user_id) {
      await sql.query(
        `update studio_members set user_id = $1, name = case when name = '' then $2 else name end, updated_at = now() where id = $3`,
        [userId, authUser?.name ?? existing.name, existing.id],
      );
      return asMember({
        ...existing,
        user_id: userId,
        name: existing.name || authUser?.name || existing.name,
      });
    }
    return asMember(existing);
  }

  const countRows = await sql<{ n: number }>`select count(*)::int as n from studio_members`;
  if ((countRows[0]?.n ?? 0) > 0) return null;

  const id = crypto.randomUUID();
  const memberEmail = email || `${userId}@studio.local`;
  const name = authUser?.name?.trim() || "Owner";
  await sql.query(
    `insert into studio_members (id, user_id, email, name, role) values ($1, $2, $3, $4, $5)`,
    [id, userId, memberEmail, name, "owner"],
  );
  return { id, email: memberEmail, name, role: "owner", staffId: null };
}

async function ensureCredentialUser(
  sql: Awaited<ReturnType<typeof import("./db").getSql>>,
  email: string,
  name: string,
  password: string,
) {
  const existing = await sql.query<{ id: string }>(`select id from "user" where lower(email) = $1 limit 1`, [email]);
  if (existing[0]) return existing[0].id;
  const userId = crypto.randomUUID();
  const hash = await hashPassword(password);
  await sql.query(
    `insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") values ($1, $2, $3, true, now(), now())`,
    [userId, name, email],
  );
  await sql.query(
    `insert into "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") values ($1, $2, $3, $4, $5, now(), now())`,
    [crypto.randomUUID(), userId, "credential", userId, hash],
  );
  return userId;
}

export const deskIsClaimed = createServerFn({ method: "POST" }).handler(async (): Promise<{ claimed: boolean }> => {
  const { getSql } = await import("./db");
  const sql = await getSql();
  const members = await sql<{ n: number }>`select count(*)::int as n from studio_members`;
  if ((members[0]?.n ?? 0) > 0) return { claimed: true };
  // First email / Google / X login also claims the desk, even before the owner
  // row is written. Gate-only viewer sessions are ignored.
  const accounts = await sql<{ n: number }>`
    select count(*)::int as n from "account"
    where "providerId" in (${"credential"}, ${"grok-google"}, ${"grok-x"})
  `;
  return { claimed: (accounts[0]?.n ?? 0) > 0 };
});

export const getMyStudioAccess = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ member: StudioMember | null }> => {
    const { getSql } = await import("./db");
    const sql = await getSql();
    const member = await resolveMember(sql, context.userId);
    return { member };
  });

export const listStudioMembers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<StudioMemberRow[]> => {
    const { getSql } = await import("./db");
    const sql = await getSql();
    await requireOwner(sql, context.userId);
    const rows = await sql.query<MemberRecord>(
      `select ${SELECT_MEMBER} from studio_members order by case role when 'owner' then 0 when 'manager' then 1 when 'desk' then 2 else 3 end, name, email`,
    );
    return rows.map(asRow);
  });

export const inviteStudioMember = createServerFn({ method: "POST" })
  .validator((d: { email: string; name?: string; role: StudioRole; staffId?: string | null; password: string }) => {
    const email = normalizeEmail(d.email);
    if (!EMAIL_RE.test(email)) throw new Error("Enter a valid email.");
    if (!isStudioRole(d.role)) throw new Error("Choose a desk role.");
    const password = String(d.password ?? "");
    if (password.length < 8) throw new Error("Set a password of at least 8 characters.");
    return {
      email,
      name: String(d.name ?? "").trim(),
      role: d.role,
      staffId: d.staffId ? String(d.staffId) : null,
      password,
    };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<StudioMemberRow> => {
    const { getSql } = await import("./db");
    const sql = await getSql();
    await requireOwner(sql, context.userId);
    const dup = await sql.query<MemberRecord>(
      `select ${SELECT_MEMBER} from studio_members where lower(email) = $1 limit 1`,
      [data.email],
    );
    if (dup[0]) throw new Error("That email is already on the desk.");
    const id = crypto.randomUUID();
    const name = data.name || data.email.split("@")[0] || "Staff";
    const userId = await ensureCredentialUser(sql, data.email, name, data.password);
    await sql.query(
      `insert into studio_members (id, user_id, email, name, role, staff_id) values ($1, $2, $3, $4, $5, $6)`,
      [id, userId, data.email, name, data.role, data.staffId],
    );
    return {
      id,
      email: data.email,
      name,
      role: data.role,
      staffId: data.staffId,
      userId,
      pending: false,
    };
  });

export const updateStudioMember = createServerFn({ method: "POST" })
  .validator((d: { id: string; name?: string; role: StudioRole; staffId?: string | null }) => {
    if (!d.id) throw new Error("Missing member.");
    if (!isStudioRole(d.role)) throw new Error("Choose a desk role.");
    return {
      id: String(d.id),
      name: d.name != null ? String(d.name).trim() : undefined,
      role: d.role,
      staffId: d.staffId ? String(d.staffId) : null,
    };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<StudioMemberRow> => {
    const { getSql } = await import("./db");
    const sql = await getSql();
    await requireOwner(sql, context.userId);
    const rows = await sql.query<MemberRecord>(
      `select ${SELECT_MEMBER} from studio_members where id = $1 limit 1`,
      [data.id],
    );
    const current = rows[0];
    if (!current) throw new Error("That login is no longer on the desk.");
    if (current.role === "owner" && data.role !== "owner" && (await ownerCount(sql)) <= 1) {
      throw new Error("Keep at least one owner.");
    }
    const name = data.name ?? current.name;
    await sql.query(
      `update studio_members set name = $1, role = $2, staff_id = $3, updated_at = now() where id = $4`,
      [name, data.role, data.staffId, data.id],
    );
    return asRow({ ...current, name, role: data.role, staff_id: data.staffId });
  });

export const removeStudioMember = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => {
    if (!d?.id) throw new Error("Missing member.");
    return { id: String(d.id) };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { getSql } = await import("./db");
    const sql = await getSql();
    await requireOwner(sql, context.userId);
    const rows = await sql.query<MemberRecord>(
      `select ${SELECT_MEMBER} from studio_members where id = $1 limit 1`,
      [data.id],
    );
    const current = rows[0];
    if (!current) return { ok: true };
    if (current.role === "owner" && (await ownerCount(sql)) <= 1) {
      throw new Error("Keep at least one owner.");
    }
    await sql.query(`delete from studio_members where id = $1`, [data.id]);
    return { ok: true };
  });
