import { useMemo, useState } from "react";
import { Check, X, AlertTriangle, Download } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "./ui/button";

type L = Tables<"scan_logs">;
const meta = {
  success: { icon: Check, cls: "bg-success-soft text-success ring-success/30", label: "Verified", good: true },
  duplicate: { icon: X, cls: "bg-flare/10 text-flare ring-flare/25", label: "Duplicate blocked", good: false },
  invalid: { icon: AlertTriangle, cls: "bg-amber/10 text-amber ring-amber/25", label: "Invalid code", good: false },
  too_early: { icon: AlertTriangle, cls: "bg-amber/10 text-amber ring-amber/25", label: "Too early", good: false },
  wrong_zone: { icon: X, cls: "bg-flare/10 text-flare ring-flare/25", label: "Wrong hall", good: false },
  wrong_event: { icon: X, cls: "bg-flare/10 text-flare ring-flare/25", label: "Wrong event", good: false },
  forbidden: { icon: X, cls: "bg-flare/10 text-flare ring-flare/25", label: "Not allowed", good: false },
} as const;

export function ScanLog({ logs }: { logs: L[] }) {
  const [f, setF] = useState<"all" | keyof typeof meta>("all");
  const rows = useMemo(() => logs.filter((l) => f === "all" || l.result === f), [logs, f]);

  function exportCsv() {
    const csv = [["Time", "Code", "Participant", "Gate", "Result"], ...logs.map((l) => [l.created_at, l.code, l.participant_name ?? "", l.gate ?? "", l.result])]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "scan-log.csv";
    a.click();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Security timeline</h2>
          <p className="text-xs text-muted-foreground">Every gate scan is recorded — including rejected duplicates and fake codes.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", "success", "duplicate", "invalid", "too_early", "wrong_zone", "wrong_event"] as const).map((k) => (
            <Button key={k} size="sm" variant={f === k ? "default" : "glass"} onClick={() => setF(k)}>
              {k === "all" ? `All (${logs.length})` : `${meta[k].label} (${logs.filter((l) => l.result === k).length})`}
            </Button>
          ))}
          <Button size="sm" variant="glass" onClick={exportCsv} disabled={!logs.length}><Download /> CSV</Button>
        </div>
      </div>
      <div className="relative space-y-0">
        {rows.map((l, i) => {
          const m = meta[(l.result as keyof typeof meta)] ?? meta.invalid;
          return (
            <div key={l.id} className="animate-rise relative flex items-start gap-4 py-3" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
              {i < rows.length - 1 && <span className="absolute left-[17px] top-9 h-[calc(100%-6px)] w-px bg-border" />}
              <div className={`relative z-10 grid size-9 shrink-0 place-items-center rounded-full ring-1 ${m.cls}`}><m.icon className="size-4" /></div>
              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 rounded-xl bg-elevated px-4 py-3 ring-1 ring-border">
                <div className="min-w-0">
                  <p className="truncate font-medium">{l.participant_name ?? "Unknown code"}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{l.code} · {l.gate ?? "—"}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className={`rounded px-2 py-1 font-mono text-[10px] font-bold uppercase ring-1 ${m.good ? "bg-success-soft text-success ring-success/30" : "bg-flare/10 text-flare ring-flare/25"}`}>
                    {m.good ? "Verified" : "Rejected"}
                  </span>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">{new Date(l.created_at).toLocaleTimeString()}</p>
                </div>
              </div>
            </div>
          );
        })}
        {!rows.length && <p className="py-10 text-center text-sm text-muted-foreground">No scans recorded yet.</p>}
      </div>
    </div>
  );
}
