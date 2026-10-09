import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type EventRow = {
  id: string; title: string; description: string | null; venue: string | null;
  starts_at: string; capacity: number; owner_id: string; created_at: string; category: string;
  is_open: boolean; checkin_opens_minutes: number;
  cover_url: string | null; host_photo_url: string | null; host_name: string | null;
};
export type EventWithStats = EventRow & { registered: number; checked_in: number };

export const myEventsQuery = (userId: string, all = false) =>
  queryOptions({
    queryKey: ["events", userId, all],
    queryFn: async (): Promise<EventWithStats[]> => {
      if (!userId && !all) return [];
      let q = supabase.from("events").select("*");
      if (!all) {
        // Events I own + events where I'm assigned as hall staff
        const { data: st } = await supabase.from("zone_staff").select("event_zones(event_id)").eq("user_id", userId);
        const staffIds = [...new Set((st ?? []).map((s) => (s.event_zones as { event_id: string } | null)?.event_id).filter(Boolean))] as string[];
        q = staffIds.length ? q.or(`owner_id.eq.${userId},id.in.(${staffIds.join(",")})`) : q.eq("owner_id", userId);
      }
      const { data, error } = await q.order("starts_at");
      if (error) throw error;
      const ids = (data ?? []).map((e) => e.id);
      const counts: Record<string, { r: number; c: number }> = {};
      if (ids.length) {
        const { data: ps, error: pe } = await supabase.from("participants").select("event_id, checked_in_at").in("event_id", ids);
        if (pe) throw pe;
        for (const p of ps ?? []) {
          const c = (counts[p.event_id] ??= { r: 0, c: 0 });
          c.r++;
          if (p.checked_in_at) c.c++;
        }
      }
      return (data ?? []).map((e) => ({ ...e, registered: counts[e.id]?.r ?? 0, checked_in: counts[e.id]?.c ?? 0 }));
    },
  });

export const eventQuery = (id: string) =>
  queryOptions({
    queryKey: ["event", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as EventRow | null;
    },
  });

export const participantsQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["participants", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.from("participants").select("*").eq("event_id", eventId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const publicStatsQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["public-stats", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("event_stats", { _event_id: eventId });
      if (error) throw error;
      const row = data?.[0];
      return { registered: Number(row?.registered ?? 0), checked_in: Number(row?.checked_in ?? 0) };
    },
  });

export const scanLogsQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["scan-logs", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.from("scan_logs").select("*").eq("event_id", eventId).order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data;
    },
  });

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
