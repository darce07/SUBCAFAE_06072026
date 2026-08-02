import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/auth-context";

const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart"] as const;
const ACTIVE_WINDOW_MS = 5 * 60 * 1000;
const HEARTBEAT_MS = 60 * 1000;

export type PresenceStatus = "activo" | "reposo" | "desconectado";

interface PresenceContextValue {
  getStatus: (userId: string) => PresenceStatus;
}

const PresenceContext = createContext<PresenceContextValue | null>(null);

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, userContext } = useAuth();
  const [lastActivityByUser, setLastActivityByUser] = useState<Record<string, number>>({});
  const [, setTick] = useState(0);
  const lastActivityRef = useRef(Date.now());

  // Fuerza un re-render periodico para que activo->reposo se refleje aunque
  // no llegue ningun evento de presencia nuevo en ese momento.
  useEffect(() => {
    const interval = window.setInterval(() => setTick((value) => value + 1), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!supabase || !isAuthenticated || !userContext) return;
    const channel = supabase.channel("presencia-usuarios", { config: { presence: { key: userContext.id } } });

    const syncState = () => {
      const state = channel.presenceState<{ last_activity: number }>();
      const next: Record<string, number> = {};
      for (const [userId, entries] of Object.entries(state)) {
        next[userId] = Math.max(...entries.map((entry) => entry.last_activity ?? 0));
      }
      setLastActivityByUser(next);
    };

    channel.on("presence", { event: "sync" }, syncState);
    void channel.subscribe((status) => {
      if (status === "SUBSCRIBED") void channel.track({ last_activity: lastActivityRef.current });
    });

    const onActivity = () => { lastActivityRef.current = Date.now(); };
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));
    const heartbeat = window.setInterval(() => void channel.track({ last_activity: lastActivityRef.current }), HEARTBEAT_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, onActivity));
      window.clearInterval(heartbeat);
      void supabase!.removeChannel(channel);
    };
  }, [isAuthenticated, userContext]);

  const getStatus = (userId: string): PresenceStatus => {
    const lastActivity = lastActivityByUser[userId];
    if (!lastActivity) return "desconectado";
    return Date.now() - lastActivity < ACTIVE_WINDOW_MS ? "activo" : "reposo";
  };

  return <PresenceContext.Provider value={{ getStatus }}>{children}</PresenceContext.Provider>;
}

export function usePresence() {
  const context = useContext(PresenceContext);
  if (!context) throw new Error("usePresence debe usarse dentro de PresenceProvider");
  return context;
}

const statusMeta: Record<PresenceStatus, { color: string; label: string }> = {
  activo: { color: "bg-emerald-500", label: "Activo" },
  reposo: { color: "bg-amber-500", label: "Inactivo (en reposo)" },
  desconectado: { color: "bg-slate-300 dark:bg-slate-600", label: "Desconectado" },
};

export function PresenceDot({ userId }: { userId: string }) {
  const { getStatus } = usePresence();
  const status = getStatus(userId);
  const meta = statusMeta[status];
  return <span title={meta.label} aria-label={meta.label} className={`inline-block size-2.5 shrink-0 rounded-full ${meta.color}`} />;
}
