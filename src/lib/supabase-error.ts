import type { PostgrestError } from "@supabase/supabase-js";

type SupabaseLikeError = Partial<PostgrestError> & {
  statusCode?: string | number;
  error?: string;
};

export function getSupabaseErrorMessage(error: unknown, fallback = "Ocurrió un error al procesar la solicitud.") {
  if (!(error instanceof Error) && (!error || typeof error !== "object")) return fallback;
  const value = error as SupabaseLikeError;
  const message = "message" in value ? String(value.message ?? "") : "";
  const code = String(value.code ?? value.statusCode ?? "");
  const normalized = `${code} ${message}`.toLocaleLowerCase("es");

  if (normalized.includes("jwt") || normalized.includes("not authenticated") || normalized.includes("usuario no autenticado")) {
    return "Tu sesión expiró o no es válida. Inicia sesión nuevamente.";
  }
  if (normalized.includes("row-level security") || normalized.includes("42501") || normalized.includes("permission denied") || normalized.includes("permiso")) {
    return "No tienes permisos para realizar esta operación.";
  }
  if (normalized.includes("23505") || normalized.includes("duplicate")) {
    return "El registro ya existe o la operación ya fue procesada.";
  }
  if (normalized.includes("23503") || normalized.includes("foreign key")) {
    return "Uno de los valores seleccionados ya no está disponible.";
  }
  if (normalized.includes("p0002") || normalized.includes("not found") || normalized.includes("no encontrado")) {
    return "El registro solicitado no existe o ya no está disponible.";
  }
  if (normalized.includes("invalid login credentials")) {
    return "El correo o la contraseña son incorrectos.";
  }
  if (normalized.includes("file size") || normalized.includes("payload too large")) {
    return "El archivo supera el tamaño permitido.";
  }
  if (normalized.includes("mime") || normalized.includes("content type")) {
    return "El tipo de archivo seleccionado no está permitido.";
  }
  if (normalized.includes("storage") && normalized.includes("not found")) {
    return "No se encontró el archivo solicitado.";
  }
  return fallback;
}
