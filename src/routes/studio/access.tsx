import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { ROLE_BLURB, ROLE_LABEL, STUDIO_ROLES, type StudioRole } from "@/lib/roles";
import { useStudioAccess } from "@/lib/studio-access";
import {
  inviteStudioMember,
  listStudioMembers,
  removeStudioMember,
  updateStudioMember,
  type StudioMemberRow,
} from "@/lib/studio-members";
import { useSalon } from "@/lib/store";

export const Route = createFileRoute("/studio/access")({ component: AccessPage });

function AccessPage() {
  const staff = useSalon((s) => s.staff);
  const { member: me, reload } = useStudioAccess();
  const [rows, setRows] = useState<StudioMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", role: "desk" as StudioRole, staffId: "", password: "" });

  async function refresh() {
    const next = await listStudioMembers();
    setRows(next);
    setLoading(false);
  }

  useEffect(() => {
    void refresh().catch((err) => {
      toast.error(err instanceof Error ? err.message : "Could not load access.");
      setLoading(false);
    });
  }, []);

  async function invite(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await inviteStudioMember({
        data: {
          email: form.email,
          name: form.name,
          role: form.role,
          staffId: form.staffId || null,
          password: form.password,
        },
      });
      toast.success("They're on the desk. They sign in with that email and password.");
      setForm({ email: "", name: "", role: "desk", staffId: "", password: "" });
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add that login.");
    } finally {
      setBusy(false);
    }
  }

  async function patch(row: StudioMemberRow, next: Partial<Pick<StudioMemberRow, "role" | "staffId" | "name">>) {
    try {
      await updateStudioMember({
        data: {
          id: row.id,
          name: next.name ?? row.name,
          role: next.role ?? row.role,
          staffId: next.staffId === undefined ? row.staffId : next.staffId,
        },
      });
      await refresh();
      if (row.id === me?.id) reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update that login.");
    }
  }

  async function remove(row: StudioMemberRow) {
    try {
      await removeStudioMember({ data: { id: row.id } });
      toast.success("Removed from the desk.");
      await refresh();
      if (row.id === me?.id) reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove that login.");
    }
  }

  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Security</p>
      <h1 className="font-serif text-3xl font-medium">Desk access</h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Sign-in is real. Only people you add here can open the studio. After the first login, Studio login is email and password only.
      </p>

      <form onSubmit={(e) => void invite(e)} className="mt-6 rounded-2xl bg-card p-5 shadow-[var(--shadow-border)]">
        <h2 className="font-serif text-2xl">Add someone</h2>
        <p className="mt-1 text-sm text-muted-foreground">They sign in on Studio login with this email and password.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Email">
            <Input
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="name@enlightenedbeauty.salon"
            />
          </Field>
          <Field label="Name">
            <Input
              value={form.name}
              autoComplete="name"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Optional"
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="At least 8 characters"
            />
          </Field>
          <Field label="Role">
            <NativeSelect value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as StudioRole })}>
              {STUDIO_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABEL[role]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Chair">
            <NativeSelect value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })}>
              <option value="">No chair</option>
              {staff.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{ROLE_BLURB[form.role]}</p>
        <Button type="submit" className="mt-4" disabled={busy}>
          {busy ? "Adding…" : "Add to desk"}
        </Button>
      </form>

      <section className="mt-8">
        <h2 className="font-serif text-2xl">On the desk</h2>
        {loading ? (
          <div className="mt-4 h-32 animate-pulse rounded-2xl bg-card" />
        ) : (
          <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-border)]">
            {rows.map((row) => (
              <li key={row.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="font-medium">
                    {row.name || row.email}
                    {row.id === me?.id ? <span className="ml-2 text-xs text-muted-foreground">you</span> : null}
                  </p>
                  <p className="text-sm text-muted-foreground">{row.email}</p>
                  {row.pending ? (
                    <Badge variant="warning" className="mt-2">
                      Waiting to sign in
                    </Badge>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <NativeSelect
                    className="w-[10.5rem]"
                    value={row.role}
                    onChange={(e) => void patch(row, { role: e.target.value as StudioRole })}
                  >
                    {STUDIO_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABEL[role]}
                      </option>
                    ))}
                  </NativeSelect>
                  <NativeSelect
                    className="w-[10.5rem]"
                    value={row.staffId ?? ""}
                    onChange={(e) => void patch(row, { staffId: e.target.value || null })}
                  >
                    <option value="">No chair</option>
                    {staff.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name.split(" ")[0]}
                      </option>
                    ))}
                  </NativeSelect>
                  <Button type="button" size="sm" variant="ghost" onClick={() => void remove(row)}>
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
