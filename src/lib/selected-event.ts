import { useEffect, useState } from "react";
import type { EventWithStats } from "./events";

const KEY = "eventease:selected-event";

/** Remembers which event the organizer is working on across pages. */
export function useSelectedEvent(events: EventWithStats[] | undefined) {
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    setId(localStorage.getItem(KEY));
  }, []);

  const valid = events?.find((e) => e.id === id) ?? events?.[0] ?? null;

  function select(next: string) {
    localStorage.setItem(KEY, next);
    setId(next);
  }

  return { event: valid, select };
}
