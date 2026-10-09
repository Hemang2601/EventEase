import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Check, Crown, Inbox, LayoutGrid, Link2, ScanLine, Search, Settings2, UserCheck, UserPlus, Users, Wifi, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { fmtDate, type EventRow } from "@/lib/events";
import { EditEventDialog } from "@/components/EditEventDialog";
import { zoneOverviewQuery } from "@/lib/zones";
import type { Role } from "@/lib/roles";
import { ZonesPanel } from "@/components/ZonesPanel";
import { AdminEditRequests, useEditRequests } from "@/components/AdminEditRequests";
import { useOnlineUsers } from "@/lib/presence";
import { createOrganizer } from "@/lib/admin.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Console — EventEase" },
      { name: "description", content: "Manage users, organizer approvals, roles and every event." },
      { property: "og:title", content: "Admin Console — EventEase" },
      { property: "og:description", content: "Full platform control for EventEase admins." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [hallEvent, setHallEvent] = useState<{ id: string; title: string; total: number } | null>(null);
  const [manageEvent, setManageEvent] = useState<string | null>(null);

  const data = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const [pr, rl, ev, ps, tk, st] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("events").select("*").order("starts_at"),
        supabase.from("participants").select("event_id, checked_in_at"),
        supabase.from("support_tickets").select("status"),
        supabase.from("zone_staff").select("user_id, zone_id, event_zones(name, event_id)"),
      ]);
      if (st.error) throw st.error;
      for (const r of [pr, rl, ev, ps, tk]) if (r.error) throw r.error;
      const roles: Record<string, Role[]> = {};
      for (const r of rl.data ?? []) (roles[r.user_id] ??= []).push(r.role as Role);
      return { profiles: pr.data ?? [], roles, events: ev.data ?? [], participants: ps.data ?? [], tickets: tk.data ?? [], staff: (st.data ?? []) as unknown as { user_id: string; zone_id: string; event_zones: { name: string; event_id: string } | null }[] };
    },
  });

  const d = data.data;
  const online = useOnlineUsers(true);
  const users = useMemo(() => (d?.profiles ?? []).filter((p) => `${p.email} ${p.full_name}`.toLowerCase().includes(search.toLowerCase())), [d, search]);
  const requests = (d?.profiles ?? []).filter((p) => p.wants_organizer && !d?.roles[p.id]?.includes("organizer"));
  const editPending = (useEditRequests().data ?? []).filter((r) => r.status === "pending").length;
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-overview"] }); qc.invalidateQueries({ queryKey: ["my-roles"] }); };

  async function setRole(uid: string, role: Role, enabled: boolean) {
    const { data: r, error } = await supabase.rpc("admin_set_role", { _user_id: uid, _role: role, _enabled: enabled });
    const res = r as { ok: boolean; error?: string } | null;
    if (error || !res?.ok) { toast.error(res?.error ?? "Could not update role"); return; }
    toast.success(`${role} ${enabled ? "granted" : "removed"}`);
    refresh();
  }
  async function dismiss(uid: string) {
    const { error } = await supabase.rpc("admin_dismiss_request", { _user_id: uid });
    if (error) { toast.error("Could not dismiss"); return; }
    toast.success("Request rejected"); refresh();
  }
  async function toggleEvent(id: string, is_open: boolean) {
    const { error } = await supabase.from("events").update({ is_open }).eq("id", id);
    if (error) { toast.error("Could not update event"); return; }
    qc.invalidateQueries({ queryKey: ["events"] }); qc.invalidateQueries({ queryKey: ["event", id] }); qc.invalidateQueries({ queryKey: ["events", "explore"] }); refresh();
  }

  const stat = (eid: string) => {
    const ps = (d?.participants ?? []).filter((p) => p.event_id === eid);
    return { r: ps.length, c: ps.filter((p) => p.checked_in_at).length };
  };

  return (
    <AppShell allow={["admin"]} title="Admin console">
      <div className="bg-hero relative mb-7 overflow-hidden rounded-3xl p-8 text-navy-foreground">
        <div className="grid-lines pointer-events-none absolute inset-0" />
        <div className="relative flex items-center gap-4">
          <span className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground"><Crown /></span>
          <div><h1 className="text-3xl font-bold tracking-tight">Admin console</h1><p className="mt-1 text-sm text-navy-muted">Full control over users, organizers and every event.</p></div>
        </div>
      </div>

      {!d ? <Skeleton className="h-96 rounded-2xl" /> : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard icon={Users} label="Total users" value={d.profiles.length} />
            <StatCard icon={Wifi} label="Online now" value={Object.keys(online).length} />
            <StatCard icon={UserCheck} label="Organizers" value={Object.values(d.roles).filter((r) => r.includes("organizer")).length} />
            <StatCard icon={CalendarDays} label="Events" value={d.events.length} />
            <StatCard icon={Inbox} label="Open help requests" value={d.tickets.filter((t) => t.status === "open").length} />
          </div>

          <Tabs key={editPending ? "e" : requests.length ? "r" : "u"} defaultValue={editPending ? "edits" : requests.length ? "requests" : "users"}>
            <TabsList>
              <TabsTrigger value="requests">Organizer requests ({requests.length})</TabsTrigger>
              <TabsTrigger value="edits">Edit requests ({editPending})</TabsTrigger>
              <TabsTrigger value="users">Users & roles</TabsTrigger>
              <TabsTrigger value="organizers">Organizers</TabsTrigger>
              <TabsTrigger value="events">All events</TabsTrigger>
            </TabsList>

            <TabsContent value="edits" className="mt-5"><AdminEditRequests profiles={d.profiles} /></TabsContent>
            <TabsContent value="requests" className="mt-5">
              {!requests.length ? <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">No pending organizer requests.</div> : (
                <div className="grid gap-3 md:grid-cols-2">
                  {requests.map((p) => (
                    <div key={p.id} className="panel flex items-center justify-between gap-3 p-4">
                      <div className="min-w-0"><p className="truncate font-semibold">{p.full_name}</p><p className="truncate text-xs text-muted-foreground">{p.email}</p></div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => dismiss(p.id)}><X /> Reject</Button>
                        <Button size="sm" onClick={() => setRole(p.id, "organizer", true)}><Check /> Approve</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="users" className="mt-5">
              <div className="relative mb-4 max-w-sm"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Search users" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
              <div className="panel overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="p-4">User</th><th className="p-4">Status</th><th className="p-4">Role</th><th className="p-4">Joined</th><th className="p-4">Organizer</th><th className="p-4">Admin</th></tr></thead>
                  <tbody>
                    {users.map((p) => {
                      const r = d.roles[p.id] ?? [];
                      const isOnline = !!online[p.id];
                      return (
                        <tr key={p.id} className="border-b last:border-0 hover:bg-muted/40">
                          <td className="p-4"><p className="font-medium">{p.full_name}</p><p className="text-xs text-muted-foreground">{p.email}</p></td>
                          <td className="p-4">
                            {isOnline
                              ? <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-semibold text-success"><span className="size-1.5 animate-pulse rounded-full bg-success" /> Online</span>
                              : <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground"><span className="size-1.5 rounded-full bg-muted-foreground/50" /> Offline</span>}
                          </td>
                          <td className="p-4">
                            {(() => {
                              const role: "admin" | "organizer" | "student" = r.includes("admin") ? "admin" : r.includes("organizer") ? "organizer" : "student";
                              return (
                                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${role === "admin" ? "bg-slate-800 text-white" : role === "organizer" ? "bg-primary/10 text-primary" : "bg-sky-100 text-sky-700"}`}>{role}</span>
                              );
                            })()}
                          </td>
                          <td className="p-4 text-xs text-muted-foreground">{fmtDate(p.created_at)}</td>
                          <td className="p-4"><Switch checked={r.includes("organizer")} onCheckedChange={(v) => setRole(p.id, "organizer", v)} /></td>
                          <td className="p-4"><Switch checked={r.includes("admin")} disabled={p.id === user?.id} onCheckedChange={(v) => setRole(p.id, "admin", v)} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="organizers" className="mt-5">
              <OrganizersTab
                organizers={d.profiles.filter((p) => d.roles[p.id]?.includes("organizer"))}
                staff={d.staff}
                events={d.events}
                onChanged={refresh}
                onAssign={(e) => setHallEvent(e)}
              />
            </TabsContent>

            <TabsContent value="events" className="mt-5">
              <div className="panel overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="p-4">Event</th><th className="p-4">Organizer</th><th className="p-4">Registered</th><th className="p-4">Checked in</th><th className="p-4">Registration</th><th className="p-4" /></tr></thead>
                  <tbody>
                    {d.events.map((e) => {
                      const s = stat(e.id);
                      const owner = d.profiles.find((p) => p.id === e.owner_id);
                      return (
                        <tr key={e.id} className="border-b last:border-0 hover:bg-muted/40">
                          <td className="p-4"><p className="font-medium">{e.title}</p><p className="text-xs text-muted-foreground">{fmtDate(e.starts_at)}</p></td>
                          <td className="p-4 text-xs">{owner?.email ?? "—"}</td>
                          <td className="p-4 font-semibold">{s.r}/{e.capacity}</td>
                          <td className="p-4 font-semibold text-success">{s.c}</td>
                          <td className="p-4"><Switch checked={e.is_open} onCheckedChange={(v) => toggleEvent(e.id, v)} /></td>
                          <td className="p-4">
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => setHallEvent({ id: e.id, title: e.title, total: s.r })}><LayoutGrid /> Halls & organizers</Button>
                              <Button size="sm" variant="outline" onClick={() => setManageEvent(e.id)}><Settings2 /> Manage</Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}

      <HallStatsDialog event={hallEvent} onClose={() => { setHallEvent(null); refresh(); }} />
      <EventManageDialog
        event={(d?.events.find((e) => e.id === manageEvent) ?? null) as EventRow | null}
        registered={manageEvent ? stat(manageEvent).r : 0}
        checkedIn={manageEvent ? stat(manageEvent).c : 0}
        onClose={() => setManageEvent(null)}
        onToggle={toggleEvent}
      />
    </AppShell>
  );
}

function HallStatsDialog({ event, onClose }: { event: { id: string; title: string; total: number } | null; onClose: () => void }) {
  const zones = useQuery({ ...zoneOverviewQuery(event?.id ?? ""), enabled: !!event });
  const list = zones.data ?? [];
  const totals = useMemo(() => ({
    registered: list.reduce((a, z) => a + z.registered, 0),
    checked: list.reduce((a, z) => a + z.checked_in, 0),
    scans: list.reduce((a, z) => a + z.staff.reduce((b, s) => b + s.scans, 0), 0),
  }), [list]);

  return (
    <Dialog open={!!event} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Hall-wise breakdown — {event?.title}</DialogTitle></DialogHeader>
        {event && <ZonesPanel eventId={event.id} canManage totalRegistered={event.total} />}
        {!event ? null : zones.isLoading ? <Skeleton className="h-48 rounded-2xl" /> : !list.length ? null : (
          <div className="space-y-4 border-t pt-4">
            <p className="font-semibold">Scan report</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="panel p-3 text-center"><p className="text-xs text-muted-foreground">Total registered</p><p className="text-xl font-bold">{totals.registered}</p></div>
              <div className="panel p-3 text-center"><p className="text-xs text-muted-foreground">Total checked in</p><p className="text-xl font-bold text-success">{totals.checked}</p></div>
              <div className="panel p-3 text-center"><p className="text-xs text-muted-foreground">Total scans</p><p className="text-xl font-bold text-primary">{totals.scans}</p></div>
            </div>
            <div className="space-y-3">
              {list.map((z) => (
                <div key={z.id} className="panel p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-semibold">{z.name}</p>
                    <p className="text-xs text-muted-foreground">{z.registered} registered · <span className="font-semibold text-success">{z.checked_in} checked in</span>{z.rejected ? ` · ${z.rejected} rejected` : ""}</p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${z.registered ? Math.min(100, (z.checked_in / z.registered) * 100) : 0}%` }} />
                  </div>
                  <div className="mt-3 space-y-1">
                    {z.staff.length ? z.staff.map((s) => (
                      <div key={s.user_id} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2"><UserCheck className="size-3.5 text-primary" />{s.full_name ?? s.email ?? "Organizer"}</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground"><ScanLine className="size-3.5" />{s.scans} scans</span>
                      </div>
                    )) : <p className="text-xs text-muted-foreground">Koi organizer assign nahi — sirf event owner/admin scan kar sakte hain.</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EventManageDialog({ event, registered, checkedIn, onClose, onToggle }: {
  event: EventRow | null;
  registered: number;
  checkedIn: number;
  onClose: () => void;
  onToggle: (id: string, is_open: boolean) => void;
}) {
  const link = event ? `${window.location.origin}/register/${event.id}` : "";
  return (
    <Dialog open={!!event} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {event && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Settings2 className="size-5 text-primary" /> Manage — {event.title}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">{fmtDate(event.starts_at)}{event.venue ? ` · ${event.venue}` : ""}</p>

            <div className="grid grid-cols-3 gap-3">
              <div className="panel animate-fade-scale p-3 text-center"><p className="text-xs text-muted-foreground">Registered</p><p className="text-xl font-bold">{registered}/{event.capacity}</p></div>
              <div className="panel animate-fade-scale p-3 text-center" style={{ animationDelay: "60ms" }}><p className="text-xs text-muted-foreground">Checked in</p><p className="text-xl font-bold text-success">{checkedIn}</p></div>
              <div className="panel animate-fade-scale p-3 text-center" style={{ animationDelay: "120ms" }}><p className="text-xs text-muted-foreground">Seats left</p><p className="text-xl font-bold text-primary">{Math.max(0, event.capacity - registered)}</p></div>
            </div>

            <div className="panel flex items-center justify-between gap-3 p-4">
              <div><p className="font-semibold">Registration</p><p className="text-xs text-muted-foreground">{event.is_open ? "Students can register right now." : "Registration is closed for students."}</p></div>
              <Switch checked={event.is_open} onCheckedChange={(v) => onToggle(event.id, v)} />
            </div>

            <div className="panel flex items-center gap-2 p-4">
              <Link2 className="size-4 shrink-0 text-primary" />
              <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{link}</p>
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(link); toast.success("Registration link copied"); }}>Copy link</Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-sm font-semibold">Edit event details</p>
              <EditEventDialog event={event} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

type Prof = { id: string; email: string | null; full_name: string | null };
function OrganizersTab({ organizers, staff, events, onChanged, onAssign }: {
  organizers: Prof[];
  staff: { user_id: string; zone_id: string; event_zones: { name: string; event_id: string } | null }[];
  events: { id: string; title: string }[];
  onChanged: () => void;
  onAssign: (e: { id: string; title: string; total: number }) => void;
}) {
  const create = useServerFn(createOrganizer);
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState("");

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true);
    try {
      const r = await create({ data: form });
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(r.existed ? "Existing user is now an organizer" : "Organizer account created");
      setForm({ fullName: "", email: "", password: "" });
      onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not add organizer"); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
      <div className="space-y-5">
        <form onSubmit={submit} className="panel space-y-3 p-5">
          <p className="flex items-center gap-2 font-semibold"><UserPlus className="size-4 text-primary" /> Add organizer</p>
          <p className="text-xs text-muted-foreground">Naya account banega. Agar email pehle se hai to us user ko organizer bana diya jayega.</p>
          <Input required placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <Input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input required minLength={8} type="text" placeholder="Password (min 8)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Adding…" : "Add organizer"}</Button>
        </form>
        <div className="panel space-y-3 p-5">
          <p className="flex items-center gap-2 font-semibold"><LayoutGrid className="size-4 text-primary" /> Assign organizers to an event</p>
          <p className="text-xs text-muted-foreground">Event chuno → hall banao → har hall me ek ya zyada organizers assign karo.</p>
          <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Select event…</option>
            {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
          <Button className="w-full" variant="outline" disabled={!pick} onClick={() => { const e = events.find((x) => x.id === pick); if (e) onAssign({ id: e.id, title: e.title, total: 0 }); }}>Open halls & organizers</Button>
        </div>
      </div>
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="p-4">Organizer</th><th className="p-4">Assigned to</th></tr></thead>
          <tbody>
            {!organizers.length && <tr><td colSpan={2} className="p-8 text-center text-muted-foreground">No organizers yet.</td></tr>}
            {organizers.map((o) => {
              const mine = staff.filter((s) => s.user_id === o.id && s.event_zones);
              return (
                <tr key={o.id} className="border-b align-top last:border-0 hover:bg-muted/40">
                  <td className="p-4"><p className="font-medium">{o.full_name}</p><p className="text-xs text-muted-foreground">{o.email}</p></td>
                  <td className="p-4">
                    {mine.length ? <div className="flex flex-wrap gap-1.5">{mine.map((s) => {
                      const ev = events.find((e) => e.id === s.event_zones!.event_id);
                      return <span key={s.zone_id} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{ev?.title ?? "Event"} · {s.event_zones!.name}</span>;
                    })}</div> : <span className="text-xs text-muted-foreground">Not assigned yet</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
