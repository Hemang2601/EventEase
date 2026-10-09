import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { EventAnalytics } from "@/components/EventAnalytics";
import { NeedEvent } from "@/components/NeedEvent";
import { participantsQuery, scanLogsQuery } from "@/lib/events";
import { usePickedEvent } from "@/lib/use-picked-event";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Analytics — EventEase" },
      { name: "description", content: "Attendance funnel, check-ins over time, gate load and department insights." },
      { property: "og:title", content: "Analytics — EventEase" },
      { property: "og:description", content: "Event attendance insights." },
    ],
  }),
  component: Page,
});

function Page() {
  const pk = usePickedEvent();
  const eid = pk.event?.id ?? "";
  const ps = useQuery({ ...participantsQuery(eid), enabled: !!eid });
  const logs = useQuery({ ...scanLogsQuery(eid), enabled: !!eid });
  return (
    <AppShell allow={["organizer"]} title="Analytics">
      <NeedEvent title="Analytics" sub="Registration doesn't mean attendance — only gate scans count." {...pk}>
        {(e) => <EventAnalytics participants={ps.data ?? []} logs={logs.data ?? []} capacity={e.capacity} />}
      </NeedEvent>
    </AppShell>
  );
}
