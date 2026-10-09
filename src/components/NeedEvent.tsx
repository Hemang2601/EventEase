import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarPlus } from "lucide-react";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { EventPicker } from "./AppShell";
import type { EventWithStats } from "@/lib/events";

/** Page header with event picker; renders children only once an event exists. */
export function NeedEvent({ title, sub, loading, events, event, select, children }: {
  title: string; sub: string; loading: boolean; events: EventWithStats[]; event: EventWithStats | null;
  select: (id: string) => void; children: (e: EventWithStats) => ReactNode;
}) {
  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{sub}</p>
        </div>
        {events.length > 0 && <EventPicker events={events} value={event?.id} onChange={select} />}
      </div>
      {loading ? <Skeleton className="h-72 rounded-2xl" /> : !event ? (
        <div className="grid place-items-center rounded-2xl border border-dashed bg-card p-14 text-center">
          <CalendarPlus className="size-10 text-primary" />
          <p className="mt-4 text-lg font-semibold">Create an event first</p>
          <p className="mt-1 text-sm text-muted-foreground">You need at least one event to use this page.</p>
          <Button asChild className="mt-5"><Link to="/events">Go to events</Link></Button>
        </div>
      ) : children(event)}
    </div>
  );
}
