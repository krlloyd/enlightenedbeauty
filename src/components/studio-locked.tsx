import { Link } from "@tanstack/react-router";
import { Button } from "./ui/button";

export function StudioLocked({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Access</p>
      <h1 className="mt-2 font-serif text-3xl font-medium">{title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{detail}</p>
      <Button asChild className="mt-6">
        <Link to="/studio">Back to today</Link>
      </Button>
    </div>
  );
}
