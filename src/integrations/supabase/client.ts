import api from "@/lib/api";

export interface LocalUser {
  id: string;
  email: string;
  full_name?: string;
  roles?: string[];
  user_metadata?: Record<string, any>;
}

export interface LocalSession {
  access_token: string;
  user: LocalUser;
}

type AuthChangeCallback = (event: string, session: LocalSession | null) => void;
const authListeners = new Set<AuthChangeCallback>();

function decodeJwtPayload(token: string): LocalUser | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const parsed = JSON.parse(jsonPayload);
    return {
      id: parsed.id || parsed.sub,
      email: parsed.email || "",
      full_name: parsed.full_name,
      roles: parsed.roles || [],
      user_metadata: { full_name: parsed.full_name },
    };
  } catch {
    return null;
  }
}

export function notifyLocalAuthChange(event: string, session: LocalSession | null) {
  authListeners.forEach((cb) => {
    try {
      cb(event, session);
    } catch {
      // ignore listener errors
    }
  });
}

function getCurrentLocalSession(): LocalSession | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("wizr_token");
  if (!token) return null;
  const user = decodeJwtPayload(token);
  if (!user) return null;
  return { access_token: token, user };
}

interface FilterCondition {
  type: "eq" | "neq" | "in" | "gte" | "lte" | "gt" | "lt" | "ilike" | "is" | "not" | "or" | "contains";
  column?: string;
  operator?: string;
  value: any;
}

interface OrderSpec {
  column: string;
  ascending: boolean;
  nullsFirst?: boolean;
}

class LocalQueryBuilder<T = any> implements PromiseLike<{ data: T | null; error: any; count?: number | null }> {
  private table: string;
  private operation: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private selectColumns = "*";
  private selectOptions: { count?: "exact" | "planned" | "estimated"; head?: boolean } = {};
  private payload: any = null;
  private upsertOptions: { onConflict?: string; ignoreDuplicates?: boolean } = {};
  private filters: FilterCondition[] = [];
  private orders: OrderSpec[] = [];
  private rangeSpec: { from: number; to: number } | null = null;
  private limitCount: number | null = null;
  private singleMode: "single" | "maybeSingle" | null = null;

  constructor(table: string) {
    this.table = table;
  }

  select(columns = "*", options?: { count?: "exact" | "planned" | "estimated"; head?: boolean }) {
    if (this.operation === "select") {
      this.selectColumns = columns;
      if (options) this.selectOptions = options;
    } else {
      this.selectColumns = columns;
    }
    return this;
  }

  insert(values: any, _options?: { count?: "exact" }) {
    this.operation = "insert";
    this.payload = values;
    return this;
  }

  update(values: any, _options?: { count?: "exact" }) {
    this.operation = "update";
    this.payload = values;
    return this;
  }

  upsert(values: any, options?: { onConflict?: string; ignoreDuplicates?: boolean; count?: "exact" }) {
    this.operation = "upsert";
    this.payload = values;
    if (options) this.upsertOptions = options;
    return this;
  }

  delete(_options?: { count?: "exact" }) {
    this.operation = "delete";
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ type: "eq", column, value });
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push({ type: "neq", column, value });
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push({ type: "in", column, value: values });
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push({ type: "gte", column, value });
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push({ type: "lte", column, value });
    return this;
  }

  gt(column: string, value: any) {
    this.filters.push({ type: "gt", column, value });
    return this;
  }

  lt(column: string, value: any) {
    this.filters.push({ type: "lt", column, value });
    return this;
  }

  ilike(column: string, pattern: string) {
    this.filters.push({ type: "ilike", column, value: pattern });
    return this;
  }

  is(column: string, value: any) {
    this.filters.push({ type: "is", column, value });
    return this;
  }

  not(column: string, operator: string, value: any) {
    this.filters.push({ type: "not", column, operator, value });
    return this;
  }

  or(orFilterString: string) {
    this.filters.push({ type: "or", value: orFilterString });
    return this;
  }

  contains(column: string, value: any) {
    this.filters.push({ type: "contains", column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orders.push({
      column,
      ascending: options?.ascending ?? true,
      nullsFirst: options?.nullsFirst,
    });
    return this;
  }

  range(from: number, to: number) {
    this.rangeSpec = { from, to };
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.singleMode = "single";
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybeSingle";
    return this;
  }

  private async execute(): Promise<{ data: T | null; error: any; count?: number | null }> {
    try {
      const response = await api.post(`/db/${this.table}`, {
        operation: this.operation,
        select: this.selectColumns,
        selectOptions: this.selectOptions,
        payload: this.payload,
        upsertOptions: this.upsertOptions,
        filters: this.filters,
        orders: this.orders,
        range: this.rangeSpec,
        limit: this.limitCount,
        singleMode: this.singleMode,
      });
      return {
        data: response.data?.data ?? null,
        error: response.data?.error ?? null,
        count: response.data?.count ?? null,
      };
    } catch (err: any) {
      const message =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Database error";
      return {
        data: null,
        error: { message, details: err?.response?.data?.details },
        count: null,
      };
    }
  }

  then<TResult1 = { data: T | null; error: any; count?: number | null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: T | null; error: any; count?: number | null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export const supabase = {
  from: <T = any>(table: string) => new LocalQueryBuilder<T>(table),

  rpc: async (fnName: string, args?: Record<string, any>) => {
    try {
      const response = await api.post(`/rpc/${fnName}`, args || {});
      return { data: response.data?.data ?? response.data ?? null, error: null };
    } catch (err: any) {
      return {
        data: null,
        error: { message: err?.response?.data?.error || err?.message || "RPC error" },
      };
    }
  },

  functions: {
    invoke: async <T = any>(
      fnName: string,
      options?: { body?: any; headers?: Record<string, string> }
    ): Promise<{ data: T | null; error: any }> => {
      try {
        const response = await api.post(`/functions/${fnName}`, options?.body || {}, {
          headers: options?.headers,
          timeout: 180000,
        });
        return { data: response.data as T, error: null };
      } catch (err: any) {
        const msg =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Error al ejecutar función en el servidor";
        return {
          data: null,
          error: {
            message: msg,
            context: {
              text: async () => JSON.stringify({ error: msg }),
            },
          },
        };
      }
    },
  },

  auth: {
    getSession: async () => {
      const session = getCurrentLocalSession();
      return { data: { session }, error: null };
    },

    getUser: async () => {
      const session = getCurrentLocalSession();
      if (!session) return { data: { user: null }, error: null };
      try {
        const res = await api.get("/auth/me");
        const u = res.data?.user || session.user;
        return {
          data: {
            user: {
              id: u.id,
              email: u.email,
              full_name: u.full_name,
              roles: u.roles,
              user_metadata: { full_name: u.full_name },
            },
          },
          error: null,
        };
      } catch {
        return { data: { user: session.user }, error: null };
      }
    },

    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      try {
        const { data } = await api.post("/auth/login", { email, password });
        if (data?.token) {
          localStorage.setItem("wizr_token", data.token);
          const session = getCurrentLocalSession();
          notifyLocalAuthChange("SIGNED_IN", session);
          return { data: { user: session?.user ?? data.user, session }, error: null };
        }
        return { data: { user: null, session: null }, error: { message: "Credenciales inválidas" } };
      } catch (err: any) {
        return {
          data: { user: null, session: null },
          error: { message: err?.response?.data?.error || err?.message || "Error al iniciar sesión" },
        };
      }
    },

    signUp: async ({
      email,
      password,
      options,
    }: {
      email: string;
      password: string;
      options?: { data?: { full_name?: string } };
    }) => {
      try {
        const { data } = await api.post("/auth/register", {
          email,
          password,
          fullName: options?.data?.full_name || "",
        });
        if (data?.token) {
          localStorage.setItem("wizr_token", data.token);
          const session = getCurrentLocalSession();
          notifyLocalAuthChange("SIGNED_IN", session);
          return { data: { user: session?.user ?? data.user, session }, error: null };
        }
        return { data: { user: data?.user ?? null, session: null }, error: null };
      } catch (err: any) {
        return {
          data: { user: null, session: null },
          error: { message: err?.response?.data?.error || err?.message || "Error al registrar usuario" },
        };
      }
    },

    signOut: async () => {
      localStorage.removeItem("wizr_token");
      localStorage.removeItem("wizr-current-project-id");
      notifyLocalAuthChange("SIGNED_OUT", null);
      return { error: null };
    },

    resetPasswordForEmail: async (email: string, _options?: { redirectTo?: string }) => {
      try {
        await api.post("/auth/recover-password", { email });
        return { data: {}, error: null };
      } catch (err: any) {
        return {
          data: null,
          error: { message: err?.response?.data?.error || err?.message || "Error al recuperar contraseña" },
        };
      }
    },

    updateUser: async (attributes: { password?: string; data?: Record<string, any> }) => {
      try {
        const { data } = await api.post("/auth/reset-password", attributes);
        return { data: { user: data?.user ?? getCurrentLocalSession()?.user ?? null }, error: null };
      } catch (err: any) {
        return {
          data: { user: null },
          error: { message: err?.response?.data?.error || err?.message || "Error al actualizar usuario" },
        };
      }
    },

    onAuthStateChange: (callback: AuthChangeCallback) => {
      authListeners.add(callback);
      const current = getCurrentLocalSession();
      setTimeout(() => callback("INITIAL_SESSION", current), 0);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              authListeners.delete(callback);
            },
          },
        },
      };
    },
  },

  storage: {
    from: (bucket: string) => ({
      upload: async (path: string, file: File | Blob, _options?: { upsert?: boolean }) => {
        try {
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          const { data } = await api.post(`/storage/${bucket}/upload`, {
            path,
            contentBase64: base64,
            contentType: (file as File).type || "application/octet-stream",
          });
          return { data: data ?? { path }, error: null };
        } catch (err: any) {
          return {
            data: null,
            error: { message: err?.response?.data?.error || err?.message || "Storage upload error" },
          };
        }
      },
      remove: async (paths: string[]) => {
        try {
          const { data } = await api.post(`/storage/${bucket}/remove`, { paths });
          return { data: data ?? [], error: null };
        } catch (err: any) {
          return {
            data: null,
            error: { message: err?.response?.data?.error || err?.message || "Storage remove error" },
          };
        }
      },
      createSignedUrl: async (path: string, _expiresIn: number) => {
        try {
          const { data } = await api.post(`/storage/${bucket}/signed-url`, { path });
          return { data: { signedUrl: data?.signedUrl || `/api/storage/${bucket}/file/${encodeURIComponent(path)}` }, error: null };
        } catch {
          return { data: { signedUrl: `/api/storage/${bucket}/file/${encodeURIComponent(path)}` }, error: null };
        }
      },
      getPublicUrl: (path: string) => ({
        data: { publicUrl: `/api/storage/${bucket}/file/${encodeURIComponent(path)}` },
      }),
    }),
  },

  channel: (_name: string) => {
    const ch = {
      on: () => ch,
      subscribe: () => ch,
      unsubscribe: () => Promise.resolve("ok"),
    };
    return ch;
  },

  removeChannel: (_channel: any) => Promise.resolve("ok"),
};