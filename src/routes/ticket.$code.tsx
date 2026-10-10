import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { QRCodeCanvas } from "qrcode.react";
import { ArrowLeft, CalendarDays, CheckCircle2, MapPin, ScrollText, ShieldCheck, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { categoryImage } from "@/lib/categories";
import { fmtDate, fmtDateRange, parseEventRules } from "@/lib/events";
import { useAuth } from "@/lib/auth";

type TicketInfo = {
  code: string; full_name: string; checked_in_at: string | null; event_id: string;
  event_title: string; venue: string | null; starts_at: string; ends_at?: string | null; category: string;
  rules?: string | null;
};

export const Route = createFileRoute("/ticket/$code")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "My Event Pass — EventEase" },
      { name: "description", content: "Your digital event pass with QR code and live check-in status." },
      { property: "og:title", content: "My Event Pass — EventEase" },
      { property: "og:description", content: "Show this QR at the entry gate." },
      { name: "robots", content: "noindex" },
    ],
  }),
  ssr: false,
  component: TicketPage,
});

function TicketPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const q = useQuery({
    queryKey: ["ticket", code],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_ticket", { _code: code });
      if (error) throw error;
      return (data ?? null) as TicketInfo | null;
    },
    refetchInterval: 8000,
  });
  const t = q.data;

  /** Go back to where the pass was opened from, or to the passes list when opened directly. */
  function dismiss() {
    if (window.history.length > 1) window.history.back();
    else navigate({ to: user ? "/my-passes" : "/explore" });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") dismiss(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <div className="bg-hero relative flex min-h-screen w-full max-w-full flex-col overflow-x-hidden px-4 py-5">
      <div className="grid-lines pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary/25 blur-3xl" />

      {/* Top bar — brand and a clear way back */}
      <div className="relative mx-auto flex w-full max-w-sm items-center justify-between gap-3">
        <Brand light />
        <Button
          onClick={dismiss}
          variant="glass"
          size="sm"
          className="h-9 rounded-full border-border bg-card px-4 text-navy-foreground backdrop-blur hover:border-primary/60 hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" /> Dismiss
        </Button>
      </div>

      <div className="relative flex flex-1 items-center justify-center py-6">
        <div className="w-full max-w-sm">
          {q.isLoading && <Skeleton className="h-[560px] rounded-3xl" />}
          {!q.isLoading && !t && (
            <div className="panel p-8 text-center">
              <p className="text-xl font-semibold">Pass not found</p>
              <p className="mt-2 text-sm text-muted-foreground">Check the code and try again.</p>
              <Button onClick={dismiss} variant="hero" className="mt-6 w-full"><ArrowLeft /> Go back</Button>
            </div>
          )}
          {t && (
            <>
              <div className="animate-rise overflow-hidden rounded-3xl glass-panel shadow-float ring-1 ring-border/70 backdrop-blur-xl">
                <div className="relative h-40 overflow-hidden">
                  <img src={categoryImage(t.category)} alt="" width={1024} height={640} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                  <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-background/70 px-2.5 py-1 font-mono text-[10px] uppercase text-primary ring-1 ring-primary/40 backdrop-blur">
                    <ShieldCheck className="size-3" /> Verified pass
                  </span>
                </div>
                <div className="px-6 pb-5">
                  <p className="label-mono">Admit one · {t.category}</p>
                  <h1 className="mt-1 text-2xl font-bold leading-tight">{t.event_title}</h1>
                  <p className="mt-3 text-sm text-muted-foreground">Participant</p>
                  <p className="font-semibold">{t.full_name}</p>
                  <div className="mt-4 space-y-1.5 font-mono text-xs text-muted-foreground">
                    <p className="flex items-center gap-2"><CalendarDays className="size-3 shrink-0" /><span>{fmtDateRange(t.starts_at, t.ends_at)}</span></p>
                    {t.venue && <p className="flex items-center gap-2"><MapPin className="size-3 shrink-0" /><span>{t.venue}</span></p>}
                  </div>
                </div>
                <div className="relative mx-6 border-t-2 border-dashed border-border" />
                <div className="flex flex-col items-center px-6 py-6 text-center">
                  <div className={`rounded-lg qr-paper p-3 ring-1 ring-border ${t.checked_in_at ? "opacity-40" : ""}`}>
                    <QRCodeCanvas value={t.code} size={180} level="H" bgColor="#ffffff" fgColor="#0f172a" marginSize={1} />
                  </div>
                  <p className="mt-4 font-mono text-xl font-bold tracking-widest text-primary">{t.code}</p>
                  {t.checked_in_at ? (
                    <p className="animate-pop mt-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm text-success ring-1 ring-success/30">
                      <CheckCircle2 className="size-4" /> Checked in at {new Date(t.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  ) : (
                    <p className="mt-4 text-xs text-muted-foreground">Show this QR at the entry gate. Valid for one entry only.</p>
                  )}
                </div>

                {(() => {
                  const rules = parseEventRules(t.rules);
                  if (rules.length === 0) return null;
                  return (
                    <div className="border-t border-border bg-muted/40 px-6 py-4 text-left">
                      <div className="flex items-center gap-2">
                        <ScrollText className="size-3.5 text-primary" />
                        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-primary">Entry Rules & Guidelines</span>
                      </div>
                      <ul className="mt-2.5 space-y-2 text-xs text-muted-foreground">
                        {rules.map((rule, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="mt-1 flex size-1.5 shrink-0 rounded-full bg-primary" />
                            <span className="leading-relaxed">{rule}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}
              </div>

              {/* Bottom dismiss — easy to reach with a thumb on a phone */}
              <Button onClick={dismiss} variant="hero" className="mt-6 h-11 w-full">
                <ArrowLeft /> Back to my passes
              </Button>
              <p className="mt-3 hidden text-center text-[11px] text-navy-muted sm:block">
                Tip: press <span className="rounded border border-white/20 px-1.5 py-0.5 font-mono">Esc</span> to close this pass
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
