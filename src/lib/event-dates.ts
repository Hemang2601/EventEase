import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Calendar day (India time) for an ISO timestamp, e.g. "2026-10-08". */
export function istDay(iso: string | Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

/** Value for <input type="datetime-local" min> — now, in local time. */
export function nowLocalInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export const takenDatesQuery = () =>
  queryOptions({
    queryKey: ["events", "taken-dates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("id, title, starts_at");
      if (error) throw error;
      return data;
    },
  });

/** Returns the title of another event already on the same day, if any. */
export function findDateClash(list: { id: string; title: string; starts_at: string }[] | undefined, localValue: string, selfId?: string) {
  if (!list || !localValue) return null;
  const d = new Date(localValue);
  if (Number.isNaN(d.getTime())) return null;
  const day = istDay(d);
  return list.find((e) => e.id !== selfId && istDay(e.starts_at) === day)?.title ?? null;
}
