import { Link } from "@tanstack/react-router";
import { CalendarDays, MapPin } from "lucide-react";
import { categoryImage } from "@/lib/categories";
import { HostBadge } from "./HostBadge";
import { fmtDate, type EventWithStats } from "@/lib/events";

export function EventCard({ e, i = 0 }: { e: EventWithStats; i?: number }) {
  const fill = Math.round((e.registered / e.capacity) * 100);
  const rate = e.registered ? Math.round((e.checked_in / e.registered) * 100) : 0;
  const full = e.registered >= e.capacity;
  const live = Math.abs(Date.now() - new Date(e.starts_at).getTime()) < 12 * 3600_000;
  const past = new Date(e.starts_at).getTime() < Date.now() - 12 * 3600_000;
  const status = !e.is_open ? "Closed" : live ? "Live" : past ? "Completed" : "Upcoming";
  const tone = !e.is_open ? "bg-destructive/10 text-destructive" : live ? "bg-success-soft text-success" : past ? "bg-muted text-muted-foreground" : "bg-accent text-primary";

  return (
    <Link to="/events/$eventId" params={{ eventId: e.id }}
      className="animate-rise card-glow group block overflow-hidden rounded-2xl border bg-card shadow-card"
      style={{ animationDelay: `${i * 60}ms` }}>
      <div className="relative h-40 overflow-hidden">
        <img src={e.cover_url || categoryImage(e.category)} alt="" loading="lazy" width={1024} height={640} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy/70 to-transparent" />
        <span className="absolute left-4 top-4 rounded-full bg-card/90 px-2.5 py-1 text-[11px] font-semibold text-foreground backdrop-blur">{e.category}</span>
        <span className={`absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>
          {live && <span className="size-1.5 animate-pulse rounded-full bg-success" />}{full && !past ? "Full" : status}
        </span>
      </div>
      <div className="p-5">
        <h3 className="truncate text-lg font-semibold group-hover:text-primary">{e.title}</h3>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><CalendarDays className="size-3.5" />{fmtDate(e.starts_at)}</span>
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
