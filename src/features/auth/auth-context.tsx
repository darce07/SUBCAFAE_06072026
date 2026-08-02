import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
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
  // getCurrentSession() y onAuthStateChange disparan refreshUserContext casi
  // en simultaneo al montar (Supabase emite un evento inicial ademas de
  // nuestra propia consulta de sesion). Sin este guard, la respuesta que
  // llega ultimo "gana" aunque corresponda a una llamada mas vieja - un
  // fallo transitorio tardio podia pisar un exito mas reciente y dejar el
  // banner de "sesion invalida" pegado con el usuario ya autenticado.
  const requestIdRef = useRef(0);

  const refreshUserContext = async () => {
    if (!supabase) return;
    const requestId = ++requestIdRef.current;
    try {
      const context = await getMyUserContext();
      if (requestId !== requestIdRef.current) return;
      setUserContext(context);
      setContextError(null);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
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
