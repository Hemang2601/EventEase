import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, CalendarDays, Crown, GraduationCap, Loader2, Mail, Pencil, ShieldCheck, Ticket, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRoles } from "@/lib/roles";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
  head: () => ({
    meta: [
      { title: "My profile — EventEase" },
      { name: "description", content: "View and manage your EventEase account profile." },
      { property: "og:title", content: "My profile — EventEase" },
      { property: "og:description", content: "View and manage your EventEase account profile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const roleMeta = {
  admin: { label: "Admin", icon: Crown, chip: "bg-secondary text-foreground", ring: "ring-border" },
  organizer: { label: "Organizer", icon: ShieldCheck, chip: "bg-primary text-primary-foreground", ring: "ring-primary/25" },
  student: { label: "Student", icon: GraduationCap, chip: "bg-accent text-electric", ring: "ring-primary/25" },
} as const;

function ProfilePage() {
  const { user } = useAuth();
  const { primary } = useRoles();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const profileQuery = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("full_name, email, created_at").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const statsQuery = useQuery({
    queryKey: ["my-profile-stats", user?.id, primary],
    enabled: !!user,
    queryFn: async () => {
      const [passes, events, users] = await Promise.all([
        supabase.from("participants").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
        supabase.from("events").select("id", { count: "exact", head: true }).eq("owner_id", user!.id),
        primary === "admin" ? supabase.from("profiles").select("id", { count: "exact", head: true }) : Promise.resolve({ count: null }),
      ]);
      return { passes: passes.count ?? 0, events: events.count ?? 0, users: users.count ?? null };
    },
  });

  const fullName = profileQuery.data?.full_name || (user?.user_metadata?.["full_name"] as string | undefined) || "";
  const email = profileQuery.data?.email || user?.email || "";

  useEffect(() => { setName(fullName); }, [fullName]);

  const initials = (fullName || email.split("@")[0] || "U").split(/[\s.]+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
  const joined = profileQuery.data?.created_at
    ? new Date(profileQuery.data.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : null;
  const PrimaryIcon = roleMeta[primary].icon;

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed) { toast.error("Name cannot be empty"); return; }
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: trimmed }).eq("id", user!.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile updated");
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["my-profile", user!.id] });
  }

  const stats = [
    { icon: Ticket, label: "My passes", value: statsQuery.data?.passes, show: true },
    { icon: CalendarDays, label: "Events I manage", value: statsQuery.data?.events, show: primary === "organizer" || primary === "admin" },
    { icon: Users, label: "Total users", value: statsQuery.data?.users, show: primary === "admin" },
  ].filter((s) => s.show);

  return (
    <AppShell title="My profile">
      <div className="profile-layout mx-auto">
        {/* Identity card */}
        <div className="overflow-hidden rounded-3xl border bg-card shadow-card">
          <div className="bg-hero relative h-48">
            <div className="grid-lines pointer-events-none absolute inset-0" />
            <div className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-primary/30 blur-3xl" />
            <div className="pointer-events-none absolute -left-10 bottom-0 size-40 rounded-full bg-sky-400/20 blur-3xl" />
          </div>
          <div className="px-6 pb-7 sm:px-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex min-w-0 flex-wrap items-end gap-5">
                <span className={`relative z-10 -mt-12 grid size-24 shrink-0 place-items-center rounded-3xl border-4 border-card bg-primary font-display text-3xl font-bold text-primary-foreground shadow-xl ring-4 ${roleMeta[primary].ring}`}>
                  {initials}
                </span>
                <div className="min-w-0 pb-1 pt-3">
                  <p className="font-display text-2xl font-bold tracking-tight">{fullName || "Your name"}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground"><Mail size={13} /> {email}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pb-1">
                <span className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider shadow-sm ${roleMeta[primary].chip}`}>
                  <PrimaryIcon size={12} /> {roleMeta[primary].label}
                </span>
              </div>
            </div>
            {joined && (
              <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays size={13} /> Member since {joined}
              </p>
            )}
          </div>
        </div>

        {/* Activity stats */}
        <div className={`grid gap-4 ${stats.length === 3 ? "sm:grid-cols-3" : stats.length === 2 ? "sm:grid-cols-2" : ""}`}>
          {stats.map((s) => (
            <div key={s.label} className="card-glow rounded-2xl border bg-card p-5 shadow-card">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><s.icon size={18} /></span>
              <p className="mt-3 font-display text-3xl font-bold">{s.value ?? "—"}</p>
              <p className="mt-0.5 text-xs font-medium text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Details */}
        <div className="rounded-3xl border bg-card p-6 shadow-card sm:p-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><UserRound size={18} className="text-primary" /> Account details</h2>
            {!editing && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil size={14} /> Edit name</Button>
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pf-name">Full name</Label>
              {editing ? (
                <div className="flex flex-wrap gap-2">
                  <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
                  <Button size="sm" onClick={saveName} disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setName(fullName); }}>Cancel</Button>
                </div>
              ) : (
                <p className="rounded-xl border bg-muted/40 px-3.5 py-2.5 text-sm font-medium">{fullName || "—"}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <p className="flex items-center gap-2 rounded-xl border bg-muted/40 px-3.5 py-2.5 text-sm text-muted-foreground">
                <Mail size={14} /> {email} <BadgeCheck size={14} className="ml-auto text-success" />
              </p>
            </div>
            <div className="space-y-2">
              <Label>Account type</Label>
              <p className="flex items-center gap-2 rounded-xl border bg-muted/40 px-3.5 py-2.5 text-sm font-medium capitalize">
                <PrimaryIcon size={14} className="text-primary" /> {primary} account
              </p>
            </div>
            <div className="space-y-2">
              <Label>Member since</Label>
              <p className="flex items-center gap-2 rounded-xl border bg-muted/40 px-3.5 py-2.5 text-sm text-muted-foreground">
                <CalendarDays size={14} /> {joined ?? "—"}
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Email and account type cannot be changed. You can update your display name at any time.</p>
        </div>
      </div>
    </AppShell>
  );
}
