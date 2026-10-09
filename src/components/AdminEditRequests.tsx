import { useState } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, CheckCircle2, Clock, Loader2, ShieldCheck, ThumbsDown, ThumbsUp, User, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { fmtDate } from "@/lib/events";

type Profile = { id: string; full_name: string | null; email: string | null };
export type EditRequest = {
  id: string; event_id: string; requester_id: string; reason: string; status: string;
  admin_note: string | null; decided_at: string | null; created_at: string;
  events: { title: string; starts_at: string } | null;
};

export function useEditRequests() {
  return useQuery({
    queryKey: ["edit-requests", "admin"],
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("event_edit_requests").select("*, events(title, starts_at)").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as EditRequest[];
    },
  });
}

export async function decideEditRequest(qc: QueryClient, id: string, eventId: string, approve: boolean, note: string) {
  const { data, error } = await supabase.rpc("admin_decide_edit_request", { _request_id: id, _approve: approve, _note: note });
  const res = data as { ok: boolean; error?: string } | null;
  if (error || !res?.ok) { toast.error(res?.error ?? "Could not update request"); return false; }
  toast.success(approve ? "Approved — editing unlocked for the organizer" : "Request rejected");
  await Promise.all([
    qc.invalidateQueries({ queryKey: ["edit-requests"] }),
    qc.invalidateQueries({ queryKey: ["event", eventId] }),
    qc.invalidateQueries({ queryKey: ["events"] }),
  ]);
  return true;
}

export const REQUEST_STATUS: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  pending: { label: "Waiting for admin", cls: "bg-primary/10 text-primary", icon: Clock },
  approved: { label: "Approved", cls: "bg-success/15 text-success", icon: CheckCircle2 },
  rejected: { label: "Rejected", cls: "bg-destructive/15 text-destructive", icon: XCircle },
  used: { label: "Changes saved", cls: "bg-muted text-muted-foreground", icon: CheckCircle2 },
};

/** Approve / Reject controls for one pending request. Reject asks for confirmation. */
export function DecisionControls({ id, eventId }: { id: string; eventId: string }) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [confirmReject, setConfirmReject] = useState(false);

  async function go(approve: boolean) {
    if (busy) return;
    setBusy(approve ? "approve" : "reject");
    await decideEditRequest(qc, id, eventId, approve, note);
    setBusy(null); setConfirmReject(false);
  }

  return (
    <div className="space-y-3">
      <Textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)}
        placeholder={confirmReject ? "Reason for rejecting (shown to organizer)" : "Note for organizer (optional)"} />
      {confirmReject ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm font-medium text-destructive">Reject this request?</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="destructive" disabled={!!busy} onClick={() => go(false)}>
              {busy === "reject" ? <Loader2 className="animate-spin" /> : <ThumbsDown />} Yes, reject
            </Button>
            <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => setConfirmReject(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button className="bg-success text-primary-foreground hover:bg-success/90" disabled={!!busy} onClick={() => go(true)}>
            {busy === "approve" ? <Loader2 className="animate-spin" /> : <ThumbsUp />} Approve
          </Button>
          <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={!!busy} onClick={() => setConfirmReject(true)}>
            <ThumbsDown /> Reject
          </Button>
        </div>
      )}
    </div>
  );
}

export function AdminEditRequests({ profiles }: { profiles: Profile[] }) {
  const q = useEditRequests();
  const all = q.data ?? [];
  const pending = all.filter((r) => r.status === "pending");
  const history = all.filter((r) => r.status !== "pending").slice(0, 20);
  const who = (id: string) => { const p = profiles.find((x) => x.id === id); return p?.full_name || p?.email || "Organizer"; };

  if (q.isLoading) return <div className="panel p-10 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto animate-spin" /></div>;

  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-3 flex items-center gap-2 font-semibold"><Clock className="size-4 text-primary" /> Waiting for your decision ({pending.length})</h3>
        {!pending.length ? (
          <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">No pending edit requests.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {pending.map((r) => (
              <div key={r.id} className="panel overflow-hidden">
                <div className="flex items-start justify-between gap-3 border-b bg-muted/30 p-5">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{r.events?.title ?? "Event"}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><User className="size-3" />{who(r.requester_id)}</span>
                      {r.events && <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" />{fmtDate(r.events.starts_at)}</span>}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">Pending</span>
                </div>
                <div className="space-y-4 p-5">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Requested change · {fmtDate(r.created_at)}</p>
                    <p className="mt-1 rounded-lg bg-muted/50 p-3 text-sm">{r.reason}</p>
                  </div>
                  <DecisionControls id={r.id} eventId={r.event_id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {!!history.length && (
        <section>
          <h3 className="mb-3 flex items-center gap-2 font-semibold"><ShieldCheck className="size-4 text-primary" /> Recent decisions</h3>
          <div className="panel divide-y">
            {history.map((r) => {
              const s = REQUEST_STATUS[r.status] ?? REQUEST_STATUS["pending"]!;
              const Icon = s.icon;
              return (
                <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-medium">{r.events?.title ?? "Event"} <span className="text-xs font-normal text-muted-foreground">· {who(r.requester_id)}</span></p>
                    <p className="mt-1 text-sm text-muted-foreground">{r.reason}</p>
                    {r.admin_note && <p className="mt-1 text-xs text-muted-foreground">Your note: {r.admin_note}</p>}
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${s.cls}`}><Icon className="size-3" />{s.label}</span>
                    {r.decided_at && <p className="mt-1 text-xs text-muted-foreground">{fmtDate(r.decided_at)}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
