import { useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { findDateClash, takenDatesQuery } from "@/lib/event-dates";
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

const schema = z.object({
  title: z.string().trim().min(3, "Title is too short").max(120),
  venue: z.string().trim().max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  starts_at: z.string().min(1, "Pick a date & time"),
  category: z.enum(CATEGORIES),
  capacity: z.coerce.number().int().min(1, "Capacity must be at least 1").max(100000),
  checkin_opens_minutes: z.coerce.number().int().min(0).max(1440),
});

function toLocalInput(iso: string) {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function EditEventDialog({ event }: { event: EventRow }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    title: event.title,
    venue: event.venue ?? "",
    description: event.description ?? "",
    starts_at: toLocalInput(event.starts_at),
    capacity: String(event.capacity),
    category: event.category,
    checkin_opens_minutes: String(event.checkin_opens_minutes ?? 60),
    cover_url: event.cover_url ?? "",
    host_photo_url: event.host_photo_url ?? "",
  });

  const { data: taken } = useQuery({ ...takenDatesQuery(), enabled: open });
  const clash = findDateClash(taken, f.starts_at, event.id);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const p = schema.safeParse(f);
    if (!p.success) { toast.error(p.error.issues[0]?.message ?? "Invalid input"); return; }
    const start = new Date(p.data.starts_at);
    if (Number.isNaN(start.getTime())) { toast.error("Pick a valid date & time"); return; }
    const changedStart = start.getTime() !== new Date(event.starts_at).getTime();
    if (changedStart && start.getTime() < Date.now()) { toast.error("Event date & time cannot be moved into the past"); return; }
    if (changedStart && clash) { toast.error(`"${clash}" is already scheduled on this date. Pick a different date.`); return; }
    setBusy(true);
    const { error } = await supabase.from("events").update({
      title: p.data.title,
      venue: p.data.venue || null,
      description: p.data.description || null,
      starts_at: changedStart ? start.toISOString() : event.starts_at,
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
      <DialogTrigger asChild><Button variant="outline"><Pencil /> Edit event</Button></DialogTrigger>
      <DialogContent className="panel border-border max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit event</DialogTitle>
          <DialogDescription>Changes apply instantly to the public registration page.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2"><Label>Title *</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Starts at *</Label><Input type="datetime-local" value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} aria-invalid={!!clash} />
              {clash && <p className="text-xs font-medium text-destructive">"{clash}" already uses this date</p>}</div>
            <div className="space-y-2"><Label>Capacity *</Label><Input type="number" min={1} value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} /></div>
          </div>
          <div className="space-y-2"><Label>Category</Label>
            <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Check-in opens (minutes before start)</Label>
            <Input type="number" min={0} max={1440} value={f.checkin_opens_minutes} onChange={(e) => setF({ ...f, checkin_opens_minutes: e.target.value })} />
            <p className="text-xs text-muted-foreground">Scanning is blocked before this time so no one is marked present early.</p></div>
          <div className="space-y-2"><Label>Venue</Label><Input value={f.venue} onChange={(e) => setF({ ...f, venue: e.target.value })} /></div>
          <div className="grid gap-4 rounded-xl border bg-muted/30 p-4 sm:grid-cols-2">
            <ImageUpload userId={event.owner_id} label="Event photo" value={f.cover_url} onChange={(v) => setF({ ...f, cover_url: v })} />
            <ImageUpload userId={event.owner_id} label="Organizer photo" round value={f.host_photo_url} onChange={(v) => setF({ ...f, host_photo_url: v })} />
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="edit-organizer-name">Organizer name (shown to students)</Label><Input id="edit-organizer-name" value={event.host_name ?? ""} readOnly aria-readonly="true" className="bg-muted/40 text-muted-foreground" /></div>
          </div>
          <div className="space-y-2"><Label>Description</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={3} /></div>
          <Button type="submit" variant="hero" className="h-11 w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Save changes</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
