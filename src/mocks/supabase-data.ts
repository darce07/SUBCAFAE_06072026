import type { CatalogItem, CatalogosData, Documento, Entidad } from "../types";

const item = (id: string, nombre: string, descripcion: string | null = null): CatalogItem => ({
  id,
  nombre,
  descripcion,
  activo: true,
});

export const mockCatalogos: CatalogosData = {
  categorias: [
    "Donaciones", "Actas Orden", "Cartas Orden", "Claves de Acceso", "Constancia de Estímulos",
    "Contratos", "Cuentas Bancarias", "Oficios-Carta Orden", "Facturas",
    "Inasistencias, Tardanzas o Permisos", "Oficios", "Pagos", "Planilla Incentivos",
    "Reclamos", "Reglamento Interno", "Caja Chica", "Requisitos", "Resolución",
    "Recibos por Honorarios", "Solicitudes", "SUNARP", "Trámites", "Incentivos",
  ].map((nombre, index) => item(`cat-${index + 1}`, nombre)),
  tiposEntidad: [item("te-1", "Persona natural"), item("te-2", "Persona jurídica"), item("te-3", "Entidad pública")],
  entidades: [
    { ...item("ent-1", "SUBCAFAE"), tipo_entidad_id: "te-2" },
    { ...item("ent-2", "SUNAT"), tipo_entidad_id: "te-3" },
    { ...item("ent-3", "Servicios Generales SAC"), tipo_entidad_id: "te-2" },
    { ...item("ent-4", "María Torres"), tipo_entidad_id: "te-1" },
  ] as Entidad[],
  tiposCategoria: [item("tc-1", "Administrativo"), item("tc-2", "Financiero"), item("tc-3", "Legal"), item("tc-4", "Laboral")],
  estadosDocumento: [item("est-1", "Verificado"), item("est-2", "Pendiente"), item("est-3", "Observado"), item("est-4", "No encontrado")],
  archivadores: [item("arc-1", "Archivador A-01"), item("arc-2", "Archivador T-02"), item("arc-3", "Archivador L-03"), item("arc-4", "Archivo central B")],
  tiposMovimiento: [item("mov-1", "Ingreso"), item("mov-2", "Egreso"), item("mov-3", "No aplica")],
  tiposOperacion: [item("op-1", "Aporte institucional"), item("op-2", "Pago a proveedor"), item("op-3", "Caja chica"), item("op-4", "Recuperación")],
  tiposAnexo: ["Voucher", "Balance", "Informe", "Informe técnico", "Acta", "Evidencia", "Sustento", "Referencia", "Otro"].map((nombre, index) => item(`anx-${index + 1}`, nombre)),
  personalNatural: [],
};

const category = (name: string) => mockCatalogos.categorias.find((value) => value.nombre === name)!;
const state = (name: string) => mockCatalogos.estadosDocumento.find((value) => value.nombre === name)!;
const movement = (name: string) => mockCatalogos.tiposMovimiento.find((value) => value.nombre === name)!;

export const mockDocumentos: Documento[] = [
  {
    id: "1", codigo_documento: "DOC-2026-001", categoria_id: category("Resolución").id,
    fecha_documento: "2026-01-15", anio: 2026, mes: 1, dia: 15, periodo_mes: null, periodo_anio: null, tipo_entidad_id: "te-3",
    entidad_id: "ent-1", tipo_categoria_id: "tc-1", estado_id: state("Verificado").id,
    titulo: "Resolución de aprobación presupuestal", descripcion: "Aprobación del presupuesto institucional.",
    ruta_historica: "2026/Administración/Resoluciones", archivador_id: "arc-1",
    archivo_url: "https://example.com/resolucion.pdf", archivo_path: "documentos/resolucion/2026/01/15/resolucion.pdf",
    extension: "pdf", monto: 0, tipo_movimiento_id: movement("No aplica").id, tipo_operacion_id: null,
  },
  {
    id: "2", codigo_documento: "DOC-2026-002", categoria_id: category("Facturas").id,
    fecha_documento: "2026-02-08", anio: 2026, mes: 2, dia: 8, periodo_mes: null, periodo_anio: null, tipo_entidad_id: "te-2",
    entidad_id: "ent-3", tipo_categoria_id: "tc-2", estado_id: state("Pendiente").id,
    titulo: "Factura por servicios generales", descripcion: "Servicio de mantenimiento de instalaciones.",
    ruta_historica: "2026/Tesorería/Facturas", archivador_id: "arc-2",
    archivo_url: "https://example.com/factura.pdf", archivo_path: "documentos/facturas/2026/02/08/factura.pdf",
    extension: "pdf", monto: 12750, tipo_movimiento_id: movement("Egreso").id, tipo_operacion_id: "op-2",
  },
  {
    id: "3", codigo_documento: "DOC-2026-003", categoria_id: category("Caja Chica").id,
    fecha_documento: "2026-03-19", anio: 2026, mes: 3, dia: 19, periodo_mes: null, periodo_anio: null, tipo_entidad_id: "te-1",
    entidad_id: "ent-4", tipo_categoria_id: "tc-2", estado_id: state("Observado").id,
    titulo: "Rendición de caja chica", descripcion: "Rendición mensual de gastos menores.",
    ruta_historica: null, archivador_id: null, archivo_url: null, archivo_path: null,
    extension: null, monto: 8300, tipo_movimiento_id: movement("Egreso").id, tipo_operacion_id: "op-3",
  },
].map((documento) => ({
  ...documento,
  categoria: mockCatalogos.categorias.find((value) => value.id === documento.categoria_id),
  tipo_entidad: mockCatalogos.tiposEntidad.find((value) => value.id === documento.tipo_entidad_id),
  entidad: mockCatalogos.entidades.find((value) => value.id === documento.entidad_id),
  tipo_categoria: mockCatalogos.tiposCategoria.find((value) => value.id === documento.tipo_categoria_id),
  estado: mockCatalogos.estadosDocumento.find((value) => value.id === documento.estado_id),
  archivador: mockCatalogos.archivadores.find((value) => value.id === documento.archivador_id),
  tipo_movimiento: mockCatalogos.tiposMovimiento.find((value) => value.id === documento.tipo_movimiento_id),
  tipo_operacion: mockCatalogos.tiposOperacion.find((value) => value.id === documento.tipo_operacion_id),
}));
