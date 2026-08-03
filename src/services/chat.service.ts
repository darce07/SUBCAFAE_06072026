import { supabase } from "../lib/supabase";
import { getSupabaseErrorMessage } from "../lib/supabase-error";
import { validateFileSignature } from "./storage.service";
import type { ChatConversacion, ChatMensaje, SoporteTicket, SoporteTicketAdmin } from "../types";

const BUCKET = "chat-temporal";
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function abrirChatSoporte(usuarioId: string): Promise<ChatConversacion> {
  if (!supabase) throw new Error("Chat no disponible en modo demo.");
  const { data, error } = await supabase.rpc("abrir_chat_soporte", { p_usuario_id: usuarioId });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo abrir el chat."));
  return data as ChatConversacion;
}

export async function cerrarChatSoporte(conversacionId: string): Promise<SoporteTicket | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("cerrar_chat_soporte", { p_conversacion_id: conversacionId });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo cerrar el chat."));
  return (data as SoporteTicket) ?? null;
}

export async function getTicketsSoporte(): Promise<SoporteTicketAdmin[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("listar_tickets_soporte");
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudieron cargar los tickets de soporte."));
  return (data ?? []) as SoporteTicketAdmin[];
}

export async function getMisConversaciones(): Promise<ChatConversacion[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("chat_conversaciones").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudieron cargar los chats."));
  return (data ?? []) as ChatConversacion[];
}

export async function getMensajes(conversacionId: string): Promise<ChatMensaje[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("chat_mensajes")
    .select("*")
    .eq("conversacion_id", conversacionId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudieron cargar los mensajes."));
  return (data ?? []) as ChatMensaje[];
}

export async function enviarMensajeTexto(conversacionId: string, autorId: string, contenido: string) {
  if (!supabase) return;
  const { error } = await supabase.from("chat_mensajes").insert({ conversacion_id: conversacionId, autor_id: autorId, contenido });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo enviar el mensaje."));
}

function validateChatImage(file: File) {
  if (!ALLOWED_IMAGE_MIME.has(file.type)) throw new Error("Solo se permiten imágenes JPG, PNG o WEBP.");
  if (file.size > MAX_IMAGE_SIZE) throw new Error("La imagen supera el tamaño máximo permitido (8 MB).");
}

export async function enviarMensajeImagen(conversacionId: string, autorId: string, file: File) {
  if (!supabase) return;
  validateChatImage(file);
  await validateFileSignature(file);
  const safeName = file.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9.]+/g, "-").toLowerCase();
  const path = `${conversacionId}/${autorId}/${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw new Error(getSupabaseErrorMessage(uploadError, "No se pudo subir la captura."));
  const { error } = await supabase.from("chat_mensajes").insert({
    conversacion_id: conversacionId,
    autor_id: autorId,
    archivo_path: path,
    archivo_mime: file.type,
  });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo enviar la captura."));
}

export async function getChatImageUrl(path: string, expiresIn = 300) {
  if (!supabase) return "";
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo abrir la captura."));
  return data.signedUrl;
}

export function subscribeToMensajes(conversacionId: string, onInsert: (mensaje: ChatMensaje) => void) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`chat_mensajes:${conversacionId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "chat_mensajes", filter: `conversacion_id=eq.${conversacionId}` },
      (payload) => onInsert(payload.new as ChatMensaje),
    )
    .subscribe();
  return () => { void supabase!.removeChannel(channel); };
}

export function subscribeToMisConversaciones(onChange: () => void) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel("chat_conversaciones:mias")
    .on("postgres_changes", { event: "*", schema: "public", table: "chat_conversaciones" }, () => onChange())
    .subscribe();
  return () => { void supabase!.removeChannel(channel); };
}
