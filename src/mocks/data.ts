import type {
  AuditEvent,
  DocumentRecord,
  FinancialMovement,
  NotificationItem,
} from "../types";

export const documents: DocumentRecord[] = [
  { id: "1", code: "DOC-2026-001", name: "Resolución de aprobación presupuestal", type: "Resolución", area: "Administración", year: 2026, month: "Enero", extension: "PDF", status: "Verificado", historicalPath: "2026/Administración/Resoluciones", physicalLocation: "Local 1 · E2 · Caja 04 · F12", hasFinancialMovement: true },
  { id: "2", code: "DOC-2026-002", name: "Comprobante de pago a proveedor", type: "Comprobante", area: "Tesorería", year: 2026, month: "Febrero", extension: "PDF", status: "Pendiente", historicalPath: "2026/Tesorería/Comprobantes", physicalLocation: "Local 1 · E1 · Caja 08 · F03", hasFinancialMovement: true },
  { id: "3", code: "DOC-2026-003", name: "Informe de inventario institucional", type: "Informe", area: "Logística", year: 2026, month: "Marzo", extension: "DOCX", status: "Observado", historicalPath: "2026/Logística/Informes", physicalLocation: "Local 2 · E4 · Caja 02 · F08", hasFinancialMovement: false },
  { id: "4", code: "DOC-2025-184", name: "Acta de sesión ordinaria", type: "Acta", area: "Dirección", year: 2025, month: "Diciembre", extension: "PDF", status: "Verificado", historicalPath: "2025/Dirección/Actas", physicalLocation: "Local 1 · E3 · Caja 06 · F21", hasFinancialMovement: false },
  { id: "5", code: "DOC-2026-005", name: "Orden de servicio de mantenimiento", type: "Orden de servicio", area: "Logística", year: 2026, month: "Abril", extension: "XLSX", status: "No encontrado", historicalPath: "2026/Logística/Órdenes", physicalLocation: "Sin ubicación confirmada", hasFinancialMovement: true },
  { id: "6", code: "DOC-2026-006", name: "Conciliación bancaria mensual", type: "Reporte", area: "Contabilidad", year: 2026, month: "Mayo", extension: "PDF", status: "Pendiente", historicalPath: "2026/Contabilidad/Conciliaciones", physicalLocation: "Local 1 · E5 · Caja 01 · F05", hasFinancialMovement: true },
];

export const financialMovements: FinancialMovement[] = [
  { id: "MOV-001", kind: "Ingreso", date: "2026-06-02", amount: 48500, category: "Aportes", party: "Asociados", description: "Aportes ordinarios del mes", document: "DOC-2026-001", status: "Validado", responsible: "María Torres" },
  { id: "MOV-002", kind: "Egreso", date: "2026-06-03", amount: 12750, category: "Servicios", party: "Servicios Generales SAC", description: "Mantenimiento de instalaciones", document: "DOC-2026-005", status: "Pendiente", responsible: "Luis Mendoza" },
  { id: "MOV-003", kind: "Ingreso", date: "2026-06-05", amount: 18200, category: "Recuperaciones", party: "Convenio institucional", description: "Recuperación de crédito", document: "DOC-2026-002", status: "Validado", responsible: "María Torres" },
  { id: "MOV-004", kind: "Egreso", date: "2026-06-07", amount: 8300, category: "Personal", party: "Planilla administrativa", description: "Honorarios del periodo", document: null, status: "Observado", responsible: "Carlos Rojas" },
  { id: "MOV-005", kind: "Egreso", date: "2026-06-09", amount: 4260, category: "Suministros", party: "Distribuidora Central", description: "Útiles y suministros", document: "DOC-2026-003", status: "Validado", responsible: "Luis Mendoza" },
];

export const monthlyFinance = [
  { month: "Ene", ingresos: 92000, egresos: 61000, saldo: 31000 },
  { month: "Feb", ingresos: 104000, egresos: 74000, saldo: 61000 },
  { month: "Mar", ingresos: 98000, egresos: 68500, saldo: 90500 },
  { month: "Abr", ingresos: 116000, egresos: 79000, saldo: 127500 },
  { month: "May", ingresos: 109000, egresos: 81500, saldo: 155000 },
  { month: "Jun", ingresos: 66700, egresos: 25310, saldo: 196390 },
];

export const documentTypeData = [
  { name: "Resoluciones", value: 34 },
  { name: "Comprobantes", value: 28 },
  { name: "Informes", value: 21 },
  { name: "Actas", value: 12 },
  { name: "Otros", value: 18 },
];

export const notifications: NotificationItem[] = [
  { id: "n1", title: "12 documentos pendientes", description: "Requieren verificación físico-digital.", type: "documental", time: "Hace 8 min", unread: true },
  { id: "n2", title: "Gasto sin sustento", description: "MOV-004 no tiene documento vinculado.", type: "financiero", time: "Hace 35 min", unread: true },
  { id: "n3", title: "Documento observado", description: "DOC-2026-003 necesita corregir metadatos.", type: "documental", time: "Hace 2 h", unread: true },
  { id: "n4", title: "Cambio de permisos", description: "Se actualizó el rol Tesorería.", type: "auditoria", time: "Ayer", unread: false },
];

export const auditEvents: AuditEvent[] = [
  { id: "a1", user: "María Torres", action: "Verificó documento", module: "Documentos", date: "2026-06-11 09:42", eventType: "Documental", previousValue: "Pendiente", newValue: "Verificado", device: "Chrome · Windows 11" },
  { id: "a2", user: "Carlos Rojas", action: "Registró egreso", module: "Finanzas", date: "2026-06-11 08:15", eventType: "Financiero", previousValue: "—", newValue: "MOV-004", device: "Edge · Windows 11" },
  { id: "a3", user: "Administrador", action: "Actualizó permisos", module: "Usuarios", date: "2026-06-10 17:20", eventType: "Seguridad", previousValue: "Consulta", newValue: "Auditor", device: "Chrome · Windows 10" },
  { id: "a4", user: "Luis Mendoza", action: "Editó ubicación física", module: "Archivo físico", date: "2026-06-10 15:06", eventType: "Documental", previousValue: "Caja 03", newValue: "Caja 04", device: "Firefox · Linux" },
];

export const users = [
  { id: "u1", name: "Ana Valdivia", email: "admin@sigdaf.pe", role: "Administrador", status: "Activo", initials: "AV" },
  { id: "u2", name: "María Torres", email: "archivo@sigdaf.pe", role: "Archivo documental", status: "Activo", initials: "MT" },
  { id: "u3", name: "Luis Mendoza", email: "tesoreria@sigdaf.pe", role: "Tesorería", status: "Activo", initials: "LM" },
  { id: "u4", name: "Carlos Rojas", email: "auditoria@sigdaf.pe", role: "Auditor", status: "Inactivo", initials: "CR" },
];

export const catalogs = [
  { name: "Tipos documentales", count: 18, associated: 1248, color: "bg-teal-500" },
  { name: "Áreas", count: 9, associated: 1248, color: "bg-blue-500" },
  { name: "Estados documentales", count: 6, associated: 1248, color: "bg-amber-500" },
  { name: "Categorías financieras", count: 14, associated: 386, color: "bg-emerald-500" },
  { name: "Medios de pago", count: 7, associated: 241, color: "bg-violet-500" },
  { name: "Ubicaciones físicas", count: 42, associated: 1106, color: "bg-orange-500" },
  { name: "Roles", count: 6, associated: 18, color: "bg-slate-500" },
  { name: "Permisos", count: 24, associated: 6, color: "bg-rose-500" },
];

export const historicalTree = [
  {
    name: "ARCHIVO HISTÓRICO",
    children: [
      {
        name: "2026",
        children: [
          {
            name: "ADMINISTRACIÓN",
            children: [
              { name: "RESOLUCIONES", children: [{ name: "Resolución de aprobación presupuestal.pdf", file: true }] },
              { name: "INFORMES", children: [{ name: "Informe de gestión trimestral.docx", file: true }] },
            ],
          },
          {
            name: "TESORERÍA",
            children: [{ name: "COMPROBANTES", children: [{ name: "Comprobante de pago 002.pdf", file: true }] }],
          },
        ],
      },
      { name: "2025", children: [{ name: "DIRECCIÓN", children: [{ name: "ACTAS", children: [{ name: "Acta sesión ordinaria.pdf", file: true }] }] }] },
    ],
  },
];
