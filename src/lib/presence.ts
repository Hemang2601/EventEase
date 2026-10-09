import { useEffect, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const CHANNEL = "eventease:online";

export type OnlineUser = { user_id: string; name: string; email: string; online_at: string };

// One shared presence channel: listeners are registered before subscribe().
let channel: RealtimeChannel | null = null;
let channelUser: string | null = null;
let state: Record<string, OnlineUser> = {};
const listeners = new Set<(s: Record<string, OnlineUser>) => void>();

function emit() {
  for (const l of listeners) l(state);
}

function openChannel(user: { id: string; email?: string | undefined; user_metadata?: Record<string, unknown> }) {
  if (channel && channelUser === user.id) return;
  closeChannel();
  const name = (user.user_metadata?.["full_name"] as string | undefined) || user.email?.split("@")[0] || "User";
  const ch = supabase.channel(CHANNEL, { config: { presence: { key: user.id } } });
  ch.on("presence", { event: "sync" }, () => {
    const raw = ch.presenceState<OnlineUser>();
    const map: Record<string, OnlineUser> = {};
    for (const metas of Object.values(raw)) for (const m of metas) map[m.user_id] = m;
    state = map;
    emit();
  });
  ch.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      void ch.track({ user_id: user.id, name, email: user.email ?? "", online_at: new Date().toISOString() });
    }
  });
  channel = ch;
  channelUser = user.id;
}

function closeChannel() {
  if (!channel) return;
  const ch = channel;
  channel = null;
  channelUser = null;
  state = {};
  emit();
  void ch.untrack();
  void supabase.removeChannel(ch);
}

/** Track the signed-in user as online (call once in the app shell). */
export function usePresence() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) {
      closeChannel();
      return;
    }
    openChannel(user);
  }, [user]);
}

/** Admin: live list of everyone currently online (reads the shared channel). */
export function useOnlineUsers(enabled: boolean) {
  const [online, setOnline] = useState<Record<string, OnlineUser>>(state);
  useEffect(() => {
    if (!enabled) return;
    setOnline(state);
    listeners.add(setOnline);
    return () => { listeners.delete(setOnline); };
  }, [enabled]);
  return online;
}
