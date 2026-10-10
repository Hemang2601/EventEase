import { useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addHoursToLocalInput, findVenueClash, nowLocalInput, takenDatesQuery } from "@/lib/event-dates";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { ImageUpload } from "./ImageUpload";
import { CATEGORIES } from "@/lib/categories";
import type { EventRow } from "@/lib/events";
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
  starts_at: z.string().min(1, "Pick a date & time"),
  ends_at: z.string().optional(),
  category: z.enum(CATEGORIES),
  capacity: z.coerce.number().int().min(1, "Capacity must be at least 1").max(100000),
  checkin_opens_minutes: z.coerce.number().int().min(0).max(1440),
});

function toLocalInput(iso?: string | null) {
  if (!iso) {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }
  const d = new Date(iso);
  if (isNaN(d.getTime())) {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  }
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function EditEventDialog({ event }: { event: EventRow }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const safeCategory = CATEGORIES.includes(event?.category as any) ? event.category : "Technology";
  const defaultEnd = event?.ends_at
    ? toLocalInput(event.ends_at)
    : event?.starts_at
      ? toLocalInput(new Date(new Date(event.starts_at).getTime() + 2 * 3600 * 1000).toISOString())
      : "";

  const [f, setF] = useState({
    title: event?.title || "",
    venue: event?.venue ?? "",
    description: event?.description ?? "",
    rules: event?.rules || DEFAULT_RULES_TEMPLATE,
    starts_at: toLocalInput(event?.starts_at),
    ends_at: defaultEnd,
    capacity: String(event?.capacity || 100),
    category: safeCategory,
    checkin_opens_minutes: String(event?.checkin_opens_minutes ?? 30),
    cover_url: event?.cover_url ?? "",
    host_photo_url: event?.host_photo_url ?? "",
  });

  // Keep form synchronized when event changes or dialog opens
  const [lastEventId, setLastEventId] = useState(event?.id);
  if (event?.id !== lastEventId) {
    setLastEventId(event?.id);
    const cat = CATEGORIES.includes(event?.category as any) ? event.category : "Technology";
    const end = event?.ends_at
      ? toLocalInput(event.ends_at)
      : event?.starts_at
        ? toLocalInput(new Date(new Date(event.starts_at).getTime() + 2 * 3600 * 1000).toISOString())
        : "";
    setF({
      title: event?.title || "",
      venue: event?.venue ?? "",
      description: event?.description ?? "",
      rules: event?.rules || DEFAULT_RULES_TEMPLATE,
      starts_at: toLocalInput(event?.starts_at),
      ends_at: end,
      capacity: String(event?.capacity || 100),
      category: cat,
      checkin_opens_minutes: String(event?.checkin_opens_minutes ?? 30),
      cover_url: event?.cover_url ?? "",
      host_photo_url: event?.host_photo_url ?? "",
    });
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

  const { data: taken } = useQuery({ ...takenDatesQuery(), enabled: open });
  const venueClash = findVenueClash(taken, f.starts_at, f.ends_at, f.venue, event?.id);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const p = schema.safeParse(f);
    if (!p.success) { toast.error(p.error.issues[0]?.message ?? "Invalid input"); return; }
    const start = new Date(p.data.starts_at);
    if (Number.isNaN(start.getTime())) { toast.error("Pick a valid start date & time"); return; }

    const end = p.data.ends_at ? new Date(p.data.ends_at) : new Date(start.getTime() + 2 * 3600 * 1000);
    if (end <= start) { toast.error("End time must be after the start time"); return; }

    const currentStart = event?.starts_at ? new Date(event.starts_at).getTime() : 0;
    const changedStart = isNaN(currentStart) || start.getTime() !== currentStart;
    if (changedStart && start.getTime() < Date.now()) { toast.error("Event date & time cannot be moved into the past"); return; }

    if (venueClash) {
      toast.error(`Venue conflict: "${venueClash.title}" is already scheduled at ${f.venue} during this time.`);
      return;
    }

    setBusy(true);
    const { error } = await supabase.from("events").update({
      title: p.data.title,
      venue: p.data.venue || null,
      description: p.data.description || null,
      rules: p.data.rules,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      capacity: p.data.capacity,
      category: p.data.category,
      checkin_opens_minutes: p.data.checkin_opens_minutes,
      cover_url: f.cover_url || null,
      host_photo_url: f.host_photo_url || null,
    }).eq("id", event.id);
    setBusy(false);
    if (error) { toast.error(error.code === "P0001" ? error.message : "Could not update event"); return; }
    toast.success("Event updated");
    qc.invalidateQueries({ queryKey: ["event", event.id] });
    qc.invalidateQueries({ queryKey: ["events"] });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="glass"><Pencil /> Edit event</Button></DialogTrigger>
      <DialogContent className="glass-panel border-border/80 max-h-[92vh] overflow-y-auto sm:max-w-xl backdrop-blur-xl shadow-2xl">
        <DialogHeader>
          <DialogTitle>Edit event</DialogTitle>
          <DialogDescription>Changes apply instantly to the public registration page and ticket passes.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5"><Label>Title *</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Starts at *</Label>
              <Input
                type="datetime-local"
                value={f.starts_at}
                onChange={(e) => handleStartChange(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ends at</Label>
              <Input
                type="datetime-local"
                min={f.starts_at}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Venue</Label>
              <Input
                value={f.venue}
                onChange={(e) => setF({ ...f, venue: e.target.value })}
                placeholder="e.g. Main Auditorium"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Capacity *</Label>
              <Input type="number" min={1} value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} />
            </div>
          </div>

          {venueClash && (
            <p className="rounded-xl bg-destructive/10 border border-destructive/25 p-2.5 text-xs font-semibold text-destructive">
              ⚠️ Venue Conflict: "{venueClash.title}" is already scheduled at {f.venue} during this time window.
            </p>
          )}

          <div className="space-y-1.5"><Label>Category</Label>
            <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5"><Label>Check-in opens (minutes before start)</Label>
            <Input type="number" min={0} max={1440} value={f.checkin_opens_minutes} onChange={(e) => setF({ ...f, checkin_opens_minutes: e.target.value })} />
            <p className="text-[11px] text-muted-foreground">Check-in starts {f.checkin_opens_minutes || 30} minutes before start. Student registrations close automatically when check-in begins.</p></div>

          <div className="grid gap-3 rounded-2xl border border-border/80 bg-muted/30 backdrop-blur-sm p-4 sm:grid-cols-2">
            <ImageUpload userId={event.owner_id} label="Event photo" value={f.cover_url} onChange={(v) => setF({ ...f, cover_url: v })} />
            <ImageUpload userId={event.owner_id} label="Organizer photo" round value={f.host_photo_url} onChange={(v) => setF({ ...f, host_photo_url: v })} />
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="edit-organizer-name">Organizer name (shown to students)</Label><Input id="edit-organizer-name" value={event.host_name ?? ""} readOnly aria-readonly="true" className="bg-muted/40 text-muted-foreground" /></div>
          </div>

          <div className="space-y-1.5"><Label>Description</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={2} /></div>

          <div className="space-y-2 rounded-2xl border border-border/80 bg-muted/25 backdrop-blur-sm p-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-rules" className="font-semibold text-foreground">Event Rules & Guidelines *</Label>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Required</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Shown to all students on the registration page and their digital passes.
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
              id="edit-rules"
              value={f.rules}
              onChange={(e) => setF({ ...f, rules: e.target.value })}
              rows={4}
              placeholder="1. Valid ID required&#10;2. Gate closing time..."
              required
            />
          </div>

          <Button type="submit" variant="hero" className="h-11 w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Save changes</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
