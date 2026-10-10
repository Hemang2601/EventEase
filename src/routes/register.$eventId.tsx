import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Clock, MapPin, Lock, ScrollText, ShieldAlert } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/Brand";
import { RegisterForm, type RegisteredTicket } from "@/components/RegisterForm";
import { Ticket } from "@/components/Ticket";
import { Skeleton } from "@/components/ui/skeleton";
import { eventQuery, fmtDate, fmtDateRange, publicStatsQuery, parseEventRules } from "@/lib/events";
import { HostBadge } from "@/components/HostBadge";

export const Route = createFileRoute("/register/$eventId")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Register for Event — EventEase" },
      { name: "description", content: "Register for this college event and get your QR entry ticket instantly." },
      { property: "og:title", content: "Register for Event — EventEase" },
      { property: "og:description", content: "Grab your seat and receive a unique QR entry code." },
    ],
  }),
  ssr: false,
  component: PublicRegister,
});

function PublicRegister() {
  const { eventId } = Route.useParams();
  const qc = useQueryClient();
  const ev = useQuery(eventQuery(eventId));
  const stats = useQuery(publicStatsQuery(eventId));
  const [ticket, setTicket] = useState<RegisteredTicket | null>(null);
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [prefill, setPrefill] = useState<{ full_name: string; email: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) { setPrefill(null); return; }
    let alive = true;
    supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (!alive) return;
      setPrefill({
        full_name: data?.full_name ?? (user.user_metadata?.["full_name"] as string | undefined) ?? "",
        email: data?.email ?? user.email ?? "",
      });
    });
    return () => { alive = false; };
  }, [user]);

  const e = ev.data;
  const left = e && stats.data ? Math.max(0, e.capacity - stats.data.registered) : null;
  const checkinMinutes = typeof e?.checkin_opens_minutes === "number" ? e.checkin_opens_minutes : 30;
  const checkinOpensAt = e ? new Date(new Date(e.starts_at).getTime() - checkinMinutes * 60 * 1000) : null;
  const isStarted = e ? new Date(e.starts_at).getTime() <= Date.now() : false;
  const isCheckInOpen = e && checkinOpensAt ? Date.now() >= checkinOpensAt.getTime() : false;
  const isOpen = e ? e.is_open !== false : false;
  const isRegClosed = !isOpen || isCheckInOpen || isStarted;

  return (
    <div className="relative min-h-screen w-full max-w-full overflow-x-hidden">
      <div className="bg-hero absolute inset-x-0 top-0 h-72"><div className="grid-lines absolute inset-0" /></div>
      <header className="relative z-10 mx-auto flex h-16 sm:h-20 max-w-3xl items-center justify-between px-4 sm:px-6"><Brand light /><Link to="/explore" className="text-xs sm:text-sm text-navy-muted hover:text-navy-foreground">All events</Link></header>
      <main className="relative z-10 mx-auto max-w-3xl space-y-5 sm:space-y-6 px-4 sm:px-6 pb-20 w-full max-w-full overflow-x-hidden">
        {ev.isLoading && <Skeleton className="h-64 rounded-2xl" />}
        {!ev.isLoading && !e && <div className="panel p-6 sm:p-10 text-center"><p className="text-xl font-semibold">Event not found</p><p className="mt-2 text-sm text-muted-foreground">This registration link is invalid or the event was removed.</p></div>}
        {e && (
          <>
            <section className="glass-panel animate-rise overflow-hidden border-border/80 shadow-float backdrop-blur-xl">
              {e.cover_url && <img src={e.cover_url} alt={e.title} className="h-48 sm:h-64 md:h-72 w-full object-cover" />}
              <div className="p-5 sm:p-8">
              <p className={`font-mono text-[11px] uppercase tracking-[0.25em] ${!isRegClosed ? "text-electric" : "text-destructive"}`}>
                {!isRegClosed ? "Registration open" : isCheckInOpen && !isStarted ? "Check-in underway · Registration closed" : "Registration closed"}
              </p>
              <h1 className="mt-2 text-2xl sm:text-3xl md:text-4xl font-bold">{e.title}</h1>
              <p className="mt-3 flex flex-wrap gap-3 sm:gap-4 font-mono text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5 shrink-0" />{fmtDateRange(e.starts_at, e.ends_at)}</span>
                {e.venue && <span className="flex items-center gap-1.5"><MapPin className="size-3.5 shrink-0" />{e.venue}</span>}
              </p>
              <div className="mt-4 sm:mt-5"><HostBadge name={e.host_name} photo={e.host_photo_url} /></div>
              {e.description && <p className="mt-4 text-sm text-muted-foreground leading-relaxed">{e.description}</p>}
              {left !== null && (
                <p className={`mt-4 sm:mt-5 inline-block rounded px-3 py-1.5 font-mono text-xs ring-1 ${left ? "bg-success-soft text-success ring-success/25" : "bg-destructive/10 text-destructive ring-destructive/25"}`}>
                  {left ? `${left} of ${e.capacity} seats left` : "Event is full"}
                </p>
              )}
              </div>
            </section>

            {/* Event Rules & Regulations Card */}
            <section className="glass-panel animate-rise overflow-hidden p-6 sm:p-8 [animation-delay:80ms] border-primary/25 bg-gradient-to-br from-card/90 via-card/80 to-primary/5 shadow-float backdrop-blur-xl">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-xs">
                    <ScrollText className="size-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                      Event Rules & Entry Guidelines
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Mandatory conditions for venue entry & check-in
                    </p>
                  </div>
                </div>
                <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-primary">
                  Required for Registration
                </span>
              </div>

              <div className="mt-4 space-y-2.5">
                {parseEventRules(e.rules).map((rule, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 p-3 text-xs sm:text-sm text-foreground transition-colors hover:bg-muted/60"
                  >
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-[11px] font-bold text-primary mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed font-medium">{rule}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/25 bg-primary/5 px-3.5 py-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 shrink-0 text-primary" />
                  <span>Check-in opens: <strong className="text-foreground">{checkinOpensAt ? checkinOpensAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "30m before"}</strong> ({checkinMinutes}m before start)</span>
                </div>
                <span className="font-semibold text-amber-500 text-[11px]">Registrations close when check-in begins</span>
              </div>

              <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-muted/60 px-3.5 py-2.5 text-xs text-muted-foreground">
                <ShieldAlert className="size-4 shrink-0 text-amber-500" />
                <span>Show your digital QR pass and College ID at check-in. Duplicate entries and pass sharing are strictly blocked.</span>
              </div>
            </section>

            {ticket ? (
              <>
                <Ticket code={ticket.code} name={ticket.full_name} email={ticket.email} eventTitle={e.title} meta={e.venue ?? undefined} date={fmtDateRange(e.starts_at, e.ends_at)} />
                <p className="text-center text-sm text-muted-foreground">Save this QR — show it at the entry gate. It works only once.</p>
              </>
            ) : isStarted ? (
              <section className="glass-panel animate-rise p-10 text-center [animation-delay:120ms] backdrop-blur-xl">
                <p className="text-xl font-semibold">This event has already started</p>
                <p className="mt-2 text-sm text-muted-foreground">Registrations are no longer accepted for this event.</p>
              </section>
            ) : isCheckInOpen ? (
              <section className="glass-panel animate-rise p-10 text-center [animation-delay:120ms] backdrop-blur-xl border border-amber/30">
                <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-amber/15 text-amber mb-3">
                  <Clock className="size-6" />
                </div>
                <p className="text-xl font-semibold text-foreground">Registrations are closed</p>
                <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                  Gate check-in has already started at <strong className="text-foreground">{checkinOpensAt?.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</strong>.
                  Student registrations close automatically 30 minutes before event start when check-in begins.
                </p>
              </section>
            ) : !isOpen ? (
              <section className="glass-panel animate-rise p-10 text-center [animation-delay:120ms] backdrop-blur-xl">
                <p className="text-xl font-semibold">Registrations are closed</p>
                <p className="mt-2 text-sm text-muted-foreground">The organizer has closed registrations for this event.</p>
              </section>
            ) : (
              <section className="panel animate-rise p-6 sm:p-8 [animation-delay:120ms]">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="label-mono">Your details</h2>
                  {!user && (
                    <Link to="/auth" search={{ redirect: `/register/${e.id}` }} className="text-xs text-primary hover:underline">
                      Have an account? Sign in
                    </Link>
                  )}
                </div>
                <RegisterForm eventId={e.id} eventTitle={e.title} disabled={left === 0} prefill={prefill ?? undefined}
                  onRegistered={(t) => { setTicket(t); qc.invalidateQueries({ queryKey: ["public-stats", eventId] }); }} />
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
