import { UserRound } from "lucide-react";

/** Shows who is organizing the event, with their photo. */
export function HostBadge({ name, photo, light }: { name: string | null; photo: string | null; light?: boolean }) {
  if (!name && !photo) return null;
  return (
    <div className="flex items-center gap-2.5">
      {photo
        ? <img src={photo} alt={name ?? "Organizer"} loading="lazy" className="size-9 rounded-full object-cover ring-2 ring-card" />
        : <span className="grid size-9 place-items-center rounded-full bg-primary/15 text-primary"><UserRound size={16} /></span>}
      <div className="min-w-0 leading-tight">
        <p className={`text-[10px] font-bold uppercase tracking-wider ${light ? "text-navy-muted" : "text-muted-foreground"}`}>Organized by</p>
        <p className="truncate text-sm font-semibold">{name || "Organizer"}</p>
      </div>
    </div>
  );
}
