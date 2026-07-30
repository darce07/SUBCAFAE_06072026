import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Search, ShieldCheck } from "lucide-react";
import { getAuditRecords } from "../services/admin.service";
import type { AuditRecord } from "../types";
import { Alert, Badge, Button, Card, Input, PageHeader, Select, Skeleton } from "../components/ui";
import { useDebounce } from "../hooks/use-debounce";

const moduleLabels: Record<string, string> = {
  documentos: "Gestión documental",
  documento_anexos: "Anexos documentales",
  entidades: "Entidades",
  profiles: "Usuarios",
  user_roles: "Accesos de usuario",
  role_permissions: "Roles y permisos",
};

const actionLabels: Record<string, string> = {
  INSERT: "Creación",
  UPDATE: "Actualización",
  DELETE: "Eliminación",
};

const fieldLabels: Record<string, string> = {
  fecha_documento: "fecha",
  categoria_id: "categoría",
  tipo_entidad_id: "tipo de entidad",
  entidad_id: "entidad",
  tipo_categoria_id: "tipo de categoría",
  estado_id: "estado",
  titulo: "título",
  descripcion: "descripción",
  ruta_historica: "ubicación histórica",
  archivador_id: "archivador",
  archivo_path: "archivo digital",
  extension: "extensión",
  monto: "monto",
  tipo_movimiento_id: "movimiento",
  tipo_operacion_id: "operación",
  activo: "estado de disponibilidad",
};

export function AuditPage() {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<"" | AuditRecord["accion"]>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const debouncedSearch = useDebounce(search, 300);
  const totalPages = Math.max(Math.ceil(count / pageSize), 1);

  useEffect(() => {
    let activeRequest = true;
    setLoading(true);
    setError(null);
    void getAuditRecords({
      search: debouncedSearch || undefined,
      action: action || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page,
      pageSize,
    })
      .then((result) => {
        if (!activeRequest) return;
        setRecords(result.data);
        setCount(result.count);
      })
      .catch((loadError) => {
        if (!activeRequest) return;
        setRecords([]);
        setCount(0);
        setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la auditoría.");
      })
      .finally(() => {
        if (activeRequest) setLoading(false);
      });
    return () => { activeRequest = false; };
  }, [action, dateFrom, dateTo, debouncedSearch, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" });
  const resetFilters = () => {
    setSearch("");
    setAction("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Trazabilidad" title="Auditoría" description="Seguimiento paginado de las operaciones relevantes realizadas en el sistema." />
      {error && <Alert>{error}</Alert>}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3">
        <motion.div className="col-span-2 sm:col-span-1" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card className="p-3 transition hover:-translate-y-0.5 hover:shadow-lg sm:p-5"><ShieldCheck className="mb-2 size-5 text-teal-600 sm:mb-3" /><p className="text-lg font-black sm:text-2xl">{count}</p><p className="text-xs text-slate-500">Eventos encontrados</p></Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
          <Card className="p-3 transition hover:-translate-y-0.5 hover:shadow-lg sm:p-5"><p className="text-lg font-black sm:text-2xl">{records.filter((item) => auditDateKey(item.created_at) === today).length}</p><p className="text-xs text-slate-500">Eventos de hoy en esta página</p></Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <Card className="p-3 transition hover:-translate-y-0.5 hover:shadow-lg sm:p-5"><p className="text-lg font-black sm:text-2xl">{records.filter((item) => item.accion === "UPDATE").length}</p><p className="text-xs text-slate-500">Actualizaciones en esta página</p></Card>
        </motion.div>
      </div>
      <Card>
        <div className="border-b border-slate-200 p-3 dark:border-slate-800 sm:p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_170px_170px_140px_auto]">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="pl-9" placeholder="Buscar módulo, usuario o registro..." /></div>
            <Select value={action} onChange={(event) => { setAction(event.target.value as "" | AuditRecord["accion"]); setPage(1); }}>
              <option value="">Todos los estados</option>
              <option value="INSERT">Creación</option>
              <option value="UPDATE">Actualización</option>
              <option value="DELETE">Eliminación</option>
            </Select>
            <label className="relative"><CalendarDays className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} className="pl-9" title="Fecha desde" /></label>
            <label className="relative"><CalendarDays className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} className="pl-9" title="Fecha hasta" /></label>
            <Select value={String(pageSize)} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
              {[10, 20, 50].map((size) => <option key={size} value={size}>{size} por página</option>)}
            </Select>
            <Button variant="secondary" onClick={resetFilters}>Limpiar</Button>
          </div>
        </div>
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="flex items-center gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">No se encontraron eventos para los filtros seleccionados.</div>
        ) : (
          <>
            <div className="responsive-card-list gap-3 p-3 sm:grid-cols-2">
              {records.map((record) => <AuditMobileCard key={record.id} record={record} />)}
            </div>
            <div className="table-scroll responsive-table" tabIndex={0}>
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900"><tr>{["Fecha", "Módulo", "Estado", "Responsable", "Resumen"].map((header) => <th key={header} className="whitespace-nowrap px-4 py-3">{header}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{records.map((record) => <tr key={record.id}><td className="whitespace-nowrap px-4 py-3">{formatAuditDate(record.created_at)}</td><td className="px-4 py-3 font-semibold">{moduleLabels[record.tabla] ?? "Módulo del sistema"}</td><td className="px-4 py-3"><AuditActionBadge record={record} /></td><td className="px-4 py-3"><Responsible record={record} /></td><td className="max-w-96 px-4 py-3 text-xs text-slate-500">{summarizeChange(record)}</td></tr>)}</tbody>
              </table>
            </div>
          </>
        )}
        <div className="flex flex-col gap-3 border-t border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <span>Página {page} de {totalPages} · {count} eventos</span>
          <div className="flex gap-2"><Button variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(value - 1, 1))}>Anterior</Button><Button variant="secondary" disabled={page >= totalPages || loading} onClick={() => setPage((value) => Math.min(value + 1, totalPages))}>Siguiente</Button></div>
        </div>
      </Card>
    </div>
  );
}

function AuditMobileCard({ record }: { record: AuditRecord }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{formatAuditDate(record.created_at)}</p><h2 className="mt-1 font-semibold">{moduleLabels[record.tabla] ?? "Módulo del sistema"}</h2></div><AuditActionBadge record={record} /></div>
      <p className="mt-3 text-sm text-slate-500">{summarizeChange(record)}</p>
      <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800"><Responsible record={record} /></div>
    </article>
  );
}

function AuditActionBadge({ record }: { record: AuditRecord }) {
  return <Badge tone={record.accion === "INSERT" ? "green" : record.accion === "DELETE" ? "red" : "blue"}>{actionLabels[record.accion] ?? "Cambio"}</Badge>;
}

function Responsible({ record }: { record: AuditRecord }) {
  return <div><p className="break-words text-sm font-semibold text-slate-700 dark:text-slate-200">{record.usuario_nombre || (record.usuario_id ? "Usuario sin perfil" : "Proceso del sistema")}</p>{record.usuario_email && <p className="break-all text-xs text-slate-400">{record.usuario_email}</p>}</div>;
}

function summarizeChange(record: AuditRecord) {
  if (record.accion === "INSERT") return "Se registró un nuevo elemento.";
  if (record.accion === "DELETE") return "Se retiró un elemento del sistema.";
  const previous = record.valor_anterior ?? {};
  const next = record.valor_nuevo ?? {};
  const fields = Object.keys(fieldLabels).filter((key) => previous[key] !== next[key]).map((key) => fieldLabels[key]);
  return fields.length > 0 ? `Se modificó: ${fields.join(", ")}.` : "Se actualizaron datos del registro.";
}

function auditDateKey(value: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function formatAuditDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
