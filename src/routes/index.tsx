import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight, BarChart3, CalendarPlus, CheckCircle2, ClipboardList, DoorOpen, QrCode, ScanLine, ShieldCheck, Ticket as TicketIcon, UserPlus, Users, XCircle, Zap,
} from "lucide-react";
import { Brand } from "@/components/Brand";
import { Reveal } from "@/components/Reveal";
import { StepAnimation } from "@/components/StepAnimation";
import { Ticket } from "@/components/Ticket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EventEase — QR Event Registration & Instant Check-In" },
      { name: "description", content: "Create college events with capacity, issue unique QR entry passes, and check participants in instantly — duplicates blocked." },
      { property: "og:title", content: "EventEase — QR Event Registration & Instant Check-In" },
      { property: "og:description", content: "One platform for registrations, QR passes and duplicate-proof check-ins. Built for Code Carnival 2026." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: ClipboardList, title: "Smart Registration", text: "Collect registrations without spreadsheets or duplicate entries." },
  { icon: QrCode, title: "Secure QR Passes", text: "Every participant gets a unique, one-time digital entry pass." },
  { icon: Zap, title: "Instant Check-In", text: "Scan with any phone camera or type the code — verified in milliseconds." },
  { icon: BarChart3, title: "Live Event Intelligence", text: "Registrations, attendance and security activity in real time." },
];
const steps = [
  { icon: CalendarPlus, title: "Create Event", text: "Set capacity, venue and schedule in minutes." },
  { icon: UserPlus, title: "Register Participants", text: "Share one link. Duplicates are caught automatically." },
  { icon: TicketIcon, title: "Generate QR Pass", text: "Each attendee receives a unique entry pass." },
  { icon: ScanLine, title: "Scan & Verify", text: "Staff admit guests at any gate in seconds." },
];
const security = ["Unique QR verification", "Duplicate check-in prevention", "Invalid code detection", "Real-time attendance tracking", "Multi-gate check-in", "Full scan audit log"];

function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pass, setPass] = useState("");
  const cta = user ? "/dashboard" : "/auth";

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-hero relative overflow-hidden text-navy-foreground">
        <div className="grid-lines pointer-events-none absolute inset-0" />
        <header className="relative z-10 mx-auto flex h-20 max-w-7xl items-center justify-between gap-3 px-5 sm:px-8">
          <Brand light />
          <nav aria-label="Primary" className="hidden items-center gap-2 md:flex">
            <Link to="/explore" className="hero-nav-item">Explore events</Link>
            <Link to={cta} className="hero-nav-item">Organizers</Link>
          </nav>
          <div className="flex items-center gap-2">
            {!user && <Link to="/auth" className="hero-nav-item hidden sm:inline-flex">Sign in</Link>}
            <Button asChild size="sm" className="hero-nav-cta btn-shine h-9 px-4"><Link to={cta}>{user ? "Open dashboard" : "Get started"}</Link></Button>
          </div>
        </header>

        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-5 pb-24 pt-10 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-navy-border bg-navy-2/60 px-3 py-1 text-xs font-semibold text-navy-muted">
              <span className="size-1.5 rounded-full bg-success" /> Code Carnival 2026 · Atmiya University
            </span>
            <h1 className="mt-6 text-5xl font-bold leading-[1.05] tracking-tight text-balance md:text-6xl">
              Registration to check-in, <span className="text-shimmer">in one scan.</span>
            </h1>
            <p className="mt-6 max-w-[52ch] text-lg text-navy-muted text-pretty">
              No more scattered forms and spreadsheets. Create an event, hand out secure QR passes, and let the gate verify every entry — second scans get rejected on the spot.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild variant="hero" size="lg" className="btn-shine h-12 px-7 text-base"><Link to={cta}>Start managing events <ArrowRight /></Link></Button>
              <Button asChild size="lg" variant="outline" className="h-12 border-navy-border bg-transparent px-7 text-base text-navy-foreground hover:bg-navy-2 hover:text-navy-foreground"><Link to="/explore">Explore events</Link></Button>
            </div>
            <form
              className="mt-8 flex max-w-md gap-2"
              onSubmit={(ev) => { ev.preventDefault(); const c = pass.trim().toUpperCase(); if (c) navigate({ to: "/ticket/$code", params: { code: c } }); }}
            >
              <Input value={pass} onChange={(ev) => setPass(ev.target.value)} placeholder="Have a code? EE-XXXX-XXXX" maxLength={20} className="h-11 border-navy-border bg-navy-2 font-mono uppercase text-navy-foreground placeholder:text-navy-muted" aria-label="Find my pass" />
              <Button type="submit" className="h-11">Find my pass</Button>
            </form>
          </div>

          <div className="relative mx-auto w-full max-w-[520px] py-6">
            <div className="hero-glass absolute inset-x-6 top-10 hidden rounded-[22px] border p-5 sm:block">
              <div className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-navy-border" /><span className="size-2.5 rounded-full bg-navy-border" /><span className="size-2.5 rounded-full bg-navy-border" /></div>
              <div className="mt-5 grid grid-cols-3 gap-3">
                {[["Registered", "84"], ["Checked in", "63"], ["Rate", "75%"]].map(([l, v]) => <div key={l} className="rounded-xl bg-navy p-3"><p className="text-[10px] text-navy-muted">{l}</p><p className="mt-1 font-display text-lg font-bold">{v}</p></div>)}
              </div>
              <div className="mt-4 flex h-24 items-end gap-1.5">{[30, 45, 38, 60, 52, 75, 68, 88, 72, 95, 80, 62].map((h, i) => <span key={i} className="flex-1 rounded-t bg-primary/70" style={{ height: `${h}%` }} />)}</div>
            </div>
            <div className="relative flex justify-center pt-4 sm:pt-24">
              <div className="animate-floaty w-[300px]">
                <Ticket code="EE-7F3A-9C21" name="Aarav Mehta" eventTitle="Code Carnival 2026" actions={false} />
              </div>
            </div>
            <div className="animate-floaty absolute -left-2 bottom-24 hidden items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-card-foreground shadow-float sm:flex [animation-delay:1.2s]">
              <span className="grid size-9 place-items-center rounded-xl bg-success-soft text-success"><CheckCircle2 size={18} /></span>
              <div><p className="text-xs font-semibold">Check-in successful</p><p className="text-[11px] text-muted-foreground">Gate 02 · just now</p></div>
            </div>
            <div className="animate-floaty absolute -right-2 top-[52%] hidden items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-card-foreground shadow-float sm:flex [animation-delay:2.4s]">
              <span className="grid size-9 place-items-center rounded-xl bg-destructive/10 text-destructive"><XCircle size={18} /></span>
              <div><p className="text-xs font-semibold">Duplicate blocked</p><p className="text-[11px] text-muted-foreground">Already checked in</p></div>
            </div>
          </div>
        </div>
      </section>

      <div className="landing-glass">
      {/* Features */}
      <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <Reveal>
          <p className="text-sm font-semibold text-primary">Why EventEase</p>
          <h2 className="mt-2 max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">Everything an organizer needs on event day.</h2>
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 90}>
              <div className="card-glow h-full rounded-2xl border bg-card p-6 shadow-card">
                <span className="grid size-11 place-items-center rounded-xl bg-accent text-primary"><f.icon size={20} /></span>
                <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section className="glass-band border-y">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
          <Reveal>
            <p className="text-sm font-semibold text-primary">How it works</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Four steps. Zero spreadsheets.</h2>
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-4">
            {steps.map((s, i) => (
              <Reveal key={s.title} delay={i * 100}>
                <StepAnimation index={i} />
                <div className="mt-4 flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-primary">0{i + 1}</span>
                  <h3 className="font-semibold">{s.title}</h3>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-24 sm:px-8 lg:grid-cols-2">
        <Reveal><div>
          <p className="text-sm font-semibold text-primary">Gate security</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">One pass. One entry. Every scan audited.</h2>
          <p className="mt-4 text-muted-foreground">Check-ins are verified by an atomic database transaction, so the same code can never be admitted twice — not even from two gates at the same moment.</p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {security.map((s) => <li key={s} className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="size-4 text-success" />{s}</li>)}
          </ul>
        </div></Reveal>
        <div className="space-y-4">
          <div className="animate-pulse-glow flex items-center gap-4 rounded-2xl border bg-success-soft p-5">
            <span className="grid size-12 place-items-center rounded-full bg-success/15 text-success"><CheckCircle2 /></span>
            <div><p className="font-semibold text-success">Checked in · Gate 01</p><p className="font-mono text-xs text-muted-foreground">EE-7F3A-9C21 · Aarav Mehta · 09:14</p></div>
          </div>
          <div className="animate-shake flex items-center gap-4 rounded-2xl border bg-destructive/5 p-5 [animation-delay:1s]">
            <span className="grid size-12 place-items-center rounded-full bg-destructive/15 text-destructive"><XCircle /></span>
            <div><p className="font-semibold text-destructive">Already checked in</p><p className="font-mono text-xs text-muted-foreground">EE-7F3A-9C21 · second scan rejected</p></div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border bg-card p-5 shadow-card">
            <span className="grid size-12 place-items-center rounded-full bg-accent text-primary"><DoorOpen /></span>
            <div><p className="font-semibold">3 gates · live sync</p><p className="text-xs text-muted-foreground">Every device sees the same attendance instantly</p></div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 pb-24 sm:px-8">
        <div className="bg-hero relative mx-auto max-w-7xl overflow-hidden rounded-3xl px-8 py-16 text-center text-navy-foreground">
          <div className="grid-lines pointer-events-none absolute inset-0" />
          <Users className="relative mx-auto size-10 text-primary" />
          <h2 className="relative mt-5 text-3xl font-bold sm:text-4xl">Ready for event day?</h2>
          <p className="relative mx-auto mt-3 max-w-lg text-navy-muted">Set up your first event in under a minute and start checking people in.</p>
          <Button asChild variant="hero" size="lg" className="btn-shine relative mt-8 h-12 px-8"><Link to={cta}>Get started free <ArrowRight /></Link></Button>
        </div>
      </section>

      <footer className="border-t py-8 text-center text-xs text-muted-foreground">EventEase · Built for Code Carnival 2026, Atmiya University</footer>
      </div>
    </div>
  );
}
