import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlarmClock, ArrowRight, BadgeCheck, CalendarX2, Fingerprint, IdCard, LifeBuoy, QrCode, ScrollText, ShieldAlert, Users,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/rules")({
  head: () => ({
    meta: [
      { title: "Rules & Regulations — EventEase" },
      { name: "description", content: "Read the event rules: registration, entry codes, check-in timings and code of conduct." },
      { property: "og:title", content: "Rules & Regulations — EventEase" },
      { property: "og:description", content: "Read the event rules: registration, entry codes, check-in timings and code of conduct." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

const sections = [
  {
    icon: Users,
    title: "Registration",
    color: "bg-primary/10 text-primary",
    rules: [
      "Register only with your own name and college email — passes are verified at the gate.",
      "One registration per student per event. Duplicate entries with the same email are rejected automatically.",
      "Seats are limited. When an event reaches full capacity, registration closes automatically.",
      "Registration closes when the event starts — plan ahead and book your spot early.",
      "If a event's registrations are closed by the organizer, no new registrations are accepted.",
    ],
  },
  {
    icon: QrCode,
    title: "Your entry code & pass",
    color: "bg-accent-soft text-accent",
    rules: [
      "Every registration gets a unique QR entry code. Do not share it with anyone — it works only once.",
      "Your pass is your entry ticket. Keep it on your phone (or take a screenshot) before you arrive.",
      "If someone else scans your code first, you may be denied entry. Lost pass? Raise a request on the Help & support page.",
      "Tampering with, editing or reusing an entry code is treated as a violation and the pass can be cancelled.",
    ],
  },
  {
    icon: AlarmClock,
    title: "Check-in & timings",
    color: "bg-warning-soft text-warning",
    rules: [
      "Check-in opens before the event starts (usually 60 minutes). Scanning earlier shows \"too early\" and is rejected.",
      "Your code can be used only once. A second scan of the same code is rejected as a duplicate check-in.",
      "Scanning a pass at the wrong hall shows \"wrong hall\" — go to the hall printed on your pass.",
      "Scanning another event's pass at this event is rejected as \"wrong event\".",
      "Arrive well before start time; entry may stop once the session is full or already running.",
    ],
  },
  {
    icon: CalendarX2,
    title: "Change or cancel",
    color: "bg-danger-soft text-danger",
    rules: [
      "You can change or cancel your registration only before the event starts.",
      "Once the event has started (or you are already checked in), changes and cancellations are locked.",
      "If you can't attend, cancel from My passes so another student can take the seat.",
      "Repeated no-shows without cancelling can affect your priority for future events.",
    ],
  },
  {
    icon: ShieldAlert,
    title: "Code of conduct",
    color: "bg-info-soft text-info",
    rules: [
      "Carry your college ID along with the pass — organizers may verify both at the gate.",
      "Follow hall staff instructions; each hall has its own assigned organizers.",
      "Photography, recording and food policies follow each event's own rules — check the event page.",
      "Misbehaviour at a gate or inside a hall can lead to removal from the event and a ban from future events.",
    ],
  },
];

function Page() {
  return (
    <AppShell title="Rules & regulations">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary"><ScrollText size={13} /> Read before you register</span>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">Rules &amp; regulations</h1>
          <p className="mt-2 text-sm text-muted-foreground">These rules keep events fair for everyone. Read them once — they explain how registration, your entry code and gate check-in work.</p>
        </div>
        <Button asChild variant="hero" className="h-11">
          <Link to="/explore">Browse events <ArrowRight /></Link>
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {sections.map((s, i) => (
          <section key={s.title} className="panel animate-rise p-6" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center gap-3">
              <span className={`grid size-10 place-items-center rounded-xl ${s.color}`}><s.icon size={19} /></span>
              <h2 className="font-display text-lg font-semibold">{s.title}</h2>
            </div>
            <ul className="mt-4 space-y-3">
              {s.rules.map((r) => (
                <li key={r} className="flex gap-3 text-sm leading-relaxed">
                  <BadgeCheck size={16} className="mt-0.5 shrink-0 text-primary" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="panel animate-rise flex flex-col justify-between gap-4 border-primary/30 bg-primary/5 p-6" style={{ animationDelay: "300ms" }}>
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Fingerprint size={19} /></span>
            <h2 className="font-display text-lg font-semibold">Quick reminders</h2>
          </div>
          <ol className="space-y-2 text-sm">
            <li className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">1</span> Register early — seats fill fast.</li>
            <li className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">2</span> Save your pass with the QR code on your phone.</li>
            <li className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">3</span> Reach the right hall before check-in opens and scan once.</li>
          </ol>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline"><Link to="/my-passes"><IdCard size={16} /> My passes</Link></Button>
            <Button asChild variant="ghost"><Link to="/help"><LifeBuoy size={16} /> Any problem? Get help</Link></Button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
