import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { durationLabel, money, whenLabel } from "@/lib/format";
import { statusMeta } from "@/lib/status";
import { clientById, useSalon } from "@/lib/store";
import { useStudioAccess } from "@/lib/studio-access";
import type { Appointment, AppointmentStatus } from "@/lib/types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Sheet, SheetContent } from "./ui/sheet";
import { Textarea } from "./ui/input";

export function AppointmentDrawer({
  appointment,
  onClose,
}: {
  appointment: Appointment | null;
  onClose: () => void;
  onCheckout?: () => void;
}) {
  const live = useSalon((s) => s.appointments.find((x) => x.id === appointment?.id));
  const a = live ?? appointment;
  const clients = useSalon((s) => s.clients);
  const services = useSalon((s) => s.services);
  const staffList = useSalon((s) => s.staff);
  const setStatus = useSalon((s) => s.setStatus);
  const updateNotes = useSalon((s) => s.updateNotes);
  const cancel = useSalon((s) => s.cancel);
  const { can } = useStudioAccess();

  const client = a ? clientById(clients, a.clientId) : undefined;
  const svc = a ? services.find((s) => s.id === a.serviceId) : undefined;
  const staff = a ? staffList.find((s) => s.id === a.staffId) : undefined;
  const meta = a ? statusMeta(a.status) : null;

  function go(status: AppointmentStatus) {
    if (!a) return;
    setStatus(a.id, status);
    toast.success(statusMeta(status).label);
  }

  return (
    <Sheet open={!!appointment} onOpenChange={(o) => !o && onClose()}>
      <SheetContent title={client?.name ?? "Visit"}>
        {a && meta ? (
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2">
              <Badge variant={meta.variant}>{meta.label}</Badge>
              {a.depositPaid ? <Badge variant="success">Deposit in</Badge> : <Badge variant="warning">No deposit</Badge>}
            </div>
            <div>
              <p className="font-medium">{svc?.name}</p>
              <p className="text-sm text-muted-foreground">
                {staff?.name} · {whenLabel(a.start)} · {durationLabel(a.durationMin)}
              </p>
              <p className="mt-1 font-serif text-2xl">{svc ? money(svc.price) : ""}</p>
            </div>
            <div className="text-sm">
              <p>{client?.phone}</p>
              <p className="text-muted-foreground">{client?.email}</p>
              {client?.notes ? <p className="mt-2 text-muted-foreground">{client.notes}</p> : null}
            </div>
            <div>
              <p className="mb-1.5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Chair notes</p>
              <Textarea defaultValue={a.notes} key={a.id} onBlur={(e) => updateNotes(a.id, e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              {a.status === "booked" ? (
                <Button size="sm" onClick={() => go("confirmed")}>
                  Confirm
                </Button>
              ) : null}
              {a.status === "booked" || a.status === "confirmed" ? (
                <Button size="sm" variant="secondary" onClick={() => go("arrived")}>
                  Mark show
                </Button>
              ) : null}
              {a.status === "arrived" ? (
                <Button size="sm" onClick={() => go("in-service")}>
                  Start service
                </Button>
              ) : null}
              {a.status === "in-service" || a.status === "arrived" || a.status === "confirmed" ? (
                can("pos") ? (
                  <Button size="sm" variant="ink" asChild>
                    <Link to="/studio/pos" search={{ appointment: a.id }} onClick={() => onClose()}>
                      Checkout
                    </Link>
                  </Button>
                ) : (
                  <Button size="sm" variant="ink" onClick={() => go("completed")}>
                    Complete
                  </Button>
                )
              ) : null}
              {a.status !== "completed" && a.status !== "cancelled" && a.status !== "no-show" ? (
                <Button size="sm" variant="outline" onClick={() => go("no-show")}>
                  No-show
                </Button>
              ) : null}
              {a.status !== "cancelled" && a.status !== "completed" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    cancel(a.id);
                    toast("Visit cancelled");
                    onClose();
                  }}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
