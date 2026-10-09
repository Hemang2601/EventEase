import { useEffect, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, MapPin, Plus, ScanLine, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EventPicker } from "@/components/AppShell";
import { CreateEventDialog } from "@/components/CreateEventDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { participantsQuery, scanLogsQuery, fmtDate } from "@/lib/events";
import { usePickedEvent } from "@/lib/use-picked-event";
import { useAuth } from "@/lib/auth";
import { categoryImage } from "@/lib/categories";
import { Panel, PanelHeader, StatusPill } from "@/components/ee/index";
import {
  buildActivity, LiveAttendance, LiveActivityPanel, RegistrationsCheckinsChart,
  EventHealthWidget, SecuritySnapshot, Reveal,
} from "@/components/ee/dashboard-widgets";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Overview — EventEase" },
      { name: "description", content: "Live event command center: registrations, attendance and gate activity." },
      { property: "og:title", content: "Overview — EventEase" },
      { property: "og:description", content: "Live event command center." },
    ],
  }),
  component: Dashboard,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function Dashboard() {
  const { user } = useAuth();
  const { events, loading, event, select } = usePickedEvent();
  const qc = useQueryClient();
  const eid = event?.id ?? "";
  const ps = useQuery({ ...participantsQuery(eid), enabled: !!eid });
  const logs = useQuery({ ...scanLogsQuery(eid), enabled: !!eid });
  const display = (user?.user_metadata?.["full_name"] as string | undefined) || user?.email?.split("@")[0] || "Organizer";

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("overview-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "participants", ...(eid ? { filter: `event_id=eq.${eid}` } : {}) }, () => {
        qc.invalidateQueries({ queryKey: ["events"] });
        qc.invalidateQueries({ queryKey: ["participants"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "scan_logs" }, () => qc.invalidateQueries({ queryKey: ["scan-logs"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc, user, eid]);

  const participants = ps.data ?? [];
  const scanLogs = logs.data ?? [];
  const registered = event?.registered ?? 0;
  const checkedIn = event?.checked_in ?? 0;
  const duplicates = scanLogs.filter((l) => l.result === "duplicate").length;
  const invalid = scanLogs.filter((l) => l.result !== "duplicate" && l.result !== "success").length;
  const success = scanLogs.filter((l) => l.result === "success").length;
  const noShowRate = registered ? Math.round(((registered - checkedIn) / registered) * 100) : 0;
  const checkInRate = registered ? Math.round((checkedIn / registered) * 100) : 0;

  const activity = useMemo(() => buildActivity(participants, scanLogs), [participants, scanLogs]);
  const securityActivity = useMemo(
    () => activity.filter((a) => a.tone === "danger" || a.tone === "success").slice(0, 6),
    [activity],
  );

  const now = Date.now();
  const live = event ? Math.abs(now - new Date(event.starts_at).getTime()) < 12 * 3600_000 : false;
  const past = event ? new Date(event.starts_at).getTime() < now - 12 * 3600_000 : false;
  const status = !event ? "" : !event.is_open ? "Closed" : live ? "Live" : past ? "Completed" : "Upcoming";

  return (
    <AppShell
      allow={["organizer"]}
      title="Overview"
      actions={user && <CreateEventDialog userId={user.id} />}
    >
      <Reveal>
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-foreground sm:text-[32px]">{greeting()}, {display}.</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">Here's what is happening across your events.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {events.length > 0 && <EventPicker events={events} value={event?.id} onChange={select} />}
            <Button asChild variant="outline"><Link to="/check-in"><ScanLine /> Open scanner</Link></Button>
          </div>
        </div>
      </Reveal>

      {loading ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : events.length === 0 ? (
        <Reveal delay={0.05}>
          <div className="bg-hero relative overflow-hidden rounded-3xl p-10 text-navy-foreground sm:p-14">
            <div className="grid-lines pointer-events-none absolute inset-0" />
            <div className="relative max-w-xl">
              <CalendarDays className="size-10 text-primary" />
              <h2 className="mt-5 text-3xl font-bold">Welcome to EventEase</h2>
              <p className="mt-3 text-navy-muted">Create your first event with a capacity, then register participants and start scanning at the gate.</p>
              {user && <div className="mt-6"><CreateEventDialog userId={user.id} /></div>}
            </div>
          </div>
        </Reveal>
      ) : (
        <div className="space-y-6">
          {event && (
            <Reveal delay={0.05}>
              <div className="bg-hero relative overflow-hidden rounded-3xl text-navy-foreground">
                <img src={event.cover_url || categoryImage(event.category)} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-navy via-navy/85 to-navy/40" />
                <div className="relative flex flex-col gap-8 p-7 sm:p-10 lg:flex-row lg:items-end lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-primary/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ring-1 ring-primary/40">{event.category}</span>
                      {status && (
                        <StatusPill tone={status === "Live" ? "success" : status === "Closed" ? "danger" : "neutral"} className="bg-navy-2/60">
                          {status.toUpperCase()}
                        </StatusPill>
                      )}
                    </div>
                    <h2 className="mt-4 text-3xl font-bold leading-tight sm:text-[2.5rem]">{event.title}</h2>
                    <p className="mt-3 flex flex-wrap gap-4 text-sm text-navy-muted">
                      <span className="flex items-center gap-1.5"><CalendarDays className="size-4" />{fmtDate(event.starts_at)}</span>
                      {event.venue && <span className="flex items-center gap-1.5"><MapPin className="size-4" />{event.venue}</span>}
                    </p>
                    <div className="mt-6 max-w-sm">
                      <div className="mb-1.5 flex justify-between font-mono text-xs text-navy-muted">
                        <span>Registration</span>
                        <span className="font-semibold text-navy-foreground">{registered} / {event.capacity}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-navy-border">
                        <div className="animate-grow h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (registered / event.capacity) * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button asChild variant="secondary" className="bg-navy-2/70 text-navy-foreground hover:bg-navy-2"><Link to="/events/$eventId" params={{ eventId: event.id }}><Users /> Manage</Link></Button>
                    <Button asChild variant="hero"><Link to="/check-in"><ScanLine /> Scan check-in</Link></Button>
                  </div>
                </div>
              </div>
            </Reveal>
          )}

          <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
            <Reveal delay={0.1}>
              <Panel className="h-full">
                <PanelHeader title="Live attendance" sub={`${registered - checkedIn} participants not yet arrived`} />
                <div className="flex justify-center py-2"><LiveAttendance registered={registered} checkedIn={checkedIn} /></div>
              </Panel>
            </Reveal>
            <Reveal delay={0.15}>
              <Panel className="h-full">
                <PanelHeader title="Live activity" sub="Real-time registrations & gate scans" />
                <LiveActivityPanel items={activity} />
              </Panel>
            </Reveal>
          </div>

          <Reveal delay={0.2}>
            <Panel>
              <PanelHeader title="Registrations & check-ins" sub="Cumulative growth across the event" />
              <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
                <RegistrationsCheckinsChart participants={participants} />
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
                  <div className="rounded-xl bg-elevated p-4 ring-1 ring-border">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Check-in rate</p>
                    <p className="mt-2 font-display text-3xl font-bold tabular-nums text-success">{checkInRate}%</p>
                  </div>
                  <div className="rounded-xl bg-elevated p-4 ring-1 ring-border">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">No-show rate</p>
                    <p className="mt-2 font-display text-3xl font-bold tabular-nums text-danger">{noShowRate}%</p>
                  </div>
                </div>
              </div>
            </Panel>
          </Reveal>

          <div className="grid gap-6 lg:grid-cols-2">
            <Reveal delay={0.25}>
              <Panel className="h-full">
                <PanelHeader title="Event health" sub="Composite score across the event lifecycle" />
                <EventHealthWidget
                  registered={registered}
                  capacity={event?.capacity ?? 0}
                  checkedIn={checkedIn}
                  duplicates={duplicates}
                  invalid={invalid}
                  totalScans={scanLogs.length}
                />
              </Panel>
            </Reveal>
            <Reveal delay={0.3}>
              <Panel className="h-full">
                <PanelHeader title="Security" sub={`${duplicates} duplicate attempts blocked · ${invalid} invalid attempts`} />
                <SecuritySnapshot duplicates={duplicates} invalid={invalid} success={success} recent={securityActivity} />
              </Panel>
            </Reveal>
          </div>

          <Reveal delay={0.35} className="flex justify-end">
            <Button asChild variant="outline"><Link to="/events/$eventId" params={{ eventId: event?.id ?? "" }}><Plus /> Open full event console</Link></Button>
          </Reveal>
        </div>
      )}
    </AppShell>
  );
}
