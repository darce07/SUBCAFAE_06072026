import { supabase } from "../lib/supabase";
import { getSupabaseErrorMessage } from "../lib/supabase-error";

export interface UsuarioApoyo {
  id: string;
  nombre: string;
}

// Personas activas que se pueden indicar como "escaneó el documento".
export async function listarUsuariosApoyo(): Promise<UsuarioApoyo[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("listar_usuarios_apoyo");
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo cargar la lista de personas."));
  return (data ?? []) as UsuarioApoyo[];
}

// Quién escaneó el documento físico (null si no se indicó).
export async function getEscaneadoPor(documentoId: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("documento_escaneos")
    .select("usuario_id")
    .eq("documento_id", documentoId)
    .maybeSingle();
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo cargar quién escaneó el documento."));
  return (data?.usuario_id as string | undefined) ?? null;
}

// Indica (o quita, con null) quién escaneó uno o varios documentos.
export async function asignarEscaneadoPor(documentoIds: string[], usuarioId: string | null): Promise<void> {
  if (!supabase || !documentoIds.length) return;
  const { error } = await supabase.rpc("asignar_escaneado_por", { p_documento_ids: documentoIds, p_usuario: usuarioId });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo guardar quién escaneó el documento."));
}
