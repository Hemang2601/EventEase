import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CopyX, ShieldCheck, ShieldX, ScanLine } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { NeedEvent } from "@/components/NeedEvent";
import { ScanLog } from "@/components/ScanLog";
import { StatCard } from "@/components/StatCard";
import { scanLogsQuery } from "@/lib/events";
import { usePickedEvent } from "@/lib/use-picked-event";

export const Route = createFileRoute("/_authenticated/security")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Security — EventEase" },
      { name: "description", content: "Every gate scan audited: duplicate check-ins and invalid codes are logged." },
      { property: "og:title", content: "Security — EventEase" },
      { property: "og:description", content: "Gate scan audit log." },
    ],
  }),
  component: Page,
});

function Page() {
  const pk = usePickedEvent();
  const eid = pk.event?.id ?? "";
  const logs = useQuery({ ...scanLogsQuery(eid), enabled: !!eid });
  const l = logs.data ?? [];
  const count = (r: string) => l.filter((x) => x.result === r).length;
  const rejected = l.filter((x) => ["forbidden", "wrong_zone", "wrong_event", "too_early"].includes(x.result)).length;
  return (
    <AppShell allow={["organizer"]} title="Security">
      <NeedEvent title="Security Center" sub="A full audit trail of every scan at every gate." {...pk}>
        {() => (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-success">
                <span className="size-1.5 animate-pulse rounded-full bg-success" /> System Secure
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={ScanLine} label="Successful scans" value={count("success")} tone="green" />
              <StatCard icon={CopyX} label="Duplicate attempts" value={count("duplicate")} tone="red" />
              <StatCard icon={ShieldX} label="Invalid codes" value={count("invalid")} tone="amber" />
              <StatCard icon={ShieldCheck} label="Rejected entries" value={rejected} tone="blue" />
            </div>
            <div className="panel p-6"><ScanLog logs={l} /></div>
          </div>
        )}
      </NeedEvent>
    </AppShell>
  );
}
