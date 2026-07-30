import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { mockCatalogos } from "../mocks/supabase-data";
import type { CatalogItem, CatalogTable, CreateEntityCommand, Entidad } from "../types";
import { getSupabaseErrorMessage } from "../lib/supabase-error";
import { normalizeEntityDocumentNumber, validateEntityDocument } from "../lib/entity-document";

async function getCatalog<T extends CatalogItem>(table: CatalogTable, fallback: T[]): Promise<T[]> {
  if (!supabase) return fallback;
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .order("nombre", { ascending: true });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo cargar el catálogo."));
  return (data ?? []) as T[];
}

export const getCategorias = () => getCatalog("catalogo_categorias", mockCatalogos.categorias);
export const getTiposEntidad = () => getCatalog("catalogo_tipo_entidad", mockCatalogos.tiposEntidad);
export const getEntidades = () => getCatalog<Entidad>("entidades", mockCatalogos.entidades);

export async function searchEntidades(tipoEntidadId: string, search = "", limit = 5): Promise<Entidad[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 5);
  const normalizedSearch = search.trim().replace(/[,()%]/g, " ");
  if (!supabase) {
    const term = normalizedSearch.toLocaleLowerCase("es");
    return mockCatalogos.entidades
      .filter((entity) => entity.activo && (!tipoEntidadId || entity.tipo_entidad_id === tipoEntidadId))
      .filter((entity) => !term || [entity.nombre, entity.tipo_documento ?? "", entity.numero_documento ?? ""]
        .some((value) => value.toLocaleLowerCase("es").includes(term)))
      .slice(0, safeLimit);
  }

  let query = supabase
    .from("entidades")
    .select("id,nombre,descripcion,activo,tipo_entidad_id,tipo_documento,numero_documento,created_at,updated_at")
    .eq("activo", true)
    .order("nombre", { ascending: true })
    .limit(safeLimit);

  // Sin tipo preseleccionado se busca en todas las entidades (el usuario
  // no debería tener que adivinar el tipo solo para poder buscar).
  if (tipoEntidadId) query = query.eq("tipo_entidad_id", tipoEntidadId);

  if (normalizedSearch) {
    query = query.or(`nombre.ilike.%${normalizedSearch}%,numero_documento.ilike.%${normalizedSearch}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudieron buscar las entidades."));
  return (data ?? []) as Entidad[];
}
export const getTiposCategoria = () => getCatalog("catalogo_tipo_categoria", mockCatalogos.tiposCategoria);
export const getEstadosDocumento = () => getCatalog("catalogo_estado_documento", mockCatalogos.estadosDocumento);
export const getArchivadores = () => getCatalog("catalogo_archivadores", mockCatalogos.archivadores);
export const getTiposMovimiento = () => getCatalog("catalogo_tipo_movimiento", mockCatalogos.tiposMovimiento);
export const getTiposOperacion = () => getCatalog("catalogo_tipo_operacion", mockCatalogos.tiposOperacion);
export const getTiposAnexo = () => getCatalog("catalogo_tipo_anexo", mockCatalogos.tiposAnexo);

export async function createCatalogItem(
  table: CatalogTable,
  values: Pick<CatalogItem, "nombre" | "descripcion"> & { tipo_entidad_id?: string | null },
) {
  const nombre = values.nombre.trim();
  if (nombre.length < 2) throw new Error("El nombre debe tener al menos 2 caracteres.");
  if (!supabase) {
    return {
      id: crypto.randomUUID(),
      nombre,
      descripcion: values.descripcion?.trim() || null,
      activo: true,
      ...("tipo_entidad_id" in values ? { tipo_entidad_id: values.tipo_entidad_id ?? null } : {}),
    } as CatalogItem;
  }
  const { data, error } = await supabase.from(table).insert({
    ...values,
    nombre,
    descripcion: values.descripcion?.trim() || null,
    activo: true,
  }).select().single();
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo crear el valor del catálogo."));
  return data as CatalogItem;
}

export async function updateCatalogItem(
  table: CatalogTable,
  id: string,
  values: Partial<Pick<CatalogItem, "nombre" | "descripcion" | "activo">> & { tipo_entidad_id?: string | null },
) {
  if (values.nombre !== undefined && values.nombre.trim().length < 2) {
    throw new Error("El nombre debe tener al menos 2 caracteres.");
  }
  if (!supabase) return { id, ...values } as CatalogItem;
  const normalized = {
    ...values,
    ...(values.nombre !== undefined ? { nombre: values.nombre.trim() } : {}),
    ...(values.descripcion !== undefined ? { descripcion: values.descripcion?.trim() || null } : {}),
  };
  const { data, error } = await supabase.from(table).update(normalized).eq("id", id).select().single();
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo actualizar el catálogo."));
  return data as CatalogItem;
}

export async function setCatalogItemActive(table: CatalogTable, id: string, activo: boolean) {
  return updateCatalogItem(table, id, { activo });
}

export async function deleteCatalogItem(table: CatalogTable, id: string) {
  if (!supabase) return;
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo eliminar el valor del catálogo."));
}

export async function createOrGetEntidad(command: CreateEntityCommand): Promise<Entidad> {
  const normalizedNumber = normalizeEntityDocumentNumber(command.tipoDocumento ?? "", command.numeroDocumento ?? "");
  const validationError = validateEntityDocument(command.tipoDocumento ?? "", normalizedNumber, Boolean(command.tipoDocumento));
  if (validationError) throw new Error(validationError);

  if (!supabase) {
    return {
      id: crypto.randomUUID(),
      nombre: command.nombre.trim(),
      descripcion: null,
      activo: true,
      tipo_entidad_id: command.tipoEntidadId,
      tipo_documento: command.tipoDocumento,
      numero_documento: normalizedNumber || null,
    };
  }
  const { data, error } = await supabase.rpc("crear_o_obtener_entidad", {
    p_tipo_entidad_id: command.tipoEntidadId,
    p_nombre: command.nombre,
    p_tipo_documento: command.tipoDocumento,
    p_numero_documento: normalizedNumber || null,
  });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo registrar la entidad."));
  return data as Entidad;
}

export { isSupabaseConfigured };
