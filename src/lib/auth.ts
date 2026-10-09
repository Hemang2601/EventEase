import { useEffect, useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// One shared auth state for the whole app: read once, then every page gets the
// user instantly instead of waiting for a network round-trip on each mount.
let current: { user: User | null; loading: boolean } = { user: null, loading: true };
const listeners = new Set<() => void>();
let started = false;

function set(user: User | null) {
  current = { user, loading: false };
  listeners.forEach((l) => l());
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  supabase.auth.getSession().then(({ data }) => set(data.session?.user ?? null));
  supabase.auth.onAuthStateChange((_e, session) => {
    const next = session?.user ?? null;
    if (next?.id !== current.user?.id || current.loading) set(next);
  });
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const SERVER = { user: null, loading: true };

export function useAuth() {
  useEffect(start, []);
  return useSyncExternalStore(subscribe, () => current, () => SERVER);
}
