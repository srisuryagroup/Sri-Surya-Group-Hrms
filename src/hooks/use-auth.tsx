import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { primaryRole as pickPrimaryRole, type Role } from "@/lib/rbac";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  roles: Role[];
  role: Role;
  rolesReady: boolean;
  loading: boolean;
  isManager: boolean;
  isAdmin: boolean;
  isEmployee: boolean;
  isFreelancer: boolean;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchRoles(userId: string): Promise<Role[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) {
    console.warn("[auth] fetchRoles error", error);
    return [];
  }
  return (data ?? []).map((r) => r.role as Role);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesReady, setRolesReady] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadRoles = (userId: string) => {
      fetchRoles(userId).then((r) => {
        if (!mounted) return;
        setRoles(r);
        setRolesReady(true);
      });
    };

    // Set up listener first
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        const uid = s.user.id;
        // Defer to avoid deadlock inside the callback
        setTimeout(() => {
          if (!mounted) return;
          loadRoles(uid);
        }, 0);
      } else {
        setRoles([]);
        setRolesReady(true);
      }
    });

    // Then check existing session
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        loadRoles(data.session.user.id);
      } else {
        setRolesReady(true);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const refreshRoles = async () => {
    if (!user) return;
    setRoles(await fetchRoles(user.id));
    setRolesReady(true);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRoles([]);
    setRolesReady(true);
  };

  const role = pickPrimaryRole(roles);
  const isManager = roles.some(
    (r) => r === "super_admin" || r === "hr_manager" || r === "manager",
  );
  const isAdmin = roles.includes("super_admin");
  const isFreelancer = role === "freelancer";
  const isEmployee = role === "employee";

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        roles,
        role,
        rolesReady,
        loading,
        isManager,
        isAdmin,
        isEmployee,
        isFreelancer,
        signOut,
        refreshRoles,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
