import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CountUp } from "@/components/CountUp";

/** Page header: eyebrow + title + subtitle on the left, actions on the right. */
export function PageHeader({ eyebrow, title, subtitle, actions, className }: {
  eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; className?: string;
}) {
  return (
    <div className={cn("mb-7 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-2">{eyebrow}</div>}
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-foreground sm:text-[32px]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Generic surface panel — the base container used everywhere. */
export function Panel({ children, className, as: As = "div", padded = true }: {
  children: ReactNode; className?: string; as?: "div" | "section"; padded?: boolean;
}) {
  return (
    <As className={cn("rounded-xl border bg-card shadow-card", padded && "p-5 sm:p-6", className)}>
      {children}
    </As>
  );
}

export function PanelHeader({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

const metricTones = {
  default: "text-foreground",
  accent: "text-primary",
  success: "text-success",
  danger: "text-danger",
  warning: "text-warning",
} as const;

/** A single stat: label, large tabular number, optional delta/footnote. */
export function Metric({ label, value, suffix = "", tone = "default", icon, foot }: {
  label: ReactNode; value: number | string; suffix?: string; tone?: keyof typeof metricTones; icon?: ReactNode; foot?: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        {icon}
      </div>
      <p className={cn("mt-2 font-display text-[28px] font-bold leading-none tabular-nums", metricTones[tone])}>
        {typeof value === "number" ? <CountUp value={value} /> : value}{suffix}
      </p>
      {foot && <p className="mt-1.5 text-xs text-muted-foreground">{foot}</p>}
    </div>
  );
}

const pillTones = {
  neutral: "bg-muted text-muted-foreground",
  accent: "bg-accent text-accent-foreground",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
} as const;

/** Compact status label used across tables, cards and timelines. */
export function StatusPill({ tone = "neutral", dot = true, children, className }: {
  tone?: keyof typeof pillTones; dot?: boolean; children: ReactNode; className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold", pillTones[tone], className)}>
      {dot && <span className={cn("size-1.5 rounded-full", {
        "bg-muted-foreground": tone === "neutral",
        "bg-primary": tone === "accent",
        "bg-success": tone === "success",
        "bg-danger": tone === "danger",
        "bg-warning": tone === "warning",
      })} />}
      {children}
    </span>
  );
}

const barTones = { accent: "bg-primary", success: "bg-success", danger: "bg-danger", warning: "bg-warning" } as const;

/** Thin horizontal progress bar with label row. */
export function ProgressBar({ label, value, max, tone = "accent", suffix }: {
  label?: ReactNode; value: number; max: number; tone?: keyof typeof barTones; suffix?: ReactNode;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      {label && (
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-semibold tabular-nums text-foreground">{suffix ?? `${value} / ${max}`}</span>
        </div>
      )}
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("animate-grow h-full rounded-full transition-all duration-700", barTones[tone])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Large circular progress ring used for attendance / health visualizations. */
export function RingProgress({ value, size = 168, stroke = 12, tone = "accent", label, sub }: {
  value: number; size?: number; stroke?: number; tone?: keyof typeof barTones; label?: ReactNode; sub?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const colorVar = { accent: "var(--primary)", success: "var(--success)", danger: "var(--danger)", warning: "var(--warning)" }[tone];
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colorVar} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-display text-3xl font-bold tabular-nums leading-none">{label ?? `${Math.round(pct)}%`}</p>
          {sub && <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

export type ActivityItem = {
  id: string;
  tone: "success" | "danger" | "warning" | "accent" | "neutral";
  title: ReactNode;
  meta?: ReactNode;
  time: ReactNode;
};

/** Operational live-activity feed — real events only, no placeholders. */
export function ActivityFeed({ items, emptyText = "No activity yet." }: { items: ActivityItem[]; emptyText?: string }) {
  if (!items.length) return <EmptyState title={emptyText} />;
  return (
    <ul className="space-y-0.5">
      {items.map((it) => (
        <li key={it.id} className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50">
          <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", {
            "bg-success": it.tone === "success",
            "bg-danger": it.tone === "danger",
            "bg-warning": it.tone === "warning",
            "bg-primary": it.tone === "accent",
            "bg-muted-foreground": it.tone === "neutral",
          })} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{it.title}</p>
            {it.meta && <p className="mt-0.5 truncate text-xs text-muted-foreground">{it.meta}</p>}
          </div>
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">{it.time}</span>
        </li>
      ))}
    </ul>
  );
}

/** Empty state block used across tables / panels when there is no real data yet. */
export function EmptyState({ icon, title, sub, action }: { icon?: ReactNode; title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="grid place-items-center rounded-lg border border-dashed border-border px-6 py-10 text-center">
      {icon && <div className="mb-3 text-muted-foreground">{icon}</div>}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {sub && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{sub}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
