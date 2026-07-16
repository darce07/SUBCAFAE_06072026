import { supabase } from "../lib/supabase";
import { getSupabaseErrorMessage } from "../lib/supabase-error";
import type { Backup } from "../types";

export async function listBackups(): Promise<Backup[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("backups_generados")
    .select("id,usuario_id,anio,categoria_id,archivador_id,estado,archivo_path,tamano_bytes,total_documentos,error_mensaje,created_at,completado_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo cargar el historial de respaldos."));
  return (data ?? []) as Backup[];
}

export async function requestBackup(filters: { anio: number; categoriaId?: string | null; archivadorId?: string | null }): Promise<Backup> {
  if (!supabase) throw new Error("Supabase no está configurado.");

  const { data, error } = await supabase.functions.invoke("generar-backup", {
    body: { anio: filters.anio, categoriaId: filters.categoriaId ?? null, archivadorId: filters.archivadorId ?? null },
  });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo generar el respaldo."));
  if (data?.error) throw new Error(data.error as string);

  const { data: row, error: fetchError } = await supabase
    .from("backups_generados")
    .select("id,usuario_id,anio,categoria_id,archivador_id,estado,archivo_path,tamano_bytes,total_documentos,error_mensaje,created_at,completado_at")
    .eq("id", data.id as string)
    .single();
  if (fetchError) throw new Error(getSupabaseErrorMessage(fetchError, "El respaldo se generó pero no se pudo leer su estado."));
  return row as Backup;
}

export async function getBackupDownloadUrl(path: string, expiresIn = 300) {
  if (!supabase) return "";
  const { data, error } = await supabase.storage.from("backups").createSignedUrl(path, expiresIn);
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo generar el enlace de descarga."));
  return data.signedUrl;
}
