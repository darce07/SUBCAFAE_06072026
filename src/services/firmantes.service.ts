import { supabase } from "../lib/supabase";
import { getSupabaseErrorMessage } from "../lib/supabase-error";
import type { DocumentoFirmante, SincronizarFirmanteInput } from "../types";

export async function getDocumentoFirmantes(documentoId: string): Promise<DocumentoFirmante[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("documento_firmantes")
    .select("*, personal_natural(*), entidad:entidades(*)")
    .eq("documento_id", documentoId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudieron cargar los firmantes."));
  return (data ?? []) as unknown as DocumentoFirmante[];
}

export async function sincronizarDocumentoFirmantes(documentoId: string, firmantes: SincronizarFirmanteInput[]) {
  if (!supabase) return;
  const { error } = await supabase.rpc("sincronizar_documento_firmantes", {
    p_documento_id: documentoId,
    p_firmantes: firmantes.map((firmante) => ({
      personal_natural_id: firmante.personalNaturalId,
      entidad_id: firmante.entidadId,
      rol: firmante.rol,
      representa_entidad_id: firmante.representaEntidadId,
    })),
  });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudieron guardar los firmantes."));
}
