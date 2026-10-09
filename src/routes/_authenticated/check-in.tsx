import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { CheckInPanel } from "@/components/CheckInPanel";
import { NeedEvent } from "@/components/NeedEvent";
import { ScanLog } from "@/components/ScanLog";
import { scanLogsQuery } from "@/lib/events";
import { usePickedEvent } from "@/lib/use-picked-event";

export const Route = createFileRoute("/_authenticated/check-in")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Gate Check-in — EventEase" },
      { name: "description", content: "Scan QR passes or enter codes to admit participants. Duplicates are rejected." },
      { property: "og:title", content: "Gate Check-in — EventEase" },
      { property: "og:description", content: "Scan, verify and admit participants." },
    ],
  }),
  component: Page,
});

function Page() {
  const pk = usePickedEvent();
  const qc = useQueryClient();
  const eid = pk.event?.id ?? "";
  const logs = useQuery({ ...scanLogsQuery(eid), enabled: !!eid });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["scan-logs", eid] });
    qc.invalidateQueries({ queryKey: ["participants", eid] });
    qc.invalidateQueries({ queryKey: ["events"] });
    qc.invalidateQueries({ queryKey: ["zones", eid] });
  };
  return (
    <AppShell allow={["organizer"]} title="Check-in">
      <NeedEvent title="Check-in" sub="Pick your gate, then scan a QR pass or type the entry code." {...pk}>
        {(e) => (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <p className="label-mono !text-[10px]">{e.title}</p>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-semibold text-success">
                <span className="size-1.5 animate-pulse rounded-full bg-success" /> Scanner Online
              </span>
            </div>
            <div className="panel p-6"><CheckInPanel eventId={e.id} onDone={refresh} logs={logs.data ?? []} /></div>
            <div className="panel p-6"><ScanLog logs={(logs.data ?? []).slice(0, 8)} /></div>
          </div>
        )}
      </NeedEvent>
    </AppShell>
  );
}
