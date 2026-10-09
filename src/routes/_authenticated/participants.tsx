import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { NeedEvent } from "@/components/NeedEvent";
import { ParticipantsTable } from "@/components/ParticipantsTable";
import { participantsQuery, scanLogsQuery } from "@/lib/events";
import { usePickedEvent } from "@/lib/use-picked-event";

export const Route = createFileRoute("/_authenticated/participants")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Participants — EventEase" },
      { name: "description", content: "Search, filter and export registered participants." },
      { property: "og:title", content: "Participants — EventEase" },
      { property: "og:description", content: "Manage registered participants." },
    ],
  }),
  component: Page,
});

function Page() {
  const pk = usePickedEvent();
  const ps = useQuery({ ...participantsQuery(pk.event?.id ?? ""), enabled: !!pk.event });
  const logs = useQuery({ ...scanLogsQuery(pk.event?.id ?? ""), enabled: !!pk.event });
  return (
    <AppShell allow={["organizer"]} title="Participants">
      <NeedEvent title="Participants" sub="Everyone registered for the selected event, with live check-in status." {...pk}>
        {(e) => <div className="panel p-6"><ParticipantsTable eventId={e.id} eventTitle={e.title} list={ps.data ?? []} logs={logs.data ?? []} /></div>}
      </NeedEvent>
    </AppShell>
  );
}
