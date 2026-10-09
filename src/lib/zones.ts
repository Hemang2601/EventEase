import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ZoneStaff = { user_id: string; full_name: string | null; email: string | null; scans: number };
export type ZoneOverview = {
  id: string; name: string; capacity: number | null;
  registered: number; checked_in: number; rejected: number;
  staff: ZoneStaff[]; mine: boolean;
};
export type StaffCandidate = { id: string; full_name: string | null; email: string | null };

export const zoneOverviewQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["zones", eventId],
    queryFn: async (): Promise<ZoneOverview[]> => {
      const { data, error } = await supabase.rpc("zone_overview", { _event_id: eventId });
      if (error) throw error;
      return (data as unknown as ZoneOverview[]) ?? [];
    },
  });

export const staffCandidatesQuery = () =>
  queryOptions({
    queryKey: ["staff-candidates"],
    queryFn: async (): Promise<StaffCandidate[]> => {
      const { data, error } = await supabase.rpc("list_staff_candidates");
      if (error) throw error;
      return data ?? [];
    },
  });
