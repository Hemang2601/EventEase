import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, CalendarDays, Copy, ExternalLink, MapPin, Trash2 } from "lucide-react";
import { EditEventDialog } from "@/components/EditEventDialog";
import { EventUpdatePanel } from "@/components/EventUpdatePanel";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { CountUp } from "@/components/CountUp";
import { CheckInPanel } from "@/components/CheckInPanel";
import { EventAnalytics } from "@/components/EventAnalytics";
import { ParticipantsTable } from "@/components/ParticipantsTable";
import { RegisterForm, type RegisteredTicket } from "@/components/RegisterForm";
import { ScanLog } from "@/components/ScanLog";
import { Ticket } from "@/components/Ticket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { eventQuery, fmtDate, participantsQuery, scanLogsQuery } from "@/lib/events";
import { categoryImage } from "@/lib/categories";
import { ZonesPanel } from "@/components/ZonesPanel";
import { HostBadge } from "@/components/HostBadge";
import { useRoles } from "@/lib/roles";
import { Users as UsersIcon, ChartNoAxesCombined, ScanLine } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ee/index";
import { buildActivity, LiveActivityPanel, SecuritySnapshot } from "@/components/ee/dashboard-widgets";

export const Route = createFileRoute("/_authenticated/events/$eventId")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Event Console — EventEase" },
      { name: "description", content: "Register participants, scan QR codes and track attendance live." },
      { property: "og:title", content: "Event Console — EventEase" },
      { property: "og:description", content: "Register, check in and track attendance live." },
    ],
  }),
  component: EventConsole,
});

function EventConsole() {
  const { eventId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const ev = useQuery(eventQuery(eventId));
  const { user, isAdmin } = useRoles();
  const ps = useQuery(participantsQuery(eventId));
  const logs = useQuery(scanLogsQuery(eventId));
  const [ticket, setTicket] = useState<RegisteredTicket | null>(null);
  const [tab, setTab] = useState("checkin");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["participants", eventId] });
    qc.invalidateQueries({ queryKey: ["scan-logs", eventId] });
    qc.invalidateQueries({ queryKey: ["events"] });
  };

  useEffect(() => {
    localStorage.setItem("eventease:selected-event", eventId);
    const ch = supabase
      .channel(`event-${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "participants", filter: `event_id=eq.${eventId}` },
        () => qc.invalidateQueries({ queryKey: ["participants", eventId] }))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "scan_logs", filter: `event_id=eq.${eventId}` },
        () => qc.invalidateQueries({ queryKey: ["scan-logs", eventId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [eventId, qc]);

  const list = ps.data ?? [];
  const registered = list.length;
  const checkedIn = list.filter((p) => p.checked_in_at).length;

  if (ev.isLoading) return <AppShell allow={["organizer"]} title="Event console"><Skeleton className="h-72 rounded-2xl" /></AppShell>;
  if (!ev.data) return (
    <AppShell allow={["organizer"]} title="Event console">
      <div className="grid place-items-center rounded-2xl border border-dashed bg-card p-16 text-center">
        <p className="text-xl font-semibold">Event not found</p>
        <Button asChild className="mt-4"><Link to="/events">Back to events</Link></Button>
      </div>
    </AppShell>
  );
  const e = ev.data;
  const canManage = isAdmin || e.owner_id === user?.id;
  const full = ps.isSuccess && registered >= e.capacity;
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const publicUrl = origin ? `${origin}/register/${e.id}` : "";

  async function deleteEvent() {
    const { error } = await supabase.from("events").delete().eq("id", e.id);
    if (error) toast.error("Could not delete event");
    else { toast.success("Event deleted"); qc.invalidateQueries({ queryKey: ["events"] }); navigate({ to: "/events" }); }
  }

  async function toggleOpen(next: boolean) {
    const { error } = await supabase.from("events").update({ is_open: next }).eq("id", e.id);
    if (error) { toast.error("Could not update registration status"); return; }
    toast.success(next ? "Registrations opened" : "Registrations closed");
    qc.invalidateQueries({ queryKey: ["event", e.id] });
    qc.invalidateQueries({ queryKey: ["events"] });
  }

  return (
    <AppShell allow={["organizer"]} title={e.title}>
      <Link to="/events" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" /> All events</Link>

      <section className="bg-hero relative mb-6 animate-rise overflow-hidden rounded-3xl p-6 text-navy-foreground sm:p-8">
        <img src={e.cover_url || categoryImage(e.category)} alt="" width={1024} height={640} className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-navy via-navy/85 to-navy/30" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <span className="rounded-full bg-primary/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-navy-foreground ring-1 ring-primary/40">{e.category}</span>
            <h1 className="mt-4 text-3xl font-bold sm:text-4xl">{e.title}</h1>
            <p className="mt-3 flex flex-wrap gap-4 text-sm text-navy-muted">
              <span className="flex items-center gap-1.5"><CalendarDays className="size-4" />{fmtDate(e.starts_at)}</span>
              {e.venue && <span className="flex items-center gap-1.5"><MapPin className="size-4" />{e.venue}</span>}
            </p>
            {e.description && <p className="mt-3 max-w-[60ch] text-sm text-navy-muted">{e.description}</p>}
            <div className="mt-4">
              <HostBadge name={e.host_name} photo={e.host_photo_url} light />
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-3 gap-2 sm:gap-3">
            {[["Registered", registered, ""], ["Checked in", checkedIn, "text-success"], ["Capacity", e.capacity, ""]].map(([l, v, c]) => (
              <div key={l as string} className="min-w-0 sm:min-w-[104px] rounded-2xl bg-navy-2/80 px-2.5 sm:px-4 py-2.5 sm:py-3 text-center sm:text-left ring-1 ring-navy-border backdrop-blur">
                <p className="text-[10px] sm:text-[11px] text-navy-muted truncate">{l}</p>
                <CountUp value={v as number} className={`mt-0.5 sm:mt-1 block font-display text-lg sm:text-2xl font-bold ${c}`} />
              </div>
            ))}
          </div>
        </div>
        <div className="relative mt-6">
          <div className="mb-1.5 flex justify-between text-xs text-navy-muted">
            <span>{checkedIn} of {registered} attendees in · {Math.max(0, e.capacity - registered)} seats left</span>
            <span className="font-semibold text-navy-foreground">{registered ? Math.round((checkedIn / registered) * 100) : 0}%</span>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-navy-border">
            <div className="absolute inset-y-0 left-0 rounded-full bg-primary/70 transition-all duration-700" style={{ width: `${Math.min(100, (registered / e.capacity) * 100)}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-success transition-all duration-700" style={{ width: `${Math.min(100, (checkedIn / e.capacity) * 100)}%` }} />
          </div>
        </div>
      </section>

      {ps.isSuccess && (
        <section className="mb-6 grid gap-6 lg:grid-cols-2">
          <Panel>
            <PanelHeader title="Live activity" sub="Real-time registrations & gate scans" />
            <LiveActivityPanel items={buildActivity(list, logs.data ?? [])} />
          </Panel>
          <Panel>
            <PanelHeader title="Security" sub="Duplicate and invalid scan attempts at the gate" />
            <SecuritySnapshot
              duplicates={(logs.data ?? []).filter((l) => l.result === "duplicate").length}
              invalid={(logs.data ?? []).filter((l) => l.result !== "duplicate" && l.result !== "success").length}
              success={(logs.data ?? []).filter((l) => l.result === "success").length}
              recent={buildActivity(list, logs.data ?? []).filter((a) => a.tone === "danger" || a.tone === "success").slice(0, 6)}
            />
          </Panel>
        </section>
      )}

      <div className="mb-5 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setTab("checkin")}><ScanLine /> Scan check-in</Button>
        <Button variant="outline" onClick={() => setTab("people")}><UsersIcon /> Manage participants</Button>
        <Button variant="outline" onClick={() => setTab("analytics")}><ChartNoAxesCombined /> Analytics</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap justify-start rounded-xl bg-card p-1 shadow-card ring-1 ring-border">
          <TabsTrigger value="checkin" className="px-4">Check-in</TabsTrigger>
          <TabsTrigger value="halls" className="px-4">Halls & organizers</TabsTrigger>
          {canManage && <TabsTrigger value="register" className="px-4">Register</TabsTrigger>}
          <TabsTrigger value="people" className="px-4">Participants ({registered})</TabsTrigger>
          <TabsTrigger value="analytics" className="px-4">Analytics</TabsTrigger>
          <TabsTrigger value="security" className="px-4">Scan log</TabsTrigger>
          {canManage && <TabsTrigger value="share" className="px-4">Share & settings</TabsTrigger>}
          <TabsTrigger value="update" className="px-4">Update event</TabsTrigger>
        </TabsList>

        <TabsContent value="update" className="mt-4"><EventUpdatePanel event={e} isAdmin={isAdmin} /></TabsContent>
        <TabsContent value="checkin" className="panel mt-4 p-6"><CheckInPanel eventId={e.id} onDone={() => { refresh(); qc.invalidateQueries({ queryKey: ["zones", e.id] }); }} /></TabsContent>
        <TabsContent value="halls" className="mt-4"><ZonesPanel eventId={e.id} canManage={canManage} totalRegistered={registered} /></TabsContent>

        <TabsContent value="register" className="mt-4">
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <div className="panel p-6">
              <h2 className="mb-1 text-lg font-semibold">Register participant</h2>
              <p className="mb-5 text-sm text-muted-foreground">A unique QR pass is generated instantly. Duplicate emails are blocked.</p>
              <RegisterForm eventId={e.id} eventTitle={e.title} disabled={full} onRegistered={(t) => { setTicket(t); refresh(); }} />
            </div>
            {ticket ? (
              <Ticket code={ticket.code} name={ticket.full_name} email={ticket.email} eventTitle={e.title} meta={e.venue ?? undefined} date={fmtDate(e.starts_at)} />
            ) : (
              <div className="grid min-h-[320px] place-items-center rounded-2xl border border-dashed bg-card p-10 text-center">
                <div><p className="font-semibold">Pass preview</p><p className="mt-2 text-sm text-muted-foreground">A unique QR pass and entry code appear here after registration.</p></div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="people" className="panel mt-4 p-6"><ParticipantsTable eventId={e.id} eventTitle={e.title} list={list} /></TabsContent>
        <TabsContent value="analytics" className="mt-4"><EventAnalytics participants={list} logs={logs.data ?? []} capacity={e.capacity} /></TabsContent>
        <TabsContent value="security" className="panel mt-4 p-6"><ScanLog logs={logs.data ?? []} /></TabsContent>

        <TabsContent value="share" className="mt-4 grid gap-6 lg:grid-cols-2">
          <div className="panel p-6">
            <h2 className="text-lg font-semibold">Public registration link</h2>
            <p className="mt-2 text-sm text-muted-foreground">Share this link — students self-register and instantly receive their QR pass.</p>
            <div className="mt-4 flex gap-2">
              <Input readOnly value={publicUrl} className="font-mono text-xs" />
              <Button variant="outline" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Link copied"); }} aria-label="Copy link"><Copy /></Button>
              <Button asChild variant="outline"><a href={publicUrl} target="_blank" rel="noreferrer" aria-label="Open link"><ExternalLink /></a></Button>
            </div>
            <div className="mt-6 flex items-center justify-between rounded-xl border bg-muted/40 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Registrations {e.is_open ? "open" : "closed"}</p>
                <p className="text-xs text-muted-foreground">{e.is_open ? "New participants can register via the public link." : "The public link shows a closed message — no new registrations."}</p>
              </div>
              <Switch checked={e.is_open} onCheckedChange={toggleOpen} aria-label="Toggle registrations" />
            </div>
            {isAdmin && <div className="mt-4"><EditEventDialog event={e} /></div>}
          </div>
          <div className="panel p-6">
            <h2 className="text-lg font-semibold">Danger zone</h2>
            <p className="mt-2 text-sm text-muted-foreground">Deleting removes the event, all participants and scan history permanently.</p>
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="destructive" className="mt-4"><Trash2 /> Delete event</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Delete “{e.title}”?</AlertDialogTitle>
                  <AlertDialogDescription>This cannot be undone. {registered} participant records will be deleted.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={deleteEvent}>Delete</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
