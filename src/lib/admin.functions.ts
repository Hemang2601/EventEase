import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Input = { email: string; fullName: string; password: string };

export const createOrganizer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Input) => {
    const email = String(d?.email ?? "").trim().toLowerCase();
    const fullName = String(d?.fullName ?? "").trim().slice(0, 100);
    const password = String(d?.password ?? "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) throw new Error("Valid email required");
    if (!fullName) throw new Error("Name required");
    if (password.length < 8 || password.length > 72) throw new Error("Password must be 8–72 characters");
    return { email, fullName, password };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) return { ok: false as const, error: "Admins only" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let uid: string | null = null;
    const { data: existing } = await supabaseAdmin.from("profiles").select("id").ilike("email", data.email).maybeSingle();
    if (existing) uid = existing.id;
    else {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email, password: data.password, email_confirm: true,
        user_metadata: { full_name: data.fullName },
      });
      if (error || !created.user) return { ok: false as const, error: error?.message ?? "Could not create account" };
      uid = created.user.id;
    }
    const { error: rErr } = await supabaseAdmin.from("user_roles").upsert({ user_id: uid, role: "organizer" }, { onConflict: "user_id,role", ignoreDuplicates: true });
    if (rErr) return { ok: false as const, error: "Could not grant organizer role" };
    await supabaseAdmin.from("profiles").update({ wants_organizer: false }).eq("id", uid);
    return { ok: true as const, existed: !!existing };
  });
