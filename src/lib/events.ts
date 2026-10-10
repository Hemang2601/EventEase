import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type EventRow = {
  id: string; title: string; description: string | null; venue: string | null;
  starts_at: string; ends_at?: string | null; capacity: number; owner_id: string; created_at: string; category: string;
  is_open: boolean; checkin_opens_minutes: number;
  cover_url: string | null; host_photo_url: string | null; host_name: string | null;
  rules?: string | null;
};
export type EventWithStats = EventRow & { registered: number; checked_in: number };

export const DEFAULT_EVENT_RULES = [
  "Valid College / University ID card is mandatory for entry.",
  "Digital QR entry pass must be presented at the gate on your mobile device.",
  "Check-in gate closes 15 minutes after the event starts; late entry will be denied.",
  "Each pass is unique and non-transferable; duplicate scans are automatically rejected.",
  "Follow campus decorum, safety protocols, and venue code of conduct at all times.",
];

export function parseEventRules(rules?: string | null): string[] {
  if (!rules || !rules.trim()) return DEFAULT_EVENT_RULES;
  // Splits by newline, bullet point, or numbered list prefix like "1. ", "2) "
  const items = rules
    .split(/\r?\n/)
    .map((s) => s.replace(/^[-*•\d+.)\]\s]+/, "").trim())
    .filter((s) => s.length > 0);
  return items.length > 0 ? items : DEFAULT_EVENT_RULES;
}

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
      return (data ?? []).map((e) => ({
        ...e,
        title: e.title || (e as any).name || "Untitled Event",
        starts_at: e.starts_at || (e as any).date || new Date().toISOString(),
        category: e.category || "Technology",
        is_open: e.is_open !== undefined ? e.is_open : true,
        registered: counts[e.id]?.r ?? 0,
        checked_in: counts[e.id]?.c ?? 0,
      }));
    },
  });

export const eventQuery = (id: string) =>
  queryOptions({
    queryKey: ["event", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        title: data.title || (data as any).name || "Untitled Event",
        starts_at: data.starts_at || (data as any).date || new Date().toISOString(),
        category: data.category || "Technology",
        is_open: data.is_open !== undefined ? data.is_open : true,
      } as EventRow;
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

export const fmtDate = (iso?: string | null) => {
  if (!iso) return "Date TBA";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Date TBA";
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

export const fmtTime = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};

export const fmtDateRange = (starts_at?: string | null, ends_at?: string | null) => {
  if (!starts_at) return "Date TBA";
  const s = new Date(starts_at);
  if (isNaN(s.getTime())) return "Date TBA";

  const startStr = s.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  if (!ends_at) return startStr;

  const e = new Date(ends_at);
  if (isNaN(e.getTime())) return startStr;

  const isSameDay = s.toDateString() === e.toDateString();
  if (isSameDay) {
    const endHour = e.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    return `${startStr} – ${endHour}`;
  }
  const endStr = e.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  return `${startStr} – ${endStr}`;
};

/**
 * Calculates check-in opening time (defaults to 30 minutes before event start).
 */
export function getCheckInOpensAt(starts_at: string, checkin_opens_minutes = 30): Date {
  const d = new Date(starts_at);
  return new Date(d.getTime() - checkin_opens_minutes * 60 * 1000);
}

/**
 * Registration deadline: registrations close 30 minutes before event start when check-in begins.
 */
export function getRegistrationDeadline(starts_at: string, checkin_opens_minutes = 30): Date {
  return getCheckInOpensAt(starts_at, checkin_opens_minutes);
}

/**
 * Returns true if registrations are currently open for students.
 */
export function isRegistrationOpen(event: {
  starts_at: string;
  is_open?: boolean;
  checkin_opens_minutes?: number;
}): boolean {
  if (event.is_open === false) return false;
  const deadline = getRegistrationDeadline(event.starts_at, event.checkin_opens_minutes ?? 30);
  return Date.now() < deadline.getTime();
}

/**
 * Returns true if check-in is currently active for this event (30m before until ends_at).
 */
export function isCheckInActive(event: {
  starts_at: string;
  ends_at?: string | null;
  checkin_opens_minutes?: number;
}): boolean {
  const opensAt = getCheckInOpensAt(event.starts_at, event.checkin_opens_minutes ?? 30).getTime();
  const startsAt = new Date(event.starts_at).getTime();
  const endsAt = event.ends_at
    ? new Date(event.ends_at).getTime()
    : startsAt + 4 * 3600 * 1000;
  const now = Date.now();
  return now >= opensAt && now <= endsAt;
}
