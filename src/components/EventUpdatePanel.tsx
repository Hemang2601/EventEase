import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Clock, Lock, Send, ShieldCheck, Unlock, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EditEventDialog } from "./EditEventDialog";
import { DecisionControls } from "./AdminEditRequests";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { fmtDate, type EventRow } from "@/lib/events";

const STATUS: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  pending: { label: "Waiting for admin", cls: "bg-primary/10 text-primary", icon: Clock },
  approved: { label: "Approved", cls: "bg-success/15 text-success", icon: CheckCircle2 },
  rejected: { label: "Rejected", cls: "bg-destructive/15 text-destructive", icon: XCircle },
  used: { label: "Changes saved", cls: "bg-muted text-muted-foreground", icon: CheckCircle2 },
};

export function EventUpdatePanel({ event, isAdmin }: { event: EventRow & { edit_unlocked?: boolean }; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const reqs = useQuery({
    queryKey: ["edit-requests", event.id],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("event_edit_requests").select("*").eq("event_id", event.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const list = reqs.data ?? [];
  const pending = list.some((r) => r.status === "pending");
  const approvedWaiting = list.some((r) => r.status === "approved") && !event.edit_unlocked;
  useEffect(() => {
    if (approvedWaiting) { qc.invalidateQueries({ queryKey: ["events"] }); qc.invalidateQueries({ queryKey: ["event", event.id] }); }
  }, [approvedWaiting, qc, event.id]);
  const unlocked = isAdmin || !!event.edit_unlocked;

  async function send() {
    if (busy) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("request_event_edit", { _event_id: event.id, _reason: reason });
    setBusy(false);
    const res = data as { ok: boolean; error?: string } | null;
    if (error || !res?.ok) { toast.error(res?.error ?? "Could not send request"); return; }
    toast.success("Request sent to admin");
    setReason("");
    qc.invalidateQueries({ queryKey: ["edit-requests", event.id] });
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="panel p-6">
        <div className="flex items-start gap-4">
          <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${unlocked ? "bg-success/15 text-success" : "bg-primary/10 text-primary"}`}>
            {unlocked ? <Unlock /> : <Lock />}
          </span>
          <div>
            <h2 className="text-lg font-semibold">{unlocked ? "Editing unlocked" : "Event details are locked"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAdmin ? "As admin you can edit this event anytime."
                : unlocked ? "The admin approved your request. You can save changes once — after that editing locks again."
                : "To change title, date, venue, capacity or photos, send a request to the admin. Once approved, the edit option opens here."}
            </p>
          </div>
        </div>

        {unlocked ? (
          <div className="mt-6 rounded-xl border bg-success/5 p-4">
            <EditEventDialog event={event} />
          </div>
        ) : pending ? (
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
            <Clock className="size-5 text-primary" /> Your request is waiting for admin approval.
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            <label htmlFor="edit-reason" className="text-sm font-medium">What do you want to change?</label>
            <Textarea id="edit-reason" rows={4} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Venue changed to Auditorium 2 and capacity should be 150" />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{reason.length}/500</span>
              <Button onClick={send} disabled={busy || reason.trim().length < 5}><Send /> Send request to admin</Button>
            </div>
          </div>
        )}
      </div>

      <div className="panel p-6">
        <h3 className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4 text-primary" /> Request history</h3>
        {!list.length ? <p className="mt-4 text-sm text-muted-foreground">No requests yet.</p> : (
          <ul className="mt-4 space-y-3">
            {list.map((r) => {
              const s = STATUS[r.status] ?? STATUS["pending"]!;
              const Icon = s.icon;
              return (
                <li key={r.id} className="rounded-xl border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${s.cls}`}><Icon className="size-3" />{s.label}</span>
                    <span className="text-xs text-muted-foreground">{fmtDate(r.created_at)}</span>
                  </div>
                  <p className="mt-2 text-sm">{r.reason}</p>
                  {r.admin_note && <p className="mt-1 text-xs text-muted-foreground">Admin: {r.admin_note}</p>}
                  {isAdmin && r.status === "pending" && <div className="mt-3 border-t pt-3"><DecisionControls id={r.id} eventId={event.id} /></div>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
