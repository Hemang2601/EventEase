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
import { fmtDate } from "@/lib/events";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { useRoles } from "@/lib/roles";

type ExploreEvent = {
  id: string; title: string; venue: string | null; starts_at: string; capacity: number;
  category: string; description: string | null; cover_url: string | null;
  host_photo_url: string | null; host_name: string | null; is_open: boolean;
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
    queryFn: async (): Promise<ExploreEvent[]> => {
      const since = new Date().toISOString();
      const { data, error } = await supabase
        .from("events")
        .select("id, title, venue, starts_at, capacity, category, description, cover_url, host_photo_url, host_name, is_open")
        .gte("starts_at", since)
        .order("starts_at")
        .limit(60);
      if (error) throw error;
      const rows = data ?? [];
      const seats = await Promise.all(
        rows.map(async (r) => {
          const { data: s, error: se } = await supabase.rpc("event_stats", { _event_id: r.id });
          if (se) throw se;
          return Number(s?.[0]?.registered ?? 0);
        }),
      );
      return rows.map((r, i) => ({ ...r, registered: seats[i] ?? 0 }));
    },
  });
  const list = useMemo(() => (events.data ?? []).filter((e) =>
    (cat === "All" || e.category === cat) && (!q.trim() || e.title.toLowerCase().includes(q.trim().toLowerCase()))), [events.data, q, cat]);

  const { user } = useAuth();
  const { isAdmin, isOrganizer, loading: rolesLoading } = useRoles();
  const signedInStudent = !!user && !rolesLoading && !isAdmin && !isOrganizer;
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
    <div className={signedInStudent ? "" : "min-h-screen"}>
      <div className={signedInStudent ? "" : "mx-auto max-w-7xl px-5 pt-6 sm:px-8"}>
        {!signedInStudent && (
          <header className="flex h-16 items-center justify-between">
            <Brand />
            <ThemeControl />
          </header>
        )}

        <section className="explore-bento mt-3">
          <div className="explore-heading">
            <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase text-electric"><Sparkles className="size-4" /> EventEase · Student portal</p>
            <h1 className="text-4xl font-bold sm:text-6xl">Explore <span className="text-gradient">events</span></h1>
            <p className="mt-4 max-w-md text-base text-muted-foreground">Discover academic summits, tech hackathons, and cultural festivals happening around you.</p>
          </div>
          <div className="explore-filters">
            <div className="glass-tile p-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input aria-label="Search events" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events..." className="h-12 border-0 bg-transparent pl-11 shadow-none focus-visible:ring-0" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {["All", ...CATEGORIES].map((c) => <Button key={c} size="sm" variant={cat === c ? "default" : "outline"} onClick={() => setCat(c)}>{c}</Button>)}
              </div>
            </div>
            <div className="glass-tile flex items-center justify-between px-4 py-3 text-xs text-muted-foreground">
              <span>{events.isLoading ? "Loading events…" : `Showing ${list.length} events`}</span>
              <CalendarDays className="size-4 text-electric" />
            </div>
          </div>
        </section>

        {/* Events — same continuous page, directly under the hero card */}
        <main className="relative py-10">
          <div className="glass-field" aria-hidden />
          <div className="relative z-10">
            <p className="mb-5 text-sm text-muted-foreground">
              {events.isLoading ? "Loading events…" : `${list.length} upcoming ${list.length === 1 ? "event" : "events"}`}
            </p>
            {events.isLoading ? (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-96 rounded-xl" />)}</div>
            ) : !list.length ? (
              <p className="glass-tile p-14 text-center text-muted-foreground">No upcoming events found.</p>
            ) : (
              <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
                {list.map((e, i) => {
                  const seatsLeft = Math.max(0, e.capacity - e.registered);
                  const full = seatsLeft === 0;
                  const pct = e.capacity ? Math.min(100, Math.round((e.registered / e.capacity) * 100)) : 0;
                  const registered = myRegs.data?.has(e.id);
                  const status = registered ? "Registered" : !e.is_open ? "Closed" : full ? "Full" : "Open";
                  const tone = registered
                    ? "text-success"
                    : !e.is_open || full
                      ? "text-amber"
                      : "text-success";
                  return (
                    <article
                      key={e.id}
                      onMouseMove={trackGlass}
                      className="event-tile glass-tile animate-rise flex flex-col"
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
                          {!e.is_open && !registered ? <Lock className="size-3" /> : <span className={`size-1.5 rounded-full ${registered || (!e.is_open || full) ? "bg-amber" : "bg-success"}`} />}
                          {status}
                        </span>
                      </div>

                      <div className="flex flex-1 flex-col p-5">
                        <h3 className="text-xl font-semibold">{e.title}</h3>

                        <div className="glass-meta mt-4">
                          <div title={fmtDate(e.starts_at)}>
                            <CalendarDays className="size-3.5" />
                            <span>{fmtDate(e.starts_at)}</span>
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

                        <div className="event-actions glass-host mt-auto flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                          <div className="min-w-0 flex-1"><HostBadge name={e.host_name} photo={e.host_photo_url} /></div>
                          {registered ? (
                            <Button className="h-10" variant="outline" disabled><BadgeCheck /> Already registered</Button>
                          ) : !e.is_open ? (
                            <Button className="h-10" variant="outline" disabled>Registrations closed</Button>
                          ) : full ? (
                            <Button className="h-10" variant="outline" disabled>Event full</Button>
                          ) : user ? (
                            <Button className="h-10" onClick={() => { setRegEvent(e); setDoneCode(null); }}>Register <ArrowRight /></Button>
                          ) : (
                            <Button asChild className="h-10"><Link to="/register/$eventId" params={{ eventId: e.id }}>Register <ArrowRight /></Link></Button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        <footer className="flex items-center justify-between border-t py-6 text-xs text-muted-foreground">
          <span>EventEase · Secure QR check-in for college events</span>
          <span>Atmiya University</span>
        </footer>
      </div>

      <Dialog open={!!regEvent} onOpenChange={(open) => { if (!open) { setRegEvent(null); setDoneCode(null); } }}>
        <DialogContent className="sm:max-w-lg">
          {regEvent && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{doneCode ? "You're in!" : `Register — ${regEvent.title}`}</DialogTitle>
                <DialogDescription className="flex flex-wrap gap-3 pt-1 text-xs">
                  <span className="flex items-center gap-1"><CalendarDays className="size-3.5" />{fmtDate(regEvent.starts_at)}</span>
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
              ) : profile.data ? (
                <RegisterForm eventId={regEvent.id} eventTitle={regEvent.title} prefill={profile.data}
                  onRegistered={(t) => {
                    setDoneCode(t.code);
                    qc.invalidateQueries({ queryKey: ["my-registrations", user?.id] });
                    qc.invalidateQueries({ queryKey: ["events", "explore"] });
                  }} />
              ) : (
                <Skeleton className="h-48 rounded-xl" />
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
