import type { LucideIcon } from "lucide-react";
import { CountUp } from "./CountUp";

const tones = {
  blue: "bg-accent text-primary",
  green: "bg-success-soft text-success",
  red: "bg-destructive/10 text-destructive",
  amber: "bg-amber/10 text-amber",
} as const;

export function StatCard({ icon: Icon, label, value, suffix = "", tone = "blue" }: {
  icon: LucideIcon; label: string; value: number; suffix?: string; tone?: keyof typeof tones;
}) {
  return (
    <div className="animate-rise card-glow rounded-2xl border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className={`grid size-9 place-items-center rounded-xl ${tones[tone]}`}><Icon size={17} /></span>
      </div>
      <p className="mt-3 font-display text-3xl font-bold tracking-tight"><CountUp value={value} />{suffix}</p>
    </div>
  );
}
