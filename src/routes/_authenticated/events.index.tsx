import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, MapPin, Search, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CreateEventDialog } from "@/components/CreateEventDialog";
import { EventCard } from "@/components/EventCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { usePickedEvent } from "@/lib/use-picked-event";
import { fmtDate, fmtDateRange, type EventWithStats } from "@/lib/events";
import { categoryImage } from "@/lib/categories";
import { PageHeader, StatusPill } from "@/components/ee/index";
import { Reveal } from "@/components/ee/dashboard-widgets";

export const Route = createFileRoute("/_authenticated/events/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Events — EventEase" },
      { name: "description", content: "Create and manage your college events with capacity limits." },
      { property: "og:title", content: "Events — EventEase" },
      { property: "og:description", content: "Create and manage your events." },
    ],
  }),
  component: EventsPage,
});

function statusOf(e: EventWithStats) {
  const now = Date.now();
  const startTime = e.starts_at ? new Date(e.starts_at).getTime() : 0;
  const endTime = e.ends_at ? new Date(e.ends_at).getTime() : (startTime ? startTime + 4 * 3600_000 : 0);
  const live = startTime > 0 && now >= startTime && now <= endTime;
  const past = endTime > 0 && now > endTime;
  if (!e.is_open) return "closed";
  if (live) return "live";
  if (past) return "completed";
  return "upcoming";
}

function FeaturedEvent({ e }: { e: EventWithStats }) {
  const status = statusOf(e);
  const regPct = Math.min(100, Math.round((e.registered / e.capacity) * 100));
  const attPct = e.registered ? Math.round((e.checked_in / e.registered) * 100) : 0;
  return (
    <Link to="/events/$eventId" params={{ eventId: e.id }} className="group block overflow-hidden rounded-3xl bg-hero relative text-navy-foreground">
      <img src={e.cover_url || categoryImage(e.category)} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30 transition-transform duration-700 group-hover:scale-105" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-navy via-navy/85 to-navy/40" />
      <div className="relative flex flex-col gap-6 p-7 sm:p-9 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ring-1 ring-primary/40">Featured</span>
            <StatusPill tone={status === "live" ? "success" : status === "closed" ? "danger" : "neutral"} className="bg-navy-2/60">
              {status.toUpperCase()}
            </StatusPill>
          </div>
          <h2 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">{e.title}</h2>
          <p className="mt-3 flex flex-wrap gap-4 text-sm text-navy-muted">
            <span className="flex items-center gap-1.5"><CalendarDays className="size-4" />{fmtDateRange(e.starts_at, e.ends_at)}</span>
            {e.venue && <span className="flex items-center gap-1.5"><MapPin className="size-4" />{e.venue}</span>}
          </p>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-4 sm:w-80 dark-glass p-4 rounded-2xl border border-white/10 backdrop-blur-md">
          <div>
            <div className="mb-1.5 flex justify-between font-mono text-xs text-navy-muted"><span>Registered</span><span className="font-semibold text-navy-foreground">{e.registered}/{e.capacity}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-navy-border"><div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${regPct}%` }} /></div>
          </div>
          <div>
            <div className="mb-1.5 flex justify-between font-mono text-xs text-navy-muted"><span>Attendance</span><span className="font-semibold text-navy-foreground">{attPct}%</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-navy-border"><div className="h-full rounded-full bg-success transition-all duration-700" style={{ width: `${attPct}%` }} /></div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function EventsPage() {
  const { user, events, loading } = usePickedEvent();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [sort, setSort] = useState<string>("date");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = events.filter((e) => (e.title || "").toLowerCase().includes(query));
    if (status !== "all") list = list.filter((e) => statusOf(e) === status);
    list = [...list].sort((a, b) => {
      if (sort === "date") {
        const timeA = a.starts_at ? new Date(a.starts_at).getTime() : 0;
        const timeB = b.starts_at ? new Date(b.starts_at).getTime() : 0;
        return timeA - timeB;
      }
      return (b.registered ?? 0) - (a.registered ?? 0);
    });
    return list;
  }, [events, q, status, sort]);

  const featured = filtered.find((e) => statusOf(e) === "live") ?? filtered[0];
  const rest = filtered.filter((e) => e.id !== featured?.id);

  return (
    <AppShell allow={["organizer", "admin"]} title="Events" actions={user && <CreateEventDialog userId={user.id} />}>
      <PageHeader title="Events" subtitle="Manage every event from one place." />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events…" className="pl-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="live">Live</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Date</SelectItem>
            <SelectItem value="registrations">Registrations</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-64 rounded-3xl" />
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-80 rounded-2xl" />)}</div>
        </div>
      ) : events.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed bg-card p-14 text-center">
          <CalendarDays className="size-10 text-primary" />
          <p className="mt-4 text-lg font-semibold">No events yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create your first event to start registering participants.</p>
          {user && <div className="mt-5"><CreateEventDialog userId={user.id} /></div>}
        </div>
      ) : filtered.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed bg-card p-14 text-center">
          <Users className="size-10 text-muted-foreground" />
          <p className="mt-4 text-lg font-semibold">No matching events</p>
          <p className="mt-1 text-sm text-muted-foreground">Try a different search term or filter.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {featured && <Reveal><FeaturedEvent e={featured} /></Reveal>}
          {rest.length > 0 && (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {rest.map((e, i) => <EventCard key={e.id} e={e} i={i} />)}
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
