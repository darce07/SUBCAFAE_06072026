import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "../lib/supabase";

const INTERVALO_MS = 2 * 60 * 1000;
const INACTIVIDAD_MS = 5 * 60 * 1000;
const AVISO_KEY = "sigdaf:aviso-registro-conexion:v1";

// Registra que la persona tiene el sistema abierto y activo (Control interno >
// Reporte diario). Solo envía la señal si la pestaña está visible y hubo
// interacción (clic, teclado, scroll, toque) en los últimos 5 minutos, así una
// pestaña olvidada no suma tiempo. No envía contenido: el servidor solo anota
// fecha y hora. Los errores se ignoran a propósito: no debe molestar al usuario.
export function usePresenceHeartbeat(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !supabase) return;
    const client = supabase;

    try {
      if (!window.localStorage.getItem(AVISO_KEY)) {
        window.localStorage.setItem(AVISO_KEY, "1");
        toast.info("Por control interno, el sistema registra la hora en que estás conectado y tu tiempo activo. No guarda lo que ves ni escribes.", { duration: 15000 });
      }
    } catch {
      // Sin acceso al almacenamiento local: se omite el aviso de una sola vez.
    }

    let ultimaInteraccion = Date.now();
    const marcar = () => { ultimaInteraccion = Date.now(); };
    const eventos = ["pointerdown", "keydown", "scroll", "touchstart", "mousemove"] as const;
    eventos.forEach((evento) => window.addEventListener(evento, marcar, { passive: true }));

    const enviar = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - ultimaInteraccion > INACTIVIDAD_MS) return;
      void client.rpc("registrar_latido_actividad").then(() => undefined, () => undefined);
    };

    const alVolver = () => {
      if (document.visibilityState === "visible") {
        marcar();
        enviar();
      }
    };

    enviar();
    const timer = window.setInterval(enviar, INTERVALO_MS);
    document.addEventListener("visibilitychange", alVolver);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", alVolver);
      eventos.forEach((evento) => window.removeEventListener(evento, marcar));
    };
  }, [enabled]);
}
