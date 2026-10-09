import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, MapPin, Lock } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/Brand";
import { RegisterForm, type RegisteredTicket } from "@/components/RegisterForm";
import { Ticket } from "@/components/Ticket";
import { Skeleton } from "@/components/ui/skeleton";
import { eventQuery, fmtDate, publicStatsQuery } from "@/lib/events";
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

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="bg-hero absolute inset-x-0 top-0 h-72"><div className="grid-lines absolute inset-0" /></div>
      <header className="relative z-10 mx-auto flex h-20 max-w-3xl items-center justify-between px-6"><Brand light /><Link to="/explore" className="text-sm text-navy-muted hover:text-navy-foreground">All events</Link></header>
      <main className="relative z-10 mx-auto max-w-3xl space-y-6 px-6 pb-20">
        {ev.isLoading && <Skeleton className="h-64 rounded-2xl" />}
        {!ev.isLoading && !e && <div className="panel p-10 text-center"><p className="text-xl font-semibold">Event not found</p><p className="mt-2 text-sm text-muted-foreground">This registration link is invalid or the event was removed.</p></div>}
        {e && (
          <>
            <section className="panel animate-rise overflow-hidden">
              {e.cover_url && <img src={e.cover_url} alt={e.title} className="h-56 w-full object-cover sm:h-72" />}
              <div className="p-6 sm:p-8">
              <p className={`font-mono text-[11px] uppercase tracking-[0.25em] ${e.is_open ? "text-electric" : "text-destructive"}`}>{e.is_open ? "Registration open" : "Registration closed"}</p>
              <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{e.title}</h1>
              <p className="mt-3 flex flex-wrap gap-4 font-mono text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><CalendarDays className="size-3" />{fmtDate(e.starts_at)}</span>
                {e.venue && <span className="flex items-center gap-1"><MapPin className="size-3" />{e.venue}</span>}
              </p>
              <div className="mt-5"><HostBadge name={e.host_name} photo={e.host_photo_url} /></div>
              {e.description && <p className="mt-4 text-sm text-muted-foreground">{e.description}</p>}
              {left !== null && (
                <p className={`mt-5 inline-block rounded px-3 py-1.5 font-mono text-xs ring-1 ${left ? "bg-success-soft text-success ring-success/25" : "bg-destructive/10 text-destructive ring-destructive/25"}`}>
                  {left ? `${left} of ${e.capacity} seats left` : "Event is full"}
                </p>
              )}
              </div>
            </section>
            {ticket ? (
              <>
                <Ticket code={ticket.code} name={ticket.full_name} email={ticket.email} eventTitle={e.title} meta={e.venue ?? undefined} date={fmtDate(e.starts_at)} />
                <p className="text-center text-sm text-muted-foreground">Save this QR — show it at the entry gate. It works only once.</p>
              </>
            ) : new Date(e.starts_at).getTime() <= Date.now() ? (
              <section className="panel animate-rise p-10 text-center [animation-delay:120ms]">
                <p className="text-xl font-semibold">This event has already started</p>
                <p className="mt-2 text-sm text-muted-foreground">Registrations are no longer accepted for this event.</p>
              </section>
            ) : !e.is_open ? (
              <section className="panel animate-rise p-10 text-center [animation-delay:120ms]">
                <p className="text-xl font-semibold">Registrations are closed</p>
                <p className="mt-2 text-sm text-muted-foreground">The organizer has closed registrations for this event.</p>
              </section>
             ) : user === null ? (
              <section className="panel animate-rise p-10 text-center [animation-delay:120ms]">
                <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><Lock className="size-6" /></div>
                <p className="mt-4 text-xl font-semibold">Sign in to register</p>
                <p className="mt-2 text-sm text-muted-foreground">You need a free EventEase account to grab your pass for this event.</p>
                <Button asChild variant="hero" className="mt-6">
                  <Link to="/auth" search={{ redirect: `/register/${e.id}` }}>Sign in or create account</Link>
                </Button>
              </section>
            ) : user === undefined || !prefill ? (
              <Skeleton className="h-48 rounded-2xl" />
            ) : (
              <section className="panel animate-rise p-6 sm:p-8 [animation-delay:120ms]">
                <h2 className="label-mono mb-5">Your details</h2>
                <RegisterForm eventId={e.id} eventTitle={e.title} disabled={left === 0} prefill={prefill}
                  onRegistered={(t) => { setTicket(t); qc.invalidateQueries({ queryKey: ["public-stats", eventId] }); }} />
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
