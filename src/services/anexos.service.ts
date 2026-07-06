import { supabase } from "../lib/supabase";
import { getSupabaseErrorMessage } from "../lib/supabase-error";
import { mockCatalogos } from "../mocks/supabase-data";
import type { CreateDocumentoAnexoCommand, DocumentoAnexo, UpdateDocumentoAnexoCommand } from "../types";

const anexoSelect = `
  *,
  tipo_anexo:catalogo_tipo_anexo(*)
`;

const mockAnexos: DocumentoAnexo[] = [];

export async function getDocumentoAnexos(documentoId: string): Promise<DocumentoAnexo[]> {
  if (!supabase) return mockAnexos.filter((anexo) => anexo.documento_id === documentoId && anexo.activo);
  const { data, error } = await supabase
    .from("documento_anexos")
    .select(anexoSelect)
    .eq("documento_id", documentoId)
    .eq("activo", true)
    .order("created_at", { ascending: false });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudieron cargar los anexos."));
  return (data ?? []) as unknown as DocumentoAnexo[];
}

export async function createDocumentoAnexo(command: CreateDocumentoAnexoCommand): Promise<DocumentoAnexo> {
  if (!supabase) {
    const created: DocumentoAnexo = {
      id: crypto.randomUUID(),
      documento_id: command.documentoId,
      tipo_anexo_id: command.tipoAnexoId,
      titulo: command.titulo,
      nombre_archivo: command.nombreArchivo,
      descripcion: command.descripcion,
      archivo_path: command.archivoPath,
      extension: command.extension,
      mime_type: command.mimeType,
      size_bytes: command.sizeBytes,
      version_actual: 1,
      activo: true,
      created_by: "demo-user",
      updated_by: null,
      eliminado_at: null,
      eliminado_por: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tipo_anexo: mockCatalogos.tiposAnexo.find((item) => item.id === command.tipoAnexoId) ?? null,
      creador: { id: "demo-user", email: "demo@sigdaf.local", nombre_completo: "Usuario demo" },
    };
    mockAnexos.unshift(created);
    return created;
  }

  const { data, error } = await supabase.rpc("registrar_documento_anexo", {
    p_documento_id: command.documentoId,
    p_tipo_anexo_id: command.tipoAnexoId,
    p_titulo: command.titulo,
    p_nombre_archivo: command.nombreArchivo,
    p_descripcion: command.descripcion,
    p_archivo_path: command.archivoPath,
    p_extension: command.extension,
    p_mime_type: command.mimeType,
    p_size_bytes: command.sizeBytes,
  });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo registrar el anexo."));
  return data as DocumentoAnexo;
}

export async function updateDocumentoAnexo(command: UpdateDocumentoAnexoCommand): Promise<DocumentoAnexo> {
  if (!supabase) {
    const current = mockAnexos.find((anexo) => anexo.id === command.id);
    if (!current) throw new Error("Anexo no encontrado.");
    Object.assign(current, {
      tipo_anexo_id: command.tipoAnexoId,
      titulo: command.titulo,
      descripcion: command.descripcion,
      nombre_archivo: command.nombreArchivo ?? current.nombre_archivo,
      archivo_path: command.archivoPath ?? current.archivo_path,
      extension: command.extension ?? current.extension,
      mime_type: command.mimeType ?? current.mime_type,
      size_bytes: command.sizeBytes ?? current.size_bytes,
      version_actual: command.archivoPath ? current.version_actual + 1 : current.version_actual,
      updated_at: new Date().toISOString(),
      tipo_anexo: mockCatalogos.tiposAnexo.find((item) => item.id === command.tipoAnexoId) ?? null,
    });
    return current;
  }

  const { data, error } = await supabase.rpc("actualizar_documento_anexo", {
    p_anexo_id: command.id,
    p_tipo_anexo_id: command.tipoAnexoId,
    p_titulo: command.titulo,
    p_descripcion: command.descripcion,
    p_nombre_archivo: command.nombreArchivo ?? null,
    p_archivo_path: command.archivoPath ?? null,
    p_extension: command.extension ?? null,
    p_mime_type: command.mimeType ?? null,
    p_size_bytes: command.sizeBytes ?? null,
  });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo actualizar el anexo."));
  return data as DocumentoAnexo;
}

export async function deleteDocumentoAnexo(id: string): Promise<void> {
  if (!supabase) {
    const current = mockAnexos.find((anexo) => anexo.id === id);
    if (current) current.activo = false;
    return;
  }
  const { error } = await supabase.rpc("eliminar_documento_anexo", { p_anexo_id: id });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo eliminar el anexo."));
}
