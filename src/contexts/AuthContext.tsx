import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import api from "@/lib/api";

type AppRole = "admin" | "analista" | "director";

interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  roles?: AppRole[];
}

interface AuthContextType {
  user: User | null;
  session: { access_token: string } | null;
  loading: boolean;
  roles: AppRole[];
  hasRole: (role: AppRole) => boolean;
  signOut: () => void;
  signIn: (token: string, userData: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<{ access_token: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('wizr_token');
      if (token) {
        try {
          const res = await api.get('/auth/me');
          const userData = res.data;
          
          setSession({ access_token: token });
          setUser(userData);
          setRoles(userData.roles || []);
        } catch (error) {
          console.error("Failed to restore session:", error);
          localStorage.removeItem('wizr_token');
          setSession(null);
          setUser(null);
          setRoles([]);
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

  const signIn = (token: string, userData: User) => {
    localStorage.setItem('wizr_token', token);
    setSession({ access_token: token });
    setUser(userData);
    setRoles(userData.roles || []);
  };

  const signOut = () => {
    localStorage.removeItem('wizr_token');
    setUser(null);
    setSession(null);
    setRoles([]);
    window.location.href = '/login';
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
