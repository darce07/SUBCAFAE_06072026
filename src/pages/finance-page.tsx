import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDownCircle, ArrowUpCircle, ChevronLeft, ChevronRight, FilePlus2, Search, SlidersHorizontal } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useDocumentos } from "../hooks/use-documentos";
import { useMontoTotal } from "../hooks/use-monto-total";
import { useCatalogos } from "../hooks/use-catalogos";
import { useDebounce } from "../hooks/use-debounce";
import { usePermissions } from "../hooks/use-permissions";
import { useColumnVisibility } from "../hooks/use-column-visibility";
import { formatCurrency, formatDate, formatDateTime, getStatusTone } from "../lib/utils";
import { Alert, Badge, Button, Card, EmptyState, Input, PageHeader, Select, Skeleton } from "../components/ui";
import { ColumnsMenu } from "../components/columns-menu";
import { DocumentoPanel } from "../components/documento-panel";
import type { Documento } from "../types";

const FINANCE_COLUMNS = [
  { id: "titulo", label: "Título" },
  { id: "registrado", label: "Subido el" },
  { id: "fecha", label: "Fecha del documento" },
  { id: "categoria", label: "Categoría" },
  { id: "archivador", label: "Archivador" },
  { id: "entidad", label: "Entidad" },
  { id: "operacion", label: "Operación" },
  { id: "estado", label: "Estado" },
];
// Entidad, Operación y Estado siguen disponibles en el menú Columnas, pero no se muestran de inicio
// para que la tabla se lea sin desplazarse.
const FINANCE_DEFAULTS = { entidad: false, operacion: false, estado: false };

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

type Orden = "monto_desc" | "monto_asc" | "fecha_desc";
const ORDENES: Record<Orden, { orderBy: "monto" | "fecha_documento"; orderDirection: "asc" | "desc" }> = {
  monto_desc: { orderBy: "monto", orderDirection: "desc" },
  monto_asc: { orderBy: "monto", orderDirection: "asc" },
  fecha_desc: { orderBy: "fecha_documento", orderDirection: "desc" },
};

// Año o mes que llegan por la dirección (por ejemplo, desde el Panel de control); si no son válidos, vacío.
function numeroDeUrl(valor: string | null, minimo: number, maximo: number) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= minimo && numero <= maximo ? String(numero) : "";
}

const PAGE_SIZE = 20;

export function FinancePage({ kind }: { kind: "Ingreso" | "Egreso" }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [statusId, setStatusId] = useState("");
  const [year, setYear] = useState(() => numeroDeUrl(searchParams.get("anio"), 1900, 2200));
  const [month, setMonth] = useState(() => numeroDeUrl(searchParams.get("mes"), 1, 12));
  // Por defecto, los documentos que más pesan en el total van primero.
  const [orden, setOrden] = useState<Orden>("monto_desc");
  // Documento abierto en el panel lateral (se puede cambiar de uno a otro sin cerrar el panel).
  const [seleccionId, setSeleccionId] = useState<string | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const columnVisibility = useColumnVisibility(`sigdaf:finanzas-${kind.toLowerCase()}-columnas-v2`, FINANCE_DEFAULTS);
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
    mes: month ? Number(month) : undefined,
  };
  const { documentos, count, loading, error, refresh } = useDocumentos({ ...filters, ...ORDENES[orden], page, pageSize: PAGE_SIZE });
  // El total general se calcula sobre TODOS los registros que calzan con el filtro,
  // no solo los de la página visible — antes se sumaba `rows` y el monto mostrado
  // quedaba silenciosamente incompleto pasados 50 documentos.
  const { total, refresh: recargarTotal } = useMontoTotal(filters);
  const rows = useMemo(
    () => documentos.filter((documento) => documento.tipo_movimiento?.nombre === kind),
    [documentos, kind],
  );
  const isIncome = kind === "Ingreso";
  const totalPages = Math.max(Math.ceil(count / PAGE_SIZE), 1);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, kind, categoryId, statusId, year, month, orden]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gestión financiera"
        title={`${kind}s`}
        description={`Documentos clasificados como ${kind.toLowerCase()} en la gestión financiera.`}
        action={canCreate("documentos") ? <Button onClick={() => navigate("/documentos/nuevo")}><FilePlus2 className="size-4" />Registrar documento</Button> : undefined}
      />
      <div className={seleccionId ? "xl:mr-[calc(min(44rem,40vw)+1rem)]" : undefined}>
      <div className="space-y-6">
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
            <Select value={month} onChange={(event) => setMonth(event.target.value)} aria-label="Filtrar por mes"><option value="">Todos los meses</option>{MESES.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</Select>
            <Select value={year} onChange={(event) => setYear(event.target.value)}><option value="">Todos los años</option>{years.map((value) => <option key={value}>{value}</option>)}</Select>
            <Select value={orden} onChange={(event) => setOrden(event.target.value as Orden)} aria-label="Ordenar documentos">
              <option value="monto_desc">Mayor monto primero</option>
              <option value="monto_asc">Menor monto primero</option>
              <option value="fecha_desc">Más recientes primero</option>
            </Select>
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
              {rows.map((row) => <FinanceMobileCard key={row.id} row={row} isIncome={isIncome} onOpen={() => setSeleccionId(row.id)} />)}
            </div>
            <div className="table-scroll responsive-table" tabIndex={0}>
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                  <tr>
                    {columnVisibility.isVisible("titulo") && <th className="whitespace-nowrap px-4 py-3">Documento <span className="font-normal normal-case text-slate-400">(clic para verlo)</span></th>}
                    {columnVisibility.isVisible("registrado") && <th className="whitespace-nowrap px-4 py-3">Subido el</th>}
                    {columnVisibility.isVisible("fecha") && <th className="whitespace-nowrap px-4 py-3">Fecha del documento</th>}
                    <th className="whitespace-nowrap px-4 py-3 text-right">Monto</th>
                    {columnVisibility.isVisible("categoria") && <th className="whitespace-nowrap px-4 py-3">Categoría</th>}
                    {columnVisibility.isVisible("archivador") && <th className="whitespace-nowrap px-4 py-3">Archivador</th>}
                    {columnVisibility.isVisible("entidad") && <th className="whitespace-nowrap px-4 py-3">Entidad</th>}
                    {columnVisibility.isVisible("operacion") && <th className="whitespace-nowrap px-4 py-3">Operación</th>}
                    {columnVisibility.isVisible("estado") && <th className="whitespace-nowrap px-4 py-3">Estado</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map((row) => (
                    <tr key={row.id} className={seleccionId === row.id ? "bg-teal-50 dark:bg-teal-950/30" : undefined} aria-selected={seleccionId === row.id}>
                      {columnVisibility.isVisible("titulo") && (
                        <td className="max-w-80 px-4 py-3">
                          <button type="button" className="block w-full truncate text-left font-semibold text-teal-700 hover:underline dark:text-teal-400" title={`${row.codigo_documento} · ${row.titulo}`} onClick={() => setSeleccionId(row.id)}>{row.titulo}</button>
                        </td>
                      )}
                      {columnVisibility.isVisible("registrado") && <td className="whitespace-nowrap px-4 py-3">{row.created_at ? formatDateTime(row.created_at) : "—"}</td>}
                      {columnVisibility.isVisible("fecha") && <td className="whitespace-nowrap px-4 py-3">{formatDate(row.fecha_documento)}</td>}
                      <td className={`whitespace-nowrap px-4 py-3 text-right font-black ${isIncome ? "text-emerald-600" : "text-rose-600"}`}>{isIncome ? "+" : "-"} {formatCurrency(row.monto)}</td>
                      {columnVisibility.isVisible("categoria") && <td className="px-4 py-3">{row.categoria?.nombre ?? "—"}</td>}
                      {columnVisibility.isVisible("archivador") && <td className="px-4 py-3">{row.archivador?.nombre ?? "Sin archivador"}</td>}
                      {columnVisibility.isVisible("entidad") && <td className="px-4 py-3">{row.entidad?.nombre ?? "—"}</td>}
                      {columnVisibility.isVisible("operacion") && <td className="px-4 py-3">{row.tipo_operacion?.nombre ?? "—"}</td>}
                      {columnVisibility.isVisible("estado") && <td className="px-4 py-3"><Badge tone={getStatusTone(row.estado?.nombre)}>{row.estado?.nombre ?? "Sin estado"}</Badge></td>}
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
      </div>

      {seleccionId && (
        <div className="fixed inset-y-0 right-0 z-40 w-full max-w-xl p-2 xl:inset-y-auto xl:bottom-4 xl:right-4 xl:top-24 xl:w-[min(44rem,40vw)] xl:max-w-none xl:p-0">
          <DocumentoPanel key={seleccionId} id={seleccionId} inicial={documentos.find((item) => item.id === seleccionId) ?? null} onClose={() => setSeleccionId(null)} onCambio={() => { void refresh(); recargarTotal(); }} />
        </div>
      )}
    </div>
  );
}

function FinanceMobileCard({ row, isIncome, onOpen }: { row: Documento; isIncome: boolean; onOpen: () => void }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button type="button" className="text-left" onClick={onOpen}>
            <h2 className="line-clamp-2 text-sm font-semibold text-teal-700 hover:underline dark:text-teal-400">{row.titulo}</h2>
          </button>
        </div>
        <Badge tone={getStatusTone(row.estado?.nombre)}>{row.estado?.nombre ?? "Sin estado"}</Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <span className="text-slate-500">{formatDate(row.fecha_documento)}</span>
        <strong className={`text-right ${isIncome ? "text-emerald-600" : "text-rose-600"}`}>{isIncome ? "+" : "-"} {formatCurrency(row.monto)}</strong>
        <span className="break-words text-slate-500">{row.categoria?.nombre ?? "Sin categoría"}</span>
        <span className="break-words text-right text-slate-500">{row.archivador?.nombre ?? "Sin archivador"}</span>
        <span className="col-span-2 text-slate-500">Subido el {row.created_at ? formatDateTime(row.created_at) : "—"}</span>
        <span className="col-span-2 text-slate-500">Operación: <strong className="text-slate-700 dark:text-slate-200">{row.tipo_operacion?.nombre ?? "No especificada"}</strong></span>
      </div>
    </article>
  );
}
