import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Camera, CameraOff, Check, ChevronDown, Loader2, ScanLine, ShieldAlert, X } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { GATES } from "@/lib/categories";

type L = Tables<"scan_logs">;

type Result =
  | { status: "success"; full_name: string; code: string; checked_in_at: string; gate?: string }
  | { status: "duplicate"; full_name: string; code: string; checked_in_at: string; gate?: string | null }
  | { status: "invalid"; code: string }
  | { status: "forbidden"; code: string }
  | { status: "too_early"; code: string; opens_at: string }
  | { status: "wrong_zone"; code: string; full_name: string; zone: string }
  | { status: "wrong_event"; code: string; full_name: string; event: string };

const fmt = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function CheckInPanel({ eventId, onDone, logs = [] }: { eventId: string; onDone: () => void; logs?: L[] }) {
  const [code, setCode] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [nonce, setNonce] = useState(0);
  const [camOn, setCamOn] = useState(false);
  const [gate, setGate] = useState<string>(GATES[0]);
  const gateRef = useRef<string>(GATES[0]);
  useEffect(() => { gateRef.current = gate; }, [gate]);
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const lastScan = useRef<{ code: string; t: number }>({ code: "", t: 0 });

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todays = logs.filter((l) => new Date(l.created_at).toDateString() === today);
    const checkedIn = todays.filter((l) => l.result === "success").length;
    const duplicate = todays.filter((l) => l.result === "duplicate").length;
    const rejected = todays.filter((l) => l.result && !["success", "duplicate"].includes(l.result)).length;
    return { checkedIn, duplicate, rejected };
  }, [logs]);

  async function verify(raw: string) {
    const c = raw.trim().toUpperCase();
    if (!c) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("check_in_participant", { _event_id: eventId, _code: c, _gate: gateRef.current });
    setBusy(false);
    if (error || !data) { setResult({ status: "invalid", code: c }); }
    else setResult({ ...(data as object), code: (data as { code?: string }).code ?? c } as Result);
    setNonce((n) => n + 1);
    setCode("");
    onDone();
  }

  function submit(e: FormEvent) { e.preventDefault(); verify(code); }

  async function startCam() {
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const s = new Html5Qrcode("qr-reader");
      scannerRef.current = s as unknown as typeof scannerRef.current;
      await s.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (text: string) => {
          const now = Date.now();
          if (text === lastScan.current.code && now - lastScan.current.t < 2500) return;
          lastScan.current = { code: text, t: now };
          verify(text);
        },
        () => {},
      );
      setCamOn(true);
    } catch {
      setCamOn(false);
      setResult({ status: "invalid", code: "Camera unavailable — use manual entry" });
      setNonce((n) => n + 1);
    }
  }

  async function stopCam() {
    try { await scannerRef.current?.stop(); scannerRef.current?.clear(); } catch { /* noop */ }
    scannerRef.current = null;
    setCamOn(false);
  }

  useEffect(() => () => { scannerRef.current?.stop().catch(() => {}); }, []);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Scanner + manual entry */}
        <div className="space-y-4">
          <div className="flex gap-2" role="radiogroup" aria-label="Gate">
            {GATES.map((g) => (
              <Button key={g} type="button" size="sm" variant={gate === g ? "default" : "glass"} className="flex-1 font-mono" onClick={() => setGate(g)}>{g}</Button>
            ))}
          </div>

          <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-navy ring-1 ring-border">
            <div id="qr-reader" className="absolute inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
            {!camOn && (
              <div className="grid-bg absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <ScanLine className="mx-auto size-12 text-primary" />
                  <p className="mt-3 text-sm font-semibold text-navy-muted">Camera scanner idle</p>
                </div>
              </div>
            )}
            {camOn && <div className="animate-scan pointer-events-none absolute inset-x-6 h-0.5 bg-primary shadow-glow" />}
            {/* Corner brackets */}
            {(["top-6 left-6 border-t-2 border-l-2", "top-6 right-6 border-t-2 border-r-2", "bottom-6 left-6 border-b-2 border-l-2", "bottom-6 right-6 border-b-2 border-r-2"] as const).map((pos) => (
              <span key={pos} className={`pointer-events-none absolute size-8 rounded-sm border-primary/70 ${pos}`} />
            ))}
          </div>

          <Button variant="glass" className="w-full" onClick={camOn ? stopCam : startCam}>
            {camOn ? <><CameraOff /> Stop camera</> : <><Camera /> Scan QR</>}
          </Button>

          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-border" />
            <span className="label-mono !text-[10px]">OR</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            onClick={() => setManualOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-dashed border-border px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            Enter Entry Code
            <ChevronDown className={`size-4 transition-transform ${manualOpen ? "rotate-180" : ""}`} />
          </button>
          {manualOpen && (
            <form onSubmit={submit} className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="EE-XXXX-XXXX"
                className="h-11 font-mono uppercase tracking-widest"
                aria-label="Entry code"
                autoFocus
              />
              <Button type="submit" variant="hero" className="h-11 px-6" disabled={busy || !code.trim()}>
                {busy ? <Loader2 className="animate-spin" /> : "Verify"}
              </Button>
            </form>
          )}
        </div>

        {/* Gate stats sidebar */}
        <div className="panel flex flex-col gap-5 p-5">
          <p className="label-mono !text-[10px]">Today's gate stats</p>
          <div>
            <p className="text-xs text-muted-foreground">Checked In</p>
            <p className="mt-1 font-display text-4xl font-bold text-success">{stats.checkedIn}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Rejected</p>
            <p className="mt-1 font-display text-4xl font-bold text-flare">{stats.rejected}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Duplicate</p>
            <p className="mt-1 font-display text-4xl font-bold text-amber">{stats.duplicate}</p>
          </div>
          <div className="mt-auto flex items-center gap-2 rounded-lg bg-muted px-3 py-2 font-mono text-xs font-semibold">
            <span className="size-1.5 rounded-full bg-primary" /> {gate}
          </div>
        </div>
      </div>

      {/* Full-width result banner */}
      <div key={nonce}>
        {!result && (
          <div className="panel grid place-items-center p-10 text-center">
            <div>
              <p className="label-mono">Awaiting scan</p>
              <p className="mt-2 text-sm text-muted-foreground">Scan a QR or enter the entry code to check a participant in.</p>
            </div>
          </div>
        )}
        {result?.status === "success" && (
          <AccessBanner
            tone="granted"
            title="ACCESS GRANTED"
            subtitle={`Welcome, ${result.full_name}`}
            rows={[["Gate", result.gate ?? gate], ["Time", fmt(result.checked_in_at)]]}
            entry={result.code}
          />
        )}
        {result?.status === "duplicate" && (
          <AccessBanner
            tone="denied"
            title="ACCESS DENIED"
            subtitle="DUPLICATE CHECK-IN"
            name={result.full_name}
            rows={[["Already checked in at", fmt(result.checked_in_at)], ["Gate", result.gate ?? "—"]]}
            entry={result.code}
            footer="Second scan rejected."
          />
        )}
        {result?.status === "invalid" && (
          <AccessBanner tone="denied" title="ACCESS DENIED" subtitle="INVALID CODE" rows={[["Code", result.code]]} footer="No participant matches this code for this event." />
        )}
        {result?.status === "too_early" && (
          <AccessBanner
            tone="denied" title="ACCESS DENIED" subtitle="GATE NOT OPEN YET"
            rows={[["Opens at", new Date(result.opens_at).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })]]}
            footer="Scans before event time are blocked so attendance stays real."
          />
        )}
        {result?.status === "forbidden" && (
          <AccessBanner tone="denied" title="ACCESS DENIED" subtitle="NOT AUTHORIZED" footer="You don't organize this event." />
        )}
        {result?.status === "wrong_zone" && (
          <AccessBanner
            tone="denied" title="ACCESS DENIED" subtitle="WRONG HALL" name={result.full_name}
            rows={[["Belongs to", result.zone]]} entry={result.code} footer="Send this participant to their assigned hall."
          />
        )}
        {result?.status === "wrong_event" && (
          <AccessBanner
            tone="denied" title="ACCESS DENIED" subtitle="WRONG EVENT" name={result.full_name}
            rows={[["Pass is for", result.event]]} entry={result.code} footer="Not allowed in this event."
          />
        )}
      </div>
    </div>
  );
}

function AccessBanner({ tone, title, subtitle, name, rows = [], entry, footer }: {
  tone: "granted" | "denied";
  title: string;
  subtitle: string;
  name?: string;
  rows?: [string, string][];
  entry?: string;
  footer?: string;
}) {
  const ok = tone === "granted";
  return (
    <div
      className={`animate-pop relative w-full overflow-hidden rounded-2xl p-8 text-center ring-1 sm:p-12 ${
        ok ? "animate-pulse-glow bg-success-soft ring-success/40" : "animate-shake bg-navy shadow-flare ring-flare/50"
      }`}
    >
      <div className={`mx-auto grid size-20 place-items-center rounded-full ring-2 ${ok ? "bg-success/15 text-success ring-success/40" : "bg-flare/15 text-flare ring-flare/50"}`}>
        {ok ? <Check className="size-10" strokeWidth={3} /> : tone === "denied" && subtitle === "DUPLICATE CHECK-IN" ? <ShieldAlert className="size-10" /> : <X className="size-10" strokeWidth={3} />}
      </div>
      <p className={`mt-6 font-display text-4xl font-black tracking-wide sm:text-5xl ${ok ? "text-success" : "text-flare"}`}>{title}</p>
      <p className={`mt-2 text-sm font-bold uppercase tracking-[0.2em] ${ok ? "text-success/80" : "text-flare/90"}`}>{subtitle}</p>
      {name && <p className={`mt-4 text-xl font-semibold ${ok ? "" : "text-navy-foreground"}`}>{name}</p>}
      {rows.length > 0 && (
        <div className="mx-auto mt-5 flex max-w-md flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {rows.map(([l, v]) => (
            <div key={l} className="text-left">
              <p className={`text-[10px] font-semibold uppercase tracking-wider ${ok ? "text-success/70" : "text-navy-muted"}`}>{l}</p>
              <p className={`font-mono text-sm font-semibold ${ok ? "text-success" : "text-navy-foreground"}`}>{v}</p>
            </div>
          ))}
        </div>
      )}
      {entry && (
        <p className={`mt-6 font-mono text-xs tracking-widest ${ok ? "text-success/70" : "text-navy-muted"}`}>
          Entry: <span className={`font-bold ${ok ? "text-success" : "text-flare"}`}>{entry}</span>
        </p>
      )}
      {footer && <p className={`mt-3 text-xs font-medium ${ok ? "text-success/70" : "text-flare/80"}`}>{footer}</p>}
    </div>
  );
}
