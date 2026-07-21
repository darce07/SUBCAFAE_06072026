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
  DocumentoHashMatch,
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
      archivo_hash: command.archivoHash ?? null,
      activo: true,
    };
  }

  const { data, error } = await supabase.rpc("registrar_documento_seguro", {
    p_idempotency_key: command.idempotencyKey,
    p_archivo_hash: command.archivoHash ?? null,
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

export async function buscarDocumentosPorHash(archivoHash: string): Promise<DocumentoHashMatch[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("buscar_documentos_por_hash", {
    p_archivo_hash: archivoHash,
  });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo verificar duplicados."));
  return (data as DocumentoHashMatch[]) ?? [];
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
    .eq("activo", !filters.soloEliminados)
    .order(filters.orderBy ?? (filters.soloEliminados ? "eliminado_at" : "fecha_documento"), { ascending: (filters.orderDirection ?? "desc") === "asc" })
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
  const documentos = await enrichDocumentos((data ?? []) as unknown as Documento[]);
  return { data: documentos, count: count ?? 0, page, pageSize };
}

type PerfilBasico = { id: string; nombre_completo: string | null; email: string | null };
type UltimaAccion = { documento_id: string; accion: "creado" | "editado" | "eliminado" | "recuperado"; actor_nombre: string | null; actor_email: string | null; fecha: string };

async function enrichDocumentos(documentos: Documento[]): Promise<Documento[]> {
  if (!supabase || !documentos.length) return documentos;

  const perfilIds = [...new Set(
    documentos.flatMap((d) => [d.created_by, d.eliminado_por]).filter((id): id is string => Boolean(id)),
  )];
  const documentoIds = documentos.map((d) => d.id);

  const [perfilesResult, accionesResult] = await Promise.all([
    perfilIds.length ? supabase.rpc("obtener_perfiles_basico", { p_ids: perfilIds }) : Promise.resolve({ data: [] as PerfilBasico[], error: null }),
    supabase.rpc("obtener_ultima_accion_documentos", { p_ids: documentoIds }),
  ]);

  const perfiles = new Map((perfilesResult.data as PerfilBasico[] ?? []).map((p) => [p.id, p]));
  const acciones = new Map((accionesResult.data as UltimaAccion[] ?? []).map((a) => [a.documento_id, a]));

  return documentos.map((documento) => {
    const accion = acciones.get(documento.id);
    return {
      ...documento,
      usuario: documento.created_by ? perfiles.get(documento.created_by) ?? null : null,
      eliminado_por_usuario: documento.eliminado_por ? perfiles.get(documento.eliminado_por) ?? null : null,
      ultima_accion: accion ? { tipo: accion.accion, actorNombre: accion.actor_nombre ?? accion.actor_email, fecha: accion.fecha } : null,
    };
  });
}

/**
 * Suma el monto de TODOS los documentos que calzan con los filtros, sin el límite
 * de página de getDocumentos. Usa una consulta liviana (solo `monto`) y avanza en
 * bloques de 1000 filas para no traer los joins completos solo para sumar.
 */
export async function getMontoTotal(filters: DocumentoFilters = {}): Promise<number> {
  if (!supabase) {
    return filterMockDocumentos(filters).reduce((sum, documento) => sum + Number(documento.monto || 0), 0);
  }

  const select = filters.tipoMovimientoNombre
    ? "monto, tipo_movimiento:catalogo_tipo_movimiento!inner(nombre)"
    : "monto";
  const term = filters.search ? sanitizeSearchTerm(filters.search) : "";
  const entityIds = term ? await getEntityIdsForDocumentSearch(term) : [];

  const chunkSize = 1000;
  let total = 0;
  let from = 0;
  for (let iterations = 0; iterations < 50; iterations += 1) {
    let query = supabase
      .from("documentos")
      .select(select)
      .eq("activo", true)
      .range(from, from + chunkSize - 1);

    if (term) {
      const searchParts = [
        `codigo_documento.ilike.%${term}%`,
        `titulo.ilike.%${term}%`,
        `descripcion.ilike.%${term}%`,
        `ruta_historica.ilike.%${term}%`,
        ...(entityIds.length ? [`entidad_id.in.(${entityIds.join(",")})`] : []),
      ];
      query = query.or(searchParts.join(","));
    }
    if (filters.categoriaId) query = query.eq("categoria_id", filters.categoriaId);
    if (filters.estadoId) query = query.eq("estado_id", filters.estadoId);
    if (filters.entidadId) query = query.eq("entidad_id", filters.entidadId);
    if (filters.anio) query = query.eq("anio", filters.anio);
    if (filters.tipoMovimientoId) query = query.eq("tipo_movimiento_id", filters.tipoMovimientoId);
    if (filters.tipoMovimientoNombre) query = query.eq("tipo_movimiento.nombre", filters.tipoMovimientoNombre);
    if (filters.hasHistoricalPath) query = query.not("ruta_historica", "is", null).neq("ruta_historica", "");

    const { data, error } = await query;
    if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo calcular el total."));
    const rows = (data ?? []) as unknown as { monto: number }[];
    total += rows.reduce((sum, row) => sum + Number(row.monto || 0), 0);
    if (rows.length < chunkSize) break;
    from += chunkSize;
  }

  return total;
}

interface DocumentoMovimientoLigero {
  id: string;
  codigo_documento: string;
  fecha_documento: string;
  titulo: string;
  monto: number;
  tipo_movimiento_nombre: string | null;
  tipo_operacion_nombre: string | null;
  entidad_nombre: string | null;
  categoria_nombre: string | null;
}

/**
 * Trae TODOS los documentos con movimiento económico ordenados cronológicamente
 * (el saldo del libro contable es acumulativo desde el primer asiento) en una
 * sola llamada a una función SQL, sin los joins completos ni el enriquecimiento
 * de usuario/última acción que el libro contable no usa.
 */
export async function getAllDocumentosMovimientoLigero(
  filters: Omit<DocumentoFilters, "page" | "pageSize" | "orderBy" | "orderDirection"> = {},
): Promise<Documento[]> {
  if (!supabase) {
    return sortDocumentos(filterMockDocumentos(filters), { orderBy: "fecha_documento", orderDirection: "asc" });
  }

  const { data, error } = await supabase.rpc("obtener_documentos_movimiento_ligero", {
    p_categoria_id: filters.categoriaId ?? null,
    p_estado_id: filters.estadoId ?? null,
    p_entidad_id: filters.entidadId ?? null,
    p_anio: filters.anio ?? null,
    p_tipo_movimiento_nombre: filters.tipoMovimientoNombre ?? null,
    p_search: filters.search ? sanitizeSearchTerm(filters.search) : null,
  });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo cargar el libro contable."));

  return ((data ?? []) as DocumentoMovimientoLigero[]).map((row) => ({
    id: row.id,
    codigo_documento: row.codigo_documento,
    fecha_documento: row.fecha_documento,
    titulo: row.titulo,
    monto: row.monto,
    categoria_id: "",
    anio: 0,
    mes: 0,
    dia: 0,
    tipo_entidad_id: null,
    entidad_id: null,
    tipo_categoria_id: null,
    estado_id: "",
    descripcion: null,
    ruta_historica: null,
    archivador_id: null,
    archivo_url: null,
    archivo_path: null,
    extension: null,
    tipo_movimiento_id: null,
    tipo_operacion_id: null,
    categoria: row.categoria_nombre ? { id: "", nombre: row.categoria_nombre } : null,
    entidad: row.entidad_nombre ? { id: "", nombre: row.entidad_nombre } : null,
    tipo_movimiento: row.tipo_movimiento_nombre ? { id: "", nombre: row.tipo_movimiento_nombre } : null,
    tipo_operacion: row.tipo_operacion_nombre ? { id: "", nombre: row.tipo_operacion_nombre } : null,
  }) as unknown as Documento);
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
  if (!data) return null;
  const [documento] = await enrichDocumentos([data as unknown as Documento]);
  return documento;
}

export async function cambiarEstadoDocumento(id: string, estadoId: string): Promise<Documento> {
  if (!supabase) {
    const current = mockDocumentos.find((documento) => documento.id === id);
    if (!current) throw new Error("Documento no encontrado.");
    return { ...current, estado_id: estadoId };
  }
  const { data, error } = await supabase.rpc("cambiar_estado_documento_seguro", {
    p_documento_id: id,
    p_estado_id: estadoId,
  });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo actualizar el estado del documento."));
  const [documento] = await enrichDocumentos([data as unknown as Documento]);
  return documento;
}

export async function deleteDocumento(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc("eliminar_documento_seguro", {
    p_documento_id: id,
  });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo eliminar el documento."));
}

export async function restaurarDocumento(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc("restaurar_documento_seguro", {
    p_documento_id: id,
  });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo restaurar el documento."));
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
  if (filters.soloEliminados) return [];
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
