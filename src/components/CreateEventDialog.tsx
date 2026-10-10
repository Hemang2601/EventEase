import { useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Loader2, Plus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addHoursToLocalInput, findVenueClash, nowLocalInput, takenDatesQuery } from "@/lib/event-dates";
import { fmtDate, fmtDateRange } from "@/lib/events";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { ImageUpload } from "./ImageUpload";
import { CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "./ui/dialog";

const DEFAULT_RULES_TEMPLATE = `1. Valid College / University ID card is mandatory for entry.
2. Digital QR entry pass must be presented at the gate on your phone.
3. Entry gate closes 15 minutes after start; late entry will be denied.
4. Each pass is unique and non-transferable; duplicate scans are rejected.
5. Follow campus decorum, safety protocols, and venue guidelines at all times.`;

const PRESET_RULES = [
  "Valid College ID card mandatory",
  "QR pass must be shown on mobile screen",
  "Gate closes 15m after start",
  "Strictly single entry (no re-entry)",
  "No outside food or beverages allowed",
  "Campus dress code applies",
];

const schema = z.object({
  title: z.string().trim().min(3, "Title is too short").max(120),
  venue: z.string().trim().max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  rules: z.string().trim().min(5, "Event rules & guidelines are required").max(3000),
  starts_at: z.string().min(1, "Pick a start date & time"),
  ends_at: z.string().optional(),
  category: z.enum(CATEGORIES),
  capacity: z.coerce.number().int().min(1, "Capacity must be at least 1").max(100000),
  checkin_opens_minutes: z.coerce.number().int().min(0).max(1440),
});

const initial = {
  title: "",
  venue: "",
  description: "",
  rules: DEFAULT_RULES_TEMPLATE,
  starts_at: "",
  ends_at: "",
  capacity: "100",
  category: "Technology",
  cover_url: "",
  host_photo_url: "",
  checkin_opens_minutes: "30",
};

const STEPS = [
  { n: 1, label: "Event basics" },
  { n: 2, label: "Schedule & venue" },
  { n: 3, label: "Capacity" },
  { n: 4, label: "Review & publish" },
];

export function CreateEventDialog({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(1);
  const [f, setF] = useState(initial);
  const organizerQuery = useQuery({
    queryKey: ["my-profile", userId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("full_name, email, created_at").eq("id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const organizerName = organizerQuery.data?.full_name?.trim() ?? "";
  const { data: taken } = useQuery({ ...takenDatesQuery(), enabled: open });
  const venueClash = findVenueClash(taken, f.starts_at, f.ends_at, f.venue);

  function reset() {
    setF(initial);
    setStep(1);
  }

  function handleStartChange(val: string) {
    setF((prev) => {
      let nextEnd = prev.ends_at;
      if (val && (!nextEnd || new Date(nextEnd) <= new Date(val))) {
        nextEnd = addHoursToLocalInput(val, 2);
      }
      return { ...prev, starts_at: val, ends_at: nextEnd };
    });
  }

  function addPresetRule(rule: string) {
    setF((prev) => {
      const trimmed = prev.rules.trim();
      if (!trimmed) return { ...prev, rules: `1. ${rule}` };
      const lines = trimmed.split("\n").filter((l) => l.trim().length > 0);
      return { ...prev, rules: `${trimmed}\n${lines.length + 1}. ${rule}` };
    });
  }

  function stepValid(n: number) {
    if (n === 1) return f.title.trim().length >= 3 && f.rules.trim().length >= 5;
    if (n === 2) {
      if (!f.starts_at) return false;
      const start = new Date(f.starts_at);
      if (Number.isNaN(start.getTime()) || start.getTime() < Date.now()) return false;
      if (f.ends_at) {
        const end = new Date(f.ends_at);
        if (Number.isNaN(end.getTime()) || end <= start) return false;
      }
      if (venueClash) return false;
      return true;
    }
    if (n === 3) return Number(f.capacity) >= 1;
    return true;
  }

  function next() {
    if (!stepValid(step)) {
      if (step === 1 && f.rules.trim().length < 5) {
        toast.error("Event rules & guidelines are required for every event");
        return;
      }
      if (step === 2 && venueClash) {
        toast.error(`Venue conflict: "${venueClash.title}" is already scheduled at ${f.venue} during this time`);
        return;
      }
      toast.error("Please complete this step before continuing");
      return;
    }
    setStep((s) => Math.min(4, s + 1));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (organizerQuery.isPending || organizerQuery.isFetching || organizerQuery.isError || !organizerName) {
      toast.error("Your organizer name must be available before creating an event");
      return;
    }
    const p = schema.safeParse(f);
    if (!p.success) { toast.error(p.error.issues[0]?.message ?? "Invalid input"); return; }
    const start = new Date(p.data.starts_at);
    if (Number.isNaN(start.getTime())) { toast.error("Pick a valid start date & time"); return; }
    if (start.getTime() < Date.now()) { toast.error("Event date & time cannot be in the past"); return; }

    const end = p.data.ends_at ? new Date(p.data.ends_at) : new Date(start.getTime() + 2 * 3600 * 1000);
    if (end <= start) { toast.error("End time must be after the start time"); return; }

    if (venueClash) {
      toast.error(`Venue conflict: "${venueClash.title}" is already scheduled at ${f.venue} during this time.`);
      return;
    }

    setBusy(true);
    const { error } = await supabase.from("events").insert({
      owner_id: userId,
      title: p.data.title,
      venue: p.data.venue || null,
      description: p.data.description || null,
      rules: p.data.rules,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      capacity: p.data.capacity,
      category: p.data.category,
      cover_url: f.cover_url || null,
      host_photo_url: f.host_photo_url || null,
      host_name: organizerName,
      checkin_opens_minutes: p.data.checkin_opens_minutes,
      is_open: true,
    });
    setBusy(false);
    if (error) { toast.error(error.code === "P0001" ? error.message : "Could not create event"); return; }
    toast.success("Event created");
    qc.invalidateQueries({ queryKey: ["events"] });
    setOpen(false);
    reset();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild><Button variant="hero" className="h-11 px-5"><Plus /> New event</Button></DialogTrigger>
      <DialogContent className="glass-panel border-border/80 max-h-[92vh] overflow-y-auto sm:max-w-3xl backdrop-blur-xl shadow-2xl">
        <DialogHeader>
          <DialogTitle>Create event</DialogTitle>
          <DialogDescription>A guided 4-step wizard — set start/end times and capacity. Events can run concurrently at different venues.</DialogDescription>
        </DialogHeader>

        <div className="mb-5 flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex flex-1 items-center gap-2">
              <div className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold transition-colors",
                step > s.n ? "bg-success text-white" : step === s.n ? "bg-primary text-primary-foreground shadow-glow" : "bg-muted text-muted-foreground",
              )}>
                {step > s.n ? <Check className="size-3.5" /> : s.n}
              </div>
              <span className={cn("hidden text-xs font-medium sm:inline", step === s.n ? "text-foreground font-semibold" : "text-muted-foreground")}>{s.label}</span>
              {i < STEPS.length - 1 && <div className={cn("h-0.5 flex-1 rounded-full", step > s.n ? "bg-success" : "bg-muted")} />}
            </div>
          ))}
        </div>

        <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="min-w-0 space-y-4">
            {step === 1 && (
              <div className="space-y-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Step 01 · Event basics</p>
                <div className="space-y-2"><Label>Title *</Label><Input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="AI & ML Sprint" /></div>
                <div className="space-y-2"><Label>Category</Label>
                  <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Description</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={2} placeholder="Brief summary of what participants can expect..." /></div>

                <div className="space-y-2 rounded-2xl border border-border/80 bg-muted/25 backdrop-blur-sm p-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="create-rules" className="font-semibold text-foreground">Event Rules & Entry Guidelines *</Label>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Required</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Required for student registration. Add gate entry rules, college ID policies, and attendance terms.
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {PRESET_RULES.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => addPresetRule(preset)}
                        className="rounded-lg border border-border/80 bg-card px-2 py-1 text-[11px] font-medium text-foreground hover:border-primary/60 hover:bg-muted transition-colors cursor-pointer"
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>
                  <Textarea
                    id="create-rules"
                    value={f.rules}
                    onChange={(e) => setF({ ...f, rules: e.target.value })}
                    rows={4}
                    placeholder="1. Valid ID card required&#10;2. Show QR at gate..."
                    required
                  />
                </div>

                <div className="grid gap-4 rounded-2xl border border-border/80 bg-muted/30 backdrop-blur-sm p-4 sm:grid-cols-2">
                  <ImageUpload userId={userId} label="Event photo" value={f.cover_url} onChange={(v) => setF({ ...f, cover_url: v })} />
                  <ImageUpload userId={userId} label="Organizer photo" round value={f.host_photo_url} onChange={(v) => setF({ ...f, host_photo_url: v })} />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Step 02 · Schedule & venue</p>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    Concurrent events allowed at different venues
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Starts at *</Label>
                    <Input
                      type="datetime-local"
                      min={nowLocalInput()}
                      value={f.starts_at}
                      onChange={(e) => handleStartChange(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Ends at</Label>
                    <Input
                      type="datetime-local"
                      min={f.starts_at || nowLocalInput()}
                      value={f.ends_at}
                      onChange={(e) => setF({ ...f, ends_at: e.target.value })}
                    />
                  </div>
                </div>

                {/* Quick duration presets */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[11px] text-muted-foreground mr-1">Duration:</span>
                  {[
                    { label: "+1h", h: 1 },
                    { label: "+2h", h: 2 },
                    { label: "+3h", h: 3 },
                    { label: "+4h (Half Day)", h: 4 },
                    { label: "+8h (Full Day)", h: 8 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        const base = f.starts_at || nowLocalInput();
                        setF((prev) => ({
                          ...prev,
                          starts_at: prev.starts_at || base,
                          ends_at: addHoursToLocalInput(base, preset.h),
                        }));
                      }}
                      className="rounded-lg border border-border/80 bg-card px-2 py-0.5 text-[11px] font-medium text-foreground hover:border-primary/60 hover:bg-muted transition-colors cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <Label>Venue</Label>
                  <Input
                    value={f.venue}
                    onChange={(e) => setF({ ...f, venue: e.target.value })}
                    placeholder="e.g. Main Auditorium, Seminar Hall 2, Tech Lab A"
                  />
                  {venueClash && (
                    <p className="rounded-lg bg-destructive/10 border border-destructive/25 p-2.5 text-xs font-semibold text-destructive">
                      ⚠️ Venue Conflict: "{venueClash.title}" is already scheduled at {f.venue} during this time window. Please pick a different venue or adjust the time.
                    </p>
                  )}
                  {!venueClash && f.venue.trim() && f.starts_at && (
                    <p className="text-[11px] text-success flex items-center gap-1 font-medium">
                      ✓ Venue available · Events can run concurrently at different venues
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Check-in opens (minutes before start)</Label>
                    <span className="text-[11px] font-mono text-primary font-semibold">Default 30m</span>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={1440}
                    value={f.checkin_opens_minutes}
                    onChange={(e) => setF({ ...f, checkin_opens_minutes: e.target.value })}
                  />
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    Check-in starts {f.checkin_opens_minutes || 30} minutes before start. Student registrations automatically close when check-in begins.
                  </p>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Step 03 · Capacity</p>
                <div className="space-y-2"><Label>Capacity *</Label><Input type="number" min={1} value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} /></div>
                <p className="text-xs text-muted-foreground">Registrations automatically close once this capacity is reached.</p>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Step 04 · Review & publish</p>
                <div className="space-y-2">
                  <Label htmlFor="create-organizer-name">Organizer name (shown to students)</Label>
                  <Input id="create-organizer-name" value={organizerName} readOnly aria-readonly="true" className="bg-muted/40 text-muted-foreground" placeholder={organizerQuery.isPending ? "Loading organizer name…" : "Organizer name unavailable"} />
                  {organizerQuery.isError ? <p className="text-xs text-destructive">Could not load your profile. Close this form and try again.</p> : !organizerQuery.isPending && !organizerName ? <p className="text-xs text-destructive">Add your full name in My profile before creating an event.</p> : null}
                </div>
                <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-border/80 bg-muted/30 backdrop-blur-sm p-4 text-sm">
                  <div><dt className="text-xs text-muted-foreground">Title</dt><dd className="font-semibold text-foreground">{f.title || "—"}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Category</dt><dd className="font-semibold text-foreground">{f.category}</dd></div>
                  <div className="col-span-2"><dt className="text-xs text-muted-foreground">Schedule</dt><dd className="font-semibold text-primary">{fmtDateRange(f.starts_at, f.ends_at)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Venue</dt><dd className="font-semibold text-foreground">{f.venue || "Campus Venue"}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Capacity</dt><dd className="font-semibold text-foreground">{f.capacity} attendees</dd></div>
                </dl>
                <div className="rounded-2xl border border-border/80 bg-muted/30 backdrop-blur-sm p-3.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Rules & Guidelines ({f.rules.split("\n").filter((l) => l.trim().length > 0).length} rules configured)</p>
                  <p className="mt-1 text-xs whitespace-pre-line text-foreground line-clamp-3 leading-relaxed">{f.rules}</p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}><ChevronLeft /> Back</Button>
              {step < 4 ? (
                <Button type="button" variant="hero" onClick={next}>Continue <ChevronRight /></Button>
              ) : (
                <Button type="submit" variant="hero" disabled={busy || organizerQuery.isPending || organizerQuery.isFetching || organizerQuery.isError || !organizerName}>{busy && <Loader2 className="animate-spin" />} Publish event</Button>
              )}
            </div>
          </div>

          {/* Right Preview Card with Glass effect */}
          <div className="hidden lg:block">
            <div className="sticky top-6 overflow-hidden rounded-2xl glass-card border border-border/80 shadow-card">
              <div className="relative h-32 bg-muted">
                {f.cover_url ? (
                  <img src={f.cover_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-xs text-muted-foreground">Cover preview</div>
                )}
                <span className="absolute left-3 top-3 rounded-full bg-card/80 px-2.5 py-0.5 text-[10px] font-bold text-foreground backdrop-blur-md ring-1 ring-border/50">{f.category}</span>
              </div>
              <div className="p-4 space-y-2">
                <p className="text-xs font-mono text-primary font-medium">{fmtDateRange(f.starts_at, f.ends_at)}</p>
                <h4 className="font-bold text-base line-clamp-1">{f.title || "Your event title"}</h4>
                <p className="text-xs text-muted-foreground line-clamp-2">{f.description || "Event description will appear here..."}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                  <span>📍 {f.venue || "Venue TBA"}</span>
                  <span>👥 {f.capacity} seats</span>
                </div>
              </div>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
