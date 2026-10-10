/**
 * EventEase Local MongoDB Client Adapter
 * 
 * Drop-in replacement for the Supabase client that routes all queries,
 * authentication, RPC procedures, and presence to your local MongoDB backend.
 */

type AuthUser = {
  id: string;
  email: string;
  user_metadata?: { full_name?: string; account_type?: string; [key: string]: any };
  created_at?: string;
};

type AuthSession = {
  access_token: string;
  user: AuthUser;
};

type AuthChangeCallback = (event: "SIGNED_IN" | "SIGNED_OUT" | "INITIAL_SESSION", session: AuthSession | null) => void;

const authListeners = new Set<AuthChangeCallback>();

const STORAGE_KEY = "eventease_auth_session";

function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return "/api";
  }
  return process.env.API_URL || "http://127.0.0.1:5000/api";
}

function getStoredSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setStoredSession(session: AuthSession | null) {
  if (typeof window === "undefined") return;
  if (session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function getAuthHeader(): Record<string, string> {
  const session = getStoredSession();
  if (session?.access_token) {
    return { Authorization: `Bearer ${session.access_token}` };
  }
  return {};
}

// ---------------------------------------------------------------------------
// Query Builder
// ---------------------------------------------------------------------------
class QueryBuilder {
  private table: string;
  private action: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private queryData: any = {};
  private filters: Array<{ col: string; op: string; val: any }> = [];
  private orderConfig?: { col: string; ascending: boolean };
  private limitCount?: number;
  private orClause?: string;
  private isSingle = false;
  private isMaybeSingle = false;
  private selectCols = "*";
  private mutationPayload: any = null;
  private onConflictCols?: string;

  constructor(table: string) {
    this.table = table;
  }

  select(cols = "*", _options?: { count?: string; head?: boolean }) {
    this.action = "select";
    this.selectCols = cols;
    return this;
  }

  insert(data: any) {
    this.action = "insert";
    this.mutationPayload = data;
    return this;
  }

  update(data: any) {
    this.action = "update";
    this.mutationPayload = data;
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  upsert(data: any, options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.action = "upsert";
    this.mutationPayload = data;
    this.onConflictCols = options?.onConflict;
    return this;
  }

  eq(col: string, val: any) {
    this.filters.push({ col, op: "eq", val });
    return this;
  }

  neq(col: string, val: any) {
    this.filters.push({ col, op: "neq", val });
    return this;
  }

  gt(col: string, val: any) {
    this.filters.push({ col, op: "gt", val });
    return this;
  }

  gte(col: string, val: any) {
    this.filters.push({ col, op: "gte", val });
    return this;
  }

  lt(col: string, val: any) {
    this.filters.push({ col, op: "lt", val });
    return this;
  }

  lte(col: string, val: any) {
    this.filters.push({ col, op: "lte", val });
    return this;
  }

  in(col: string, val: any[]) {
    this.filters.push({ col, op: "in", val });
    return this;
  }

  ilike(col: string, val: string) {
    this.filters.push({ col, op: "ilike", val });
    return this;
  }

  or(expr: string) {
    this.orClause = expr;
    return this;
  }

  order(col: string, options?: { ascending?: boolean }) {
    this.orderConfig = { col, ascending: options?.ascending ?? true };
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  async execute(): Promise<{ data: any; error: any }> {
    try {
      const url = `${getBaseUrl()}/data/${this.table}`;
      const payload = {
        action: this.action,
        data: this.mutationPayload,
        query: {
          select: this.selectCols,
          filters: this.filters,
          or: this.orClause,
          order: this.orderConfig,
          limit: this.limitCount,
          single: this.isSingle,
          maybeSingle: this.isMaybeSingle,
          onConflict: this.onConflictCols,
        },
      };

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      return { data: json.data, error: json.error };
    } catch (err: any) {
      return { data: null, error: { message: err.message || "Failed to execute database query" } };
    }
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null
  ): Promise<any | TResult> {
    return this.execute().catch(onrejected);
  }
}

// ---------------------------------------------------------------------------
// Realtime Channel
// ---------------------------------------------------------------------------
class RealtimeChannelMock {
  private channelName: string;
  private key?: string;
  private syncCallback?: () => void;
  private heartbeatInterval?: any;
  private pollInterval?: any;
  private stateCache: Record<string, any[]> = {};

  constructor(channelName: string, config?: any) {
    this.channelName = channelName;
    this.key = config?.config?.presence?.key;
  }

  on(type: string, _filter: any, callback: () => void) {
    if (type === "presence") {
      this.syncCallback = callback;
    }
    return this;
  }

  subscribe(statusCallback?: (status: string) => void) {
    if (statusCallback) {
      setTimeout(() => statusCallback("SUBSCRIBED"), 10);
    }

    // Periodically fetch online list to fire sync
    this.pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`${getBaseUrl()}/presence/online`);
        const json = await res.json();
        if (json.data) {
          const grouped: Record<string, any[]> = {};
          for (const [uid, user] of Object.entries(json.data)) {
            grouped[uid] = [user];
          }
          this.stateCache = grouped;
          if (this.syncCallback) this.syncCallback();
        }
      } catch {}
    }, 5000);

    return this;
  }

  async track(meta: any) {
    try {
      const sendBeat = async () => {
        await fetch(`${getBaseUrl()}/presence/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(meta),
        });
      };
      await sendBeat();
      if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = setInterval(sendBeat, 15000);
    } catch {}
    return "ok";
  }

  async untrack() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.pollInterval) clearInterval(this.pollInterval);
    return "ok";
  }

  presenceState<T = any>(): Record<string, T[]> {
    return this.stateCache as Record<string, T[]>;
  }
}

// ---------------------------------------------------------------------------
// Local Supabase Client Implementation
// ---------------------------------------------------------------------------
export const supabase = {
  from(tableName: string) {
    return new QueryBuilder(tableName);
  },

  async rpc(functionName: string, args: Record<string, any> = {}) {
    try {
      const res = await fetch(`${getBaseUrl()}/rpc/${functionName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(args),
      });
      return await res.json();
    } catch (err: any) {
      return { data: null, error: { message: err.message || "RPC request failed" } };
    }
  },

  auth: {
    async signInWithPassword(credentials: { email: string; password: string }) {
      try {
        const res = await fetch(`${getBaseUrl()}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credentials),
        });
        const json = await res.json();
        if (!json.error && json.data?.session) {
          setStoredSession(json.data.session);
          authListeners.forEach((l) => l("SIGNED_IN", json.data.session));
        }
        return json;
      } catch (err: any) {
        return { data: { user: null, session: null }, error: { message: err.message } };
      }
    },

    async signUp(input: { email: string; password: string; options?: any }) {
      try {
        const res = await fetch(`${getBaseUrl()}/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const json = await res.json();
        if (!json.error && json.data?.session) {
          setStoredSession(json.data.session);
          authListeners.forEach((l) => l("SIGNED_IN", json.data.session));
        }
        return json;
      } catch (err: any) {
        return { data: { user: null, session: null }, error: { message: err.message } };
      }
    },

    async signOut() {
      try {
        await fetch(`${getBaseUrl()}/auth/logout`, {
          method: "POST",
          headers: getAuthHeader(),
        });
      } catch {}
      setStoredSession(null);
      authListeners.forEach((l) => l("SIGNED_OUT", null));
      return { error: null };
    },

    async getUser() {
      const session = getStoredSession();
      if (!session) return { data: { user: null }, error: null };
      return { data: { user: session.user }, error: null };
    },

    async getSession() {
      const session = getStoredSession();
      return { data: { session }, error: null };
    },

    async updateUser(updates: any) {
      try {
        const res = await fetch(`${getBaseUrl()}/auth/user`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeader(),
          },
          body: JSON.stringify(updates),
        });
        const json = await res.json();
        if (json.data?.user) {
          const current = getStoredSession();
          if (current) {
            current.user = json.data.user;
            setStoredSession(current);
          }
        }
        return json;
      } catch (err: any) {
        return { data: null, error: { message: err.message } };
      }
    },

    onAuthStateChange(callback: AuthChangeCallback) {
      authListeners.add(callback);
      // Trigger initial state callback asynchronously
      const session = getStoredSession();
      setTimeout(() => callback("INITIAL_SESSION", session), 0);

      return {
        data: {
          subscription: {
            unsubscribe() {
              authListeners.delete(callback);
            },
          },
        },
      };
    },

    admin: {
      async createUser(input: { email: string; password: string; email_confirm?: boolean; user_metadata?: any }) {
        try {
          const res = await fetch(`${getBaseUrl()}/auth/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: input.email,
              password: input.password,
              options: { data: input.user_metadata },
            }),
          });
          return await res.json();
        } catch (err: any) {
          return { data: null, error: { message: err.message } };
        }
      },
    },
  },

  channel(name: string, config?: any) {
    return new RealtimeChannelMock(name, config);
  },

  removeChannel(ch: RealtimeChannelMock) {
    void ch.untrack();
  },

  storage: {
    from(bucket: string) {
      return {
        async upload(path: string, file: any, _options?: any) {
          try {
            let dataUrl = "";
            if (typeof file === "string") {
              dataUrl = file;
            } else if (file instanceof Blob) {
              dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = () => reject(new Error("Failed to read image blob"));
                reader.readAsDataURL(file);
              });
            }

            const res = await fetch(`${getBaseUrl()}/storage/upload`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...getAuthHeader(),
              },
              body: JSON.stringify({ bucket, path, dataUrl }),
            });

            const json = await res.json();
            if (json.error) return { data: null, error: json.error };
            return {
              data: {
                path: json.data?.publicUrl || json.data?.path,
                publicUrl: json.data?.publicUrl || json.data?.path,
              },
              error: null,
            };
          } catch (err: any) {
            return { data: null, error: { message: err.message || "Failed to upload file" } };
          }
        },
        getPublicUrl(path: string) {
          const publicUrl = path.startsWith("http") || path.startsWith("/") || path.startsWith("data:")
            ? path
            : `/uploads/${path.replace(/^.*\//, "")}`;
          return { data: { publicUrl } };
        },
      };
    },
  },
};
