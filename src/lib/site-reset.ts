import { createServerFn } from "@tanstack/react-start";

/** Wipe logins, desk access, backups, and live-mode so the first owner can sign up again. */
export async function wipeSiteData() {
  const { getSql } = await import("./db");
  const sql = await getSql();
  const statements = [
    `delete from salon_backups`,
    `delete from studio_members`,
    `update salon_state set production = false, backup_cadence = 'daily', payload = '{}'::jsonb, updated_at = now() where id = 'salon'`,
    `insert into salon_state (id) values ('salon') on conflict (id) do nothing`,
    `delete from "session"`,
    `delete from "account"`,
    `delete from "verification"`,
    `delete from "user"`,
  ];
  for (const text of statements) {
    try {
      await sql.query(text);
    } catch (err) {
      console.warn("[site-reset] skipped:", text, err);
    }
  }
}

export const resetSiteData = createServerFn({ method: "POST" }).handler(async (): Promise<{ ok: true }> => {
  await wipeSiteData();
  return { ok: true };
});
