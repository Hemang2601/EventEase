import { useEffect, useState } from "react";
import { QrCode } from "lucide-react";

const LETTERS = "EventEase".split("");

/**
 * Premium startup splash shown once per app load/refresh.
 * Fades in instantly, holds, then fades out and unmounts.
 */
export function SplashScreen() {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("show");
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("fade"), 1300);
    const t2 = setTimeout(() => setPhase("gone"), 1900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(100, Math.round(((now - start) / 1150) * 100));
      setPct(p);
      if (p < 100) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-navy transition-transform duration-700 ease-[cubic-bezier(.7,0,.3,1)] ${
        phase === "fade" ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      {/* soft glow orbs */}
      <div className="splash-orb absolute -left-24 -top-24 h-80 w-80 rounded-full bg-primary/35 blur-3xl" />
      <div className="splash-orb-delayed absolute -bottom-28 -right-20 h-96 w-96 rounded-full bg-electric/25 blur-3xl" />
      <div className="splash-orb-slow absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />

      {/* full-screen scan beam */}
      <div className="splash-beam absolute left-0 right-0 h-24 bg-gradient-to-b from-transparent via-electric/15 to-transparent" />
      <div className="splash-beam-line absolute left-0 right-0 h-px bg-electric/60 shadow-[0_0_24px_4px_hsl(var(--electric)/0.5)]" />

      {/* logo mark with spinning conic ring */}
      <div className="splash-pop relative">
        <div className="splash-spin absolute -inset-3 rounded-[2rem] [background:conic-gradient(from_0deg,transparent_0%,hsl(var(--electric))_20%,transparent_40%,hsl(var(--primary))_60%,transparent_80%)]" />
        <div className="absolute -inset-3 rounded-[2rem] bg-navy" style={{ margin: "2px" }} />
        <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-primary to-electric shadow-[0_24px_70px_-12px_hsl(var(--primary)/0.7)]">
          <QrCode className="h-12 w-12 text-primary-foreground" strokeWidth={2.2} />
          {/* scan sweep inside logo */}
          <div className="animate-scan absolute left-1 right-1 h-0.5 rounded-full bg-white/80 shadow-[0_0_12px_2px_rgba(255,255,255,0.7)]" />
        </div>
        <span className="splash-ring absolute -inset-1 rounded-[2rem] border border-primary-foreground/30" />
      </div>

      {/* wordmark — letters stagger in */}
      <div className="mt-8 flex font-display text-4xl font-bold tracking-tight text-navy-foreground sm:text-5xl">
        {LETTERS.map((ch, i) => (
          <span
            key={i}
            className={`splash-letter ${i >= 5 ? "text-electric" : ""}`}
            style={{ animationDelay: `${0.45 + i * 0.06}s` }}
          >
            {ch}
          </span>
        ))}
      </div>
      <p className="splash-rise mt-2.5 text-[11px] font-semibold uppercase tracking-[0.4em] text-navy-muted">
        Register · Scan · Done
      </p>

      {/* loading bar + percentage */}
      <div className="splash-rise mt-10 flex w-52 flex-col items-center gap-2" style={{ animationDelay: "0.9s" }}>
        <div className="h-1 w-full overflow-hidden rounded-full bg-navy-foreground/10">
          <div className="splash-bar h-full w-full origin-left rounded-full bg-gradient-to-r from-primary via-electric to-primary" />
        </div>
        <span className="font-mono text-[11px] font-medium tabular-nums text-navy-muted">
          {pct}%
        </span>
      </div>
    </div>
  );
}
