import { useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Loader2, MapPin, Plus, Users } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { findDateClash, nowLocalInput, takenDatesQuery } from "@/lib/event-dates";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { ImageUpload } from "./ImageUpload";
import { CATEGORIES, categoryImage } from "@/lib/categories";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "./ui/dialog";
import { HostBadge } from "./HostBadge";
import { fmtDate } from "@/lib/events";
import { cn } from "@/lib/utils";

const schema = z.object({
  title: z.string().trim().min(3, "Title is too short").max(120),
  venue: z.string().trim().max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  starts_at: z.string().min(1, "Pick a date & time"),
  category: z.enum(CATEGORIES),
  capacity: z.coerce.number().int().min(1, "Capacity must be at least 1").max(100000),
  checkin_opens_minutes: z.coerce.number().int().min(0).max(1440),
});

const initial = { title: "", venue: "", description: "", starts_at: "", capacity: "100", category: "Technology", cover_url: "", host_photo_url: "", checkin_opens_minutes: "60" };

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
  const clash = findDateClash(taken, f.starts_at);

  function reset() {
    setF(initial);
    setStep(1);
  }

  function stepValid(n: number) {
    if (n === 1) return f.title.trim().length >= 3;
    if (n === 2) {
      if (!f.starts_at) return false;
      const start = new Date(f.starts_at);
      if (Number.isNaN(start.getTime()) || start.getTime() < Date.now()) return false;
      if (clash) return false;
      return true;
    }
    if (n === 3) return Number(f.capacity) >= 1;
    return true;
  }

  function next() {
    if (!stepValid(step)) {
      toast.error(step === 2 && clash ? `"${clash}" is already scheduled on this date` : "Please complete this step before continuing");
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
    if (Number.isNaN(start.getTime())) { toast.error("Pick a valid date & time"); return; }
    if (start.getTime() < Date.now()) { toast.error("Event date & time cannot be in the past"); return; }
    if (clash) { toast.error(`"${clash}" is already scheduled on this date. Pick a different date.`); return; }
    setBusy(true);
    const { error } = await supabase.from("events").insert({
      owner_id: userId,
      title: p.data.title,
      venue: p.data.venue || null,
      description: p.data.description || null,
      starts_at: start.toISOString(),
      capacity: p.data.capacity,
      category: p.data.category,
      cover_url: f.cover_url || null,
      host_photo_url: f.host_photo_url || null,
      host_name: organizerName,
      checkin_opens_minutes: p.data.checkin_opens_minutes,
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
      <DialogContent className="panel border-border max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create event</DialogTitle>
          <DialogDescription>A guided 4-step wizard — set a capacity and registrations close automatically when full.</DialogDescription>
        </DialogHeader>

        <div className="mb-5 flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex flex-1 items-center gap-2">
              <div className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold transition-colors",
                step > s.n ? "bg-success text-white" : step === s.n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}>
                {step > s.n ? <Check className="size-3.5" /> : s.n}
              </div>
              <span className={cn("hidden text-xs font-medium sm:inline", step === s.n ? "text-foreground" : "text-muted-foreground")}>{s.label}</span>
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
                <div className="space-y-2"><Label>Description</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={3} /></div>
                <div className="grid gap-4 rounded-xl border bg-muted/30 p-4 sm:grid-cols-2">
                  <ImageUpload userId={userId} label="Event photo" value={f.cover_url} onChange={(v) => setF({ ...f, cover_url: v })} />
                  <ImageUpload userId={userId} label="Organizer photo" round value={f.host_photo_url} onChange={(v) => setF({ ...f, host_photo_url: v })} />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Step 02 · Schedule & venue</p>
                <div className="space-y-2"><Label>Starts at *</Label><Input type="datetime-local" min={nowLocalInput()} value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} aria-invalid={!!clash} />
                  {clash && <p className="text-xs font-medium text-destructive">"{clash}" already uses this date</p>}</div>
                <div className="space-y-2"><Label>Venue</Label><Input value={f.venue} onChange={(e) => setF({ ...f, venue: e.target.value })} placeholder="Main Hall" /></div>
                <div className="space-y-2"><Label>Check-in opens (minutes before start)</Label><Input type="number" min={0} max={1440} value={f.checkin_opens_minutes} onChange={(e) => setF({ ...f, checkin_opens_minutes: e.target.value })} /></div>
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
                <dl className="grid grid-cols-2 gap-3 rounded-xl border bg-muted/30 p-4 text-sm">
                  <div><dt className="text-xs text-muted-foreground">Title</dt><dd className="font-medium">{f.title || "—"}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Category</dt><dd className="font-medium">{f.category}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Starts</dt><dd className="font-medium">{f.starts_at ? fmtDate(new Date(f.starts_at).toISOString()) : "—"}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Capacity</dt><dd className="font-medium">{f.capacity}</dd></div>
                </dl>
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

          <div className="min-w-0">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Live event preview</p>
            <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
              <div className="relative h-32 overflow-hidden">
                <img src={f.cover_url || categoryImage(f.category)} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-navy/70 to-transparent" />
                <span className="absolute left-3 top-3 rounded-full bg-card/90 px-2.5 py-1 text-[11px] font-semibold text-foreground">{f.category}</span>
              </div>
              <div className="p-4">
                <h3 className="truncate text-base font-semibold">{f.title || "Untitled event"}</h3>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><CalendarDays className="size-3.5" />{f.starts_at ? fmtDate(new Date(f.starts_at).toISOString()) : "Date TBD"}</span>
                  {f.venue && <span className="flex items-center gap-1"><MapPin className="size-3.5" />{f.venue}</span>}
                </p>
                {f.description && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{f.description}</p>}
                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-xs text-muted-foreground"><span className="flex items-center gap-1"><Users className="size-3.5" /> 0 / {f.capacity || 0} registered</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full w-0 rounded-full bg-primary" /></div>
                </div>
                <div className="mt-3 border-t pt-3">
                  <HostBadge name={organizerName || "Organizer"} photo={f.host_photo_url || null} />
                </div>
              </div>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
