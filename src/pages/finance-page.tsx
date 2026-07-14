import { useEffect, useMemo, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, ChevronLeft, ChevronRight, FilePlus2, LoaderCircle, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDocumentos } from "../hooks/use-documentos";
import { useMontoTotal } from "../hooks/use-monto-total";
import { useDebounce } from "../hooks/use-debounce";
import { usePermissions } from "../hooks/use-permissions";
import { formatCurrency, formatDate, getStatusTone } from "../lib/utils";
import { Badge, Button, Card, Input, PageHeader } from "../components/ui";
import type { Documento } from "../types";

const PAGE_SIZE = 20;

export function FinancePage({ kind }: { kind: "Ingreso" | "Egreso" }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search);
  const { canCreate } = usePermissions();
  const { documentos, count, loading, error } = useDocumentos({
    search: debouncedSearch,
    tipoMovimientoNombre: kind,
    page,
    pageSize: PAGE_SIZE,
  });
  // El total general se calcula sobre TODOS los registros que calzan con el filtro,
  // no solo los de la página visible — antes se sumaba `rows` y el monto mostrado
  // quedaba silenciosamente incompleto pasados 50 documentos.
  const { total } = useMontoTotal({ search: debouncedSearch, tipoMovimientoNombre: kind });
  const rows = useMemo(
    () => documentos.filter((documento) => documento.tipo_movimiento?.nombre === kind),
    [documentos, kind],
  );
  const isIncome = kind === "Ingreso";
  const totalPages = Math.max(Math.ceil(count / PAGE_SIZE), 1);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, kind]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gestión financiera"
        title={`${kind}s`}
        description={`Documentos clasificados como ${kind.toLowerCase()} en la gestión financiera.`}
        action={canCreate("documentos") ? <Button onClick={() => navigate("/documentos/nuevo")}><FilePlus2 className="size-4" />Registrar documento</Button> : undefined}
      />
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className={`grid size-12 place-items-center rounded-xl ${isIncome ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
              {isIncome ? <ArrowUpCircle /> : <ArrowDownCircle />}
            </div>
            <div className="min-w-0">
              <p className="break-words text-2xl font-black">{formatCurrency(total)}</p>
              <p className="text-xs text-slate-500">Total general</p>
            </div>
          </div>
        </Card>
        <Card className="p-5"><p className="text-2xl font-black">{count}</p><p className="text-xs text-slate-500">Documentos registrados</p></Card>
        <Card className="p-5"><p className="text-2xl font-black">{rows.filter((row) => row.estado?.nombre === "Observado").length}</p><p className="text-xs text-slate-500">Observados en esta página</p></Card>
      </div>

      <Card>
        <div className="border-b border-slate-200 p-3 dark:border-slate-800 sm:p-4">
          <div className="relative max-w-lg">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder={`Buscar ${kind.toLowerCase()}...`} />
          </div>
        </div>

        {loading ? (
          <div className="grid min-h-56 place-items-center"><LoaderCircle className="size-7 animate-spin text-teal-600" /></div>
        ) : (
          <>
            <div className="responsive-card-list gap-3 p-3 sm:grid-cols-2">
              {rows.map((row) => <FinanceMobileCard key={row.id} row={row} isIncome={isIncome} />)}
            </div>
            <div className="table-scroll responsive-table">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                  <tr>{["Código", "Fecha", "Categoría", "Entidad", "Título", "Operación", "Estado", "Monto"].map((header) => <th key={header} className="whitespace-nowrap px-4 py-3">{header}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-bold text-teal-700">{row.codigo_documento}</td>
                      <td className="whitespace-nowrap px-4 py-3">{formatDate(row.fecha_documento)}</td>
                      <td className="px-4 py-3">{row.categoria?.nombre ?? "—"}</td>
                      <td className="px-4 py-3">{row.entidad?.nombre ?? "—"}</td>
                      <td className="max-w-64 truncate px-4 py-3">{row.titulo}</td>
                      <td className="px-4 py-3">{row.tipo_operacion?.nombre ?? "—"}</td>
                      <td className="px-4 py-3"><Badge tone={getStatusTone(row.estado?.nombre)}>{row.estado?.nombre ?? "Sin estado"}</Badge></td>
                      <td className={`whitespace-nowrap px-4 py-3 text-right font-black ${isIncome ? "text-emerald-600" : "text-rose-600"}`}>{isIncome ? "+" : "-"} {formatCurrency(row.monto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
