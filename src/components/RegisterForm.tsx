import { useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

const schema = z.object({
  full_name: z.string().trim().min(2, "Name is too short").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  phone: z.string().trim().max(20).optional(),
  department: z.string().trim().max(80).optional(),
});

export type RegisteredTicket = { code: string; full_name: string; email: string; event_title: string };

export function RegisterForm({ eventId, eventTitle = "", disabled, prefill, onRegistered }: {
  eventId: string;
  eventTitle?: string;
  disabled?: boolean;
  prefill?: { full_name: string; email: string };
  onRegistered: (t: RegisteredTicket) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    full_name: prefill?.full_name ?? "",
    email: prefill?.email ?? "",
    phone: "",
    department: "",
  });
  const locked = !!prefill;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Invalid input"); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("register_participant", {
      _event_id: eventId,
      _full_name: parsed.data.full_name,
      _email: parsed.data.email,
      _phone: parsed.data.phone ?? "",
      _department: parsed.data.department ?? "",
    });
    setBusy(false);
    const res = data as { ok: boolean; error?: string; code?: string } | null;
    if (error || !res) { toast.error("Registration failed. Try again."); return; }
    if (!res.ok || !res.code) { toast.error(res.error ?? "Registration failed"); return; }
    toast.success(`Registered! Code ${res.code}`);
    setForm((f) => ({ ...f, phone: "", department: "" }));
    onRegistered({ code: res.code, full_name: parsed.data.full_name, email: parsed.data.email, event_title: eventTitle });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="rn">Full name *</Label>
          <Input id="rn" value={form.full_name} onChange={set("full_name")} placeholder="Aarav Mehta" required readOnly={locked} className={locked ? "bg-muted/50 text-muted-foreground" : undefined} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="re">Email *</Label>
          <Input id="re" type="email" value={form.email} onChange={set("email")} placeholder="aarav@atmiya.edu" required readOnly={locked} className={locked ? "bg-muted/50 text-muted-foreground" : undefined} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rp">Phone</Label>
          <Input id="rp" value={form.phone} onChange={set("phone")} placeholder="98xxxxxx10" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rd">Department</Label>
          <Input id="rd" value={form.department} onChange={set("department")} placeholder="CE / IT / MCA" />
        </div>
      </div>
      <Button type="submit" variant="hero" className="h-11 w-full" disabled={busy || disabled}>
        {busy ? <Loader2 className="animate-spin" /> : <UserPlus />}
        {disabled ? "Event is full" : "Register & generate code"}
      </Button>
    </form>
  );
}
