import { useMemo } from "react";
import { motion } from "framer-motion";
import { AreaChart, Area, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Tables } from "@/integrations/supabase/types";
import { RingProgress, ActivityFeed, ProgressBar, type ActivityItem } from "@/components/ee/index";
import { cn } from "@/lib/utils";

type P = Tables<"participants">;
type L = Tables<"scan_logs">;

export function buildActivity(participants: P[], logs: L[]): ActivityItem[] {
  const regEvents = participants.map((p) => ({
    id: `reg-${p.id}`,
    tone: "accent" as const,
    title: `${p.full_name} registered`,
    meta: undefined,
    time: new Date(p.created_at),
  }));
  const checkinEvents = participants
    .filter((p) => p.checked_in_at)
    .map((p) => ({
      id: `chk-${p.id}`,
      tone: "success" as const,
      title: `${p.full_name} checked in`,
      meta: p.checked_in_gate ?? undefined,
      time: new Date(p.checked_in_at!),
    }));
  const scanEvents = logs
    .filter((l) => l.result !== "success")
    .map((l) => ({
      id: `scan-${l.id}`,
      tone: "danger" as const,
      title: l.result === "duplicate" ? `Duplicate attempt${l.participant_name ? ` · ${l.participant_name}` : ""}` : `Invalid code attempt`,
      meta: l.gate ?? undefined,
      time: new Date(l.created_at),
    }));
  return [...regEvents, ...checkinEvents, ...scanEvents]
    .sort((a, b) => b.time.getTime() - a.time.getTime())
    .slice(0, 8)
    .map((e) => ({
      id: e.id,
      tone: e.tone,
      title: e.title,
      meta: e.meta,
      time: e.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }));
}

/** Large circular live-attendance visualization used on the dashboard hero. */
export function LiveAttendance({ registered, checkedIn }: { registered: number; checkedIn: number }) {
  const pct = registered ? Math.round((checkedIn / registered) * 100) : 0;
  return (
    <div className="flex flex-col items-center gap-4">
      <RingProgress value={pct} size={192} stroke={14} tone="accent" label={`${pct}%`} sub="Attendance" />
      <p className="font-mono text-sm text-muted-foreground tabular-nums">{checkedIn} / {registered} checked in</p>
    </div>
  );
}

export function LiveActivityPanel({ items }: { items: ActivityItem[] }) {
  return <ActivityFeed items={items} emptyText="No activity yet — scans and registrations will show up here." />;
}

const axis = { axisLine: false, tickLine: false, tick: { fill: "var(--muted-foreground)", fontSize: 11, fontFamily: "JetBrains Mono" } } as const;
const tip = {
  contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, color: "var(--foreground)" },
  cursor: { stroke: "var(--primary)", strokeOpacity: 0.3 },
};

export function RegistrationsCheckinsChart({ participants }: { participants: P[] }) {
  const data = useMemo(() => {
    const byDay = new Map<string, { d: string; reg: number; chk: number }>();
    const sorted = [...participants].sort((a, b) => a.created_at.localeCompare(b.created_at));
    let regCum = 0;
    for (const p of sorted) {
      const d = new Date(p.created_at).toLocaleDateString([], { day: "2-digit", month: "short" });
      regCum++;
      const row = byDay.get(d) ?? { d, reg: 0, chk: 0 };
      row.reg = regCum;
      byDay.set(d, row);
    }
    const checkedSorted = participants.filter((p) => p.checked_in_at).sort((a, b) => a.checked_in_at!.localeCompare(b.checked_in_at!));
    let chkCum = 0;
    const chkByDay = new Map<string, number>();
    for (const p of checkedSorted) {
      const d = new Date(p.checked_in_at!).toLocaleDateString([], { day: "2-digit", month: "short" });
      chkCum++;
      chkByDay.set(d, chkCum);
    }
    let lastChk = 0;
    for (const [d, row] of byDay) {
      if (chkByDay.has(d)) lastChk = chkByDay.get(d)!;
      row.chk = lastChk;
    }
    return [...byDay.values()];
  }, [participants]);

  if (!data.length) {
    return <div className="grid h-[260px] place-items-center rounded-lg border border-dashed border-border"><p className="text-sm text-muted-foreground">No registrations yet</p></div>;
  }

  return (
    <div className="h-[260px]">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
          <defs>
            <linearGradient id="reg-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--electric)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--electric)" stopOpacity={0} /></linearGradient>
            <linearGradient id="chk-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity={0.45} /><stop offset="100%" stopColor="var(--primary)" stopOpacity={0} /></linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
          <XAxis dataKey="d" {...axis} /><YAxis {...axis} allowDecimals={false} />
          <Tooltip {...tip} />
          <Area type="monotone" dataKey="reg" name="Registrations" stroke="var(--electric)" strokeWidth={2} fill="url(#reg-fill)" />
          <Area type="monotone" dataKey="chk" name="Check-ins" stroke="var(--primary)" strokeWidth={2.5} fill="url(#chk-fill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EventHealthWidget({ registered, capacity, checkedIn, duplicates, invalid, totalScans }: {
  registered: number; capacity: number; checkedIn: number; duplicates: number; invalid: number; totalScans: number;
}) {
  const registration = capacity ? Math.min(100, Math.round((registered / capacity) * 100)) : 0;
  const attendance = registered ? Math.round((checkedIn / registered) * 100) : 0;
  const over = Math.max(0, registered - capacity);
  const capacityScore = capacity ? Math.max(0, 100 - Math.round((over / capacity) * 100)) : 100;
  const security = totalScans ? Math.max(0, Math.round(((totalScans - duplicates - invalid) / totalScans) * 100)) : 100;
  const score = Math.round((registration + attendance + capacityScore + security) / 4);
  const status = score >= 80 ? "Healthy" : score >= 55 ? "Needs attention" : "At risk";
  const statusTone = score >= 80 ? "text-success" : score >= 55 ? "text-warning" : "text-danger";

  const rows: { label: string; value: number; tone: "accent" | "success" | "danger" | "warning" }[] = [
    { label: "Registration", value: registration, tone: "accent" },
    { label: "Attendance", value: attendance, tone: "success" },
    { label: "Capacity", value: capacityScore, tone: "warning" },
    { label: "Security", value: security, tone: "danger" },
  ];

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <p className="font-display text-4xl font-bold tabular-nums leading-none">{score}<span className="text-lg text-muted-foreground"> / 100</span></p>
          <p className={cn("mt-1.5 text-sm font-semibold", statusTone)}>{status}</p>
        </div>
      </div>
      <div className="mt-5 space-y-3.5">
        {rows.map((r) => <ProgressBar key={r.label} label={r.label} value={r.value} max={100} tone={r.tone} suffix={`${r.value}%`} />)}
      </div>
    </div>
  );
}

export function SecuritySnapshot({ duplicates, invalid, success, recent }: {
  duplicates: number; invalid: number; success: number; recent: ActivityItem[];
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-success-soft px-3 py-3 text-center">
          <p className="font-mono text-xl font-bold tabular-nums text-success">{success}</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Admitted</p>
        </div>
        <div className="rounded-lg bg-danger-soft px-3 py-3 text-center">
          <p className="font-mono text-xl font-bold tabular-nums text-danger">{duplicates}</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Duplicates</p>
        </div>
        <div className="rounded-lg bg-warning-soft px-3 py-3 text-center">
          <p className="font-mono text-xl font-bold tabular-nums text-warning">{invalid}</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Invalid</p>
        </div>
      </div>
      <ActivityFeed items={recent} emptyText="No security events yet." />
    </div>
  );
}

export const fadeRise = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

export function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div initial={fadeRise.initial} animate={fadeRise.animate} transition={{ duration: 0.45, delay, ease: [0.2, 0.8, 0.2, 1] }} className={className}>
      {children}
    </motion.div>
  );
}
