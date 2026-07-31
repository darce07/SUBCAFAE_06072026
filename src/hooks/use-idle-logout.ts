import { useEffect, useRef } from "react";

const IDLE_LIMIT_MS = 30 * 60 * 1000;
const WARNING_BEFORE_MS = 60 * 1000;
const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart"] as const;

// Sesión abierta indefinidamente en una PC compartida (institucional, no
// personal) es un riesgo real de seguridad — nadie la cerraba a menos que
// el usuario se acuerde. Cierra sola tras 30 min sin actividad, avisando
// 1 min antes para que alguien activo no pierda trabajo sin aviso.
export function useIdleLogout(onIdle: () => void, onWarning: () => void) {
  const idleTimer = useRef<number | undefined>(undefined);
  const warningTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const reset = () => {
      window.clearTimeout(idleTimer.current);
      window.clearTimeout(warningTimer.current);
      warningTimer.current = window.setTimeout(onWarning, IDLE_LIMIT_MS - WARNING_BEFORE_MS);
      idleTimer.current = window.setTimeout(onIdle, IDLE_LIMIT_MS);
    };
    reset();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, reset, { passive: true }));
    return () => {
      window.clearTimeout(idleTimer.current);
      window.clearTimeout(warningTimer.current);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, reset));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
