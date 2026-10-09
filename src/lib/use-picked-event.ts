import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./auth";
import { myEventsQuery } from "./events";
import { useRoles } from "./roles";
import { useSelectedEvent } from "./selected-event";

export function usePickedEvent() {
  const { user } = useAuth();
  const { isAdmin, loading: rl } = useRoles();
  const events = useQuery({ ...myEventsQuery(user?.id ?? "", isAdmin), enabled: !!user && !rl });
  const { event, select } = useSelectedEvent(events.data);
  return { user, events: events.data ?? [], loading: !user || rl || events.isLoading, event, select };
}
