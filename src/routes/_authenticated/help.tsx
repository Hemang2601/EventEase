import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { LifeBuoy, Loader2, MessageSquareReply, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill, fmtTime, type SupportTicket } from "@/components/TicketThread";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/help")({
  head: () => ({
    meta: [
      { title: "Help & Support — EventEase" },
      { name: "description", content: "Contact event organizers about any registration or pass problem." },
      { property: "og:title", content: "Help & Support — EventEase" },
      { property: "og:description", content: "Raise a support request and read organizer replies." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

const schema = z.object({
  subject: z.string().trim().min(3, "Subject is too short").max(150),
  message: z.string().trim().min(5, "Describe your problem").max(3000),
});

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [f, setF] = useState({ subject: "", message: "", event_id: "general" });
  const [busy, setBusy] = useState(false);

  const events = useQuery({
    queryKey: ["all-events-lite"],
    queryFn: async () => (await supabase.from("events").select("id, title").order("starts_at")).data ?? [],
  });
  const tickets = useQuery({
    queryKey: ["my-tickets", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<SupportTicket[]> => {
      const { data, error } = await supabase.from("support_tickets").select("*, events(title)").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as SupportTicket[];
    },
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    const p = schema.safeParse(f);
    if (!p.success) { toast.error(p.error.issues[0]?.message ?? "Invalid input"); return; }
    setBusy(true);
    const { error } = await supabase.from("support_tickets").insert({
      user_id: user.id, email: user.email ?? "", full_name: (user.user_metadata?.["full_name"] as string | undefined) ?? null,
      subject: p.data.subject, message: p.data.message, event_id: f.event_id === "general" ? null : f.event_id,
    });
    setBusy(false);
    if (error) { toast.error("Could not send your request"); return; }
    toast.success("Sent! The organizer will reply here.");
    setF({ subject: "", message: "", event_id: "general" });
    qc.invalidateQueries({ queryKey: ["my-tickets"] });
  }

  return (
    <AppShell title="Help & support">
      <div className="mb-7">
        <h1 className="text-3xl font-bold tracking-tight">Help & support</h1>
        <p className="mt-2 text-sm text-muted-foreground">Facing a problem with registration, your pass or entry? Write to the organizer.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <form onSubmit={submit} className="panel h-fit space-y-4 p-6">
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><LifeBuoy size={18} /></span><p className="font-semibold">New request</p></div>
          <div className="space-y-2"><Label>About</Label>
            <Select value={f.event_id} onValueChange={(v) => setF({ ...f, event_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General question</SelectItem>
                {(events.data ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Subject</Label><Input value={f.subject} maxLength={150} onChange={(e) => setF({ ...f, subject: e.target.value })} placeholder="QR not showing on my pass" /></div>
          <div className="space-y-2"><Label>Message</Label><Textarea rows={5} maxLength={3000} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder="Explain what happened…" /></div>
          <Button type="submit" variant="hero" className="h-11 w-full" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Send />} Send to organizer</Button>
        </form>

        <div className="space-y-4">
          <p className="label-mono">My requests</p>
          {tickets.isLoading ? <Skeleton className="h-40 rounded-2xl" /> : !tickets.data?.length ? (
            <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">No requests yet.</div>
          ) : tickets.data.map((t) => (
            <div key={t.id} className="panel animate-rise p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{t.subject}</p><StatusPill status={t.status} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t.events?.title ?? "General"} · {fmtTime(t.created_at)}</p>
              <p className="mt-3 whitespace-pre-wrap text-sm">{t.message}</p>
              {t.reply && (
                <div className="mt-4 rounded-xl border-l-4 border-primary bg-primary/5 p-4">
                  <p className="flex items-center gap-2 text-xs font-bold text-primary"><MessageSquareReply size={14} /> Organizer reply {t.replied_at && `· ${fmtTime(t.replied_at)}`}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{t.reply}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
