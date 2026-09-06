import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { matchClient, parseVagaroSheet, type ImportMode, type VagaroParseResult } from "@/lib/vagaro-import";
import { useSalon } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Dialog, DialogContent } from "./ui/dialog";

export function VagaroImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const clients = useSalon((s) => s.clients);
  const importClients = useSalon((s) => s.importClients);
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<VagaroParseResult | null>(null);
  const [mode, setMode] = useState<ImportMode>("merge");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const matches = parsed?.rows.filter((row) => matchClient(clients, row)).length ?? 0;

  function reset() {
    setFileName("");
    setParsed(null);
    setMode("merge");
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function readFile(file: File) {
    setBusy(true);
    setError("");
    try {
      const buffer = await file.arrayBuffer();
      const result = parseVagaroSheet(buffer);
      setFileName(file.name);
      setParsed(result);
      if (result.rows.length === 0 && result.skipped.length) {
        setError(result.skipped[0]?.reason || "No clients found.");
      }
    } catch {
      setParsed(null);
      setError("Could not read that spreadsheet. Export Excel or CSV from Vagaro and try again.");
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    if (!parsed?.rows.length) return;
    const result = importClients(parsed.rows, mode);
    const parts = [
      result.added ? `${result.added} new` : "",
      result.updated ? `${result.updated} updated` : "",
      result.skipped ? `${result.skipped} skipped` : "",
    ].filter(Boolean);
    toast.success(parts.length ? `Imported ${parts.join(", ")}.` : "Nothing to import.");
    reset();
    onClose();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent title="Import from Vagaro" className="max-h-[min(88dvh,760px)] overflow-y-auto">
        <p className="mt-2 text-sm text-muted-foreground">
          In Vagaro: Reports → Customers → Export → Excel. Drop the spreadsheet here. CSV works too.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xls,.xlsx,.tsv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void readFile(file);
          }}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) void readFile(file);
          }}
          className="mt-4 flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-secondary/40 px-4 py-8 text-center hover:bg-accent"
        >
          <Upload className="size-5 text-primary" />
          <span className="text-sm font-medium">{busy ? "Reading…" : "Drop Vagaro Excel or CSV"}</span>
          <span className="text-xs text-muted-foreground">{fileName || "Name, Email, Mobile, Customer Since, Points Earned…"}</span>
        </button>

        <p className="mt-3 text-xs text-muted-foreground">
          Need a trial file?{" "}
          <a href="/samples/vagaro-customers.csv" download className="text-foreground underline-offset-2 hover:underline">
            Download a sample Customer List
          </a>
        </p>

        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

        {parsed && parsed.rows.length > 0 ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm">
              {parsed.rows.length} ready
              {matches ? ` · ${matches} already in the file` : ""}
              {parsed.skipped.length ? ` · ${parsed.skipped.length} skipped` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["merge", "Update matches"],
                  ["skip", "Skip matches"],
                  ["add", "Add all as new"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={cn(
                    "min-h-10 rounded-full px-3.5 text-sm shadow-[var(--shadow-border)]",
                    mode === value ? "bg-foreground text-background" : "bg-card hover:bg-accent",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-xl bg-background">
              {parsed.rows.slice(0, 12).map((row) => (
                <li key={`${row.line}-${row.email}-${row.phone}`} className="px-3 py-2 text-sm">
                  <p className="font-medium">{row.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.phone || "no mobile"} · {row.email || "no email"}
                    {matchClient(clients, row) ? " · match" : ""}
                  </p>
                </li>
              ))}
            </ul>
            {parsed.rows.length > 12 ? (
              <p className="text-xs text-muted-foreground">Showing first 12 of {parsed.rows.length}.</p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Dismiss
          </Button>
          <Button type="button" variant="ink" disabled={!parsed?.rows.length || busy} onClick={apply}>
            Import
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
