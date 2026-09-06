import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({
  className,
  children,
  side = "right",
  title,
}: {
  className?: string;
  children?: ReactNode;
  side?: "right" | "left" | "bottom";
  title?: string;
}) {
  const sideClass =
    side === "bottom"
      ? "inset-x-0 bottom-0 max-h-[88vh] rounded-t-2xl data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom"
      : side === "left"
        ? "inset-y-0 left-0 h-full w-[min(320px,90vw)] rounded-r-2xl data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left"
        : "inset-y-0 right-0 h-full w-[min(420px,92vw)] rounded-l-2xl data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right";
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 overflow-y-auto bg-card p-6 shadow-[var(--shadow-border-hover)] outline-none data-[state=open]:animate-in data-[state=closed]:animate-out",
          sideClass,
          className,
        )}
      >
        {title ? (
          <DialogPrimitive.Title className="mb-4 pr-10 font-serif text-2xl font-medium">{title}</DialogPrimitive.Title>
        ) : (
          <DialogPrimitive.Title className="sr-only">Panel</DialogPrimitive.Title>
        )}
        <DialogPrimitive.Close asChild>
          <Button variant="ghost" size="icon" className="absolute top-3 right-3 size-9" aria-label="Close">
            <X className="size-4" />
          </Button>
        </DialogPrimitive.Close>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
