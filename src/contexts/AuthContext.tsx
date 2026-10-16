import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import api from "@/lib/api";
import { notifyLocalAuthChange } from "@/integrations/supabase/client";

type AppRole = "admin" | "analista" | "director";

interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  roles?: AppRole[];
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
    [key: string]: any;
  };
}

interface AuthContextType {
  user: User | null;
  session: { access_token: string; user?: User } | null;
  loading: boolean;
  roles: AppRole[];
  hasRole: (role: AppRole) => boolean;
  signOut: () => void;
  signIn: (token: string, userData: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function enrichUser(u: User): User {
  return {
    ...u,
    user_metadata: {
      full_name: u.full_name || u.user_metadata?.full_name,
      avatar_url: u.avatar_url || u.user_metadata?.avatar_url,
      ...(u.user_metadata || {}),
    },
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<{ access_token: string; user?: User } | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem("wizr_token");
      if (token) {
        try {
          const res = await api.get("/auth/me");
          const rawUser = res.data?.user || res.data;
          const userData = enrichUser(rawUser);

          setSession({ access_token: token, user: userData });
          setUser(userData);
          setRoles(userData.roles || []);
          notifyLocalAuthChange("INITIAL_SESSION", { access_token: token, user: userData });
        } catch (error) {
          console.error("Failed to restore session:", error);
          localStorage.removeItem("wizr_token");
          setSession(null);
          setUser(null);
          setRoles([]);
          notifyLocalAuthChange("SIGNED_OUT", null);
        }
      } else {
        setSession(null);
        setUser(null);
        setRoles([]);
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const hasRole = (role: AppRole) => roles.includes(role);

  const signIn = (token: string, rawUserData: User) => {
    const userData = enrichUser(rawUserData);
    localStorage.setItem("wizr_token", token);
    setSession({ access_token: token, user: userData });
    setUser(userData);
    setRoles(userData.roles || []);
    notifyLocalAuthChange("SIGNED_IN", { access_token: token, user: userData });
  };

  const signOut = () => {
    localStorage.removeItem("wizr_token");
    localStorage.removeItem("wizr-current-project-id");
    setUser(null);
    setSession(null);
    setRoles([]);
    notifyLocalAuthChange("SIGNED_OUT", null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider
      value={{ user, session, loading, roles, hasRole, signOut, signIn }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
