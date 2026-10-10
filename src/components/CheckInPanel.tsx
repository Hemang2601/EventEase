import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Camera,
  CameraOff,
  Check,
  ChevronDown,
  Clock,
  Flashlight,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RefreshCw,
  ScanLine,
  ShieldAlert,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { GATES } from "@/lib/categories";
import { toast } from "sonner";

type L = Tables<"scan_logs">;

export type Result =
  | { status: "success"; full_name: string; code: string; checked_in_at: string; gate?: string }
  | { status: "duplicate"; full_name: string; code: string; checked_in_at: string; gate?: string | null }
  | { status: "invalid"; code: string }
  | { status: "forbidden"; code: string }
  | { status: "too_early"; code: string; opens_at: string }
  | { status: "wrong_zone"; code: string; full_name: string; zone: string }
  | { status: "wrong_event"; code: string; full_name: string; event: string };

const fmt = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Plays an instant pleasant chime or warning buzz on verification */
function playAudioFeedback(type: "success" | "error") {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === "success") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.08); // A5
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.28);
    } else {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.setValueAtTime(180, now + 0.12);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    }
  } catch {
    // Ignore audio restriction errors
  }
}

/** Triggers subtle device vibration on mobile */
function triggerVibrate(type: "success" | "error") {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      if (type === "success") {
        navigator.vibrate(120);
      } else {
        navigator.vibrate([150, 70, 150]);
      }
    }
  } catch {
    // Ignore vibration failure
  }
}

export function CheckInPanel({
  eventId,
  onDone,
  logs = [],
}: {
  eventId: string;
  onDone: () => void;
  logs?: L[];
}) {
  const [code, setCode] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);

  const evQuery = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, title, starts_at, ends_at, checkin_opens_minutes")
        .eq("id", eventId)
        .maybeSingle();
      return data;
    },
    enabled: !!eventId,
  });

  const ev = evQuery.data;
  const checkinMinutes = typeof ev?.checkin_opens_minutes === "number" ? ev.checkin_opens_minutes : 30;
  const opensAt = ev ? new Date(new Date(ev.starts_at).getTime() - checkinMinutes * 60 * 1000) : null;
  const endsAt = ev ? (ev.ends_at ? new Date(ev.ends_at) : new Date(new Date(ev.starts_at).getTime() + 4 * 3600 * 1000)) : null;
  const isTooEarly = opensAt ? Date.now() < opensAt.getTime() : false;
  const isEnded = endsAt ? Date.now() > endsAt.getTime() : false;

  // Auto-dismiss popup modal states
  const [popupResult, setPopupResult] = useState<Result | null>(null);
  const [lastScannedResult, setLastScannedResult] = useState<Result | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [totalCountdown, setTotalCountdown] = useState(2800);
  const [isPaused, setIsPaused] = useState(false);

  const [gate, setGate] = useState<string>(GATES[0]);
  const gateRef = useRef<string>(GATES[0]);
  useEffect(() => {
    gateRef.current = gate;
  }, [gate]);

  const scannerRef = useRef<any>(null);
  const lastScan = useRef<{ code: string; t: number }>({ code: "", t: 0 });
  const popupResultRef = useRef<Result | null>(null);
  const canScanRef = useRef<boolean>(true);

  // Keep ref synchronized
  useEffect(() => {
    popupResultRef.current = popupResult;
  }, [popupResult]);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todays = logs.filter((l) => new Date(l.created_at).toDateString() === today);
    const checkedIn = todays.filter((l) => l.result === "success").length;
    const duplicate = todays.filter((l) => l.result === "duplicate").length;
    const rejected = todays.filter((l) => l.result && !["success", "duplicate"].includes(l.result)).length;
    return { checkedIn, duplicate, rejected };
  }, [logs]);

  /** Close popup and resume camera scanning seamlessly */
  function dismissPopup() {
    setPopupResult(null);
    popupResultRef.current = null;
    setIsPaused(false);
    // Allow small debounce so attendee can pull phone away before next scan
    setTimeout(() => {
      canScanRef.current = true;
    }, 450);
  }

  /** Auto-dismiss countdown interval */
  useEffect(() => {
    if (!popupResult || isPaused) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 50) {
          clearInterval(timer);
          dismissPopup();
          return 0;
        }
        return prev - 50;
      });
    }, 50);

    return () => clearInterval(timer);
  }, [popupResult, isPaused]);

  /** Keyboard shortcut for dismissing modal (Space, Enter, Esc) */
  useEffect(() => {
    if (!popupResult) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.code === "Space") {
        e.preventDefault();
        dismissPopup();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [popupResult]);

  /** Verify pass code against database */
  async function verify(raw: string) {
    const c = raw.trim().toUpperCase();
    if (!c) return;

    setBusy(true);
    canScanRef.current = false;

    const { data, error } = await supabase.rpc("check_in_participant", {
      _event_id: eventId,
      _code: c,
      _gate: gateRef.current,
    });
    setBusy(false);

    let res: Result;
    if (error || !data) {
      res = { status: "invalid", code: c };
    } else {
      res = { ...(data as object), code: (data as { code?: string }).code ?? c } as Result;
    }

    const ok = res.status === "success";

    // Audio & haptic feedback
    if (soundEnabled) {
      playAudioFeedback(ok ? "success" : "error");
    }
    triggerVibrate(ok ? "success" : "error");

    // Auto-dismiss duration: 2.8s for success, 4.5s for denied/duplicate
    const duration = ok ? 2800 : 4500;
    setCountdown(duration);
    setTotalCountdown(duration);
    setIsPaused(false);
    setPopupResult(res);
    popupResultRef.current = res;
    setLastScannedResult(res);

    setCode("");
    onDone();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    verify(code);
  }

  /** Start camera with enlarged scanning area and hardware acceleration */
  async function startCam(preferredCamId?: string) {
    try {
      const { Html5Qrcode } = await import("html5-qrcode");

      // Stop previous instance if running
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
          scannerRef.current.clear();
        } catch {
          // ignore
        }
        scannerRef.current = null;
      }

      // Initialize scanner with native hardware BarcodeDetector enabled
      const s = new Html5Qrcode("qr-reader", {
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        verbose: false,
      });
      scannerRef.current = s;

      // Query available camera devices for quick switching
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setCameras(devices);
          if (!activeCameraId) setActiveCameraId(devices[0].id);
        }
      } catch {
        // ignore
      }

      const cameraConfig = preferredCamId || { facingMode: "environment" };

      await s.start(
        cameraConfig,
        {
          fps: 15,
          // Large dynamic scan box: 88% of viewfinder area (allows scanning anywhere in view!)
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const size = Math.max(280, Math.floor(minEdge * 0.88));
            return { width: size, height: size };
          },
          aspectRatio: 1.0,
          disableFlip: false,
        },
        (text: string) => {
          // Ignore if popup is open or scanning paused
          if (popupResultRef.current || !canScanRef.current) return;
          const now = Date.now();
          if (text === lastScan.current.code && now - lastScan.current.t < 3000) return;
          lastScan.current = { code: text, t: now };
          verify(text);
        },
        () => {},
      );

      setCamOn(true);
      if (preferredCamId) setActiveCameraId(preferredCamId);

      // Inspect torch support
      try {
        const cap = (s as any).getRunningTrackCameraCapabilities?.();
        setHasTorch(Boolean(cap?.torchFeature()?.isSupported()));
      } catch {
        setHasTorch(false);
      }
    } catch {
      setCamOn(false);
      toast.error("Camera unavailable or permission denied. You can still use manual entry.");
    }
  }

  async function stopCam() {
    try {
      if (torchOn && scannerRef.current) {
        try {
          const cap = (scannerRef.current as any).getRunningTrackCameraCapabilities?.();
          await cap?.torchFeature()?.apply(false);
        } catch {
          // noop
        }
      }
      await scannerRef.current?.stop();
      scannerRef.current?.clear();
    } catch {
      // noop
    }
    scannerRef.current = null;
    setCamOn(false);
    setTorchOn(false);
    setHasTorch(false);
  }

  async function toggleTorch() {
    try {
      if (!scannerRef.current) return;
      const cap = (scannerRef.current as any).getRunningTrackCameraCapabilities?.();
      if (cap?.torchFeature()?.isSupported()) {
        const next = !torchOn;
        await cap.torchFeature().apply(next);
        setTorchOn(next);
      }
    } catch {
      toast.error("Torch is not supported by this camera device.");
    }
  }

  async function switchCamera() {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex((c) => c.id === activeCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex];
    setActiveCameraId(nextCamera.id);
    if (camOn) {
      await startCam(nextCamera.id);
    }
  }

  useEffect(() => {
    return () => {
      scannerRef.current?.stop().catch(() => {});
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Controls Toolbar: Gate Selector & Scanner Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap gap-2" role="radiogroup" aria-label="Gate selection">
          {GATES.map((g) => (
            <Button
              key={g}
              type="button"
              size="sm"
              variant={gate === g ? "default" : "glass"}
              className="font-mono text-xs"
              onClick={() => setGate(g)}
            >
              {g}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Sound Toggle */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? "Sound chime enabled" : "Sound chime muted"}
            className="h-8 px-2 text-xs"
          >
            {soundEnabled ? (
              <span className="flex items-center gap-1 text-primary">
                <Volume2 className="size-4" /> Sound ON
              </span>
            ) : (
              <span className="flex items-center gap-1 text-muted-foreground">
                <VolumeX className="size-4" /> Muted
              </span>
            )}
          </Button>

          {/* Flashlight toggle */}
          {hasTorch && camOn && (
            <Button
              type="button"
              variant={torchOn ? "default" : "ghost"}
              size="sm"
              onClick={toggleTorch}
              title="Toggle Flashlight / Torch"
              className="h-8 px-2 text-xs"
            >
              <Flashlight className="size-4" />
            </Button>
          )}

          {/* Switch Camera */}
          {cameras.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={switchCamera}
              title="Switch camera device"
              className="h-8 px-2 text-xs"
            >
              <RefreshCw className="size-4" />
            </Button>
          )}

          {/* Expand / Minimize View */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? "Standard view" : "Enlarge scanner view"}
            className="h-8 px-2 text-xs"
          >
            {isExpanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
        </div>
      </div>

      <div className={`grid gap-6 ${isExpanded ? "grid-cols-1" : "lg:grid-cols-[1fr_280px]"}`}>
        {/* Scanner Column */}
        <div className="space-y-4">
          {/* Check-in Schedule / Status Notification Banner */}
          {isTooEarly && opensAt && (
            <div className="flex items-center gap-3 rounded-2xl border border-amber/35 bg-amber/10 p-3.5 text-xs text-amber animate-rise shadow-sm">
              <Clock className="size-4 shrink-0 text-amber" />
              <div>
                <p className="font-semibold text-foreground">
                  Check-in Gate opens at {opensAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Check-in starts {checkinMinutes} minutes before the event. Student registrations automatically close at that time. Scans before gate opening are rejected.
                </p>
              </div>
            </div>
          )}

          {!isTooEarly && !isEnded && ev && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-success/30 bg-success/10 px-3.5 py-2 text-xs text-success animate-rise">
              <span className="flex items-center gap-2 font-semibold">
                <span className="size-2 rounded-full bg-success animate-pulse" /> Check-in Gate Active
              </span>
              <span className="text-[11px] text-muted-foreground">
                Registrations closed · Admitting verified pass holders
              </span>
            </div>
          )}

          {isEnded && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2 text-xs text-destructive">
              <ShieldAlert className="size-4 shrink-0" /> Event has concluded. Check-in gate is closed.
            </div>
          )}

          {/* Main Camera Viewfinder with Increased Scan Area */}
          <div
            className={`relative w-full overflow-hidden rounded-3xl bg-navy ring-1 ring-border shadow-float transition-all duration-300 ${
              isExpanded
                ? "min-h-[520px] md:min-h-[600px] aspect-[4/3]"
                : "min-h-[380px] sm:min-h-[440px] md:min-h-[480px] aspect-square"
            }`}
          >
            {/* HTML5-QRCode target container with full object cover */}
            <div
              id="qr-reader"
              className="absolute inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
            />

            {/* Camera Idle State */}
            {!camOn && (
              <div className="grid-bg absolute inset-0 grid place-items-center p-6 text-center">
                <div className="max-w-sm">
                  <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-glow ring-1 ring-primary/30">
                    <ScanLine className="size-8" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold text-navy-foreground">
                    High-Speed Gate Scanner
                  </h3>
                  <p className="mt-1.5 text-xs text-navy-muted leading-relaxed">
                    Point camera at participant’s QR pass. Wide auto-detect scans instantly from any angle or distance.
                  </p>
                  <Button
                    variant="hero"
                    className="mt-5 h-11 px-6 shadow-glow"
                    onClick={() => startCam(activeCameraId ?? undefined)}
                  >
                    <Camera className="size-4" /> Start Camera Scanner
                  </Button>
                </div>
              </div>
            )}

            {/* Active Scanner Laser & Reticles */}
            {camOn && (
              <>
                {/* Real-time sweeping laser line */}
                <div className="animate-scan pointer-events-none absolute inset-x-8 h-1 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_16px_rgba(59,130,246,0.9)]" />

                {/* High-visibility corner targeting reticles */}
                {(
                  [
                    "top-6 left-6 border-t-4 border-l-4",
                    "top-6 right-6 border-t-4 border-r-4",
                    "bottom-6 left-6 border-b-4 border-l-4",
                    "bottom-6 right-6 border-b-4 border-r-4",
                  ] as const
                ).map((pos) => (
                  <span
                    key={pos}
                    className={`pointer-events-none absolute size-10 rounded-md border-primary shadow-[0_0_10px_rgba(59,130,246,0.6)] ${pos}`}
                  />
                ))}

                {/* Status HUD Pill */}
                <div className="pointer-events-none absolute top-4 inset-x-0 flex justify-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-background/85 px-3 py-1 font-mono text-[11px] font-semibold text-primary shadow-lg ring-1 ring-primary/30 backdrop-blur-md">
                    <span className="size-2 rounded-full bg-success animate-pulse" />
                    Wide Auto-Detect Active · {gate}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Camera Toggle Button */}
          {camOn ? (
            <Button
              variant="outline"
              className="w-full h-11 border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={stopCam}
            >
              <CameraOff className="size-4" /> Stop Camera Scanner
            </Button>
          ) : (
            <Button
              variant="hero"
              className="w-full h-11"
              onClick={() => startCam(activeCameraId ?? undefined)}
            >
              <Camera className="size-4" /> Turn On Camera Scanner
            </Button>
          )}

          {/* Manual Entry Divider */}
          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-border" />
            <span className="label-mono !text-[10px]">OR MANUAL ENTRY</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Manual Code Input Dropdown */}
          <button
            type="button"
            onClick={() => setManualOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-dashed border-border px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground cursor-pointer"
          >
            <span>Enter Participant Pass Code</span>
            <ChevronDown className={`size-4 transition-transform ${manualOpen ? "rotate-180" : ""}`} />
          </button>

          {manualOpen && (
            <form onSubmit={submit} className="flex gap-2 animate-in fade-in duration-150">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="EVT-XXXXXX"
                className="h-11 flex-1 min-w-0 font-mono uppercase tracking-widest text-xs sm:text-sm"
                aria-label="Entry code"
                autoFocus
              />
              <Button
                type="submit"
                variant="hero"
                className="h-11 px-5 shrink-0"
                disabled={busy || !code.trim()}
              >
                {busy ? <Loader2 className="animate-spin size-4" /> : "Verify Code"}
              </Button>
            </form>
          )}

          {/* Last Scanned Attendee Card (Persists after popup auto-dismisses) */}
          {lastScannedResult && !popupResult && (
            <div className="rounded-2xl border border-border/80 bg-muted/40 p-4 shadow-sm animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Last Scanned Attendee
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                    lastScannedResult.status === "success"
                      ? "bg-success-soft text-success ring-1 ring-success/30"
                      : "bg-destructive/15 text-destructive ring-1 ring-destructive/30"
                  }`}
                >
                  {lastScannedResult.status === "success" ? (
                    <>
                      <Check className="size-3" /> Granted
                    </>
                  ) : (
                    <>
                      <X className="size-3" /> Denied
                    </>
                  )}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm text-foreground">
                    {"full_name" in lastScannedResult
                      ? lastScannedResult.full_name
                      : "Participant"}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    Code: <span className="font-bold text-foreground">{lastScannedResult.code}</span>
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-primary"
                  onClick={() => {
                    setPopupResult(lastScannedResult);
                    setIsPaused(true);
                  }}
                >
                  View Details
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Gate Stats Sidebar */}
        <div className="panel flex flex-col gap-5 p-5">
          <p className="label-mono !text-[10px]">Today's Gate Stats</p>
          <div>
            <p className="text-xs text-muted-foreground">Checked In</p>
            <p className="mt-1 font-display text-4xl font-bold text-success">{stats.checkedIn}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Rejected Scans</p>
            <p className="mt-1 font-display text-4xl font-bold text-flare">{stats.rejected}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Duplicate Attempts</p>
            <p className="mt-1 font-display text-4xl font-bold text-amber">{stats.duplicate}</p>
          </div>
          <div className="mt-auto flex items-center gap-2 rounded-xl bg-muted px-3 py-2 font-mono text-xs font-semibold">
            <span className="size-2 rounded-full bg-primary" /> Active Gate: {gate}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VERIFICATION MODAL POPUP (AUTO-DISMISSES TO RESUME SCANNING INSTANTLY) */}
      {/* ========================================================================= */}
      {popupResult && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-150"
          onClick={(e) => {
            // Dismiss when clicking backdrop
            if (e.target === e.currentTarget) dismissPopup();
          }}
        >
          <div
            className={`relative w-full max-w-md overflow-hidden rounded-3xl border p-6 sm:p-7 shadow-2xl transition-all duration-200 animate-in zoom-in-95 ${
              popupResult.status === "success"
                ? "border-success/50 bg-card shadow-success/20 ring-2 ring-success/30"
                : popupResult.status === "duplicate"
                  ? "border-amber-500/50 bg-card shadow-amber-500/20 ring-2 ring-amber-500/30"
                  : "border-destructive/50 bg-card shadow-destructive/20 ring-2 ring-destructive/30"
            }`}
          >
            {/* Top Auto-dismiss Progress Bar */}
            <div className="absolute inset-x-0 top-0 h-1.5 bg-muted/60 overflow-hidden">
              <div
                className={`h-full transition-all duration-75 ${
                  popupResult.status === "success"
                    ? "bg-success"
                    : popupResult.status === "duplicate"
                      ? "bg-amber-500"
                      : "bg-destructive"
                }`}
                style={{
                  width: `${totalCountdown > 0 ? (countdown / totalCountdown) * 100 : 0}%`,
                }}
              />
            </div>

            {/* Quick close X button */}
            <button
              type="button"
              onClick={dismissPopup}
              className="absolute top-4 right-4 rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              aria-label="Dismiss popup"
            >
              <X className="size-5" />
            </button>

            {/* Status Visual Icons & Details */}
            {popupResult.status === "success" && (
              <div className="text-center">
                <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-success/15 ring-4 ring-success/30 text-success shadow-lg">
                  <Check className="size-11 stroke-[3]" />
                </div>

                <p className="mt-4 text-xs font-bold uppercase tracking-[0.25em] text-success">
                  Access Granted · Gate Verified
                </p>
                <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                  {popupResult.full_name}
                </h2>

                <div className="mt-2.5 flex justify-center">
                  <span className="font-mono text-sm font-bold text-primary bg-primary/10 px-3.5 py-1 rounded-full border border-primary/25">
                    {popupResult.code}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2.5 rounded-2xl border border-border/80 bg-muted/40 p-3.5 text-xs text-left">
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                      Gate / Hall
                    </p>
                    <p className="mt-0.5 font-semibold text-foreground">
                      {popupResult.gate || gate}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                      Check-in Time
                    </p>
                    <p className="mt-0.5 font-mono font-semibold text-foreground">
                      {fmt(popupResult.checked_in_at)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-success">
                  <Check className="size-3.5" /> Admitted · Valid for single entry
                </div>
              </div>
            )}

            {popupResult.status === "duplicate" && (
              <div className="text-center">
                <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-amber-500/15 ring-4 ring-amber-500/30 text-amber-500 shadow-lg">
                  <ShieldAlert className="size-11" />
                </div>

                <p className="mt-4 text-xs font-bold uppercase tracking-[0.25em] text-amber-500">
                  Access Denied · Duplicate Pass
                </p>
                <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                  {popupResult.full_name}
                </h2>

                <div className="mt-2.5 flex justify-center">
                  <span className="font-mono text-sm font-bold text-amber-500 bg-amber-500/10 px-3.5 py-1 rounded-full border border-amber-500/30">
                    {popupResult.code}
                  </span>
                </div>

                <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-center text-xs text-amber-500">
                  <p className="font-bold text-sm">Pass Already Used!</p>
                  <p className="mt-1 text-muted-foreground">
                    First checked in at{" "}
                    <span className="font-mono font-semibold text-foreground">
                      {fmt(popupResult.checked_in_at)}
                    </span>{" "}
                    {popupResult.gate ? `at ${popupResult.gate}` : ""}.
                  </p>
                  <p className="mt-1.5 font-semibold text-destructive">
                    Re-entry with this ticket pass is strictly denied.
                  </p>
                </div>
              </div>
            )}

            {popupResult.status === "wrong_event" && (
              <div className="text-center">
                <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-destructive/15 ring-4 ring-destructive/30 text-destructive shadow-lg">
                  <X className="size-11 stroke-[3]" />
                </div>

                <p className="mt-4 text-xs font-bold uppercase tracking-[0.25em] text-destructive">
                  Access Denied · Wrong Event
                </p>
                <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                  {popupResult.full_name}
                </h2>

                <div className="mt-2.5 flex justify-center">
                  <span className="font-mono text-sm font-bold text-destructive bg-destructive/10 px-3.5 py-1 rounded-full border border-destructive/30">
                    {popupResult.code}
                  </span>
                </div>

                <div className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 text-center text-xs text-destructive">
                  <p className="font-semibold">
                    Pass is registered for:{" "}
                    <span className="text-foreground font-bold">{popupResult.event}</span>
                  </p>
                  <p className="mt-1 text-muted-foreground">Not valid for the current event venue.</p>
                </div>
              </div>
            )}

            {popupResult.status === "wrong_zone" && (
              <div className="text-center">
                <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-destructive/15 ring-4 ring-destructive/30 text-destructive shadow-lg">
                  <X className="size-11 stroke-[3]" />
                </div>

                <p className="mt-4 text-xs font-bold uppercase tracking-[0.25em] text-destructive">
                  Access Denied · Wrong Hall / Gate
                </p>
                <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                  {popupResult.full_name}
                </h2>

                <div className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 text-center text-xs text-destructive">
                  <p className="font-semibold">
                    Participant assigned to:{" "}
                    <span className="text-foreground font-bold">{popupResult.zone}</span>
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Please send this participant to their assigned hall gate.
                  </p>
                </div>
              </div>
            )}

            {popupResult.status === "too_early" && (
              <div className="text-center">
                <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-destructive/15 ring-4 ring-destructive/30 text-destructive shadow-lg">
                  <Clock className="size-11" />
                </div>

                <p className="mt-4 text-xs font-bold uppercase tracking-[0.25em] text-destructive">
                  Access Denied · Gate Not Open Yet
                </p>
                <div className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 text-center text-xs text-destructive">
                  <p className="font-semibold">
                    Check-in opens at:{" "}
                    <span className="text-foreground font-bold">
                      {new Date(popupResult.opens_at).toLocaleString([], {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Scans before gate opening time are blocked to maintain accurate records.
                  </p>
                </div>
              </div>
            )}

            {popupResult.status === "forbidden" && (
              <div className="text-center">
                <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-destructive/15 ring-4 ring-destructive/30 text-destructive shadow-lg">
                  <X className="size-11 stroke-[3]" />
                </div>

                <p className="mt-4 text-xs font-bold uppercase tracking-[0.25em] text-destructive">
                  Access Denied · Not Authorized
                </p>
                <div className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 text-center text-xs text-destructive">
                  <p className="font-semibold">You do not have organizer privileges for this event.</p>
                </div>
              </div>
            )}

            {popupResult.status === "invalid" && (
              <div className="text-center">
                <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-destructive/15 ring-4 ring-destructive/30 text-destructive shadow-lg">
                  <X className="size-11 stroke-[3]" />
                </div>

                <p className="mt-4 text-xs font-bold uppercase tracking-[0.25em] text-destructive">
                  Access Denied · Invalid Entry Pass
                </p>
                <div className="mt-2.5 flex justify-center">
                  <span className="font-mono text-sm font-bold text-destructive bg-destructive/10 px-3.5 py-1 rounded-full border border-destructive/30">
                    {popupResult.code}
                  </span>
                </div>
                <div className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 text-center text-xs text-destructive">
                  <p className="font-semibold">No registered participant found with this entry code.</p>
                </div>
              </div>
            )}

            {/* Modal Bottom Controls: Auto-Dismiss Countdown & Next Attendee Button */}
            <div className="mt-6 border-t border-border pt-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5 font-medium">
                  <Clock className="size-3.5 text-primary" />
                  <span>
                    {isPaused
                      ? "Auto-dismiss paused"
                      : `Auto-dismiss in ${(Math.max(0, countdown) / 1000).toFixed(1)}s`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPaused((p) => !p)}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                >
                  {isPaused ? (
                    <>
                      <Play className="size-3" /> Resume timer
                    </>
                  ) : (
                    <>
                      <Pause className="size-3" /> Hold screen
                    </>
                  )}
                </button>
              </div>

              <Button
                type="button"
                variant={popupResult.status === "success" ? "hero" : "default"}
                className="mt-3 w-full h-11 text-sm font-semibold gap-2 shadow-md cursor-pointer"
                onClick={dismissPopup}
              >
                <span>Next Attendee</span>
                <ArrowRight className="size-4" />
                <span className="ml-1 rounded border border-white/20 px-1.5 py-0.5 text-[10px] font-mono opacity-80 hidden sm:inline-block">
                  Space / Enter / Esc
                </span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
