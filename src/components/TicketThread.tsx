import { cn } from "@/lib/utils";

export type SupportTicket = {
  id: string; subject: string; message: string; status: string; reply: string | null;
  replied_at: string | null; created_at: string; email: string; full_name: string | null; event_id: string | null;
  events?: { title: string } | null;
};

export function StatusPill({ status }: { status: string }) {
  const cls = status === "open" ? "bg-amber/15 text-amber" : status === "answered" ? "bg-success-soft text-success" : "bg-muted text-muted-foreground";
  return <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider", cls)}>{status}</span>;
}

export const fmtTime = (iso: string) => new Date(iso).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
