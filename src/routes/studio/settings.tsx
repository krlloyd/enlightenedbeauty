import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { dateLabel, timeLabel } from "@/lib/format";
import {
  createSalonBackup,
  getSalonBackup,
  getSalonDesk,
  listSalonBackups,
  restoreSalonBackup,
  setBackupCadence,
  setSalonLive,
  type BackupSummary,
} from "@/lib/salon-ops";
import { BACKUP_CADENCES, CADENCE_LABEL, type BackupCadence } from "@/lib/salon-payload";
import { useSalon } from "@/lib/store";
import { useStudioAccess } from "@/lib/studio-access";

export const Route = createFileRoute("/studio/settings")({ component: SettingsPage });

function SettingsPage() {
  const { reload } = useStudioAccess();
  const production = useSalon((s) => s.production);
  const snapshot = useSalon((s) => s.snapshot);
  const applyDesk = useSalon((s) => s.applyDesk);
  const [cadence, setCadence] = useState<BackupCadence>("daily");
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [rows, setRows] = useState<BackupSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmLive, setConfirmLive] = useState(false);

  async function refreshList() {
    const list = await listSalonBackups();
    setRows(list);
    setLastBackupAt(list[0]?.createdAt ?? null);
  }

  useEffect(() => {
    void (async () => {
      try {
        const desk = await getSalonDesk();
        setCadence(desk.backupCadence);
        setLastBackupAt(desk.lastBackupAt);
      } catch {
        /* desk row not ready */
      }
      try {
        await refreshList();
      } catch {
        /* empty until first backup */
      }
    })();
  }, []);

  async function goLive() {
    setBusy(true);
    try {
      const payload = snapshot();
      if (!payload) throw new Error("The desk is empty.");
      const next = await setSalonLive({ data: { production: true, payload, clearDemo: true } });
      applyDesk({ production: next.production, payload: next.payload });
      setCadence(next.backupCadence);
      setLastBackupAt(next.lastBackupAt);
      await refreshList();
      reload();
      toast.success("The desk is live. Sample visits are off the book.");
      setConfirmLive(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not go live.");
    } finally {
      setBusy(false);
    }
  }

  async function backToDemo() {
    setBusy(true);
    try {
      const payload = snapshot();
      const next = await setSalonLive({ data: { production: false, payload: payload ?? undefined } });
      applyDesk({ production: next.production, payload: next.payload });
      toast.success("Demo mode is back. Reset in the header restores sample visits.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not switch.");
    } finally {
      setBusy(false);
    }
  }

  async function saveCadence(next: BackupCadence) {
    setCadence(next);
    try {
      await setBackupCadence({ data: { cadence: next } });
      toast.success(next === "off" ? "Scheduled backups are off." : `Backups run ${CADENCE_LABEL[next].toLowerCase()}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the schedule.");
    }
  }

  async function backupNow() {
    setBusy(true);
    try {
      const payload = snapshot();
      if (!payload) throw new Error("Nothing to back up yet.");
      await createSalonBackup({ data: { payload, note: "Manual backup" } });
      await refreshList();
      toast.success("Backup saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save a backup.");
    } finally {
      setBusy(false);
    }
  }

  async function restore(id: string) {
    if (!window.confirm("Replace the live book with this backup?")) return;
    setBusy(true);
    try {
      const next = await restoreSalonBackup({ data: { id } });
      applyDesk({ production: next.production, payload: next.payload });
      await refreshList();
      toast.success("Backup restored.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not restore that backup.");
    } finally {
      setBusy(false);
    }
  }

  async function download(id: string) {
    try {
      const file = await getSalonBackup({ data: { id } });
      const blob = new Blob([JSON.stringify(file.payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `enlightened-beauty-${file.createdAt.slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not download that backup.");
    }
  }

  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Owner</p>
      <h1 className="font-serif text-3xl font-medium">Studio settings</h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Live mode turns off sample clients and the reset button. Backups copy the book, clients, tickets, and menu.
      </p>

      <section className="mt-6 rounded-2xl bg-card p-5 shadow-[var(--shadow-border)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl">Mode</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {production
                ? "The public site and the desk are treating this as the real book."
                : "Sample clients, visits, and the EB-KATE gift card are on the book so you can click around."}
            </p>
          </div>
          <Badge variant={production ? "success" : "warning"}>{production ? "Live" : "Demo"}</Badge>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {production ? (
            <Button type="button" variant="outline" disabled={busy} onClick={() => void backToDemo()}>
              Switch back to demo
            </Button>
          ) : (
            <Button type="button" disabled={busy} onClick={() => setConfirmLive(true)}>
              Go live
            </Button>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-2xl bg-card p-5 shadow-[var(--shadow-border)]">
        <h2 className="font-serif text-2xl">Backups</h2>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          A copy is saved on this schedule whenever someone is signed in at the desk. Last thirty copies are kept.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Schedule">
            <NativeSelect
              value={cadence}
              onChange={(e) => void saveCadence(e.target.value as BackupCadence)}
              disabled={busy}
            >
              {BACKUP_CADENCES.map((c) => (
                <option key={c} value={c}>
                  {CADENCE_LABEL[c]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Button type="button" variant="outline" disabled={busy} onClick={() => void backupNow()}>
            {busy ? "Working…" : "Back up now"}
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {lastBackupAt
            ? `Last copy ${dateLabel(lastBackupAt)} at ${timeLabel(lastBackupAt)}.`
            : "No copies yet."}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-2xl">Saved copies</h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nothing stored yet. Take one now or wait for the schedule.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-border)]">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">
                    {dateLabel(row.createdAt)} · {timeLabel(row.createdAt)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {row.note || (row.kind === "scheduled" ? "Scheduled" : "Manual")} · {row.clients} clients ·{" "}
                    {row.appointments} visits
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => void download(row.id)}>
                    Download
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => void restore(row.id)}>
                    Restore
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={confirmLive} onOpenChange={setConfirmLive}>
        <DialogContent title="Go live?">
          <p className="mt-3 text-sm text-muted-foreground">
            We’ll save a backup first, then remove sample clients, fake visits, tickets, and the EB-KATE gift card. Your
            menu, team, hours, and real bookings stay.
          </p>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmLive(false)}>
              Stay in demo
            </Button>
            <Button type="button" disabled={busy} onClick={() => void goLive()}>
              {busy ? "Switching…" : "Go live"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
