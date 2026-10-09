import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeftRight, Loader2, Lock, Ticket as TicketIcon, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Ticket } from "@/components/Ticket";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth";
import { fmtDate } from "@/lib/events";

export const Route = createFileRoute("/_authenticated/my-passes")({
  head: () => ({
    meta: [
      { title: "My Passes — EventEase" },
      { name: "description", content: "All your event passes with QR codes, check-in status and change options." },
      { property: "og:title", content: "My Passes — EventEase" },
      { property: "og:description", content: "Your digital event passes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type Pass = { id: string; code: string; full_name: string; email: string; checked_in_at: string | null; event_id: string; events: { title: string; venue: string | null; starts_at: string } | null };

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [switching, setSwitching] = useState<Pass | null>(null);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["my-passes", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Pass[]> => {
      const { data, error } = await supabase
        .from("participants")
        .select("id, code, full_name, email, checked_in_at, event_id, events(title, venue, starts_at)")
        .or(`user_id.eq.${user!.id},email.ilike.${(user!.email ?? "").replace(/[,()%*]/g, "")}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Pass[];
    },
  });

  const openEvents = useQuery({
    queryKey: ["open-events"],
    enabled: !!switching,
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("id, title, starts_at, capacity").eq("is_open", true).gt("starts_at", new Date().toISOString()).order("starts_at");
      if (error) throw error;
      const withSeats = await Promise.all(
        data.map(async (e) => {
          const { data: stats } = await supabase.rpc("event_stats", { _event_id: e.id });
          const registered = Number((stats as { registered: number }[] | null)?.[0]?.registered ?? 0);
          return { ...e, registered, seatsLeft: Math.max(0, e.capacity - registered) };
        }),
      );
      return withSeats;
    },
  });

  const refresh = () => { qc.invalidateQueries({ queryKey: ["my-passes"] }); qc.invalidateQueries({ queryKey: ["events"] }); };

  async function cancel(id: string) {
    const { data, error } = await supabase.rpc("cancel_registration", { _participant_id: id });
    const r = data as { ok: boolean; error?: string } | null;
    if (error || !r?.ok) { toast.error(r?.error ?? "Could not cancel"); return; }
    toast.success("Registration cancelled");
    refresh();
  }

  async function doSwitch() {
    if (!switching || !target) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("switch_registration", { _participant_id: switching.id, _new_event_id: target });
    setBusy(false);
    const r = data as { ok: boolean; error?: string; code?: string } | null;
    if (error || !r?.ok) { toast.error(r?.error ?? "Could not change event"); return; }
    toast.success(`Event changed — new code ${r.code}`);
    setSwitching(null); setTarget("");
    refresh();
  }

  const passes = q.data ?? [];
  const targetEvent = (openEvents.data ?? []).find((e) => e.id === target);

  return (
    <AppShell title="My passes">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">My passes</h1>
          <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-muted-foreground">Show the QR at the gate. You can change or cancel an event any time before it starts.</p>
        </div>
        <Button asChild variant="outline" className="w-full sm:w-auto shrink-0 h-10"><Link to="/explore">Register for more</Link></Button>
      </div>
      {q.isLoading ? (
        <div className="grid place-items-center py-8"><Skeleton className="h-[520px] w-full max-w-[380px] rounded-3xl" /></div>
      ) : !passes.length ? (
        <div className="grid place-items-center rounded-2xl border border-dashed bg-card p-8 sm:p-14 text-center">
          <TicketIcon className="size-10 text-primary" />
          <p className="mt-4 text-base sm:text-lg font-semibold">No passes yet</p>
          <p className="mt-1 max-w-sm text-xs sm:text-sm text-muted-foreground">Register for an event while signed in to see your pass here.</p>
          <Button asChild className="mt-5 w-full sm:w-auto"><Link to="/explore">Explore events</Link></Button>
        </div>
      ) : (
        <div className="grid gap-6 sm:gap-8 md:grid-cols-2 xl:grid-cols-3 justify-items-center">
          {passes.map((p) => {
            const locked = !!p.checked_in_at || (p.events ? new Date(p.events.starts_at) <= new Date() : true);
            return (
              <div key={p.id} className="w-full max-w-[380px] space-y-3">
                <Ticket code={p.code} name={p.full_name} eventTitle={p.events?.title ?? "Event"}
                  date={p.events ? fmtDate(p.events.starts_at) : undefined} meta={p.events?.venue ?? undefined} checkedInAt={p.checked_in_at} />
                {locked ? (
                  <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-1"><Lock size={13} /> {p.checked_in_at ? "Checked in — pass used" : "Event started — changes locked"}</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" className="h-9 sm:h-10 text-xs sm:text-sm" onClick={() => { setSwitching(p); setTarget(""); }}>
                      <ArrowLeftRight className="size-3.5 sm:size-4 shrink-0" /> <span className="truncate">Change event</span>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9 sm:h-10 text-xs sm:text-sm text-destructive">
                          <Trash2 className="size-3.5 sm:size-4 shrink-0" /> <span className="truncate">Cancel</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="w-[calc(100vw-32px)] sm:max-w-md p-5 sm:p-6 rounded-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancel this registration?</AlertDialogTitle>
                          <AlertDialogDescription>Your seat for {p.events?.title} will be released and the QR code stops working.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
                          <AlertDialogCancel className="w-full sm:w-auto">Keep it</AlertDialogCancel>
                          <AlertDialogAction onClick={() => cancel(p.id)} className="w-full sm:w-auto">Yes, cancel</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!switching} onOpenChange={(o) => !o && setSwitching(null)}>
        <DialogContent className="panel border-border w-[calc(100vw-32px)] sm:max-w-md p-5 sm:p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle>Change event</DialogTitle>
            <DialogDescription>Move your seat from “{switching?.events?.title}” to another open event. You'll get a new code.</DialogDescription>
          </DialogHeader>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger><SelectValue placeholder={openEvents.isLoading ? "Loading…" : "Pick an event"} /></SelectTrigger>
            <SelectContent>
              {(openEvents.data ?? []).filter((e) => e.id !== switching?.event_id).map((e) => (
                <SelectItem key={e.id} value={e.id} disabled={e.seatsLeft === 0}>
                  <span className="flex w-full items-center justify-between gap-3">
                    <span>{e.title} · {fmtDate(e.starts_at)}</span>
                    {e.seatsLeft === 0 ? (
                      <span className="text-xs font-semibold text-destructive">Full — no seats</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{e.seatsLeft} seat{e.seatsLeft === 1 ? "" : "s"} left</span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {targetEvent && targetEvent.seatsLeft === 0 && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              This event is fully booked — {targetEvent.title} has no remaining seats. Please select another event.
            </p>
          )}
          {targetEvent && targetEvent.seatsLeft > 0 && (
            <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
              {targetEvent.title} has <span className="font-semibold text-foreground">{targetEvent.seatsLeft} seat{targetEvent.seatsLeft === 1 ? "" : "s"}</span> available.
            </p>
          )}
          <Button variant="hero" className="h-11 w-full" disabled={!target || busy || targetEvent?.seatsLeft === 0} onClick={doSwitch}>{busy && <Loader2 className="animate-spin" />} Confirm change</Button>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
