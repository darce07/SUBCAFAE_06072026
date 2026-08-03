import { useEffect, useRef, useState } from "react";
import { MessageCircle, Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";
import { useChat } from "./chat-context";
import { useAuth } from "../auth/auth-context";
import { Button } from "../../components/ui";
import { enviarMensajeImagen, enviarMensajeTexto, getChatImageUrl, getMensajes, subscribeToMensajes } from "../../services/chat.service";
import type { ChatMensaje } from "../../types";
import { formatDateTime, formatShortName } from "../../lib/utils";

export function ChatDrawer() {
  const { conversaciones, activeId, setActiveId, closeChat } = useChat();
  const { userContext } = useAuth();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);

  if (!conversaciones.length) return null;

  const active = conversaciones.find((item) => item.id === activeId) ?? conversaciones[0];

  if (minimized) {
    return (
      <button
        type="button"
        aria-label="Mostrar chat de soporte"
        title={`Chat de soporte (${conversaciones.length} abierto${conversaciones.length === 1 ? "" : "s"}) - sigue activo, no se cerró`}
        onClick={() => setMinimized(false)}
        className="fixed bottom-5 right-5 z-40 grid size-11 place-items-center rounded-full bg-teal-600 text-white shadow-xl transition hover:bg-teal-700"
      >
        <MessageCircle className="size-5" />
        <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-slate-900 text-[10px] font-black text-white ring-2 ring-white dark:ring-slate-950">{conversaciones.length}</span>
      </button>
    );
  }

  return (
    <>
      <div className="fixed bottom-5 right-5 z-40 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => { setOpen((value) => !value); setActiveId(active.id); }}
          className="flex items-center gap-2 rounded-full bg-teal-600 px-4 py-3 text-sm font-bold text-white shadow-xl transition hover:bg-teal-700"
        >
          <MessageCircle className="size-5" />
          Chat de soporte
          <span className="grid size-5 place-items-center rounded-full bg-white text-xs font-black text-teal-700">{conversaciones.length}</span>
        </button>
        <button
          type="button"
          aria-label="Minimizar chat de soporte"
          title="Minimizar (el chat sigue abierto, no se genera ticket)"
          onClick={() => { setMinimized(true); setOpen(false); }}
          className="rounded-full bg-slate-700 p-2.5 text-white shadow-xl transition hover:bg-slate-600"
        >
          <X className="size-4" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/20 p-0 sm:items-stretch sm:p-5">
          <div className="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-900 sm:h-auto sm:max-h-[85vh] sm:w-[420px] sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-3 dark:border-slate-800">
              <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
                {conversaciones.map((item) => {
                  const isMine = item.admin_id === userContext?.id;
                  const otroNombre = isMine ? item.usuario_nombre : item.admin_nombre;
                  const label = otroNombre ? formatShortName(otroNombre) : (isMine ? "Chat abierto" : "Soporte");
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveId(item.id)}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${item.id === active.id ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <button type="button" onClick={() => setOpen(false)} className="ml-2 shrink-0 rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="size-4" /></button>
            </div>
            <ChatThread conversacionId={active.id} onClose={() => void closeChat(active.id).then(() => toast.success("Chat cerrado. Se guardó un ticket de soporte."))} />
          </div>
        </div>
      )}
    </>
  );
}

function ChatThread({ conversacionId, onClose }: { conversacionId: string; onClose: () => void }) {
  const { userContext } = useAuth();
  const [mensajes, setMensajes] = useState<ChatMensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    void getMensajes(conversacionId).then((items) => { if (active) setMensajes(items); });
    const unsubscribe = subscribeToMensajes(conversacionId, (mensaje) => {
      setMensajes((current) => (current.some((item) => item.id === mensaje.id) ? current : [...current, mensaje]));
    });
    return () => { active = false; unsubscribe(); };
  }, [conversacionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes.length]);

  const send = async () => {
    if (!texto.trim() || !userContext) return;
    setSending(true);
    try {
      await enviarMensajeTexto(conversacionId, userContext.id, texto.trim());
      setTexto("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo enviar el mensaje.");
    } finally {
      setSending(false);
    }
  };

  const sendImage = async (file: File | undefined) => {
    if (!file || !userContext) return;
    setSending(true);
    try {
      await enviarMensajeImagen(conversacionId, userContext.id, file);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo enviar la captura.");
    } finally {
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {!mensajes.length && <p className="py-8 text-center text-xs text-slate-400">Escribí para empezar la conversación.</p>}
        {mensajes.map((mensaje) => (
          <ChatBubble key={mensaje.id} mensaje={mensaje} mine={mensaje.autor_id === userContext?.id} />
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        <div className="flex items-end gap-2">
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => void sendImage(event.target.files?.[0])} />
          <button type="button" title="Adjuntar captura" onClick={() => fileInputRef.current?.click()} className="rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            <Paperclip className="size-4" />
          </button>
          <textarea
            value={texto}
            onChange={(event) => setTexto(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }}
            placeholder="Escribí un mensaje..."
            rows={1}
            className="min-h-[42px] flex-1 resize-none rounded-xl border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-950"
          />
          <Button type="button" size="icon" loading={sending} disabled={!texto.trim()} onClick={() => void send()}><Send className="size-4" /></Button>
        </div>
        <button type="button" onClick={onClose} className="mt-2 text-xs font-semibold text-rose-600 hover:underline">Cerrar chat y generar ticket</button>
      </div>
    </>
  );
}

function ChatBubble({ mensaje, mine }: { mensaje: ChatMensaje; mine: boolean }) {
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    if (mensaje.archivo_path) void getChatImageUrl(mensaje.archivo_path).then(setImageUrl).catch(() => {});
  }, [mensaje.archivo_path]);

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"}`}>
        {mensaje.contenido && <p className="whitespace-pre-wrap break-words">{mensaje.contenido}</p>}
        {mensaje.archivo_path && (imageUrl ? <img src={imageUrl} alt="Captura adjunta" className="mt-1 max-h-56 rounded-lg" /> : <p className="text-xs italic opacity-70">Cargando captura...</p>)}
        <p className={`mt-1 text-[10px] ${mine ? "text-teal-100" : "text-slate-400"}`}>{formatDateTime(mensaje.created_at)}</p>
      </div>
    </div>
  );
}
