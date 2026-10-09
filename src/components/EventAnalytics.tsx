import { useMemo } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Tables } from "@/integrations/supabase/types";
import { GATES } from "@/lib/categories";

type P = Tables<"participants">;
type L = Tables<"scan_logs">;

const axis = { axisLine: false, tickLine: false, tick: { fill: "var(--muted-foreground)", fontSize: 11, fontFamily: "JetBrains Mono" } } as const;
const tip = {
  contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, color: "var(--foreground)" },
  cursor: { fill: "color-mix(in oklab, var(--primary) 8%, transparent)" },
};

function Card({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="panel p-6">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
      <div className="mt-5 h-[220px]">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="grid-bg grid h-full place-items-center rounded-lg ring-1 ring-border"><p className="label-mono">{text}</p></div>;
}

export function EventAnalytics({ participants, logs, capacity }: { participants: P[]; logs: L[]; capacity: number }) {
  const data = useMemo(() => {
    const ins = participants.filter((p) => p.checked_in_at).map((p) => new Date(p.checked_in_at!).getTime()).sort((a, b) => a - b);
    const cum = ins.map((t, i) => ({ t: new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), n: i + 1 }));
    const byDay = new Map<string, number>();
    [...participants].sort((a, b) => a.created_at.localeCompare(b.created_at)).forEach((p) => {
      const d = new Date(p.created_at).toLocaleDateString([], { day: "2-digit", month: "short" });
      byDay.set(d, (byDay.get(d) ?? 0) + 1);
    });
    const regs = [...byDay].map(([d, n]) => ({ d, n }));
    const gates = GATES.map((g) => ({ g, n: participants.filter((p) => p.checked_in_gate === g).length }));
    const depts = new Map<string, number>();
    participants.forEach((p) => { const k = p.department?.trim() || "Other"; depts.set(k, (depts.get(k) ?? 0) + 1); });
    const dept = [...depts].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([d, n]) => ({ d, n }));
    const dup = logs.filter((l) => l.result === "duplicate").length;
    const inv = logs.filter((l) => l.result === "invalid").length;
    return { cum, regs, gates, dept, dup, inv, checked: ins.length };
  }, [participants, logs]);

  const reg = participants.length;
  const rate = reg ? Math.round((data.checked / reg) * 100) : 0;
  const funnel = [
    { label: "Capacity", v: capacity, cls: "bg-electric" },
    { label: "Registered", v: reg, cls: "bg-electric/70" },
    { label: "Checked in", v: data.checked, cls: "bg-primary" },
    { label: "Not arrived yet", v: reg - data.checked, cls: "bg-flare" },
  ];
  const colors = ["var(--primary)", "var(--electric)", "var(--amber)"];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Attendance rate", `${rate}%`, "text-primary"],
          ["Seats left", String(Math.max(0, capacity - reg)), "text-electric"],
          ["Duplicates blocked", String(data.dup), "text-flare"],
          ["Invalid attempts", String(data.inv), "text-amber"],
        ].map(([l, v, c]) => (
          <div key={l} className="panel p-5">
            <p className="label-mono !text-[10px]">{l}</p>
            <p className={`mt-2 font-mono text-3xl font-bold ${c}`}>{v}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card title="Check-ins over time" sub="Cumulative gate scans">
          {data.cum.length ? (
            <ResponsiveContainer>
              <AreaChart data={data.cum} margin={{ left: -20, right: 8 }}>
                <defs><linearGradient id="cf" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--primary)" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
                <XAxis dataKey="t" {...axis} /><YAxis {...axis} allowDecimals={false} />
                <Tooltip {...tip} />
                <Area type="monotone" dataKey="n" name="Checked in" stroke="var(--primary)" strokeWidth={2.5} fill="url(#cf)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <Empty text="No check-ins yet" />}
        </Card>

        <div className="panel p-6">
          <h3 className="font-semibold">Registration → attendance</h3>
          <p className="mt-1 text-xs text-muted-foreground">Only gate scans count as attendance.</p>
          <div className="mt-6 space-y-5">
            {funnel.map((f) => (
              <div key={f.label}>
                <div className="mb-2 flex justify-between text-sm"><span>{f.label}</span><span className="font-mono font-semibold">{f.v}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-border">
                  <div className={`h-full rounded-full ${f.cls} transition-all duration-700`} style={{ width: `${capacity ? Math.min(100, (f.v / capacity) * 100) : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Registrations per day" sub="When people signed up">
          {data.regs.length ? (
            <ResponsiveContainer>
              <BarChart data={data.regs} margin={{ left: -20 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
                <XAxis dataKey="d" {...axis} /><YAxis {...axis} allowDecimals={false} /><Tooltip {...tip} />
                <Bar dataKey="n" name="Registrations" fill="var(--electric)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty text="No registrations yet" />}
        </Card>
        <Card title="Check-ins by gate" sub="Load across entry points">
          <ResponsiveContainer>
            <BarChart data={data.gates} margin={{ left: -20 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
              <XAxis dataKey="g" {...axis} /><YAxis {...axis} allowDecimals={false} /><Tooltip {...tip} />
              <Bar dataKey="n" name="Check-ins" radius={[6, 6, 0, 0]}>
                {data.gates.map((g, i) => <Cell key={g.g} fill={colors[i % colors.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Top departments" sub="Who is registering">
          {data.dept.length ? (
            <ResponsiveContainer>
              <BarChart data={data.dept} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" {...axis} allowDecimals={false} /><YAxis type="category" dataKey="d" {...axis} width={70} /><Tooltip {...tip} />
                <Bar dataKey="n" name="Participants" fill="var(--primary)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty text="No data yet" />}
        </Card>
      </div>
    </div>
  );
}
