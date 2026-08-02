import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDownCircle, ArrowUpCircle, ChevronLeft, ChevronRight, FilePlus2, Search, SlidersHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDocumentos } from "../hooks/use-documentos";
import { useMontoTotal } from "../hooks/use-monto-total";
import { useCatalogos } from "../hooks/use-catalogos";
import { useDebounce } from "../hooks/use-debounce";
import { usePermissions } from "../hooks/use-permissions";
import { useColumnVisibility } from "../hooks/use-column-visibility";
import { formatCurrency, formatDate, getStatusTone } from "../lib/utils";
import { Alert, Badge, Button, Card, EmptyState, Input, PageHeader, Select, Skeleton } from "../components/ui";
import { ColumnsMenu } from "../components/columns-menu";
import type { Documento } from "../types";

const FINANCE_COLUMNS = [
  { id: "fecha", label: "Fecha" },
  { id: "categoria", label: "Categoría" },
  { id: "entidad", label: "Entidad" },
  { id: "titulo", label: "Título" },
  { id: "operacion", label: "Operación" },
  { id: "estado", label: "Estado" },
];

const PAGE_SIZE = 20;

export function FinancePage({ kind }: { kind: "Ingreso" | "Egreso" }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [statusId, setStatusId] = useState("");
  const [year, setYear] = useState("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const columnVisibility = useColumnVisibility(`sigdaf:finanzas-${kind.toLowerCase()}-columnas`);
  const debouncedSearch = useDebounce(search);
  const { canCreate } = usePermissions();
  const catalogos = useCatalogos({ includeEntidades: false });
  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 15 }, (_, index) => current - index);
  }, []);
  const filters = {
    search: debouncedSearch,
    tipoMovimientoNombre: kind,
    categoriaId: categoryId || undefined,
    estadoId: statusId || undefined,
    anio: year ? Number(year) : undefined,
  };
  const { documentos, count, loading, error } = useDocumentos({ ...filters, page, pageSize: PAGE_SIZE });
  // El total general se calcula sobre TODOS los registros que calzan con el filtro,
  // no solo los de la página visible — antes se sumaba `rows` y el monto mostrado
  // quedaba silenciosamente incompleto pasados 50 documentos.
  const { total } = useMontoTotal(filters);
  const rows = useMemo(
    () => documentos.filter((documento) => documento.tipo_movimiento?.nombre === kind),
    [documentos, kind],
  );
  const isIncome = kind === "Ingreso";
  const totalPages = Math.max(Math.ceil(count / PAGE_SIZE), 1);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, kind, categoryId, statusId, year]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gestión financiera"
        title={`${kind}s`}
        description={`Documentos clasificados como ${kind.toLowerCase()} en la gestión financiera.`}
        action={canCreate("documentos") ? <Button onClick={() => navigate("/documentos/nuevo")}><FilePlus2 className="size-4" />Registrar documento</Button> : undefined}
      />
      {error && <Alert>{error}</Alert>}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3">
        <motion.div className="col-span-2 sm:col-span-1" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card className="p-3 transition hover:-translate-y-0.5 hover:shadow-lg sm:p-5">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className={`grid size-10 shrink-0 place-items-center rounded-2xl ring-1 ring-inset sm:size-12 ${isIncome ? "bg-emerald-50 text-emerald-600 ring-emerald-600/10 dark:bg-emerald-950/50" : "bg-rose-50 text-rose-600 ring-rose-600/10 dark:bg-rose-950/50"}`}>
                {isIncome ? <ArrowUpCircle /> : <ArrowDownCircle />}
              </div>
              <div className="min-w-0">
                <p className="break-words text-lg font-black sm:text-2xl">{formatCurrency(total)}</p>
                <p className="text-xs text-slate-500">Total general</p>
              </div>
            </div>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
          <Card className="p-3 transition hover:-translate-y-0.5 hover:shadow-lg sm:p-5"><p className="text-lg font-black sm:text-2xl">{count}</p><p className="text-xs text-slate-500">Documentos registrados</p></Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <Card className="p-3 transition hover:-translate-y-0.5 hover:shadow-lg sm:p-5"><p className="text-lg font-black sm:text-2xl">{rows.filter((row) => row.estado?.nombre === "Observado").length}</p><p className="text-xs text-slate-500">Observados en esta página</p></Card>
        </motion.div>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3 dark:border-slate-800 sm:p-4">
          <div className="relative w-full min-w-0 sm:w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder={`Buscar ${kind.toLowerCase()}...`} />
          </div>
          <Button type="button" variant="secondary" size="md" className="shrink-0 sm:hidden" onClick={() => setMobileFiltersOpen((value) => !value)} aria-expanded={mobileFiltersOpen}>
            <SlidersHorizontal className="size-4" />Filtros
          </Button>
          <div className={`sm:contents ${mobileFiltersOpen ? "flex flex-wrap gap-2" : "hidden"}`}>
            <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Todas las categorías</option>{catalogos.categorias.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</Select>
            <Select value={statusId} onChange={(event) => setStatusId(event.target.value)}><option value="">Todos los estados</option>{catalogos.estadosDocumento.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</Select>
            <Select value={year} onChange={(event) => setYear(event.target.value)}><option value="">Todos los años</option>{years.map((value) => <option key={value}>{value}</option>)}</Select>
            <ColumnsMenu columns={FINANCE_COLUMNS} isVisible={columnVisibility.isVisible} toggle={columnVisibility.toggle} />
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="flex items-center gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="responsive-card-list gap-3 p-3 sm:grid-cols-2">
              {rows.map((row) => <FinanceMobileCard key={row.id} row={row} isIncome={isIncome} />)}
            </div>
            <div className="table-scroll responsive-table" tabIndex={0}>
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-3">Código</th>
                    {columnVisibility.isVisible("fecha") && <th className="whitespace-nowrap px-4 py-3">Fecha</th>}
                    {columnVisibility.isVisible("categoria") && <th className="whitespace-nowrap px-4 py-3">Categoría</th>}
                    {columnVisibility.isVisible("entidad") && <th className="whitespace-nowrap px-4 py-3">Entidad</th>}
                    {columnVisibility.isVisible("titulo") && <th className="whitespace-nowrap px-4 py-3">Título</th>}
                    {columnVisibility.isVisible("operacion") && <th className="whitespace-nowrap px-4 py-3">Operación</th>}
                    {columnVisibility.isVisible("estado") && <th className="whitespace-nowrap px-4 py-3">Estado</th>}
                    <th className="whitespace-nowrap px-4 py-3">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-bold text-teal-700">{row.codigo_documento}</td>
                      {columnVisibility.isVisible("fecha") && <td className="whitespace-nowrap px-4 py-3">{formatDate(row.fecha_documento)}</td>}
                      {columnVisibility.isVisible("categoria") && <td className="px-4 py-3">{row.categoria?.nombre ?? "—"}</td>}
                      {columnVisibility.isVisible("entidad") && <td className="px-4 py-3">{row.entidad?.nombre ?? "—"}</td>}
                      {columnVisibility.isVisible("titulo") && <td className="max-w-64 truncate px-4 py-3">{row.titulo}</td>}
                      {columnVisibility.isVisible("operacion") && <td className="px-4 py-3">{row.tipo_operacion?.nombre ?? "—"}</td>}
                      {columnVisibility.isVisible("estado") && <td className="px-4 py-3"><Badge tone={getStatusTone(row.estado?.nombre)}>{row.estado?.nombre ?? "Sin estado"}</Badge></td>}
                      <td className={`whitespace-nowrap px-4 py-3 text-right font-black ${isIncome ? "text-emerald-600" : "text-rose-600"}`}>{isIncome ? "+" : "-"} {formatCurrency(row.monto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!rows.length && (
              <div className="p-3 sm:p-4">
                <EmptyState icon={isIncome ? <ArrowUpCircle /> : <ArrowDownCircle />} title={`No se encontraron ${kind.toLowerCase()}s`} description="Ajusta la búsqueda o los filtros para ver otros documentos." />
              </div>
            )}
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 p-3 text-sm dark:border-slate-800 sm:p-4">
              <p className="text-xs text-slate-500">Página {page} de {totalPages} · {count} documentos</p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(current - 1, 1))}>
                  <ChevronLeft className="size-4" />Anterior
                </Button>
                <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(current + 1, totalPages))}>
                  Siguiente<ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function FinanceMobileCard({ row, isIncome }: { row: Documento; isIncome: boolean }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-black text-teal-700 dark:text-teal-400">{row.codigo_documento}</p>
          <h2 className="mt-1 line-clamp-2 text-sm font-semibold text-slate-950 dark:text-white">{row.titulo}</h2>
        </div>
        <Badge tone={getStatusTone(row.estado?.nombre)}>{row.estado?.nombre ?? "Sin estado"}</Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <span className="text-slate-500">{formatDate(row.fecha_documento)}</span>
        <strong className={`text-right ${isIncome ? "text-emerald-600" : "text-rose-600"}`}>{isIncome ? "+" : "-"} {formatCurrency(row.monto)}</strong>
        <span className="break-words text-slate-500">{row.categoria?.nombre ?? "Sin categoría"}</span>
        <span className="break-words text-right text-slate-500">{row.entidad?.nombre ?? "Sin entidad"}</span>
        <span className="col-span-2 text-slate-500">Operación: <strong className="text-slate-700 dark:text-slate-200">{row.tipo_operacion?.nombre ?? "No especificada"}</strong></span>
      </div>
    </article>
  );
}
