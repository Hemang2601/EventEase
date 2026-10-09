import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { GraduationCap, ClipboardCheck, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

const ROLES: Record<Role, {
  label: string;
  icon: typeof GraduationCap;
  tagline: string;
  heading: string;
  sub: string;
  bullets: string[];
  accent: string;
  chip: string;
  ring: string;
  canSignup: boolean;
}> = {
  student: {
    label: "Student",
    icon: GraduationCap,
    tagline: "Your pass, one scan away.",
    heading: "Student login",
    sub: "Browse events, grab your QR pass and manage your registrations.",
    bullets: ["Explore every upcoming event", "Digital pass with unique QR code", "Change or cancel before the event"],
    accent: "from-primary to-electric",
    chip: "bg-accent text-electric",
    ring: "ring-primary shadow-[0_0_24px_-6px_var(--color-primary)] hover:border-primary/60",
    canSignup: true,
  },
  organizer: {
    label: "Organizer",
    icon: ClipboardCheck,
    tagline: "Run event day like a pro.",
    heading: "Organizer login",
    sub: "Create events, manage halls and scan passes at the gate.",
    bullets: ["Unique QR pass for every participant", "Duplicate & invalid scans rejected", "Live attendance across all halls"],
    accent: "from-success to-success/60",
    chip: "bg-success/15 text-success",
    ring: "ring-success shadow-[0_0_24px_-6px_var(--color-success)] hover:border-success/60",
    canSignup: true,
  },
  admin: {
    label: "Admin",
    icon: ShieldCheck,
    tagline: "Full control, one console.",
    heading: "Admin login",
    sub: "Approve organizers, assign halls and watch every event live.",
    bullets: ["Approve & manage organizers", "Assign organizers to event halls", "Hall-wise registrations and scans"],
    accent: "from-warning to-warning/60",
    chip: "bg-warning/15 text-warning",
    ring: "ring-warning shadow-[0_0_24px_-6px_var(--color-warning)] hover:border-warning/60",
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
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const R = ROLES[role];
  const Icon = R.icon;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) navigate({ to: dest }); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => { if (s) navigate({ to: dest }); });
    return () => data.subscription.unsubscribe();
  }, [navigate, dest]);

  function pickRole(r: Role) {
    setRole(r);
    if (!ROLES[r].canSignup) setMode("signin");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Invalid input"); return; }
    setBusy(true);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword(parsed.data);
      if (error) toast.error(error.message === "Invalid login credentials" ? "Wrong email or password" : error.message);
    } else {
      const { data, error } = await supabase.auth.signUp({
        ...parsed.data,
        options: { emailRedirectTo: window.location.origin + "/dashboard", data: { full_name: name.trim(), account_type: role } },
      });
      if (error) toast.error(error.message);
      else if (!data.session) setSent(true);
    }
    setBusy(false);
  }

  async function google() {
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (res.error) toast.error("Google sign-in failed");
  }

  return (
    <div className="grid min-h-screen w-full max-w-full overflow-x-hidden lg:grid-cols-2">
      <div className="bg-hero relative hidden overflow-hidden p-12 text-navy-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="grid-lines pointer-events-none absolute inset-0" />
        <div className="relative"><Brand light /></div>
        <div className="relative" key={role}>
          <div className={`mb-6 inline-flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br ${R.accent} shadow-lg animate-fade-scale`}>
            <Icon className="size-7 text-primary-foreground" />
          </div>
          <h2 className="text-4xl font-bold leading-tight animate-rise">{R.tagline}</h2>
          <p className="mt-4 max-w-md text-navy-muted">{R.sub}</p>
          <ul className="mt-8 space-y-3 text-sm">
            {R.bullets.map((t) => (
              <li key={t} className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-success" />{t}</li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-navy-muted">Code Carnival 2026 · Atmiya University</p>
      </div>
      <div className="grid place-items-center px-4 py-8 sm:py-10 w-full max-w-full overflow-x-hidden">
      <div className="w-full max-w-md animate-rise overflow-hidden">
        <div className="mb-8 flex justify-center lg:hidden"><Brand /></div>

        {/* Role picker */}
        <div className="mb-4 grid grid-cols-3 gap-2">
          {(Object.keys(ROLES) as Role[]).map((r) => {
            const cfg = ROLES[r];
            const RIcon = cfg.icon;
            const active = role === r;
            return (
              <Button variant="outline" key={r} type="button" onClick={() => pickRole(r)}
                className={`group flex h-auto flex-col items-center gap-1.5 px-2 py-3.5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg active:scale-95 ${active ? `ring-2 ${cfg.ring}` : `opacity-75 hover:opacity-100 ${cfg.ring.split(" ").pop()}`}`}>
                <span className={`inline-flex size-9 items-center justify-center rounded-xl bg-gradient-to-br ${cfg.accent} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6`}>
                  <RIcon className="size-4.5 text-primary-foreground" />
                </span>
                <span className="text-xs font-semibold">{cfg.label}</span>
              </Button>
            );
          })}
        </div>

        <div className="border-t border-border pt-8">
          {sent ? (
            <div className="text-center">
              <p className="text-2xl font-semibold">Check your inbox</p>
              <p className="mt-3 text-sm text-muted-foreground">We sent a confirmation link to <span className="text-foreground">{email}</span>. Click it to activate your account.</p>
              <Button variant="glass" className="mt-6" onClick={() => { setSent(false); setMode("signin"); }}>Back to sign in</Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className={`inline-flex size-11 items-center justify-center rounded-xl bg-gradient-to-br ${R.accent}`}>
                  <Icon className="size-5 text-primary-foreground" />
                </span>
                <div>
                  <h1 className="text-2xl font-semibold">{mode === "signin" ? R.heading : `Create ${R.label.toLowerCase()} account`}</h1>
                  <span className={`label-mono rounded-full px-2 py-0.5 !text-[9px] ${R.chip}`}>{R.label} portal</span>
                </div>
              </div>

              <Button variant="outline" className="mt-6 h-11 w-full" onClick={google} type="button">
                <svg viewBox="0 0 24 24" className="size-4" aria-hidden><path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.7 3.72 14.56 2.8 12 2.8 6.92 2.8 2.8 6.92 2.8 12s4.12 9.2 9.2 9.2c5.31 0 8.83-3.73 8.83-8.99 0-.6-.07-1.06-.15-1.51z"/></svg>
                Continue with Google
              </Button>
              <div className="my-6 flex items-center gap-3"><div className="h-px flex-1 bg-border" /><span className="label-mono !text-[10px]">or</span><div className="h-px flex-1 bg-border" /></div>

              <form onSubmit={submit} className="space-y-4">
                {mode === "signup" && role === "organizer" && (
                  <p className="rounded-lg bg-primary/10 p-3 text-xs text-primary">Organizer access is approved by the admin. You can use student features until then.</p>
                )}
                {mode === "signup" && (
                  <div className="space-y-2"><Label htmlFor="n">Full name</Label><Input id="n" value={name} onChange={(e) => setName(e.target.value)} placeholder="Prof. Sharma" /></div>
                )}
                <div className="space-y-2"><Label htmlFor="e">Email</Label><Input id="e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@atmiya.edu" required /></div>
                <div className="space-y-2"><Label htmlFor="p">Password</Label><Input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required /></div>
                <Button type="submit" className={`h-11 w-full bg-gradient-to-r ${R.accent} text-primary-foreground transition-all hover:-translate-y-0.5 hover:brightness-110 hover:shadow-lg active:scale-[.98]`} disabled={busy}>
                  {busy && <Loader2 className="animate-spin" />}{mode === "signin" ? `Sign in as ${R.label}` : "Create account"}
                </Button>
              </form>
              {R.canSignup ? (
                <p className="mt-6 text-center text-sm text-muted-foreground">
                  {mode === "signin" ? `New ${R.label.toLowerCase()}?` : "Already have an account?"}{" "}
                  <Button variant="link" className="h-auto p-0 text-electric" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
                    {mode === "signin" ? "Create account" : "Sign in"}
                  </Button>
                </p>
              ) : (
                <p className="mt-6 text-center text-xs text-muted-foreground">Admin accounts are created by the existing admin only.</p>
              )}
            </>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
