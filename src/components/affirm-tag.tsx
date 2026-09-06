import { AffirmMark } from "@/components/affirm-mark";
import { cn } from "@/lib/utils";

export function AffirmTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-[#4a30d9]/10 px-2 py-0.5 text-[#4a30d9]",
        className,
      )}
    >
      <AffirmMark className="h-3 w-auto" />
      <span className="sr-only">Affirm</span>
    </span>
  );
}
