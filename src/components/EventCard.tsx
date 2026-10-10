import { Link } from "@tanstack/react-router";
import { CalendarDays, MapPin } from "lucide-react";
import { categoryImage } from "@/lib/categories";
import { HostBadge } from "./HostBadge";
import { fmtDate, fmtDateRange, type EventWithStats } from "@/lib/events";

export function EventCard({ e, i = 0 }: { e: EventWithStats; i?: number }) {
  const fill = Math.round((e.registered / e.capacity) * 100);
  const rate = e.registered ? Math.round((e.checked_in / e.registered) * 100) : 0;
  const full = e.registered >= e.capacity;
  const startTime = e.starts_at ? new Date(e.starts_at).getTime() : 0;
  const endTime = e.ends_at ? new Date(e.ends_at).getTime() : (startTime ? startTime + 4 * 3600_000 : 0);
  const live = startTime > 0 && Date.now() >= startTime && Date.now() <= endTime;
  const past = endTime > 0 && Date.now() > endTime;
  const status = !e.is_open ? "Closed" : live ? "Live" : past ? "Completed" : "Upcoming";
  const tone = !e.is_open ? "bg-destructive/15 text-destructive ring-1 ring-destructive/30" : live ? "bg-success-soft text-success ring-1 ring-success/30" : past ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary ring-1 ring-primary/30";

  return (
    <Link to="/events/$eventId" params={{ eventId: e.id }}
      className="animate-rise card-glow glass-card group block overflow-hidden rounded-2xl border border-border/80 shadow-card"
      style={{ animationDelay: `${i * 60}ms` }}>
      <div className="relative h-40 overflow-hidden">
        <img src={e.cover_url || categoryImage(e.category)} alt="" loading="lazy" width={1024} height={640} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy/75 to-transparent" />
        <span className="absolute left-3.5 top-3.5 rounded-full bg-card/85 px-2.5 py-1 text-[11px] font-semibold text-foreground backdrop-blur-md ring-1 ring-border/50">{e.category}</span>
        <span className={`absolute right-3.5 top-3.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-md ${tone}`}>
          {live && <span className="size-1.5 animate-pulse rounded-full bg-success" />}{full && !past ? "Full" : status}
        </span>
      </div>
      <div className="p-5">
        <h3 className="truncate text-lg font-semibold group-hover:text-primary transition-colors">{e.title}</h3>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><CalendarDays className="size-3.5" />{fmtDateRange(e.starts_at, e.ends_at)}</span>
          {e.venue && <span className="flex items-center gap-1"><MapPin className="size-3.5" />{e.venue}</span>}
        </p>
        <div className="mt-4"><HostBadge name={e.host_name} photo={e.host_photo_url} /></div>
        <div className="mt-5 space-y-3">
          <Meter label={`${e.registered} / ${e.capacity} registered`} pct={fill} cls="bg-primary" />
          <Meter label={`${e.checked_in} attended`} pct={rate} cls="bg-success" />
        </div>
      </div>
    </Link>
  );
}

function Meter({ label, pct, cls }: { label: string; pct: number; cls: string }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs"><span className="text-muted-foreground">{label}</span><span className="font-semibold">{pct}%</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`animate-grow h-full rounded-full ${cls}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
    </div>
  );
}
