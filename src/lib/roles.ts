import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

export type Role = "admin" | "organizer" | "student";

export function useRoles() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["my-roles", user?.id],
    staleTime: 5 * 60_000,
    enabled: !!user,
    queryFn: async (): Promise<Role[]> => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      if (error) throw error;
      return data.map((r) => r.role as Role);
    },
  });
  const roles = q.data ?? [];
  const isAdmin = roles.includes("admin");
  const isOrganizer = isAdmin || roles.includes("organizer");
  const primary: Role = isAdmin ? "admin" : roles.includes("organizer") ? "organizer" : "student";
  return { user, roles, isAdmin, isOrganizer, primary, loading: !user || q.isLoading };
}
