import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { getSupabaseErrorMessage } from "../lib/supabase-error";
import { mockDocumentos } from "../mocks/supabase-data";
import type { Documento, PaginatedResult } from "../types";

export interface ArchivoFisicoFilters {
  search?: string;
  archivadorId?: string;
  page?: number;
  pageSize?: number;
}

export interface ArchivoFisicoResumen {
  asignados: number;
  sinArchivador: number;
  porArchivador: Record<string, number>;
}

const archivoFisicoSelect = `
  *,
  categoria:catalogo_categorias(*),
  tipo_entidad:catalogo_tipo_entidad(*),
  entidad:entidades(*),
  tipo_categoria:catalogo_tipo_categoria(*),
  estado:catalogo_estado_documento(*),
  archivador:catalogo_archivadores(*),
  tipo_movimiento:catalogo_tipo_movimiento(*),
  tipo_operacion:catalogo_tipo_operacion(*)
`;

export async function getArchivoFisicoDocumentos(filters: ArchivoFisicoFilters = {}): Promise<PaginatedResult<Documento>> {
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.min(Math.max(filters.pageSize ?? 10, 1), 100);

  if (!supabase) {
    const filtered = filterArchivoFisicoMock(filters);
    const start = (page - 1) * pageSize;
    return { data: filtered.slice(start, start + pageSize), count: filtered.length, page, pageSize };
  }

  let query = supabase
    .from("documentos")
    .select(archivoFisicoSelect, { count: "exact" })
    .eq("activo", true)
    .not("archivador_id", "is", null)
    .order("fecha_documento", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  query = applyArchivoFisicoFilters(query, filters);

  const { data, error, count } = await query;
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo cargar el archivo físico."));
  return { data: (data ?? []) as unknown as Documento[], count: count ?? 0, page, pageSize };
}

export async function getArchivoFisicoResumen(search?: string): Promise<ArchivoFisicoResumen> {
  if (!supabase) {
    const filtered = filterArchivoFisicoMock({ search });
    return {
      asignados: filtered.length,
      sinArchivador: filterArchivoFisicoMock({ search, archivadorId: "__sin_archivador__" }).length,
      porArchivador: filtered.reduce<Record<string, number>>((accumulator, documento) => {
        if (documento.archivador_id) accumulator[documento.archivador_id] = (accumulator[documento.archivador_id] ?? 0) + 1;
        return accumulator;
      }, {}),
    };
  }

  const assignedQuery = applyArchivoFisicoSearch(
    supabase.from("documentos").select("id", { count: "exact", head: true }).eq("activo", true).not("archivador_id", "is", null),
    search,
  );
  const unassignedQuery = applyArchivoFisicoSearch(
    supabase.from("documentos").select("id", { count: "exact", head: true }).eq("activo", true).is("archivador_id", null),
    search,
  );
  const countSource = applyArchivoFisicoSearch(
    supabase.from("documentos").select("archivador_id").eq("activo", true).not("archivador_id", "is", null).range(0, 9999),
    search,
  );

  const [assigned, unassigned, byArchive] = await Promise.all([assignedQuery, unassignedQuery, countSource]);
  if (assigned.error) throw new Error(getSupabaseErrorMessage(assigned.error, "No se pudo cargar el resumen del archivo físico."));
  if (unassigned.error) throw new Error(getSupabaseErrorMessage(unassigned.error, "No se pudo cargar el resumen del archivo físico."));
  if (byArchive.error) throw new Error(getSupabaseErrorMessage(byArchive.error, "No se pudo cargar el resumen del archivo físico."));

  return {
    asignados: assigned.count ?? 0,
    sinArchivador: unassigned.count ?? 0,
    porArchivador: ((byArchive.data ?? []) as Array<{ archivador_id: string | null }>).reduce<Record<string, number>>((accumulator, row) => {
      if (row.archivador_id) accumulator[row.archivador_id] = (accumulator[row.archivador_id] ?? 0) + 1;
      return accumulator;
    }, {}),
  };
}

function applyArchivoFisicoFilters(query: any, filters: ArchivoFisicoFilters) {
  let nextQuery = query;
  nextQuery = applyArchivoFisicoSearch(nextQuery, filters.search);
  if (filters.archivadorId) nextQuery = nextQuery.eq("archivador_id", filters.archivadorId);
  return nextQuery;
}

function applyArchivoFisicoSearch(query: any, search?: string) {
  if (!search?.trim()) return query;
  const term = search.replaceAll(",", " ").trim();
  return query.or(`codigo_documento.ilike.%${term}%,titulo.ilike.%${term}%,ruta_historica.ilike.%${term}%`);
}

function filterArchivoFisicoMock(filters: ArchivoFisicoFilters) {
  const search = filters.search?.toLocaleLowerCase("es") ?? "";
  return mockDocumentos.filter((documento) => {
    const matchesSearch = !search || [
      documento.codigo_documento,
      documento.titulo,
      documento.ruta_historica ?? "",
      documento.categoria?.nombre ?? "",
      documento.entidad?.nombre ?? "",
      documento.archivador?.nombre ?? "",
    ].some((value) => value.toLocaleLowerCase("es").includes(search));
    const matchesArchive = filters.archivadorId === "__sin_archivador__"
      ? !documento.archivador_id
      : !filters.archivadorId || documento.archivador_id === filters.archivadorId;
    return matchesSearch && matchesArchive && (filters.archivadorId === "__sin_archivador__" || Boolean(documento.archivador_id));
  });
}

export { isSupabaseConfigured };
