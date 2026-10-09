import { Link } from "@tanstack/react-router";
import { Ticket } from "lucide-react";

export function BrandMark({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-glow">
        <Ticket className="size-[18px]" strokeWidth={2.2} />
      </span>
      <span className={`font-display text-[17px] font-bold tracking-tight ${light ? "text-navy-foreground" : "text-foreground"}`}>
        Event<span className="text-primary">Ease</span>
      </span>
    </span>
  );
}

export function Brand({ light = false }: { light?: boolean }) {
  return <Link to="/" aria-label="EventEase home"><BrandMark light={light} /></Link>;
}
