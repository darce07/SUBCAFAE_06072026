import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../auth/auth-context";
import {
  abrirChatPropio,
  abrirChatSoporte,
  cerrarChatSoporte,
  descartarChatSoporte,
  getMisConversaciones,
  subscribeToMisConversaciones,
} from "../../services/chat.service";
import { CHAT_SESSION_FLAG } from "../../lib/session-flags";
import type { ChatConversacion } from "../../types";

interface ChatContextValue {
  conversaciones: ChatConversacion[];
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  openChat: (usuarioId: string) => Promise<void>;
  openMyChat: () => Promise<void>;
  closeChat: (conversacionId: string) => Promise<void>;
  closeAllChats: () => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

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
    const isFreshLogin = !sessionStorage.getItem(CHAT_SESSION_FLAG);
    sessionStorage.setItem(CHAT_SESSION_FLAG, "true");

    void getMisConversaciones().then(async (rows) => {
      if (isFreshLogin && rows.length) {
        // Nadie lo cerro explicitamente antes de este login - se descarta
        // sin generar ticket (chat temporal por diseno, no cada charla
        // amerita quedar archivada).
        await Promise.all(rows.map((row) => descartarChatSoporte(row.id).catch(() => {})));
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

  const openMyChat = useCallback(async () => {
    const conversacion = await abrirChatPropio();
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
    () => ({ conversaciones, activeId, setActiveId, openChat, openMyChat, closeChat, closeAllChats }),
    [conversaciones, activeId, openChat, openMyChat, closeChat, closeAllChats],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChat debe usarse dentro de ChatProvider");
  return context;
}
