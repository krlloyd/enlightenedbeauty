import { cn } from "@/lib/utils";

export function SalonLogo({
  variant = "dark",
  className,
}: {
  variant?: "dark" | "light";
  className?: string;
}) {
  return (
    <img
      src="/logo.png"
      alt="Enlightened Beauty"
      className={cn(
        "h-12 w-auto max-w-[min(62vw,18rem)] object-contain object-left sm:h-16 sm:max-w-[22rem]",
        variant === "dark" && "rounded-md",
        variant === "light" && "mix-blend-screen",
        className,
      )}
    />
  );
}
