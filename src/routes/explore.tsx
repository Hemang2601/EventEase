import { useMemo, useState, type MouseEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, CalendarDays, Lock, MapPin, Search, Sparkles, Ticket, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Brand } from "@/components/Brand";
import { ThemeControl } from "@/components/ThemeControl";
import { HostBadge } from "@/components/HostBadge";
import { RegisterForm } from "@/components/RegisterForm";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORIES, categoryImage } from "@/lib/categories";
import { fmtDate, fmtDateRange } from "@/lib/events";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { useRoles } from "@/lib/roles";

type ExploreEvent = {
  id: string; title: string; venue: string | null; starts_at: string; ends_at?: string | null; capacity: number;
  category: string; description: string | null; cover_url: string | null;
  host_photo_url: string | null; host_name: string | null; is_open: boolean;
  checkin_opens_minutes?: number;
  registered: number;
};

/** Points the frosted-glass highlight at the cursor. */
function trackGlass(e: MouseEvent<HTMLElement>) {
  const rect = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
}

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Explore Events — EventEase" },
      { name: "description", content: "Browse upcoming college events, check seats remaining and grab your QR entry pass in seconds." },
      { property: "og:title", content: "Explore Events — EventEase" },
      { property: "og:description", content: "Browse upcoming college events and register instantly." },
    ],
  }),
  ssr: false,
  component: Explore,
});

function Explore() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("All");
  const events = useQuery({
    queryKey: ["events", "explore"],
    staleTime: 30_000,
    queryFn: async (): Promise<ExploreEvent[]> => {
      const since = new Date().toISOString();
      const { data, error } = await supabase
        .from("events")
        .select("id, title, venue, starts_at, ends_at, capacity, category, description, cover_url, host_photo_url, host_name, is_open, checkin_opens_minutes")
        .gte("starts_at", since)
        .order("starts_at")
        .limit(60);
      if (error) throw error;
      const rows = data ?? [];
      if (rows.length === 0) return [];

      // Single batch call instead of N individual calls
      const ids = rows.map((r) => r.id);
      const { data: statsMap } = await supabase.rpc("batch_event_stats", { _event_ids: ids });
      const counts: Record<string, number> = {};
      if (statsMap && typeof statsMap === "object" && !Array.isArray(statsMap)) {
        for (const [eid, s] of Object.entries(statsMap as Record<string, any>)) {
          counts[eid] = Number(s?.registered ?? 0);
        }
      }
      return rows.map((r) => ({ ...r, registered: counts[r.id] ?? 0 }));
    },
  });
  const list = useMemo(() => (events.data ?? []).filter((e) =>
    (cat === "All" || e.category === cat) && (!q.trim() || e.title.toLowerCase().includes(q.trim().toLowerCase()))), [events.data, q, cat]);

  const { user } = useAuth();
  const { isAdmin, isOrganizer, loading: rolesLoading } = useRoles();
  // If user is logged in, default to student view unless explicitly confirmed as admin/organizer
  const signedInStudent = !!user && (!rolesLoading ? (!isAdmin && !isOrganizer) : true);
  const qc = useQueryClient();
  const [regEvent, setRegEvent] = useState<ExploreEvent | null>(null);
  const [doneCode, setDoneCode] = useState<string | null>(null);

  const myRegs = useQuery({
    queryKey: ["my-registrations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return new Set<string>();
      const { data, error } = await supabase.from("participants").select("event_id").eq("user_id", user.id);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.event_id as string));
    },
  });

  const profile = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return { full_name: "", email: "" };
      const { data } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle();
      return {
        full_name: data?.full_name ?? (user.user_metadata?.["full_name"] as string | undefined) ?? "",
        email: data?.email ?? user.email ?? "",
      };
    },
  });

  const body = (
    <div className={signedInStudent ? "w-full max-w-full overflow-x-hidden" : "min-h-screen w-full max-w-full overflow-x-hidden"}>
      <div className={signedInStudent ? "w-full max-w-full overflow-x-hidden" : "mx-auto max-w-7xl px-4 pt-4 sm:px-8 sm:pt-6 w-full max-w-full overflow-x-hidden"}>
        {!signedInStudent && (
          <header className="flex h-16 items-center justify-between">
            <Brand />
            <ThemeControl />
          </header>
        )}

        <section className="explore-bento mt-2 sm:mt-3 w-full max-w-full overflow-hidden">
          <div className="explore-heading">
            <p className="mb-2.5 sm:mb-4 flex items-center gap-2 text-xs font-semibold uppercase text-electric"><Sparkles className="size-4" /> EventEase · Student portal</p>
            <h1 className="text-3xl font-bold sm:text-5xl lg:text-6xl">Explore <span className="text-gradient">events</span></h1>
            <p className="mt-2.5 sm:mt-4 max-w-md text-sm sm:text-base text-muted-foreground">Discover academic summits, tech hackathons, and cultural festivals happening around you.</p>
          </div>
          <div className="explore-filters">
            <div className="glass-tile p-3.5 sm:p-4">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input aria-label="Search events" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events..." className="h-11 sm:h-12 border-0 bg-transparent pl-10 sm:pl-11 shadow-none focus-visible:ring-0 text-sm" />
              </div>
              <div className="mt-3 flex overflow-x-auto pb-1 gap-2 sm:flex-wrap no-scrollbar">
                {["All", ...CATEGORIES].map((c) => (
                  <Button key={c} size="sm" variant={cat === c ? "default" : "outline"} onClick={() => setCat(c)} className="shrink-0 h-8 sm:h-9 text-xs sm:text-sm">
                    {c}
                  </Button>
                ))}
              </div>
            </div>
            <div className="glass-tile flex items-center justify-between px-3.5 py-2.5 sm:px-4 sm:py-3 text-xs text-muted-foreground">
              <span>{events.isLoading ? "Loading events…" : events.isError ? "Error loading events" : `Showing ${list.length} ${list.length === 1 ? "event" : "events"}`}</span>
              <CalendarDays className="size-4 text-electric" />
            </div>
          </div>
        </section>

        {/* Events — same continuous page, directly under the hero card */}
        <main className="relative py-8 sm:py-10 overflow-hidden w-full max-w-full">
          <div className="glass-field" aria-hidden />
          <div className="relative z-10">
            <p className="mb-5 text-sm text-muted-foreground">
              {events.isLoading ? "Loading events…" : events.isError ? "Could not load events" : `${list.length} upcoming ${list.length === 1 ? "event" : "events"}`}
            </p>
            {events.isLoading ? (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-96 rounded-xl" />)}</div>
            ) : events.isError ? (
              <div className="glass-tile flex flex-col items-center gap-4 p-14 text-center">
                <p className="text-base font-semibold text-destructive">Failed to load events</p>
                <p className="text-sm text-muted-foreground">Could not connect to the server. Make sure the app is running and refresh.</p>
                <Button variant="outline" onClick={() => events.refetch()}>Retry</Button>
              </div>
            ) : !list.length ? (
              <p className="glass-tile p-14 text-center text-muted-foreground">No upcoming events found.</p>
            ) : (
              <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
                {list.map((e, i) => {
                  const seatsLeft = Math.max(0, e.capacity - e.registered);
                  const full = seatsLeft === 0;
                  const pct = e.capacity ? Math.min(100, Math.round((e.registered / e.capacity) * 100)) : 0;
                  const registered = myRegs.data?.has(e.id);
                  const checkinMinutes = typeof e.checkin_opens_minutes === "number" ? e.checkin_opens_minutes : 30;
                  const checkinOpensAt = new Date(new Date(e.starts_at).getTime() - checkinMinutes * 60 * 1000);
                  const isCheckInStarted = Date.now() >= checkinOpensAt.getTime();
                  const isOpen = e.is_open !== false;
                  const isRegClosed = !isOpen || isCheckInStarted;
                  const status = registered
                    ? "Registered"
                    : isCheckInStarted
                      ? "Check-in Live"
                      : !isOpen
                        ? "Closed"
                        : full
                          ? "Full"
                          : "Open";
                  const tone = registered
                    ? "text-success"
                    : isRegClosed || full
                      ? "text-amber"
                      : "text-success";
                  return (
                    <article
                      key={e.id}
                      onMouseMove={trackGlass}
                      className="event-tile glass-tile glass-card animate-rise flex flex-col overflow-hidden max-w-full"
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      <div className="relative aspect-video shrink-0 overflow-hidden rounded-t-xl">
                        <img
                          src={e.cover_url || categoryImage(e.category)}
                          alt=""
                          loading="lazy"
                          width={1024}
                          height={640}
                          className="h-full w-full object-cover"
                        />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
                        <span className="glass-chip absolute left-4 top-4 rounded-md px-3 py-1.5 text-[11px] font-semibold">{e.category}</span>
                        <span className={`glass-chip absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold ${tone}`}>
                          {!isOpen && !registered ? <Lock className="size-3" /> : <span className={`size-1.5 rounded-full ${registered || (!isOpen || full) ? "bg-amber" : "bg-success"}`} />}
                          {status}
                        </span>
                      </div>

                      <div className="flex flex-1 flex-col p-5">
                        <h3 className="text-xl font-semibold">{e.title}</h3>

                        <div className="glass-meta mt-4">
                          <div title={fmtDateRange(e.starts_at, e.ends_at)}>
                            <CalendarDays className="size-3.5 shrink-0" />
                            <span className="truncate">{fmtDateRange(e.starts_at, e.ends_at)}</span>
                          </div>
                          <div title={e.venue ?? "Venue to be announced"}>
                            <MapPin className="size-3.5" />
                            <span>{e.venue ?? "Venue TBA"}</span>
                          </div>
                          <div title={`${e.registered} of ${e.capacity} seats booked`}>
                            <Users className="size-3.5" />
                            <span>{e.registered} / {e.capacity} booked</span>
                          </div>
                          <div title={full ? "No seats left" : `${seatsLeft} seats left`}>
                            <Ticket className="size-3.5" />
                            <span>{full ? "No seats left" : `${seatsLeft} seats left`}</span>
                          </div>
                        </div>

                        <div className="glass-bar mt-3" role="img" aria-label={`${pct}% of seats booked`}>
                          <i style={{ width: `${pct}%` }} />
                        </div>

                        {e.description && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{e.description}</p>}

                        <div className="event-actions glass-host mt-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t pt-4">
                          <div className="min-w-0 flex-1"><HostBadge name={e.host_name} photo={e.host_photo_url} /></div>
                          <div className="w-full sm:w-auto shrink-0">
                            {registered ? (
                              <Button className="h-10 w-full sm:w-auto" variant="outline" disabled><BadgeCheck /> Already registered</Button>
                            ) : isCheckInStarted ? (
                              <Button className="h-10 w-full sm:w-auto" variant="outline" disabled>Check-in started · Closed</Button>
                            ) : !isOpen ? (
                              <Button className="h-10 w-full sm:w-auto" variant="outline" disabled>Registrations closed</Button>
                            ) : full ? (
                              <Button className="h-10 w-full sm:w-auto" variant="outline" disabled>Event full</Button>
                            ) : user ? (
                              <Button className="h-10 w-full sm:w-auto" onClick={() => { setRegEvent(e); setDoneCode(null); }}>Register <ArrowRight /></Button>
                            ) : (
                              <Button asChild className="h-10 w-full sm:w-auto"><Link to="/register/$eventId" params={{ eventId: e.id }}>Register <ArrowRight /></Link></Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        <footer className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t py-6 text-xs text-muted-foreground text-center sm:text-left">
          <span>EventEase · Secure QR check-in for college events</span>
          <span>Atmiya University</span>
        </footer>
      </div>

      <Dialog open={!!regEvent} onOpenChange={(open) => { if (!open) { setRegEvent(null); setDoneCode(null); } }}>
        <DialogContent className="glass-panel max-h-[92vh] overflow-y-auto w-[calc(100vw-32px)] sm:max-w-lg p-5 sm:p-6 backdrop-blur-xl">
          {regEvent && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{doneCode ? "You're in!" : `Register — ${regEvent.title}`}</DialogTitle>
                <DialogDescription className="flex flex-wrap gap-3 pt-1 text-xs">
                  <span className="flex items-center gap-1"><CalendarDays className="size-3.5" />{fmtDateRange(regEvent.starts_at, regEvent.ends_at)}</span>
                  {regEvent.venue && <span className="flex items-center gap-1"><MapPin className="size-3.5" />{regEvent.venue}</span>}
                  <span className="flex items-center gap-1"><Users className="size-3.5" />{regEvent.registered} / {regEvent.capacity} booked</span>
                </DialogDescription>
              </DialogHeader>
              {doneCode ? (
                <div className="space-y-4 py-2 text-center">
                  <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-success-soft text-success"><Ticket className="size-6" /></div>
                  <p className="text-sm text-muted-foreground">Your entry code</p>
                  <p className="font-mono text-3xl font-bold tracking-[0.2em]">{doneCode}</p>
                  <p className="text-xs text-muted-foreground">Your QR pass is saved in My passes — show it at the entry gate.</p>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => { setRegEvent(null); setDoneCode(null); }}>Done</Button>
                    <Button asChild className="flex-1"><Link to="/my-passes">View my passes</Link></Button>
                  </div>
                </div>
              ) : Date.now() >= new Date(regEvent.starts_at).getTime() - (regEvent.checkin_opens_minutes ?? 30) * 60 * 1000 ? (
                <div className="space-y-3 py-6 text-center">
                  <p className="text-base font-semibold text-amber">Registrations are closed</p>
                  <p className="text-xs text-muted-foreground">Check-in has started for this event. Registrations close automatically 30 minutes before event start.</p>
                  <Button variant="outline" className="mt-2 w-full" onClick={() => setRegEvent(null)}>Close</Button>
                </div>
              ) : (
                <RegisterForm
                  eventId={regEvent.id}
                  eventTitle={regEvent.title}
                  prefill={profile.data ?? (user ? { full_name: (user.user_metadata?.full_name as string) || "", email: user.email || "" } : undefined)}
                  onRegistered={(t) => {
                    setDoneCode(t.code);
                    qc.invalidateQueries({ queryKey: ["my-registrations", user?.id] });
                    qc.invalidateQueries({ queryKey: ["events", "explore"] });
                  }}
                />
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  if (signedInStudent) return <AppShell title="Explore events">{body}</AppShell>;
  return body;
}
