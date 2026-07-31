import { Download, FileSpreadsheet, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { useLibroContable } from "../hooks/use-libro-contable";
import { useCatalogos } from "../hooks/use-catalogos";
import { useDebounce } from "../hooks/use-debounce";
import { useColumnVisibility } from "../hooks/use-column-visibility";
import { formatCurrency, formatDate, getStatusTone } from "../lib/utils";
import { exportToExcel, exportToPdf } from "../lib/export";
import { Alert, Badge, Button, Card, Input, PageHeader, Select, Skeleton } from "../components/ui";
import { ColumnsMenu } from "../components/columns-menu";
import type { Documento } from "../types";

const ACCOUNTING_COLUMNS = [
  { id: "fecha", label: "Fecha" },
  { id: "documento", label: "Documento" },
  { id: "debe", label: "Debe" },
  { id: "haber", label: "Haber" },
  { id: "saldo", label: "Saldo" },
  { id: "estado", label: "Estado" },
];

export function AccountingBookPage() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [year, setYear] = useState("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const columnVisibility = useColumnVisibility("sigdaf:libro-contable-columnas");
  const debouncedSearch = useDebounce(search);
  const catalogos = useCatalogos({ includeEntidades: false });
  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 15 }, (_, index) => current - index);
  }, []);
  // useLibroContable trae TODOS los asientos (no una página) ordenados cronológicamente
  // ascendente — el saldo corrido es acumulativo y solo es correcto sobre el set completo.
  const { movimientos, loading, error } = useLibroContable({ search: debouncedSearch, categoriaId: categoryId || undefined, anio: year ? Number(year) : undefined });
  const movements = movimientos.filter((item) => item.tipo_movimiento?.nombre === "Ingreso" || item.tipo_movimiento?.nombre === "Egreso");

  const buildExportRows = () => {
    let saldo = 0;
    return movements.map((movement, index) => {
      const income = movement.tipo_movimiento?.nombre === "Ingreso";
      saldo += income ? movement.monto : -movement.monto;
      return [
        `ASI-${String(index + 1).padStart(4, "0")}`,
        formatDate(movement.fecha_documento),
        movement.titulo,
        movement.codigo_documento,
        income ? formatCurrency(movement.monto) : "",
        !income ? formatCurrency(movement.monto) : "",
        formatCurrency(saldo),
        movement.estado?.nombre ?? "Pendiente",
      ];
    });
  };
  const exportHeaders = ["Asiento", "Fecha", "Detalle", "Documento", "Debe", "Haber", "Saldo", "Estado"];

  const onExportExcel = () => {
    exportToExcel(exportHeaders, buildExportRows(), `libro-contable-${new Date().toISOString().slice(0, 10)}`);
  };
  const onExportPdf = () => {
    exportToPdf("Libro contable digital", exportHeaders, buildExportRows(), `libro-contable-${new Date().toISOString().slice(0, 10)}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Contabilidad"
        title="Libro contable digital"
        description="Vista contable derivada de documentos con movimiento económico."
        action={<div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto"><Button variant="secondary" disabled={movements.length === 0} onClick={onExportExcel}><FileSpreadsheet className="size-4" />Excel</Button><Button variant="secondary" disabled={movements.length === 0} onClick={onExportPdf}><Download className="size-4" />PDF</Button></div>}
      />
      {error && <Alert>{error}</Alert>}
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-200 p-3 dark:border-slate-800 sm:p-4 md:flex-row md:items-center">
          <div className="flex gap-2">
            <div className="relative w-full flex-1 md:max-w-lg">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Buscar documento o descripción..." />
            </div>
            <Button type="button" variant="secondary" size="md" className="shrink-0 sm:hidden" onClick={() => setMobileFiltersOpen((value) => !value)} aria-expanded={mobileFiltersOpen}>
              <SlidersHorizontal className="size-4" />Filtros
            </Button>
          </div>
          <div className={`grid-cols-1 gap-2 sm:grid sm:grid-cols-2 md:flex md:flex-wrap ${mobileFiltersOpen ? "grid" : "hidden sm:grid"}`}>
            <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Todas las categorías</option>{catalogos.categorias.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</Select>
            <Select value={year} onChange={(event) => setYear(event.target.value)}><option value="">Todos los años</option>{years.map((value) => <option key={value}>{value}</option>)}</Select>
            <ColumnsMenu columns={ACCOUNTING_COLUMNS} isVisible={columnVisibility.isVisible} toggle={columnVisibility.toggle} />
          </div>
        </div>
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="flex items-center gap-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <AccountingRows movements={movements} isVisible={columnVisibility.isVisible} />
            <p className="border-t border-slate-200 p-3 text-xs text-slate-500 dark:border-slate-800 sm:p-4">{movements.length} asientos · saldo acumulado desde el primer registro</p>
          </>
        )}
      </Card>
    </div>
  );
}

function AccountingRows({ movements, isVisible }: { movements: Documento[]; isVisible: (columnId: string) => boolean }) {
  let mobileBalance = 0;
  let tableBalance = 0;
  return (
    <>
      <div className="responsive-card-list gap-3 p-3 sm:grid-cols-2">
        {movements.map((movement, index) => {
          const income = movement.tipo_movimiento?.nombre === "Ingreso";
          mobileBalance += income ? movement.monto : -movement.monto;
          return (
            <article key={movement.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-400">ASI-{String(index + 1).padStart(4, "0")}</p>
                  <h2 className="mt-1 line-clamp-2 text-sm font-semibold text-slate-950 dark:text-white">{movement.titulo}</h2>
                  <p className="mt-1 break-words text-xs text-slate-500">{movement.codigo_documento}</p>
                </div>
                <Badge tone={getStatusTone(movement.estado?.nombre)}>{movement.estado?.nombre ?? "Pendiente"}</Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <span className="text-slate-500">{formatDate(movement.fecha_documento)}</span>
                <strong className="text-right text-slate-900 dark:text-white">{formatCurrency(mobileBalance)}</strong>
                <span className={income ? "text-emerald-600" : "text-slate-400"}>Debe: {income ? formatCurrency(movement.monto) : "—"}</span>
                <span className={!income ? "text-rose-600" : "text-slate-400"}>Haber: {!income ? formatCurrency(movement.monto) : "—"}</span>
              </div>
            </article>
          );
        })}
      </div>
      <div className="table-scroll responsive-table" tabIndex={0}>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="whitespace-nowrap px-4 py-3">Asiento</th>
              {isVisible("fecha") && <th className="whitespace-nowrap px-4 py-3">Fecha</th>}
              <th className="whitespace-nowrap px-4 py-3">Detalle</th>
              {isVisible("documento") && <th className="whitespace-nowrap px-4 py-3">Documento</th>}
              {isVisible("debe") && <th className="whitespace-nowrap px-4 py-3">Debe</th>}
              {isVisible("haber") && <th className="whitespace-nowrap px-4 py-3">Haber</th>}
              {isVisible("saldo") && <th className="whitespace-nowrap px-4 py-3">Saldo</th>}
              {isVisible("estado") && <th className="whitespace-nowrap px-4 py-3">Estado</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {movements.map((movement, index) => {
              const income = movement.tipo_movimiento?.nombre === "Ingreso";
              tableBalance += income ? movement.monto : -movement.monto;
              return (
                <tr key={movement.id}>
                  <td className="px-4 py-3 font-bold">ASI-{String(index + 1).padStart(4, "0")}</td>
                  {isVisible("fecha") && <td className="whitespace-nowrap px-4 py-3">{formatDate(movement.fecha_documento)}</td>}
                  <td className="min-w-60 px-4 py-3"><strong>{movement.titulo}</strong><p className="text-xs text-slate-500">{movement.categoria?.nombre} · {movement.entidad?.nombre ?? "Sin entidad"}</p></td>
                  {isVisible("documento") && <td className="px-4 py-3">{movement.codigo_documento}</td>}
                  {isVisible("debe") && <td className="px-4 py-3 text-emerald-600">{income ? formatCurrency(movement.monto) : "—"}</td>}
                  {isVisible("haber") && <td className="px-4 py-3 text-rose-600">{!income ? formatCurrency(movement.monto) : "—"}</td>}
                  {isVisible("saldo") && <td className="px-4 py-3 font-bold">{formatCurrency(tableBalance)}</td>}
                  {isVisible("estado") && <td className="px-4 py-3"><Badge tone={getStatusTone(movement.estado?.nombre)}>{movement.estado?.nombre ?? "Pendiente"}</Badge></td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
