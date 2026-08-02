import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import { getCurrentSession, signInWithPassword, signOutSession } from "../../services/auth.service";
import { getMyUserContext } from "../../services/auth.service";
import type { UserContext } from "../../types";

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  userContext: UserContext | null;
  contextError: string | null;
  refreshUserContext: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const demoSessionKey = "sigdaf-demo-session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [demoAuthenticated, setDemoAuthenticated] = useState(
    () => !isSupabaseConfigured && localStorage.getItem(demoSessionKey) === "true",
  );
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);

  const refreshUserContext = async () => {
    if (!supabase) return;
    try {
      setContextError(null);
      setUserContext(await getMyUserContext());
    } catch (error) {
      setUserContext(null);
      setContextError(error instanceof Error ? error.message : "No se pudo cargar el perfil.");
    }
  };

  useEffect(() => {
    if (!supabase) return;
    void getCurrentSession()
      .then(async (currentSession) => {
        const validSession = currentSession?.user.is_anonymous ? null : currentSession;
        setSession(validSession);
        if (validSession) await refreshUserContext();
      })
      .finally(() => setLoading(false));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) void refreshUserContext();
      else setUserContext(null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      isAuthenticated: Boolean(session) || demoAuthenticated,
      userContext,
      contextError,
      refreshUserContext,
      signIn: async (email, password) => {
        if (supabase) {
          setSession(await signInWithPassword(email, password));
          await refreshUserContext();
          return;
        }
        if (!email || !password) throw new Error("Ingresa tus credenciales.");
        localStorage.setItem(demoSessionKey, "true");
        setDemoAuthenticated(true);
      },
      signOut: async () => {
        if (supabase) await signOutSession();
        localStorage.removeItem(demoSessionKey);
        setDemoAuthenticated(false);
        setUserContext(null);
        // El aviso "se cerrará en 1 minuto" (10s de duración) queda flotando
        // sobre la pantalla de login si el logout real ocurre mientras
        // todavía está visible - el Toaster es global, no se desmonta solo
        // porque cambiemos de ruta.
        toast.dismiss();
      },
    }),
    [contextError, demoAuthenticated, loading, session, userContext],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return context;
}
