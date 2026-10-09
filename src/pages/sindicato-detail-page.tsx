import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowDownRight, ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight, FileText, Scale, UsersRound } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Select, Skeleton } from "../components/ui";
import { ChartFrame } from "../components/chart-frame";
import { useDocumentos } from "../hooks/use-documentos";
import { getBalanceSindicato } from "../services/sindicatos.service";
import { formatCurrency, formatDate, getStatusTone } from "../lib/utils";
import { chartAxisTick, chartGridStroke, chartTooltipLabelStyle, chartTooltipStyle } from "../lib/chart-theme";
import type { BalanceSindicato } from "../types";

const PAGE_SIZE = 10;

export function SindicatoDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [year, setYear] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<BalanceSindicato | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const anio = year ? Number(year) : undefined;
  const { documentos, count, loading: loadingDocs, error: docsError } = useDocumentos({
    entidadId: id,
    anio,
    page,
    pageSize: PAGE_SIZE,
    orderBy: "fecha_documento",
    orderDirection: "desc",
  });

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    setError(null);
    void getBalanceSindicato(id, anio)
      .then((result) => { if (active) setData(result); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el sindicato."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, anio]);

  useEffect(() => { setPage(1); }, [year]);

  const fallbackYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, index) => currentYear - index);
  }, []);
  const availableYears = data?.aniosDisponibles.length ? data.aniosDisponibles : fallbackYears;
  const totalPages = Math.max(Math.ceil(count / PAGE_SIZE), 1);
  const hasMovements = Boolean(data && (data.totalIngresos > 0 || data.totalEgresos > 0));

  const metrics = [
    { label: "Documentos", value: String(data?.totalDocumentos ?? 0), icon: FileText, tone: "text-blue-600 bg-blue-50 dark:bg-blue-950/50 ring-blue-600/10" },
    { label: "Ingresos", value: formatCurrency(data?.totalIngresos ?? 0), icon: ArrowUpRight, tone: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 ring-emerald-600/10" },
    { label: "Gastado (egresos)", value: formatCurrency(data?.totalEgresos ?? 0), icon: ArrowDownRight, tone: "text-rose-600 bg-rose-50 dark:bg-rose-950/50 ring-rose-600/10" },
    { label: "Saldo", value: formatCurrency(data?.balance ?? 0), icon: Scale, tone: "text-teal-600 bg-teal-50 dark:bg-teal-950/50 ring-teal-600/10" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sindicatos"
        title={data?.sindicato.nombre ?? "Sindicato"}
        description="Detalle de ingresos, gastos y documentos asociados a este sindicato."
        action={<Button variant="secondary" onClick={() => navigate("/sindicatos")}><ArrowLeft className="size-4" />Volver</Button>}
      />
      {error && <Alert>{error}</Alert>}

      <Card className="p-4 sm:p-5">
        <label className="block max-w-48">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Año</span>
          <Select className="w-full" value={year} onChange={(event) => setYear(event.target.value)}>
            <option value="">Todos los años</option>
            {availableYears.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
        </label>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon, tone }) => (
          <Card key={label} className="p-3 sm:p-5">
            <div className={`mb-3 grid size-9 place-items-center rounded-2xl ring-1 ring-inset sm:mb-4 sm:size-10 ${tone}`}><Icon className="size-4 sm:size-5" /></div>
            {loading ? <Skeleton className="h-7 w-24" /> : <p className="break-words text-lg font-black sm:text-2xl">{value}</p>}
            <p className="mt-1 text-xs text-slate-500">{label}</p>
          </Card>
        ))}
      </div>

      {hasMovements ? (
        <Card className="min-w-0 overflow-hidden p-5">
          <h2 className="font-bold">Ingresos y gastos por mes</h2>
          <p className="text-sm text-slate-500">{year ? `Año ${year}` : "Acumulado de todos los años por mes"}</p>
          <ChartFrame height={288} className="mt-5">
            {({ width, height }) => (
              <BarChart width={width} height={height} data={data?.balanceMensual ?? []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridStroke} />
                <XAxis dataKey="month" tick={chartAxisTick} />
                <YAxis tick={chartAxisTick} tickFormatter={(value) => `${value / 1000}K`} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} />
                <Bar dataKey="ingresos" name="Ingresos" fill="#0f766e" radius={[6, 6, 0, 0]} />
                <Bar dataKey="egresos" name="Gastos" fill="#f97316" radius={[6, 6, 0, 0]} />
              </BarChart>
            )}
          </ChartFrame>
        </Card>
      ) : !loading && (
        <Alert variant="info">
          Este sindicato todavía no tiene montos registrados. El balance se llena cuando sus documentos tengan
          <strong> Ingreso</strong> o <strong>Egreso</strong> como naturaleza y un monto mayor a cero.
        </Alert>
      )}

      <Card className="min-w-0 overflow-hidden">
        <div className="border-b border-slate-200 p-5 dark:border-slate-800">
          <h2 className="font-bold">Documentos del sindicato</h2>
          <p className="text-sm text-slate-500">{count} {count === 1 ? "documento" : "documentos"}{year ? ` en ${year}` : ""}</p>
        </div>
        {docsError && <div className="p-4"><Alert>{docsError}</Alert></div>}
        {loadingDocs && !documentos.length ? (
          <div className="space-y-2 p-4">{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-10" />)}</div>
        ) : !documentos.length ? (
          <div className="p-3 sm:p-4"><EmptyState icon={<UsersRound />} title="Sin documentos" description="Este sindicato no tiene documentos en el periodo seleccionado." /></div>
        ) : (
          <>
            <div className="table-scroll" tabIndex={0}>
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-3">Código</th>
                    <th className="whitespace-nowrap px-4 py-3">Fecha</th>
                    <th className="whitespace-nowrap px-4 py-3">Título</th>
                    <th className="whitespace-nowrap px-4 py-3">Categoría</th>
                    <th className="whitespace-nowrap px-4 py-3">Estado</th>
                    <th className="whitespace-nowrap px-4 py-3">Naturaleza</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {documentos.map((row) => {
                    const movimiento = row.tipo_movimiento?.nombre;
                    return (
                      <tr key={row.id} className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-900/60" onClick={() => navigate(`/documentos/${row.id}`)}>
                        <td className="whitespace-nowrap px-4 py-3 font-bold text-teal-700">{row.codigo_documento}</td>
                        <td className="whitespace-nowrap px-4 py-3">{formatDate(row.fecha_documento)}</td>
                        <td className="max-w-64 truncate px-4 py-3">{row.titulo}</td>
                        <td className="px-4 py-3">{row.categoria?.nombre ?? "—"}</td>
                        <td className="px-4 py-3"><Badge tone={getStatusTone(row.estado?.nombre)}>{row.estado?.nombre ?? "Sin estado"}</Badge></td>
                        <td className="px-4 py-3">{movimiento ?? "—"}</td>
                        <td className={`whitespace-nowrap px-4 py-3 text-right font-black ${movimiento === "Ingreso" ? "text-emerald-600" : movimiento === "Egreso" ? "text-rose-600" : "text-slate-400"}`}>
                          {movimiento === "Ingreso" ? "+ " : movimiento === "Egreso" ? "- " : ""}{formatCurrency(row.monto)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 p-3 text-sm dark:border-slate-800 sm:p-4">
              <p className="text-xs text-slate-500">Página {page} de {totalPages}</p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(current - 1, 1))}><ChevronLeft className="size-4" />Anterior</Button>
                <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(current + 1, totalPages))}>Siguiente<ChevronRight className="size-4" /></Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
