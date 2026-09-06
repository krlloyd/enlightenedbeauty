import { AffirmMark } from "@/components/affirm-mark";
import { affirmMonthly } from "@/lib/affirm";
import { money } from "@/lib/format";

export function AffirmPromo({ amount }: { amount: number }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <AffirmMark className="h-3.5 w-auto text-[#4a30d9]" />
      As low as {money(affirmMonthly(amount, 3))}/mo
    </p>
  );
}
