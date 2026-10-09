import { useMemo, useState } from "react";
import { toast } from "sonner";
import { QRCodeCanvas } from "qrcode.react";
import { Download, History, Search, ShieldCheck, Trash2, Undo2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";

type P = Tables<"participants">;
type L = Tables<"scan_logs">;

export function ParticipantsTable({ eventId, eventTitle, list, logs = [] }: { eventId: string; eventTitle: string; list: P[]; logs?: L[] }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "in" | "out">("all");
  const [active, setActive] = useState<P | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return list.filter((p) =>
      (filter === "all" || (filter === "in" ? p.checked_in_at : !p.checked_in_at)) &&
      (!s || p.full_name.toLowerCase().includes(s) || p.email.includes(s) || p.code.toLowerCase().includes(s)));
  }, [list, q, filter]);

  const activeLogs = useMemo(() => (active ? logs.filter((l) => l.participant_id === active.id || l.code === active.code) : []), [logs, active]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["participants", eventId] });
    qc.invalidateQueries({ queryKey: ["events"] });
    qc.invalidateQueries({ queryKey: ["zones", eventId] });
  };

  function exportCsv() {
    const rows = [["Name", "Email", "Phone", "Department", "Code", "Registered", "Checked in", "Gate"],
      ...list.map((p) => [p.full_name, p.email, p.phone ?? "", p.department ?? "", p.code, p.created_at, p.checked_in_at ?? "", p.checked_in_gate ?? ""])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${eventTitle.replace(/\W+/g, "-")}-participants.csv`;
    a.click();
  }

  async function undo(id: string) {
    const { error } = await supabase.from("participants").update({ checked_in_at: null, checked_in_gate: null }).eq("id", id);
    if (error) toast.error("Could not undo"); else { toast.success("Check-in reverted"); refresh(); }
  }
  async function remove(id: string) {
    const { error } = await supabase.from("participants").delete().eq("id", id);
    if (error) toast.error("Could not remove"); else { toast.success("Participant removed"); refresh(); setActive(null); }
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">Participants</h2>
          <p className="text-xs text-muted-foreground">{list.length} registered</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or code" className="pl-9" />
          </div>
          {(["all", "in", "out"] as const).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
              {f === "all" ? `All (${list.length})` : f === "in" ? "Checked in" : "Not arrived"}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!list.length}><Download /> CSV</Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full whitespace-nowrap text-sm">
          <thead className="bg-muted/60"><tr className="text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <th className="px-5 py-3.5">Participant</th><th className="px-5 py-3.5">Entry Code</th><th className="px-5 py-3.5">Registration</th><th className="px-5 py-3.5">Check-In</th><th className="px-5 py-3.5">Gate</th><th className="px-5 py-3.5">Time</th><th className="px-5 py-3.5">Status</th>
          </tr></thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="cursor-pointer border-t transition-colors hover:bg-muted/40" onClick={() => setActive(p)}>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                      {p.full_name.split(" ").slice(0, 2).map((s) => s[0]?.toUpperCase()).join("")}
                    </span>
                    <div className="min-w-0"><p className="font-semibold">{p.full_name}</p><p className="truncate text-xs text-muted-foreground">{p.email}</p></div>
                  </div>
                </td>
                <td className="px-5 py-4 font-mono text-xs">{p.code}</td>
                <td className="px-5 py-4 text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString([], { day: "2-digit", month: "short" })}</td>
                <td className="px-5 py-4 text-xs text-muted-foreground">{p.checked_in_at ? new Date(p.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                <td className="px-5 py-4 font-mono text-xs text-muted-foreground">{p.checked_in_gate ?? "—"}</td>
                <td className="px-5 py-4 text-xs text-muted-foreground">{p.checked_in_at ? new Date(p.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}</td>
                <td className="px-5 py-4">
                  {p.checked_in_at
                    ? <span className="rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-semibold text-success">Checked in</span>
                    : <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">Registered</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && <p className="py-10 text-center text-sm text-muted-foreground">{list.length ? "No matches." : "No participants yet."}</p>}
      </div>

      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          {active && (
            <div className="space-y-6">
              <SheetHeader>
                <SheetTitle>Participant profile</SheetTitle>
              </SheetHeader>

              <div className="flex items-center gap-4 rounded-xl border bg-card p-4">
                <span className="grid size-14 shrink-0 place-items-center rounded-full bg-accent text-lg font-bold text-accent-foreground">
                  {active.full_name.split(" ").slice(0, 2).map((s) => s[0]?.toUpperCase()).join("")}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{active.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{active.email}</p>
                  {active.phone && <p className="text-xs text-muted-foreground">{active.phone}</p>}
                </div>
              </div>

              <div className="rounded-xl border bg-card p-4">
                <p className="label-mono !text-[10px]">Event</p>
                <p className="mt-1 text-sm font-semibold">{eventTitle}</p>
                {active.department && <p className="mt-1 text-xs text-muted-foreground">{active.department}</p>}
              </div>

              <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-5">
                <div className="rounded-xl qr-paper p-3 ring-1 ring-border"><QRCodeCanvas value={active.code} size={140} level="H" bgColor="#ffffff" fgColor="#07111F" marginSize={1} /></div>
                <p className="font-mono text-sm font-bold tracking-widest">{active.code}</p>
              </div>

              <div className="rounded-xl border bg-card p-4">
                <p className="label-mono !text-[10px]">Registration details</p>
                <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                  <div><p className="text-muted-foreground">Registered</p><p className="font-semibold">{new Date(active.created_at).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p></div>
                  <div><p className="text-muted-foreground">Status</p><p className="font-semibold">{active.checked_in_at ? "Checked in" : "Registered"}</p></div>
                </div>
              </div>

              <div className="rounded-xl border bg-card p-4">
                <p className="label-mono mb-2 flex items-center gap-1.5 !text-[10px]"><History className="size-3" /> Check-in history</p>
                {active.checked_in_at ? (
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-success">Admitted · {active.checked_in_gate ?? "—"}</span>
                    <span className="font-mono text-muted-foreground">{new Date(active.checked_in_at).toLocaleString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                  </div>
                ) : <p className="text-xs text-muted-foreground">Not checked in yet.</p>}
              </div>

              <div className="rounded-xl border bg-card p-4">
                <p className="label-mono mb-2 flex items-center gap-1.5 !text-[10px]"><ShieldCheck className="size-3" /> Security history</p>
                <div className="space-y-2">
                  {activeLogs.length ? activeLogs.map((l) => (
                    <div key={l.id} className="flex items-center justify-between text-xs">
                      <span className={l.result === "success" ? "font-semibold text-success" : "font-semibold text-flare"}>{l.result}</span>
                      <span className="font-mono text-muted-foreground">{new Date(l.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                    </div>
                  )) : <p className="text-xs text-muted-foreground">No scan events recorded.</p>}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                {active.checked_in_at && <Button variant="outline" className="flex-1" onClick={() => undo(active.id)}><Undo2 /> Undo check-in</Button>}
                <Button variant="outline" className="flex-1 text-destructive hover:text-destructive" onClick={() => remove(active.id)}><Trash2 /> Remove</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
