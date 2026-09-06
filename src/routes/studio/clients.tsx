import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { VagaroImportDialog } from "@/components/vagaro-import-dialog";
import { formatPhone, money, whenLabel } from "@/lib/format";
import { useSalon } from "@/lib/store";
import type { Client } from "@/lib/types";

export const Route = createFileRoute("/studio/clients")({ component: ClientsPage });

function ClientsPage() {
  const clients = useSalon((s) => s.clients);
  const appointments = useSalon((s) => s.appointments);
  const services = useSalon((s) => s.services);
  const upsert = useSalon((s) => s.upsertClient);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(n) ||
        c.phone.replace(/\D/g, "").includes(n.replace(/\D/g, "")) ||
        c.email.toLowerCase().includes(n),
    );
  }, [clients, q]);

  function startNew() {
    setEditing(null);
    setForm({ name: "", phone: "", email: "", notes: "" });
    setOpen(true);
  }

  function startEdit(c: Client) {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone, email: c.email, notes: c.notes });
    setOpen(true);
  }

  function save(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Name is required.");
      return;
    }
    upsert({ ...form, phone: formatPhone(form.phone), id: editing?.id });
    toast.success(editing ? "Client updated" : "Client added");
    setOpen(false);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">File</p>
          <h1 className="font-serif text-3xl font-medium">Clients</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            Import Vagaro
          </Button>
          <Button onClick={startNew}>New client</Button>
        </div>
      </div>
      <Input
        className="mt-5 max-w-md"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name, mobile, email"
      />
      <ul className="mt-5 divide-y divide-border overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-border)]">
        {filtered.map((c) => {
          const hist = appointments.filter((a) => a.clientId === c.id);
          const last = hist.sort((a, b) => +new Date(b.start) - +new Date(a.start))[0];
          return (
            <li key={c.id}>
              <button type="button" onClick={() => startEdit(c)} className="flex w-full flex-col gap-1 px-5 py-4 text-left sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {c.phone} · {c.email || "no email"}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Badge>{c.loyaltyPoints} pts</Badge>
                  <span className="text-muted-foreground">
                    {last ? `${services.find((s) => s.id === last.serviceId)?.name} · ${whenLabel(last.start)}` : "No visits yet"}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={editing ? editing.name : "New client"}>
          <form onSubmit={save} className="mt-4 flex flex-col gap-3">
            <Field label="Name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Mobile">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })} />
            </Field>
            <Field label="Email">
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Notes">
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            {editing ? (
              <p className="text-sm text-muted-foreground">Loyalty {editing.loyaltyPoints} pts · {money(editing.loyaltyPoints / 10)} in banked value</p>
            ) : null}
            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Dismiss
              </Button>
              <Button type="submit" variant="ink">
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <VagaroImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
