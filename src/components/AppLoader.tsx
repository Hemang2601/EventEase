import { useEffect, useState } from "react";
import { QrCode, Sparkles } from "lucide-react";
import { useIsFetching } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

interface AppLoaderProps {
  fullscreen?: boolean;
  message?: string;
  submessage?: string;
  compact?: boolean;
  className?: string;
}

const MESSAGES = [
  "Synchronizing workspace…",
  "Loading event details…",
  "Preparing passes & tickets…",
  "Almost ready…",
];

/**
 * Premium EventEase Loader
 * Modern animated loader for page refreshes, initial startup, and route navigation.
 */
export function AppLoader({
  fullscreen = false,
  message,
  submessage,
  compact = false,
  className,
}: AppLoaderProps) {
  const [activeMsgIndex, setActiveMsgIndex] = useState(0);

  // Cycle through contextual messages if loading takes more than 1.2s
  useEffect(() => {
    if (message) return;
    const interval = setInterval(() => {
      setActiveMsgIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 1400);
    return () => clearInterval(interval);
  }, [message]);

  const displayMessage = message || MESSAGES[activeMsgIndex];
  const displaySubmessage = submessage ?? "Real-time QR check-in & event system";

  if (compact) {
    return (
      <div
        className={cn(
          "flex min-h-[220px] w-full flex-col items-center justify-center gap-3 py-10 px-4 text-center animate-fade-scale",
          className
        )}
      >
        <div className="relative">
          {/* Subtle spinning ring */}
          <div className="loader-orbit absolute -inset-2 rounded-2xl [background:conic-gradient(from_0deg,transparent_0%,var(--electric)_40%,var(--primary)_70%,transparent_100%)] opacity-80" />
          <div className="absolute -inset-1.5 rounded-2xl bg-card" />
          <div className="relative flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-electric text-white shadow-md">
            <QrCode className="size-6 text-white" strokeWidth={2.2} />
            <div className="loader-scan absolute inset-x-1 top-1 h-0.5 rounded-full bg-white/90 shadow-[0_0_8px_#fff]" />
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-tight text-foreground">{displayMessage}</p>
          <div className="mx-auto h-1 w-24 overflow-hidden rounded-full bg-muted">
            <div className="loader-wave h-full w-1/2 rounded-full bg-gradient-to-r from-primary to-electric" />
          </div>
        </div>
      </div>
    );
  }

  const content = (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center p-8 text-center animate-rise",
        fullscreen ? "max-w-md" : "w-full max-w-sm rounded-3xl border border-border/80 bg-card/85 p-8 backdrop-blur-xl shadow-float",
        className
      )}
    >
      {/* Background ambient orbs */}
      <div className="loader-glow pointer-events-none absolute -top-12 -left-12 size-40 rounded-full bg-primary/20 blur-3xl" />
      <div className="loader-glow pointer-events-none absolute -bottom-12 -right-12 size-44 rounded-full bg-electric/20 blur-3xl" />

      {/* Branded Badge with Dual Ring & Scanning Laser */}
      <div className="relative mb-6">
        {/* Outer conical spinner */}
        <div className="loader-orbit absolute -inset-3.5 rounded-[2rem] [background:conic-gradient(from_0deg,transparent_0%,var(--electric)_30%,var(--primary)_70%,transparent_100%)] opacity-85" />
        <div className="absolute -inset-3 rounded-[1.85rem] bg-card" />

        {/* Pulsing ring */}
        <div className="animate-ping absolute -inset-1 rounded-[1.5rem] bg-primary/20 duration-1000" />

        {/* Core icon mark */}
        <div className="relative flex size-20 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/95 to-electric shadow-[0_16px_40px_-10px_var(--primary)] shadow-primary/40">
          <QrCode className="size-10 text-white transition-transform" strokeWidth={2.2} />
          {/* Laser beam sweep */}
          <div className="loader-scan absolute inset-x-1.5 h-0.5 rounded-full bg-white shadow-[0_0_12px_2px_rgba(255,255,255,0.9)]" />
        </div>
      </div>

      {/* Brand title with shimmer */}
      <div className="flex items-center gap-1.5">
        <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Event<span className="text-shimmer">Ease</span>
        </h2>
        <Sparkles className="size-4 text-electric animate-pulse" />
      </div>

      {/* Contextual status message */}
      <p className="mt-2 text-sm font-medium text-foreground transition-all duration-300">
        {displayMessage}
      </p>

      {displaySubmessage && (
        <p className="mt-1 text-xs text-muted-foreground">{displaySubmessage}</p>
      )}

      {/* Glowing progress track */}
      <div className="mt-6 w-full max-w-[220px]">
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted/80 ring-1 ring-border/50">
          <div className="loader-wave absolute inset-y-0 h-full w-2/3 rounded-full bg-gradient-to-r from-primary via-electric to-primary shadow-sm shadow-primary/40" />
        </div>
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-background/90 backdrop-blur-md p-4 text-center"
      >
        {content}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[70vh] w-full flex-col items-center justify-center p-6 text-center"
    >
      {content}
    </div>
  );
}

/**
 * Top-of-screen laser progress bar shown during route changes or data refetches.
 */
export function TopNavigationProgress() {
  const isNavigating = useRouterState({ select: (s) => s.status === "pending" });
  const isFetching = useIsFetching();
  const active = isNavigating || isFetching > 0;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let t: NodeJS.Timeout;
    if (active) {
      setVisible(true);
    } else {
      t = setTimeout(() => setVisible(false), 280);
    }
    return () => clearTimeout(t);
  }, [active]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className={cn(
        "fixed inset-x-0 top-0 z-[99999] h-[3px] overflow-hidden bg-primary/15 transition-opacity duration-300",
        active ? "opacity-100" : "opacity-0"
      )}
    >
      <div className="loader-wave relative h-full w-2/3 bg-gradient-to-r from-transparent via-primary to-electric shadow-[0_0_14px_3px_var(--primary)]">
        <div className="absolute right-0 top-0 h-full w-4 bg-white/80 shadow-[0_0_10px_2px_#fff]" />
      </div>
    </div>
  );
}

/**
 * Route-level pending component for TanStack Router
 */
export function RoutePendingScreen({ message }: { message?: string }) {
  return (
    <AppLoader
      fullscreen
      message={message ?? "Loading workspace…"}
      submessage="Preparing events & real-time tickets"
    />
  );
}

/**
 * Fullscreen pending component for root route initial hydration / refresh
 */
export function RootPendingScreen() {
  return (
    <AppLoader
      fullscreen
      message="Loading EventEase…"
      submessage="Synchronizing your workspace"
    />
  );
}
