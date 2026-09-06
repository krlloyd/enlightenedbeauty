import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { redirectToLoginIfRequired } from "@/lib/app-data";
import { dateLabel, timeLabel } from "@/lib/format";
import {
  CLOUD_KIND_LABEL,
  CLOUD_KINDS,
  type CloudKind,
} from "@/lib/salon-cloud-kinds";
import {
  connectDriveFolder,
  getCloudStatus,
  refreshCloudIndex,
  restoreCloudCopy,
  saveCloudSettings,
  sendCloudCopy,
  type CloudStatus,
} from "@/lib/salon-cloud";
import {
  createSalonBackup,
  getSalonBackup,
  getSalonDesk,
  importSalonBackup,
  listSalonBackups,
  restoreSalonBackup,
  setBackupCadence,
  setSalonLive,
  type BackupSummary,
} from "@/lib/salon-ops";
import { BACKUP_CADENCES, CADENCE_LABEL, pickSalonPayload, type BackupCadence, type SalonPayload } from "@/lib/salon-payload";
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
  const [cloud, setCloud] = useState<CloudStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmLive, setConfirmLive] = useState(false);

  async function refreshList() {
    const list = await listSalonBackups();
    setRows(list);
    setLastBackupAt(list[0]?.createdAt ?? null);
  }

  async function refreshCloud() {
    const next = await getCloudStatus();
    setCloud(next);
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
      try {
        await refreshCloud();
      } catch {
        /* owner-only */
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
      await refreshCloud().catch(() => undefined);
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
      const next = await getCloudStatus().catch(() => null);
      if (next) setCloud(next);
      toast.success(next?.error ? "Backup saved on the desk. Cloud copy failed." : "Backup saved.");
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

      <CloudCopies
        busy={busy}
        setBusy={setBusy}
        cloud={cloud}
        setCloud={setCloud}
        snapshot={snapshot}
        applyDesk={applyDesk}
      />

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

function asLogin(status: CloudStatus) {
  return {
    ok: false as const,
    data: null,
    loginRequired: status.loginRequired,
    loginUrl: status.loginUrl ?? undefined,
  };
}

function CloudCopies({
  busy,
  setBusy,
  cloud,
  setCloud,
  snapshot,
  applyDesk,
}: {
  busy: boolean;
  setBusy: (v: boolean) => void;
  cloud: CloudStatus | null;
  setCloud: (v: CloudStatus) => void;
  snapshot: () => SalonPayload | null;
  applyDesk: (next: { production: boolean; payload: SalonPayload | null }) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<CloudKind>("off");
  const [autoUpload, setAutoUpload] = useState(true);
  const [endpoint, setEndpoint] = useState("");
  const [region, setRegion] = useState("auto");
  const [bucket, setBucket] = useState("");
  const [prefix, setPrefix] = useState("enlightened-beauty");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");

  useEffect(() => {
    if (!cloud) return;
    setKind(cloud.kind);
    setAutoUpload(cloud.autoUpload);
    setEndpoint(cloud.s3.endpoint);
    setRegion(cloud.s3.region);
    setBucket(cloud.s3.bucket);
    setPrefix(cloud.s3.prefix);
    setAccessKeyId(cloud.s3.accessKeyId);
  }, [cloud]);

  async function pickKind(next: CloudKind) {
    setKind(next);
    if (next === "drive") {
      setBusy(true);
      try {
        const status = await connectDriveFolder();
        if (redirectToLoginIfRequired(asLogin(status))) return;
        setCloud(status);
        if (status.loginRequired) {
          toast.message("Continue with Grok so Drive can receive copies.");
          return;
        }
        toast.success("Copies will go to Google Drive, in Enlightened Beauty backups.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not connect Drive.");
        setKind(cloud?.kind ?? "off");
      } finally {
        setBusy(false);
      }
      return;
    }
    if (next === "off") {
      setBusy(true);
      try {
        const status = await saveCloudSettings({ data: { kind: "off", autoUpload } });
        setCloud(status);
        toast.success("Off-site copies are off. Desk backups still run.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update cloud copies.");
        setKind(cloud?.kind ?? "off");
      } finally {
        setBusy(false);
      }
    }
  }

  async function saveBucket() {
    setBusy(true);
    try {
      const status = await saveCloudSettings({
        data: {
          kind: "s3",
          autoUpload,
          s3: { endpoint, region, bucket, prefix, accessKeyId, secretAccessKey },
        },
      });
      setCloud(status);
      setSecretAccessKey("");
      toast.success("Bucket saved. New backups will send a copy there.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the bucket.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAuto(next: boolean) {
    setAutoUpload(next);
    if (kind === "off") return;
    if (kind === "s3" && cloud?.kind !== "s3") return;
    try {
      const status = await saveCloudSettings({
        data: {
          kind,
          autoUpload: next,
          s3: { endpoint, region, bucket, prefix, accessKeyId, secretAccessKey },
        },
      });
      setCloud(status);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save that setting.");
    }
  }

  async function sendNow() {
    const payload = snapshot();
    if (!payload) {
      toast.error("Nothing to send yet.");
      return;
    }
    setBusy(true);
    try {
      const status = await sendCloudCopy({ data: { payload, note: "Sent from Settings" } });
      if (redirectToLoginIfRequired(asLogin(status))) return;
      setCloud(status);
      toast.success("Copy sent off-site.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send that copy.");
    } finally {
      setBusy(false);
    }
  }

  async function refreshRemote() {
    setBusy(true);
    try {
      const status = await refreshCloudIndex();
      if (redirectToLoginIfRequired(asLogin(status))) return;
      setCloud(status);
      toast.success(
        status.files.length
          ? `Off-site copies now match what's in ${kind === "s3" ? "the bucket" : "Drive"} (${status.files.length}).`
          : "Nothing left off-site. The list is clear.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not refresh off-site copies.");
    } finally {
      setBusy(false);
    }
  }

  async function restoreRemote(id: string) {
    if (!window.confirm("Replace the live book with this off-site copy?")) return;
    setBusy(true);
    try {
      const payload = await restoreCloudCopy({ data: { id } });
      const next = await importSalonBackup({ data: { payload, note: "Restored from cloud" } });
      applyDesk({ production: next.production, payload: next.payload });
      toast.success("Off-site copy restored.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not restore that copy.");
    } finally {
      setBusy(false);
    }
  }

  async function importFile(file: File) {
    setBusy(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const payload = pickSalonPayload((parsed ?? {}) as Parameters<typeof pickSalonPayload>[0]);
      if (!payload) throw new Error("That file is not a salon backup.");
      const next = await importSalonBackup({ data: { payload, note: `Imported ${file.name}` } });
      applyDesk({ production: next.production, payload: next.payload });
      toast.success("Backup imported onto the desk.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not import that file.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <section className="mt-6 rounded-2xl bg-card p-5 shadow-[var(--shadow-border)]">
      <h2 className="font-serif text-2xl">Cloud copies</h2>
      <p className="mt-1 max-w-xl text-sm text-muted-foreground">
        Send a private copy off this server so a wipe doesn’t take the book with it. Google Drive is for this Grok
        preview. A bucket (Amazon S3, Cloudflare R2, Backblaze) is for your own server. Files are never public links.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label="Destination">
          <NativeSelect value={kind} disabled={busy} onChange={(e) => void pickKind(e.target.value as CloudKind)}>
            {CLOUD_KINDS.map((c) => (
              <option key={c} value={c}>
                {CLOUD_KIND_LABEL[c]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <label className="flex h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={autoUpload}
            disabled={busy || kind === "off"}
            onChange={(e) => void saveAuto(e.target.checked)}
          />
          Send with each backup
        </label>
      </div>

      {kind === "drive" ? (
        <div className="mt-4 rounded-xl bg-muted/40 p-4">
          <p className="text-sm">
            {cloud?.driveFolderName
              ? `Folder: ${cloud.driveFolderName}`
              : "Creates a Drive folder named Enlightened Beauty backups."}
          </p>
          {cloud?.loginRequired ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Continue with Grok so this desk can write into your Drive. On your own server, use a bucket instead.
            </p>
          ) : null}
          {cloud?.error ? <p className="mt-2 text-sm text-destructive">{cloud.error}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {cloud?.loginRequired && cloud.loginUrl ? (
              <Button type="button" onClick={() => redirectToLoginIfRequired(asLogin(cloud))}>
                Continue with Grok
              </Button>
            ) : null}
            <Button type="button" variant="outline" disabled={busy} onClick={() => void sendNow()}>
              Send a copy now
            </Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => void refreshRemote()}>
              Refresh from Drive
            </Button>
          </div>
        </div>
      ) : null}

      {kind === "s3" ? (
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void saveBucket();
          }}
        >
          <Field label="Bucket" className="sm:col-span-2">
            <Input value={bucket} onChange={(e) => setBucket(e.target.value)} required autoComplete="off" />
          </Field>
          <Field label="Region">
            <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="auto" autoComplete="off" />
          </Field>
          <Field label="Prefix">
            <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Endpoint" className="sm:col-span-2">
            <Input
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="Leave blank for Amazon S3"
              autoComplete="off"
            />
          </Field>
          <Field label="Access key">
            <Input value={accessKeyId} onChange={(e) => setAccessKeyId(e.target.value)} required autoComplete="off" />
          </Field>
          <Field label="Secret">
            <Input
              type="password"
              value={secretAccessKey}
              onChange={(e) => setSecretAccessKey(e.target.value)}
              placeholder={cloud?.s3.secretSet ? "Saved — type to replace" : ""}
              autoComplete="new-password"
            />
          </Field>
          {cloud?.error ? <p className="text-sm text-destructive sm:col-span-2">{cloud.error}</p> : null}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" disabled={busy}>
              Save bucket
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => void sendNow()}>
              Send a copy now
            </Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => void refreshRemote()}>
              Refresh from bucket
            </Button>
          </div>
        </form>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importFile(file);
          }}
        />
        <Button type="button" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
          Import JSON
        </Button>
        <p className="text-xs text-muted-foreground">
          Restore a downloaded JSON, or refresh the list after files were deleted in Drive or the bucket.
        </p>
      </div>

      {cloud?.files.length ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {cloud.lastCloudAt
            ? `Last off-site copy ${dateLabel(cloud.lastCloudAt)} at ${timeLabel(cloud.lastCloudAt)}.`
            : "Copies currently in Drive or the bucket."}
        </p>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">No off-site copies yet.</p>
      )}

      {cloud?.files.length ? (
        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl bg-muted/40">
          {cloud.files.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div>
                <p className="text-sm font-medium">{row.name}</p>
                <p className="text-xs text-muted-foreground">
                  {CLOUD_KIND_LABEL[row.kind]} · {dateLabel(row.createdAt)} · {row.clients} clients
                </p>
              </div>
              <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void restoreRemote(row.id)}>
                Restore
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
