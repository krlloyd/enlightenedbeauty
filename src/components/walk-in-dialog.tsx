import { format } from "date-fns";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { formatPhone } from "@/lib/format";
import { useSalon } from "@/lib/store";
import { Dialog, DialogContent } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input, NativeSelect } from "./ui/input";
import { Field } from "./ui/label";

export function WalkInDialog({
  open,
  staffId,
  start,
  onClose,
}: {
  open: boolean;
  staffId?: string;
  start?: Date;
  onClose: () => void;
}) {
  const book = useSalon((s) => s.book);
  const services = useSalon((s) => s.services);
  const staffList = useSalon((s) => s.staff);
  const [serviceId, setServiceId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const staff = staffList.find((s) => s.id === staffId);
  const options = staff ? services.filter((s) => s.staffIds.includes(staff.id)) : services;

  const optionKey = options.map((s) => s.id).join(",");

  useEffect(() => {
    if (!open) return;
    setServiceId((curr) => (options.some((s) => s.id === curr) ? curr : options[0]?.id ?? ""));
  }, [open, staffId, optionKey, options]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!staffId || !start) return;
    const svc = options.find((s) => s.id === serviceId) ?? options[0];
    if (!svc) {
      toast.error("This specialist has no services yet.");
      return;
    }
    if (!name.trim()) {
      toast.error("Client name is required.");
      return;
    }
    const result = book({
      serviceId: svc.id,
      staffId,
      start: start.toISOString(),
      name: name.trim(),
      phone: phone ? formatPhone(phone) : "(715) 555-0100",
      email: "",
      notes: "Walk-in",
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Walk-in added");
    setName("");
    setPhone("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Walk-in">
        <p className="mt-1 text-sm text-muted-foreground">
          {staff?.name}
          {start ? ` · ${format(start, "EEE h:mm a")}` : ""}
        </p>
        <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
          <Field label="Service">
            <NativeSelect value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              {options.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Client name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Walk-in name" />
          </Field>
          <Field label="Mobile">
            <Input value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="(715) 555-0100" />
          </Field>
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Dismiss
            </Button>
            <Button type="submit" variant="ink">
              Add to book
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}