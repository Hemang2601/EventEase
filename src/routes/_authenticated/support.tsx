import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Inbox, Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill, fmtTime, type SupportTicket } from "@/components/TicketThread";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({
    meta: [
      { title: "Support Inbox — EventEase" },
      { name: "description", content: "Read and answer student support requests for your events." },
      { property: "og:title", content: "Support Inbox — EventEase" },
      { property: "og:description", content: "Organizer support inbox." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"open" | "answered" | "closed" | "all">("open");
  const q = useQuery({
    queryKey: ["support-inbox", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<SupportTicket[]> => {
      const { data, error } = await supabase.from("support_tickets").select("*, events(title)").order("created_at", { ascending: false });
      if (error) throw error;
      return data as SupportTicket[];
    },
  });
  const all = q.data ?? [];
  const rows = all.filter((t) => filter === "all" || t.status === filter);

  return (
    <AppShell allow={["organizer"]} title="Support inbox">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Support inbox</h1>
          <p className="mt-2 text-sm text-muted-foreground">Student problems about your events and general questions.</p>
        </div>
        <div className="flex gap-1 rounded-xl bg-muted p-1">
          {(["open", "answered", "closed", "all"] as const).map((k) => (
            <button key={k} onClick={() => setFilter(k)} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold capitalize", filter === k ? "bg-card shadow-card" : "text-muted-foreground")}>
              {k} ({k === "all" ? all.length : all.filter((t) => t.status === k).length})
            </button>
          ))}
        </div>
      </div>
      {q.isLoading ? <Skeleton className="h-64 rounded-2xl" /> : !rows.length ? (
        <div className="grid place-items-center rounded-2xl border border-dashed bg-card p-14 text-center">
          <Inbox className="size-10 text-primary" /><p className="mt-4 font-semibold">Nothing here</p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {rows.map((t) => <Item key={t.id} t={t} userId={user!.id} onDone={() => qc.invalidateQueries({ queryKey: ["support-inbox"] })} />)}
        </div>
      )}
    </AppShell>
  );
}

function Item({ t, userId, onDone }: { t: SupportTicket; userId: string; onDone: () => void }) {
  const [reply, setReply] = useState(t.reply ?? "");
  const [busy, setBusy] = useState(false);

  async function save(status: "answered" | "closed") {
    const text = reply.trim();
    if (status === "answered" && text.length < 2) { toast.error("Write a reply first"); return; }
    if (text.length > 3000) { toast.error("Reply is too long"); return; }
    setBusy(true);
    const { error } = await supabase.from("support_tickets").update({
      reply: text || t.reply, status, replied_by: userId, replied_at: new Date().toISOString(),
    }).eq("id", t.id);
    setBusy(false);
    if (error) { toast.error("Could not save"); return; }
    toast.success(status === "closed" ? "Request closed" : "Reply sent");
    onDone();
  }

  return (
    <div className="panel animate-rise p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{t.subject}</p><StatusPill status={t.status} /></div>
      <p className="mt-1 text-xs text-muted-foreground">{t.full_name ?? t.email} · {t.email} · {t.events?.title ?? "General"} · {fmtTime(t.created_at)}</p>
      <p className="mt-3 whitespace-pre-wrap rounded-xl bg-muted/60 p-3 text-sm">{t.message}</p>
      <Textarea className="mt-3" rows={3} maxLength={3000} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type your reply…" />
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="outline" size="sm" disabled={busy || t.status === "closed"} onClick={() => save("closed")}>Close</Button>
        <Button size="sm" disabled={busy} onClick={() => save("answered")}>{busy ? <Loader2 className="animate-spin" /> : <Send />} Send reply</Button>
      </div>
    </div>
  );
}
