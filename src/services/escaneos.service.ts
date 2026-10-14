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

// Quién escaneó cada anexo (id del anexo -> id de la persona). Si falla (por ejemplo, la migración aún no
// está aplicada) devuelve vacío: el dato es complementario y no debe impedir ver los anexos.
export async function getEscaneadosAnexos(anexoIds: string[]): Promise<Record<string, string>> {
  if (!supabase || !anexoIds.length) return {};
  const { data, error } = await supabase.from("anexo_escaneos").select("anexo_id, usuario_id").in("anexo_id", anexoIds);
  if (error) return {};
  return Object.fromEntries((data ?? []).map((row) => [row.anexo_id as string, row.usuario_id as string]));
}

// Indica (o quita, con null) quién escaneó uno o varios anexos.
export async function asignarEscaneadoPorAnexos(anexoIds: string[], usuarioId: string | null): Promise<void> {
  if (!supabase || !anexoIds.length) return;
  const { error } = await supabase.rpc("asignar_escaneado_por_anexos", { p_anexo_ids: anexoIds, p_usuario: usuarioId });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo guardar quién escaneó el anexo."));
}

// Indica (o quita, con null) quién escaneó uno o varios documentos.
export async function asignarEscaneadoPor(documentoIds: string[], usuarioId: string | null): Promise<void> {
  if (!supabase || !documentoIds.length) return;
  const { error } = await supabase.rpc("asignar_escaneado_por", { p_documento_ids: documentoIds, p_usuario: usuarioId });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo guardar quién escaneó el documento."));
}
