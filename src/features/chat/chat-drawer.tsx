import { useEffect, useRef, useState } from "react";
import { MessageCircle, Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";
import { useChat } from "./chat-context";
import { useAuth } from "../auth/auth-context";
import { Button, Input, Select } from "../../components/ui";
import { enviarMensajeImagen, enviarMensajeTexto, getChatImageUrl, getMensajes, subscribeToMensajes, type CerrarChatOpciones } from "../../services/chat.service";
import type { ChatMensaje, SoporteTicket } from "../../types";
import { formatDateTime } from "../../lib/utils";

export function ChatDrawer() {
  const { conversaciones, activeId, setActiveId, closeChat } = useChat();
  const { userContext } = useAuth();
  const [open, setOpen] = useState(false);

  if (!conversaciones.length) return null;

  const active = conversaciones.find((item) => item.id === activeId) ?? conversaciones[0];

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen((value) => !value); setActiveId(active.id); }}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-teal-600 px-4 py-3 text-sm font-bold text-white shadow-xl transition hover:bg-teal-700"
      >
        <MessageCircle className="size-5" />
        Chat de soporte
        <span className="grid size-5 place-items-center rounded-full bg-white text-xs font-black text-teal-700">{conversaciones.length}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/20 p-0 sm:items-stretch sm:p-5">
          <div className="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-900 sm:h-auto sm:max-h-[85vh] sm:w-[420px] sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-3 dark:border-slate-800">
              <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
                {conversaciones.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveId(item.id)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${item.id === active.id ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
                  >
                    {item.admin_id === userContext?.id ? "Chat abierto" : "Soporte"}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setOpen(false)} className="ml-2 shrink-0 rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="size-4" /></button>
            </div>
            <ChatThread
              conversacionId={active.id}
              soyAdmin={active.admin_id === userContext?.id}
              onClose={(opciones) => void closeChat(active.id, opciones).then(() => toast.success(opciones?.crearTicket === false ? "Chat cerrado sin ticket." : "Chat cerrado. Se guardó un ticket de soporte."))}
            />
          </div>
        </div>
      )}
    </>
  );
}

function ChatThread({ conversacionId, soyAdmin, onClose }: { conversacionId: string; soyAdmin: boolean; onClose: (opciones?: CerrarChatOpciones) => void }) {
  const { userContext } = useAuth();
  const [mensajes, setMensajes] = useState<ChatMensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [sending, setSending] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
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
        {soyAdmin ? (
          <button type="button" onClick={() => setShowCloseDialog(true)} className="mt-2 text-xs font-semibold text-rose-600 hover:underline">Cerrar chat...</button>
        ) : (
          <button type="button" onClick={() => onClose()} className="mt-2 text-xs font-semibold text-rose-600 hover:underline">Cerrar chat</button>
        )}
      </div>
      {showCloseDialog && <CloseChatDialog onCancel={() => setShowCloseDialog(false)} onConfirm={(opciones) => { setShowCloseDialog(false); onClose(opciones); }} />}
    </>
  );
}

function CloseChatDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: (opciones: CerrarChatOpciones) => void }) {
  const [crearTicket, setCrearTicket] = useState(true);
  const [titulo, setTitulo] = useState("");
  const [categoria, setCategoria] = useState<SoporteTicket["categoria"]>("sin_categorizar");
  const [prioridad, setPrioridad] = useState<SoporteTicket["prioridad"]>("media");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl dark:bg-slate-900">
        <h3 className="font-bold">Cerrar chat</h3>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={crearTicket} onChange={(event) => setCrearTicket(event.target.checked)} />
          Crear ticket de seguimiento con esta conversación
        </label>
        {crearTicket && (
          <div className="mt-3 space-y-2">
            <Input placeholder="Título breve (opcional)" value={titulo} onChange={(event) => setTitulo(event.target.value)} />
            <Select value={categoria} onChange={(event) => setCategoria(event.target.value as SoporteTicket["categoria"])}>
              <option value="sin_categorizar">Sin categorizar</option>
              <option value="bug">Bug / error</option>
              <option value="consulta">Consulta</option>
              <option value="solicitud">Solicitud</option>
              <option value="otro">Otro</option>
            </Select>
            <Select value={prioridad} onChange={(event) => setPrioridad(event.target.value as SoporteTicket["prioridad"])}>
              <option value="baja">Prioridad baja</option>
              <option value="media">Prioridad media</option>
              <option value="alta">Prioridad alta</option>
            </Select>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onCancel}>Cancelar</Button>
          <Button type="button" size="sm" onClick={() => onConfirm({ crearTicket, titulo, categoria, prioridad })}>Cerrar chat</Button>
        </div>
      </div>
    </div>
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
