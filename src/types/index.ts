export type DocumentStatus = "Verificado" | "Pendiente" | "Observado" | "No encontrado";

export interface DocumentRecord {
  id: string;
  code: string;
  name: string;
  type: string;
  area: string;
  year: number;
  month: string;
  extension: string;
  status: DocumentStatus;
  historicalPath: string;
  physicalLocation: string;
  hasFinancialMovement: boolean;
}

export interface CatalogItem {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Entidad extends CatalogItem {
  tipo_entidad_id: string | null;
  tipo_documento: EntityDocumentType | null;
  numero_documento: string | null;
}

export type EntityDocumentType = "DNI" | "CE" | "PASAPORTE" | "RUC" | "OTRO";

export interface CreateEntityCommand {
  tipoEntidadId: string;
  nombre: string;
  tipoDocumento: EntityDocumentType | null;
  numeroDocumento: string | null;
}

export type CatalogTable =
  | "catalogo_categorias"
  | "catalogo_tipo_entidad"
  | "entidades"
  | "catalogo_tipo_categoria"
  | "catalogo_estado_documento"
  | "catalogo_archivadores"
  | "catalogo_tipo_movimiento"
  | "catalogo_tipo_operacion"
  | "catalogo_tipo_anexo";

export interface Documento {
  id: string;
  codigo_documento: string;
  categoria_id: string;
  fecha_documento: string;
  anio: number;
  mes: number;
  dia: number;
  periodo_mes: number | null;
  periodo_anio: number | null;
  tipo_entidad_id: string | null;
  entidad_id: string | null;
  tipo_categoria_id: string | null;
  estado_id: string;
  titulo: string;
  descripcion: string | null;
  ruta_historica: string | null;
  archivador_id: string | null;
  archivo_url: string | null;
  archivo_path: string | null;
  extension: string | null;
  monto: number;
  tipo_movimiento_id: string | null;
  tipo_operacion_id: string | null;
  idempotency_key?: string;
  archivo_hash?: string | null;
  activo?: boolean;
  eliminado_at?: string | null;
  eliminado_por?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
  usuario?: { id: string; nombre_completo: string | null; email: string | null } | null;
  eliminado_por_usuario?: { id: string; nombre_completo: string | null; email: string | null } | null;
  ultima_accion?: {
    tipo: "creado" | "editado" | "eliminado" | "recuperado";
    actorNombre: string | null;
    fecha: string;
  } | null;
  categoria?: CatalogItem | null;
  tipo_entidad?: CatalogItem | null;
  entidad?: Entidad | null;
  tipo_categoria?: CatalogItem | null;
  estado?: CatalogItem | null;
  archivador?: CatalogItem | null;
  tipo_movimiento?: CatalogItem | null;
  tipo_operacion?: CatalogItem | null;
}

export interface DocumentoAnexo {
  id: string;
  documento_id: string;
  tipo_anexo_id: string;
  titulo: string;
  nombre_archivo: string;
  descripcion: string | null;
  archivo_path: string;
  extension: string | null;
  mime_type: string | null;
  size_bytes: number;
  version_actual: number;
  activo: boolean;
  created_by: string;
  updated_by: string | null;
  eliminado_at: string | null;
  eliminado_por: string | null;
  created_at: string;
  updated_at: string;
  tipo_anexo?: CatalogItem | null;
  creador?: {
    id: string;
    email: string | null;
    nombre_completo: string | null;
  } | null;
}

export interface PendingDocumentoAnexo {
  id: string;
  file: File;
  titulo: string;
  tipoAnexoId: string;
  descripcion: string;
}

export interface CreateDocumentoAnexoCommand {
  documentoId: string;
  tipoAnexoId: string;
  titulo: string;
  nombreArchivo: string;
  descripcion: string | null;
  archivoPath: string;
  extension: string | null;
  mimeType: string | null;
  sizeBytes: number;
}

export interface UpdateDocumentoAnexoCommand {
  id: string;
  tipoAnexoId: string;
  titulo: string;
  descripcion: string | null;
  nombreArchivo?: string | null;
  archivoPath?: string | null;
  extension?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
}

export interface DocumentoAnexoVersion {
  id: string;
  anexo_id: string;
  version_numero: number;
  titulo: string;
  tipo_anexo_id: string;
  descripcion: string | null;
  nombre_archivo: string;
  archivo_path: string;
  extension: string | null;
  mime_type: string | null;
  size_bytes: number;
  accion: "CREADO" | "EDITADO" | "REEMPLAZADO" | "ELIMINADO";
  created_by: string | null;
  created_at: string;
}

export interface DocumentCreator {
  id: string;
  nombre_completo: string | null;
  email: string | null;
}

export interface DocumentoFilters {
  search?: string;
  categoriaId?: string;
  estadoId?: string;
  entidadId?: string;
  creadorId?: string;
  anio?: number;
  tipoMovimientoId?: string;
  tipoMovimientoNombre?: "Ingreso" | "Egreso" | "No aplica";
  hasHistoricalPath?: boolean;
  soloEliminados?: boolean;
  orderBy?: "fecha_documento" | "created_at" | "eliminado_at";
  orderDirection?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
}

export interface CreateDocumentoCommand {
  idempotencyKey: string;
  categoriaId: string;
  fechaDocumento: string;
  tipoEntidadId: string | null;
  entidadId: string | null;
  tipoCategoriaId: string | null;
  estadoId: string;
  titulo: string;
  descripcion: string | null;
  rutaHistorica: string | null;
  estructuraHistoricaId: string | null;
  archivadorId: string | null;
  archivoPath: string;
  extension: string | null;
  monto: number;
  tipoMovimientoId: string | null;
  tipoOperacionId: string | null;
  archivoHash?: string | null;
  periodoMes?: number | null;
  periodoAnio?: number | null;
}

export interface DocumentoHashMatch {
  id: string;
  codigo_documento: string;
  titulo: string;
  fecha_documento: string;
  created_at: string;
  creador_nombre: string | null;
}

export interface UpdateDocumentoCommand {
  fechaDocumento: string;
  categoriaId: string;
  tipoEntidadId: string | null;
  entidadId: string | null;
  tipoCategoriaId: string | null;
  estadoId: string;
  titulo: string;
  descripcion: string | null;
  rutaHistorica: string | null;
  archivadorId: string | null;
  archivoPath: string | null;
  extension: string | null;
  monto: number;
  tipoMovimientoId: string | null;
  tipoOperacionId: string | null;
  periodoMes?: number | null;
  periodoAnio?: number | null;
}

export interface DashboardResumen {
  totalDocumentos: number;
  totalIngresos: number;
  totalEgresos: number;
  balanceGeneral: number;
  sinArchivo: number;
  sinArchivador: number;
  sinRutaHistorica: number;
  porCategoria: Array<{ name: string; value: number }>;
  porEstado: Array<{ name: string; value: number }>;
  balanceMensual: Array<{ month: string; ingresos: number; egresos: number; balance: number }>;
  aniosDisponibles: number[];
}

export interface DashboardFilters {
  anio?: number;
  mes?: number;
}

export interface ControlInternoUsuario {
  usuario_id: string;
  usuario_nombre: string | null;
  usuario_email: string | null;
  subidos: number;
  editados: number;
  eliminados: number;
}

export interface ControlInternoFilters {
  anio?: number;
  mes?: number;
}

export interface UserContext {
  id: string;
  email: string | null;
  nombreCompleto: string | null;
  avatarUrl: string | null;
  activo: boolean;
  roles: string[];
  permisos: string[];
}

export interface ChatConversacion {
  id: string;
  admin_id: string;
  usuario_id: string;
  created_at: string;
  admin_nombre?: string | null;
  usuario_nombre?: string | null;
}

export interface ChatMensaje {
  id: string;
  conversacion_id: string;
  autor_id: string;
  contenido: string | null;
  archivo_path: string | null;
  archivo_mime: string | null;
  created_at: string;
}

export interface SoporteTicket {
  id: string;
  usuario_id: string;
  admin_id: string;
  transcripcion: Array<{ autor_id: string; contenido: string | null; archivo_path: string | null; archivo_mime: string | null; created_at: string }>;
  estado: "abierto" | "resuelto";
  created_at: string;
}

export interface AdminUser {
  id: string;
  email: string | null;
  nombre_completo: string | null;
  activo: boolean;
  role_id: string | null;
  role_nombre: string | null;
}

export interface AuditRecord {
  id: number;
  tabla: string;
  registro_id: string | null;
  accion: "INSERT" | "UPDATE" | "DELETE";
  valor_anterior: Record<string, unknown> | null;
  valor_nuevo: Record<string, unknown> | null;
  usuario_id: string | null;
  usuario_nombre: string | null;
  usuario_email: string | null;
  created_at: string;
}

export interface AuditFilters {
  search?: string;
  action?: "INSERT" | "UPDATE" | "DELETE";
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface DocumentAuditRecord extends AuditRecord {
  usuario_nombre: string | null;
  usuario_email: string | null;
}

export interface RolePermissionRow {
  role_id: string;
  role_nombre: string;
  role_descripcion: string | null;
  permission_id: string;
  modulo: string;
  accion: string;
  asignado: boolean;
}

export interface Backup {
  id: string;
  usuario_id: string;
  anio: number;
  categoria_id: string | null;
  archivador_id: string | null;
  estado: "procesando" | "listo" | "error";
  archivo_path: string | null;
  tamano_bytes: number | null;
  total_documentos: number | null;
  total_archivos: number | null;
  archivos_procesados: number;
  error_mensaje: string | null;
  created_at: string;
  completado_at: string | null;
}

export interface HistoricalRecord {
  id: string;
  nivel_1: string | null;
  nivel_2: string | null;
  nivel_3: string | null;
  nivel_4: string | null;
  nivel_5: string | null;
  nivel_6: string | null;
  nivel_7: string | null;
  nombre_archivo: string | null;
  extension: string | null;
  ruta_original: string | null;
  folder_archivador: string | null;
  fecha_importacion: string;
}

export interface AppNotification {
  id: number;
  titulo: string;
  descripcion: string;
  tipo: "documental" | "financiero" | "auditoria" | "seguridad" | "sistema";
  leida_at: string | null;
  created_at: string;
}

export interface CatalogosData {
  categorias: CatalogItem[];
  tiposEntidad: CatalogItem[];
  entidades: Entidad[];
  tiposCategoria: CatalogItem[];
  estadosDocumento: CatalogItem[];
  archivadores: CatalogItem[];
  tiposMovimiento: CatalogItem[];
  tiposOperacion: CatalogItem[];
  tiposAnexo: CatalogItem[];
}

export interface FinancialMovement {
  id: string;
  kind: "Ingreso" | "Egreso";
  date: string;
  amount: number;
  category: string;
  party: string;
  description: string;
  document: string | null;
  status: "Validado" | "Pendiente" | "Observado";
  responsible: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  type: "documental" | "financiero" | "auditoria";
  time: string;
  unread: boolean;
}

export interface AuditEvent {
  id: string;
  user: string;
  action: string;
  module: string;
  date: string;
  eventType: "Documental" | "Financiero" | "Seguridad" | "Configuración";
  previousValue: string;
  newValue: string;
  device: string;
}
