import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../auth/auth-context";
import {
  abrirChatSoporte,
  cerrarChatSoporte,
  getMisConversaciones,
  subscribeToMisConversaciones,
} from "../../services/chat.service";
import type { ChatConversacion } from "../../types";

interface ChatContextValue {
  conversaciones: ChatConversacion[];
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  openChat: (usuarioId: string) => Promise<void>;
  closeChat: (conversacionId: string) => Promise<void>;
  closeAllChats: () => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);
// Cerrar la pestaña/navegador sin usar "Salir" (o sin esperar el timeout de
// inactividad) no dispara el cierre del chat - queda abierto en la base y
// reaparecia al volver a iniciar sesion despues. sessionStorage se borra al
// cerrar el navegador (pero sobrevive a un F5), asi que sirve para distinguir
// "sigo en la misma sesion de navegador" de "esto es un login nuevo": si es
// nuevo y ya hay una conversacion mia abierta, es huerfana de la vez pasada -
// se cierra sola generando su ticket, en vez de reaparecer.
const BROWSER_SESSION_FLAG = "sigdaf:chat-browser-session";

export function ChatProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, userContext } = useAuth();
  const [conversaciones, setConversaciones] = useState<ChatConversacion[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const conversacionesRef = useRef<ChatConversacion[]>([]);
  useEffect(() => { conversacionesRef.current = conversaciones; }, [conversaciones]);

  const refresh = useCallback(() => {
    if (!userContext) return;
    void getMisConversaciones().then(setConversaciones).catch(() => {});
  }, [userContext]);

  useEffect(() => {
    if (!isAuthenticated || !userContext) {
      setConversaciones([]);
      return;
    }
    const isFreshBrowserSession = !sessionStorage.getItem(BROWSER_SESSION_FLAG);
    sessionStorage.setItem(BROWSER_SESSION_FLAG, "true");

    void getMisConversaciones().then(async (rows) => {
      if (isFreshBrowserSession && rows.length) {
        await Promise.all(rows.map((row) => cerrarChatSoporte(row.id).catch(() => {})));
        setConversaciones([]);
        return;
      }
      setConversaciones(rows);
    }).catch(() => {});

    const unsubscribe = subscribeToMisConversaciones(refresh);
    return unsubscribe;
  }, [isAuthenticated, userContext, refresh]);

  const openChat = useCallback(async (usuarioId: string) => {
    const conversacion = await abrirChatSoporte(usuarioId);
    setConversaciones((current) => (current.some((item) => item.id === conversacion.id) ? current : [conversacion, ...current]));
    setActiveId(conversacion.id);
  }, []);

  const closeChat = useCallback(async (conversacionId: string) => {
    await cerrarChatSoporte(conversacionId);
    setConversaciones((current) => current.filter((item) => item.id !== conversacionId));
    setActiveId((current) => (current === conversacionId ? null : current));
  }, []);

  const closeAllChats = useCallback(async () => {
    const ids = conversacionesRef.current.map((item) => item.id);
    await Promise.all(ids.map((id) => cerrarChatSoporte(id).catch(() => {})));
    setConversaciones([]);
    setActiveId(null);
  }, []);

  const value = useMemo<ChatContextValue>(
    () => ({ conversaciones, activeId, setActiveId, openChat, closeChat, closeAllChats }),
    [conversaciones, activeId, openChat, closeChat, closeAllChats],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChat debe usarse dentro de ChatProvider");
  return context;
}
