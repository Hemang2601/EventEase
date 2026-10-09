import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Loader2, Plus, ScanLine, Trash2, UserPlus, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Skeleton } from "./ui/skeleton";
import { staffCandidatesQuery, zoneOverviewQuery, type ZoneOverview } from "@/lib/zones";

export function ZonesPanel({ eventId, canManage, totalRegistered }: { eventId: string; canManage: boolean; totalRegistered: number }) {
  const qc = useQueryClient();
  const zones = useQuery(zoneOverviewQuery(eventId));
  const cands = useQuery({ ...staffCandidatesQuery(), enabled: canManage });
  const [name, setName] = useState("");
  const [cap, setCap] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["zones", eventId] }); qc.invalidateQueries({ queryKey: ["participants", eventId] }); };

  async function addZone(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    const c = cap ? Number(cap) : null;
    if (c !== null && (!Number.isInteger(c) || c < 1)) { toast.error("Capacity must be a positive number"); return; }
    setBusy(true);
    const { error } = await supabase.from("event_zones").insert({ event_id: eventId, name: n.slice(0, 60), capacity: c });
    setBusy(false);
    if (error) { toast.error(error.code === "23505" ? "A hall with this name already exists" : "Could not add hall"); return; }
    toast.success(`${n} added`); setName(""); setCap(""); refresh();
  }

  async function removeZone(z: ZoneOverview) {
    if (!confirm(`Delete ${z.name}? Its ${z.registered} students become unassigned.`)) return;
    const { error } = await supabase.from("event_zones").delete().eq("id", z.id);
    if (error) toast.error("Could not delete hall"); else { toast.success("Hall deleted"); refresh(); }
  }

  async function addStaff(zoneId: string, userId: string) {
    if (!userId) return;
    const { error } = await supabase.from("zone_staff").insert({ zone_id: zoneId, user_id: userId });
    if (error) toast.error(error.code === "23505" ? "Already assigned here" : "Could not assign organizer");
    else { toast.success("Organizer assigned"); refresh(); }
  }

  async function removeStaff(zoneId: string, userId: string) {
    const { error } = await supabase.from("zone_staff").delete().eq("zone_id", zoneId).eq("user_id", userId);
    if (error) toast.error("Could not remove"); else refresh();
  }

  const list = zones.data ?? [];
  const reg = list.reduce((s, z) => s + Number(z.registered), 0);
  const inn = list.reduce((s, z) => s + Number(z.checked_in), 0);
  const unassigned = canManage ? Math.max(0, totalRegistered - reg) : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        {[["Halls", list.length, ""], ["Registered", reg, ""], ["Checked in", inn, "text-success"], ["Not yet in", reg - inn, "text-primary"]].map(([l, v, c]) => (
          <div key={l as string} className="panel p-5"><p className="text-sm text-muted-foreground">{l}</p><p className={`mt-2 font-display text-3xl font-bold ${c}`}>{v}</p></div>
        ))}
      </div>

      {canManage && (
        <form onSubmit={addZone} className="panel flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
          <div className="flex-1">
            <p className="text-sm font-semibold">Add a hall / check-in point</p>
            <p className="mb-2 text-xs text-muted-foreground">New registrations are auto-assigned to the least-filled hall.</p>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Auditorium 1" maxLength={60} aria-label="Hall name" />
          </div>
          <Input value={cap} onChange={(e) => setCap(e.target.value)} type="number" min={1} placeholder="Seats (optional)" className="sm:w-40" aria-label="Hall capacity" />
          <Button type="submit" variant="hero" disabled={busy || !name.trim()}>{busy ? <Loader2 className="animate-spin" /> : <Plus />} Add hall</Button>
        </form>
      )}

      {unassigned > 0 && list.length > 0 && (
        <p className="rounded-xl bg-amber/10 px-4 py-3 text-sm text-amber ring-1 ring-amber/25">
          {unassigned} student{unassigned > 1 ? "s are" : " is"} not in any hall — only the event owner or admin can check them in.
        </p>
      )}

      {zones.isLoading ? <Skeleton className="h-48 rounded-2xl" /> : list.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed bg-card p-12 text-center">
          <Building2 className="size-10 text-primary" />
          <p className="mt-3 font-semibold">{canManage ? "No halls yet" : "You are not assigned to a hall"}</p>
          <p className="mt-1 text-sm text-muted-foreground">{canManage ? "Add halls like Auditorium 1, 2, 3 and assign organizers to each." : "Ask the admin to assign you."}</p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {list.map((z, i) => {
            const pct = z.registered ? Math.round((z.checked_in / z.registered) * 100) : 0;
            const free = (cands.data ?? []).filter((c) => !z.staff.some((s) => s.user_id === c.id));
            return (
              <div key={z.id} className="panel animate-rise p-5" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-lg font-semibold"><Building2 className="size-4 text-primary" />{z.name}</p>
                    <p className="text-xs text-muted-foreground">{z.capacity ? `${z.registered}/${z.capacity} seats` : `${z.registered} registered`}{z.mine && " · your hall"}</p>
                  </div>
                  {canManage && <Button size="icon" variant="ghost" onClick={() => removeZone(z)} aria-label={`Delete ${z.name}`}><Trash2 className="size-4" /></Button>}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-muted/50 p-2"><p className="font-display text-xl font-bold">{z.registered}</p><p className="text-[11px] text-muted-foreground">Registered</p></div>
                  <div className="rounded-xl bg-success-soft p-2"><p className="font-display text-xl font-bold text-success">{z.checked_in}</p><p className="text-[11px] text-muted-foreground">Scanned in</p></div>
                  <div className="rounded-xl bg-destructive/5 p-2"><p className="font-display text-xl font-bold text-destructive">{z.rejected}</p><p className="text-[11px] text-muted-foreground">Rejected</p></div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-success transition-all duration-700" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-right text-xs text-muted-foreground">{pct}% attended</p>

                <p className="mt-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Users className="size-3.5" /> Organizers ({z.staff.length})</p>
                <ul className="mt-2 space-y-1.5">
                  {z.staff.length === 0 && <li className="text-sm text-muted-foreground">Nobody assigned yet</li>}
                  {z.staff.map((s) => (
                    <li key={s.user_id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{s.full_name || s.email}</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground"><ScanLine className="size-3" />{s.scans} scanned</span>
                      </span>
                      {canManage && <button type="button" onClick={() => removeStaff(z.id, s.user_id)} className="rounded p-1 text-muted-foreground hover:text-destructive" aria-label="Remove organizer"><X className="size-4" /></button>}
                    </li>
                  ))}
                </ul>
                {canManage && (
                  <label className="mt-3 flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
                    <UserPlus className="size-4 text-primary" />
                    <select className="w-full bg-transparent outline-none" value="" onChange={(e) => { if (e.target.value) addStaff(z.id, e.target.value); }} aria-label={`Assign organizer to ${z.name}`}>
                      <option value="">{free.length ? "Assign organizer…" : "No more organizers available"}</option>
                      {free.map((c) => <option key={c.id} value={c.id}>{c.full_name || c.email}{c.email && c.full_name ? ` · ${c.email}` : ""}</option>)}
                    </select>
                  </label>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
