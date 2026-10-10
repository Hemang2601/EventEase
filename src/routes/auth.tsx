import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import {
  GraduationCap,
  ClipboardCheck,
  ShieldCheck,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Sparkles,
  QrCode,
  ArrowLeft,
  ArrowRight,
  Zap,
  CheckCircle2,
  Shield,
  Loader2,
  CalendarDays,
  KeyRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const r = search["redirect"];
    return typeof r === "string" && r.startsWith("/") ? { redirect: r } : {};
  },
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Login — EventEase" },
      { name: "description", content: "Sign in as a student, organizer or admin to manage events and check-ins." },
      { property: "og:title", content: "Login — EventEase" },
      { property: "og:description", content: "Sign in to manage registrations and QR check-ins." },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

type Role = "student" | "organizer" | "admin";

interface RoleConfig {
  label: string;
  badge: string;
  icon: typeof GraduationCap;
  tagline: string;
  heading: string;
  sub: string;
  demoEmail: string;
  bullets: string[];
  gradient: string;
  borderGlow: string;
  chipClass: string;
  btnGradient: string;
  canSignup: boolean;
}

const ROLES: Record<Role, RoleConfig> = {
  student: {
    label: "Student",
    badge: "Free Digital Pass",
    icon: GraduationCap,
    tagline: "Your college event pass, always in your pocket.",
    heading: "Student Portal",
    sub: "Discover hackathons, symposiums & summits. Grab your verified QR entry pass in seconds.",
    demoEmail: "student@gmail.com",
    bullets: [
      "Instant cryptographically unique QR pass",
      "Switch or cancel events anytime before start",
      "Zero registration fees for campus events",
    ],
    gradient: "from-blue-600 via-indigo-600 to-cyan-500",
    borderGlow: "border-primary/50 shadow-[0_0_30px_-8px_rgba(59,130,246,0.45)] ring-1 ring-primary/40",
    chipClass: "bg-primary/10 text-primary border-primary/20",
    btnGradient: "from-primary via-indigo-600 to-electric",
    canSignup: true,
  },
  organizer: {
    label: "Organizer",
    badge: "Gate Staff & Scanner",
    icon: ClipboardCheck,
    tagline: "High-speed gate check-in with zero duplicates.",
    heading: "Organizer Terminal",
    sub: "Manage event capacity, split into halls, and verify attendees at lightning speed.",
    demoEmail: "organizer@gmail.com",
    bullets: [
      "Rapid camera & barcode scanner verification",
      "Atomic duplicate scan rejection engine",
      "Per-hall headcount & attendance analytics",
    ],
    gradient: "from-emerald-600 via-teal-600 to-cyan-600",
    borderGlow: "border-emerald-500/50 shadow-[0_0_30px_-8px_rgba(16,185,129,0.45)] ring-1 ring-emerald-500/40",
    chipClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    btnGradient: "from-emerald-600 via-teal-600 to-cyan-700",
    canSignup: true,
  },
  admin: {
    label: "Admin",
    badge: "Master Console",
    icon: ShieldCheck,
    tagline: "Campus-wide governance and event supervision.",
    heading: "Admin Console",
    sub: "Approve event changes, supervise hall allocations, and review audit logs.",
    demoEmail: "admin@gmail.com",
    bullets: [
      "Full oversight of all campus societies & events",
      "Approve or deny event schedule modifications",
      "Audit logs with gate timestamp records",
    ],
    gradient: "from-amber-500 via-orange-600 to-rose-600",
    borderGlow: "border-amber-500/50 shadow-[0_0_30px_-8px_rgba(245,158,11,0.45)] ring-1 ring-amber-500/40",
    chipClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    btnGradient: "from-amber-600 via-orange-600 to-rose-600",
    canSignup: false,
  },
};

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const dest = redirect ?? "/dashboard";
  const [role, setRole] = useState<Role>("student");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const R = ROLES[role];
  const Icon = R.icon;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: dest });
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) navigate({ to: dest });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate, dest]);

  function pickRole(r: Role) {
    setRole(r);
    if (!ROLES[r].canSignup) setMode("signin");
  }

  function applyDemo(targetRole: Role) {
    setRole(targetRole);
    setMode("signin");
    setEmail(ROLES[targetRole].demoEmail);
    setPassword("EventEase@123");
    toast.success(`Loaded ${ROLES[targetRole].label} demo credentials`, {
      description: "Click Sign In below to enter immediately.",
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setBusy(true);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword(parsed.data);
      if (error) {
        toast.error(
          error.message === "Invalid login credentials"
            ? "Wrong email or password"
            : error.message
        );
      } else {
        toast.success(`Welcome back!`);
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        ...parsed.data,
        options: {
          emailRedirectTo: window.location.origin + "/dashboard",
          data: {
            full_name: name.trim() || email.split("@")[0],
            account_type: role,
          },
        },
      });
      if (error) {
        toast.error(error.message);
      } else if (!data.session) {
        setSent(true);
      } else {
        toast.success("Account created successfully!");
      }
    }
    setBusy(false);
  }

  async function google() {
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth",
    });
    if (res.error) toast.error("Google sign-in failed");
  }

  return (
    <div className="relative min-h-screen w-full max-w-full overflow-x-hidden bg-background">
      {/* Background ambient lighting */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="loader-glow absolute -top-40 -left-40 size-96 rounded-full bg-primary/15 blur-[120px]" />
        <div className="loader-glow absolute top-1/3 -right-40 size-[30rem] rounded-full bg-electric/15 blur-[140px]" />
        <div className="loader-glow absolute -bottom-40 left-1/3 size-96 rounded-full bg-primary/10 blur-[130px]" />
      </div>

      {/* Top Header Bar */}
      <header className="relative z-20 flex h-16 w-full items-center justify-between border-b border-border/40 bg-background/60 px-4 backdrop-blur-md sm:px-8">
        <div className="flex items-center gap-3">
          <Brand />
          <span className="hidden h-4 w-px bg-border/80 sm:inline-block" />
          <span className="hidden text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:inline-block">
            Campus Event Suite
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/explore"
            className="flex items-center gap-1.5 rounded-full border border-border/80 bg-card/60 px-3.5 py-1.5 text-xs font-medium text-foreground transition-all hover:border-primary hover:bg-card hover:shadow-sm"
          >
            <ArrowLeft className="size-3.5" />
            <span>Explore events</span>
          </Link>
        </div>
      </header>

      {/* Split Hero & Form View */}
      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-64px)] w-full max-w-7xl lg:grid-cols-12">
        {/* Left Column: Visual Showcase (Visible on lg+) */}
        <div className="relative hidden flex-col justify-between p-10 lg:col-span-6 lg:flex xl:col-span-7 xl:p-14">
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary backdrop-blur-md">
              <Sparkles className="size-3.5 animate-pulse" />
              <span>Atmiya University Campus Portal</span>
            </div>

            <h1 className="mt-5 font-display text-4xl font-extrabold tracking-tight text-foreground xl:text-5xl">
              Seamless access to{" "}
              <span className="text-shimmer">every college event.</span>
            </h1>
            <p className="mt-3.5 max-w-lg text-base text-muted-foreground leading-relaxed">
              {R.sub}
            </p>
          </div>

          {/* Interactive Holographic Ticket Preview Card */}
          <div className="relative my-8">
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-primary/30 via-electric/20 to-primary/30 blur-xl opacity-75" />
            <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-card/90 p-6 shadow-float backdrop-blur-xl transition-all duration-500">
              {/* Header ribbon */}
              <div className="flex items-center justify-between border-b border-border/60 pb-4">
                <div className="flex items-center gap-2">
                  <div className={cn("size-2.5 rounded-full bg-gradient-to-r", R.gradient)} />
                  <span className="font-mono text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                    Official Campus Pass
                  </span>
                </div>
                <span className={cn("rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase", R.chipClass)}>
                  {R.badge}
                </span>
              </div>

              {/* Ticket Body */}
              <div className="mt-4 flex items-center justify-between gap-6">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Featured Event</p>
                  <h3 className="font-display text-xl font-bold tracking-tight text-foreground">
                    Code Carnival 2026: Tech Expo
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="size-3.5 text-primary" /> Tomorrow · 10:00 AM
                    </span>
                    <span>•</span>
                    <span>Main Auditorium</span>
                  </div>
                </div>

                {/* Scannable Micro-QR with Laser Sweep */}
                <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white p-2 shadow-md">
                  <QrCode className="size-full text-slate-900" strokeWidth={2.2} />
                  <div className="loader-scan absolute inset-x-1 h-0.5 rounded-full bg-primary shadow-[0_0_8px_#3b82f6]" />
                </div>
              </div>

              {/* Status pill row */}
              <div className="mt-5 flex items-center justify-between rounded-xl bg-muted/60 px-3.5 py-2.5 text-xs">
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <CheckCircle2 className="size-4 text-success" />
                  <span>Verified Authenticity</span>
                </div>
                <span className="font-mono text-[11px] text-muted-foreground font-semibold">
                  CODE: #EE-2026-LIVE
                </span>
              </div>
            </div>
          </div>

          {/* Dynamic Role Feature Bullets */}
          <div className="space-y-3">
            <p className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {R.label} capabilities
            </p>
            <div className="grid gap-2.5 sm:grid-cols-3">
              {R.bullets.map((b, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-card/60 p-3 text-xs backdrop-blur-sm"
                >
                  <Zap className="size-4 shrink-0 text-primary mt-0.5" />
                  <span className="text-foreground leading-snug">{b}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer note */}
          <div className="flex items-center gap-2 pt-6 text-xs text-muted-foreground">
            <Shield className="size-3.5 text-success" />
            <span>Encrypted local MongoDB database · Zero duplicate check-in guarantee</span>
          </div>
        </div>

        {/* Right Column: Centered Modern Login Card */}
        <div className="flex flex-col items-center justify-center p-4 sm:p-8 lg:col-span-6 xl:col-span-5">
          <div className="w-full max-w-md animate-rise">
            {/* Main Interactive Login Card */}
            <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-card/95 p-6 shadow-float backdrop-blur-2xl sm:p-8">
              {/* Card top ambient glow */}
              <div
                className={cn(
                  "pointer-events-none absolute -top-24 left-1/2 h-32 w-72 -translate-x-1/2 rounded-full opacity-35 blur-3xl transition-colors duration-500",
                  role === "student" && "bg-primary",
                  role === "organizer" && "bg-emerald-500",
                  role === "admin" && "bg-amber-500"
                )}
              />

              {/* 3-Way Role Selector */}
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-tight text-muted-foreground uppercase">
                    Select Account Role
                  </span>
                  <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase", R.chipClass)}>
                    {R.label} Active
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-2xl bg-muted/60 p-1.5 ring-1 ring-border/50">
                  {(Object.keys(ROLES) as Role[]).map((r) => {
                    const cfg = ROLES[r];
                    const RIcon = cfg.icon;
                    const isActive = role === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => pickRole(r)}
                        className={cn(
                          "group relative flex flex-col items-center justify-center gap-1.5 rounded-xl py-2.5 px-1 text-center transition-all duration-200 active:scale-95",
                          isActive
                            ? "bg-card text-foreground shadow-md ring-1 ring-border font-bold"
                            : "text-muted-foreground hover:bg-card/50 hover:text-foreground font-medium"
                        )}
                      >
                        <div
                          className={cn(
                            "flex size-8 items-center justify-center rounded-lg transition-transform group-hover:scale-105",
                            isActive
                              ? `bg-gradient-to-br ${cfg.gradient} text-white shadow-sm`
                              : "bg-muted text-muted-foreground group-hover:text-foreground"
                          )}
                        >
                          <RIcon className="size-4.5" strokeWidth={isActive ? 2.4 : 2} />
                        </div>
                        <span className="text-[11px] leading-tight">{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* One-Click Quick Demo Fill Bar */}
              <div className="mb-6 rounded-2xl border border-dashed border-border/80 bg-muted/40 p-3">
                <div className="flex items-center justify-between pb-1.5">
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                    <KeyRound className="size-3 text-primary" />
                    1-Click Demo Fill:
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">Pass: EventEase@123</span>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
                  <button
                    type="button"
                    onClick={() => applyDemo("student")}
                    className={cn(
                      "flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all hover:scale-[1.02] active:scale-95",
                      role === "student"
                        ? "border-primary/50 bg-primary/10 text-primary font-semibold shadow-xs"
                        : "border-border bg-card/80 text-muted-foreground hover:bg-card hover:text-foreground"
                    )}
                  >
                    <GraduationCap className="size-3" /> Student
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDemo("organizer")}
                    className={cn(
                      "flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all hover:scale-[1.02] active:scale-95",
                      role === "organizer"
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs"
                        : "border-border bg-card/80 text-muted-foreground hover:bg-card hover:text-foreground"
                    )}
                  >
                    <ClipboardCheck className="size-3" /> Organizer
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDemo("admin")}
                    className={cn(
                      "flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all hover:scale-[1.02] active:scale-95",
                      role === "admin"
                        ? "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold shadow-xs"
                        : "border-border bg-card/80 text-muted-foreground hover:bg-card hover:text-foreground"
                    )}
                  >
                    <ShieldCheck className="size-3" /> Admin
                  </button>
                </div>
              </div>

              {/* Confirmation Email Sent State */}
              {sent ? (
                <div className="py-6 text-center animate-rise">
                  <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-success/15 text-success">
                    <CheckCircle2 className="size-8" />
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-foreground">
                    Check your inbox
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    We sent a confirmation link to <span className="font-semibold text-foreground">{email}</span>.
                    Click it to verify your account.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-6 h-11 w-full rounded-xl"
                    onClick={() => {
                      setSent(false);
                      setMode("signin");
                    }}
                  >
                    Return to Sign In
                  </Button>
                </div>
              ) : (
                <>
                  {/* Card Title & Icon Header */}
                  <div className="mb-6 flex items-center gap-3.5">
                    <div
                      className={cn(
                        "flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md transition-all duration-300",
                        R.gradient
                      )}
                    >
                      <Icon className="size-6" strokeWidth={2.2} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                        {mode === "signin"
                          ? `${R.label} Sign In`
                          : `Create ${R.label} Account`}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {mode === "signin"
                          ? `Sign in to access your ${R.label.toLowerCase()} dashboard.`
                          : `Register for your official ${R.label.toLowerCase()} account.`}
                      </p>
                    </div>
                  </div>

                  {/* Google OAuth Button */}
                  <Button
                    variant="outline"
                    className="h-11 w-full rounded-xl border-border/80 bg-muted/30 font-medium text-foreground transition-all hover:bg-card hover:shadow-xs active:scale-[0.99]"
                    onClick={google}
                    type="button"
                  >
                    <svg viewBox="0 0 24 24" className="mr-2 size-4.5" aria-hidden="true">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    Continue with Google
                  </Button>

                  {/* Divider */}
                  <div className="my-5 flex items-center gap-3">
                    <div className="h-px flex-1 bg-border/60" />
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      or use email
                    </span>
                    <div className="h-px flex-1 bg-border/60" />
                  </div>

                  {/* Form */}
                  <form onSubmit={submit} className="space-y-4">
                    {mode === "signup" && role === "organizer" && (
                      <div className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-xs text-primary leading-relaxed">
                        <strong>Note:</strong> Organizer privileges are reviewed by university administrators.
                        You can immediately access student events while pending approval.
                      </div>
                    )}

                    {mode === "signup" && (
                      <div className="space-y-1.5">
                        <Label htmlFor="n" className="text-xs font-semibold">
                          Full Name
                        </Label>
                        <div className="relative">
                          <User className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="n"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Rahul Sharma"
                            className="h-11 rounded-xl pl-10"
                            required
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor="e" className="text-xs font-semibold">
                        Email Address
                      </Label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="e"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@atmiya.edu"
                          className="h-11 rounded-xl pl-10"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="p" className="text-xs font-semibold">
                          Password
                        </Label>
                        {mode === "signin" && (
                          <span className="text-[11px] text-muted-foreground hover:text-primary cursor-pointer transition-colors">
                            Forgot?
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="p"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="h-11 rounded-xl pl-10 pr-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={busy}
                      className={cn(
                        "btn-shine relative flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none",
                        `bg-gradient-to-r ${R.btnGradient}`
                      )}
                    >
                      {busy ? (
                        <>
                          <Loader2 className="size-4.5 animate-spin" />
                          <span>Verifying…</span>
                        </>
                      ) : (
                        <>
                          <span>
                            {mode === "signin"
                              ? `Sign In as ${R.label}`
                              : `Register ${R.label} Account`}
                          </span>
                          <ArrowRight className="size-4" />
                        </>
                      )}
                    </button>
                  </form>

                  {/* Mode switch */}
                  {R.canSignup ? (
                    <div className="mt-5 text-center text-xs text-muted-foreground">
                      <span>
                        {mode === "signin"
                          ? `Don't have a ${R.label.toLowerCase()} account yet? `
                          : "Already registered? "}
                      </span>
                      <button
                        type="button"
                        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                        className="font-semibold text-primary underline-offset-4 hover:underline"
                      >
                        {mode === "signin" ? "Create one now" : "Sign in here"}
                      </button>
                    </div>
                  ) : (
                    <p className="mt-5 text-center text-xs text-muted-foreground leading-relaxed">
                      Admin credentials are pre-provisioned for university authorities. Use the 1-Click Demo Fill above to test the console.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Mobile Bottom Return Link */}
            <div className="mt-6 text-center lg:hidden">
              <Link
                to="/explore"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="size-3.5" /> Return to Campus Events Explorer
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
