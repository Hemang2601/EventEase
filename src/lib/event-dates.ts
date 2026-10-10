import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Calendar day (India time) for an ISO timestamp, e.g. "2026-10-08". */
export function istDay(iso: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** Value for <input type="datetime-local" min> — now, in local time. */
export function nowLocalInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/** Helper to add hours to local input date string */
export function addHoursToLocalInput(localStr: string, hours: number) {
  if (!localStr) return "";
  const d = new Date(localStr);
  if (isNaN(d.getTime())) return "";
  d.setHours(d.getHours() + hours);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export type ScheduledEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at?: string | null;
  venue?: string | null;
};

export const takenDatesQuery = () =>
  queryOptions({
    queryKey: ["events", "taken-dates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, starts_at, ends_at, venue");
      if (error) throw error;
      return (data ?? []) as ScheduledEvent[];
    },
  });

/**
 * Checks if another event is already booked at the SAME venue during overlapping time.
 * If venues are different, multiple events can run concurrently at the same time!
 */
export function findVenueClash(
  list: ScheduledEvent[] | undefined,
  startValue: string,
  endValue?: string,
  venueValue?: string,
  selfId?: string,
) {
  if (!list || !startValue || !venueValue?.trim()) return null;
  const startA = new Date(startValue);
  if (Number.isNaN(startA.getTime())) return null;
  const endA = endValue ? new Date(endValue) : new Date(startA.getTime() + 2 * 3600 * 1000);
  const cleanVenue = venueValue.trim().toLowerCase();

  const clash = list.find((e) => {
    if (e.id === selfId) return false;
    const eVenue = (e.venue || "").trim().toLowerCase();
    if (!eVenue || eVenue !== cleanVenue) return false;

    const startB = new Date(e.starts_at);
    if (Number.isNaN(startB.getTime())) return false;
    const endB = e.ends_at ? new Date(e.ends_at) : new Date(startB.getTime() + 2 * 3600 * 1000);

    // Overlap condition: startA < endB && endA > startB
    return startA < endB && endA > startB;
  });

  return clash ? { id: clash.id, title: clash.title, venue: clash.venue } : null;
}

/** Legacy helper preserved for backwards compatibility */
export function findDateClash(
  list: ScheduledEvent[] | undefined,
  localValue: string,
  selfId?: string,
) {
  // Concurrency supported across different venues
  return null;
}
