import { supabase } from "../lib/supabase";
import { getSupabaseErrorMessage } from "../lib/supabase-error";
import { mockDocumentos } from "../mocks/supabase-data";
import type {
  CreateDocumentoCommand,
  DashboardFilters,
  DashboardResumen,
  DocumentAuditRecord,
  Documento,
  DocumentoFilters,
  DocumentoInput,
  PaginatedResult,
  UpdateDocumentoCommand,
} from "../types";

const documentoSelect = `
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

export async function createDocumento(command: CreateDocumentoCommand): Promise<Documento> {
  if (!supabase) {
    return {
      id: crypto.randomUUID(),
      codigo_documento: `DOC-${command.fechaDocumento.slice(0, 4)}-DEMO`,
      categoria_id: command.categoriaId,
      fecha_documento: command.fechaDocumento,
      anio: Number(command.fechaDocumento.slice(0, 4)),
      mes: Number(command.fechaDocumento.slice(5, 7)),
      dia: Number(command.fechaDocumento.slice(8, 10)),
      tipo_entidad_id: command.tipoEntidadId,
      entidad_id: command.entidadId,
      tipo_categoria_id: command.tipoCategoriaId,
      estado_id: command.estadoId,
      titulo: command.titulo,
      descripcion: command.descripcion,
      ruta_historica: command.rutaHistorica,
      archivador_id: command.archivadorId,
      archivo_path: command.archivoPath,
      archivo_url: null,
      extension: command.extension,
      monto: command.monto,
      tipo_movimiento_id: command.tipoMovimientoId,
      tipo_operacion_id: command.tipoOperacionId,
      idempotency_key: command.idempotencyKey,
      activo: true,
    };
  }

  const { data, error } = await supabase.rpc("registrar_documento_seguro", {
    p_idempotency_key: command.idempotencyKey,
    p_categoria_id: command.categoriaId,
    p_fecha_documento: command.fechaDocumento,
    p_tipo_entidad_id: command.tipoEntidadId,
    p_entidad_id: command.entidadId,
    p_tipo_categoria_id: command.tipoCategoriaId,
    p_estado_id: command.estadoId,
    p_titulo: command.titulo,
    p_descripcion: command.descripcion,
    p_ruta_historica: command.rutaHistorica,
    p_estructura_historica_id: command.estructuraHistoricaId,
    p_archivador_id: command.archivadorId,
    p_archivo_path: command.archivoPath,
    p_extension: command.extension,
    p_monto: command.monto,
    p_tipo_movimiento_id: command.tipoMovimientoId,
    p_tipo_operacion_id: command.tipoOperacionId,
  });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo registrar el documento."));

  const created = data as Documento;
  return (await getDocumentoById(created.id)) ?? created;
}

export async function getDocumentos(filters: DocumentoFilters = {}): Promise<PaginatedResult<Documento>> {
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.min(Math.max(filters.pageSize ?? 10, 1), 100);
  if (!supabase) {
    const filtered = sortDocumentos(filterMockDocumentos(filters), filters);
    const start = (page - 1) * pageSize;
    return { data: filtered.slice(start, start + pageSize), count: filtered.length, page, pageSize };
  }

  const select = filters.tipoMovimientoNombre
    ? documentoSelect.replace(
      "tipo_movimiento:catalogo_tipo_movimiento(*)",
      "tipo_movimiento:catalogo_tipo_movimiento!inner(*)",
    )
    : documentoSelect;

  let query = supabase
    .from("documentos")
    .select(select, { count: "exact" })
    .eq("activo", true)
    .order(filters.orderBy ?? "fecha_documento", { ascending: (filters.orderDirection ?? "desc") === "asc" })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (filters.search) {
    const term = sanitizeSearchTerm(filters.search);
    if (term) {
      const entityIds = await getEntityIdsForDocumentSearch(term);
      const searchParts = [
        `codigo_documento.ilike.%${term}%`,
        `titulo.ilike.%${term}%`,
        `descripcion.ilike.%${term}%`,
        `ruta_historica.ilike.%${term}%`,
        ...(entityIds.length ? [`entidad_id.in.(${entityIds.join(",")})`] : []),
      ];
      query = query.or(searchParts.join(","));
    }
  }
  if (filters.categoriaId) query = query.eq("categoria_id", filters.categoriaId);
  if (filters.estadoId) query = query.eq("estado_id", filters.estadoId);
  if (filters.entidadId) query = query.eq("entidad_id", filters.entidadId);
  if (filters.anio) query = query.eq("anio", filters.anio);
  if (filters.tipoMovimientoId) query = query.eq("tipo_movimiento_id", filters.tipoMovimientoId);
  if (filters.tipoMovimientoNombre) query = query.eq("tipo_movimiento.nombre", filters.tipoMovimientoNombre);
  if (filters.hasHistoricalPath) query = query.not("ruta_historica", "is", null).neq("ruta_historica", "");

  const { data, error, count } = await query;
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudieron cargar los documentos."));
  return { data: (data ?? []) as unknown as Documento[], count: count ?? 0, page, pageSize };
}

export async function getDocumentoById(id: string): Promise<Documento | null> {
  if (!supabase) return mockDocumentos.find((documento) => documento.id === id) ?? null;
  const { data, error } = await supabase
    .from("documentos")
    .select(documentoSelect)
    .eq("id", id)
    .eq("activo", true)
    .maybeSingle();
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo cargar el documento."));
  return data as unknown as Documento | null;
}

export async function updateDocumento(id: string, data: Partial<DocumentoInput>): Promise<Documento> {
  if (!supabase) {
    const current = mockDocumentos.find((documento) => documento.id === id);
    if (!current) throw new Error("Documento no encontrado.");
    return { ...current, ...data };
  }
  const safeData = { ...data };
  delete safeData.created_by;
  const { data: updated, error } = await supabase
    .from("documentos")
    .update(safeData)
    .eq("id", id)
    .eq("activo", true)
    .select(documentoSelect)
    .single();
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo actualizar el documento."));
  return updated as unknown as Documento;
}

export async function deleteDocumento(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc("eliminar_documento_seguro", {
    p_documento_id: id,
  });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo eliminar el documento."));
}

export async function getDashboardResumen(filters: DashboardFilters = {}): Promise<DashboardResumen> {
  if (!supabase) return buildMockDashboard(filters);
  const { data, error } = await supabase.rpc("obtener_dashboard_resumen_filtrado", {
    p_anio: filters.anio ?? null,
    p_mes: filters.mes ?? null,
  });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo cargar el resumen del dashboard."));
  return data as DashboardResumen;
}

function filterMockDocumentos(filters: DocumentoFilters) {
  const search = filters.search?.toLocaleLowerCase("es") ?? "";
  return mockDocumentos.filter((documento) => {
    const matchesSearch = !search || [
      documento.codigo_documento,
      documento.titulo,
      documento.descripcion ?? "",
      documento.ruta_historica ?? "",
      documento.categoria?.nombre ?? "",
      documento.entidad?.nombre ?? "",
    ].some((value) => value.toLocaleLowerCase("es").includes(search));
    return matchesSearch
      && (!filters.categoriaId || documento.categoria_id === filters.categoriaId)
      && (!filters.estadoId || documento.estado_id === filters.estadoId)
      && (!filters.entidadId || documento.entidad_id === filters.entidadId)
      && (!filters.anio || documento.anio === filters.anio)
      && (!filters.tipoMovimientoId || documento.tipo_movimiento_id === filters.tipoMovimientoId)
      && (!filters.tipoMovimientoNombre || documento.tipo_movimiento?.nombre === filters.tipoMovimientoNombre)
      && (!filters.hasHistoricalPath || Boolean(documento.ruta_historica?.trim()));
  });
}

function sortDocumentos(documentos: Documento[], filters: DocumentoFilters) {
  const orderBy = filters.orderBy ?? "fecha_documento";
  const direction = filters.orderDirection ?? "desc";
  const multiplier = direction === "asc" ? 1 : -1;
  return [...documentos].sort((left, right) => {
    const leftValue = orderBy === "created_at" ? left.created_at ?? "" : left.fecha_documento;
    const rightValue = orderBy === "created_at" ? right.created_at ?? "" : right.fecha_documento;
    return leftValue.localeCompare(rightValue) * multiplier;
  });
}

function sanitizeSearchTerm(search: string) {
  return search.replace(/[%(),]/g, " ").replace(/\s+/g, " ").trim();
}

async function getEntityIdsForDocumentSearch(term: string) {
  if (!supabase || term.length < 2) return [];
  const { data, error } = await supabase
    .from("entidades")
    .select("id")
    .eq("activo", true)
    .or(`nombre.ilike.%${term}%,numero_documento.ilike.%${term}%`)
    .limit(50);

  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudieron buscar las entidades relacionadas."));
  return (data ?? []).map((item) => item.id as string);
}

export async function editDocumento(id: string, command: UpdateDocumentoCommand): Promise<Documento> {
  if (!supabase) {
    const current = mockDocumentos.find((documento) => documento.id === id);
    if (!current) throw new Error("Documento no encontrado.");
    return {
      ...current,
      fecha_documento: command.fechaDocumento,
      anio: Number(command.fechaDocumento.slice(0, 4)),
      mes: Number(command.fechaDocumento.slice(5, 7)),
      dia: Number(command.fechaDocumento.slice(8, 10)),
      categoria_id: command.categoriaId,
      tipo_entidad_id: command.tipoEntidadId,
      entidad_id: command.entidadId,
      tipo_categoria_id: command.tipoCategoriaId,
      estado_id: command.estadoId,
      titulo: command.titulo,
      descripcion: command.descripcion,
      ruta_historica: command.rutaHistorica,
      archivador_id: command.archivadorId,
      archivo_path: command.archivoPath,
      extension: command.extension,
      monto: command.monto,
      tipo_movimiento_id: command.tipoMovimientoId,
      tipo_operacion_id: command.tipoOperacionId,
    };
  }

  const { data, error } = await supabase.rpc("editar_documento_seguro_v2", {
    p_documento_id: id,
    p_fecha_documento: command.fechaDocumento,
    p_categoria_id: command.categoriaId,
    p_tipo_entidad_id: command.tipoEntidadId,
    p_entidad_id: command.entidadId,
    p_tipo_categoria_id: command.tipoCategoriaId,
    p_estado_id: command.estadoId,
    p_titulo: command.titulo,
    p_descripcion: command.descripcion,
    p_ruta_historica: command.rutaHistorica,
    p_archivador_id: command.archivadorId,
    p_archivo_path: command.archivoPath,
    p_extension: command.extension,
    p_monto: command.monto,
    p_tipo_movimiento_id: command.tipoMovimientoId,
    p_tipo_operacion_id: command.tipoOperacionId,
  });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo actualizar el documento."));
  const updated = data as Documento;
  return (await getDocumentoById(updated.id)) ?? updated;
}

export async function getDocumentoHistory(id: string): Promise<DocumentAuditRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("obtener_historial_documento", {
    p_documento_id: id,
  });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo cargar el historial del documento."));
  return (data ?? []) as DocumentAuditRecord[];
}

function buildMockDashboard(filters: DashboardFilters = {}): DashboardResumen {
  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const filteredDocuments = mockDocumentos.filter((item) =>
    (!filters.anio || item.anio === filters.anio)
    && (!filters.mes || item.mes === filters.mes),
  );
  const ingresos = filteredDocuments.filter((item) => item.tipo_movimiento?.nombre === "Ingreso").reduce((sum, item) => sum + item.monto, 0);
  const egresos = filteredDocuments.filter((item) => item.tipo_movimiento?.nombre === "Egreso").reduce((sum, item) => sum + item.monto, 0);
  const group = (selector: (item: Documento) => string) =>
    Array.from(filteredDocuments.reduce((map, item) => {
      const name = selector(item);
      map.set(name, (map.get(name) ?? 0) + 1);
      return map;
    }, new Map<string, number>()), ([name, value]) => ({ name, value }));
  return {
    totalDocumentos: filteredDocuments.length,
    totalIngresos: ingresos,
    totalEgresos: egresos,
    balanceGeneral: ingresos - egresos,
    sinArchivo: filteredDocuments.filter((item) => !item.archivo_path).length,
    sinArchivador: filteredDocuments.filter((item) => !item.archivador_id).length,
    sinRutaHistorica: filteredDocuments.filter((item) => !item.ruta_historica).length,
    porCategoria: group((item) => item.categoria?.nombre ?? "Sin categoría"),
    porEstado: group((item) => item.estado?.nombre ?? "Sin estado"),
    balanceMensual: monthNames.map((month, index) => {
      const rows = filteredDocuments.filter((item) => item.mes === index + 1);
      const monthIncome = rows.filter((item) => item.tipo_movimiento?.nombre === "Ingreso").reduce((sum, item) => sum + item.monto, 0);
      const monthExpense = rows.filter((item) => item.tipo_movimiento?.nombre === "Egreso").reduce((sum, item) => sum + item.monto, 0);
      return { month, ingresos: monthIncome, egresos: monthExpense, balance: monthIncome - monthExpense };
    }).filter((_, index) => !filters.mes || index + 1 === filters.mes),
    aniosDisponibles: Array.from(new Set(mockDocumentos.map((item) => item.anio))).sort((left, right) => right - left),
  };
}
