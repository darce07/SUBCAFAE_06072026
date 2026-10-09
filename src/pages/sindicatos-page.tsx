import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, CalendarRange, ChevronRight, Info, Scale, UsersRound } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Select, Skeleton } from "../components/ui";
import { ChartFrame } from "../components/chart-frame";
import { getBalanceSindicatos } from "../services/sindicatos.service";
import { formatCurrency, formatDate } from "../lib/utils";
import { chartAxisTick, chartGridStroke, chartTooltipLabelStyle, chartTooltipStyle } from "../lib/chart-theme";
import type { BalanceSindicatos } from "../types";

const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const emptyData: BalanceSindicatos = { sindicatos: [], aniosDisponibles: [] };

function shortName(name: string) {
  return name.length > 16 ? `${name.slice(0, 15)}…` : name;
}

export function SindicatosPage() {
  const navigate = useNavigate();
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [data, setData] = useState<BalanceSindicatos>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void getBalanceSindicatos({ anio: year ? Number(year) : undefined, mes: month ? Number(month) : undefined })
      .then((result) => { if (active) setData(result); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el balance de sindicatos."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [year, month]);

  const totals = useMemo(() => data.sindicatos.reduce(
    (acc, item) => ({ ingresos: acc.ingresos + item.totalIngresos, egresos: acc.egresos + item.totalEgresos }),
    { ingresos: 0, egresos: 0 },
  ), [data.sindicatos]);
  const chartData = useMemo(
    () => data.sindicatos.map((item) => ({ nombre: item.nombre, corto: shortName(item.nombre), ingresos: item.totalIngresos, egresos: item.totalEgresos })),
    [data.sindicatos],
  );
  const hasMovements = totals.ingresos > 0 || totals.egresos > 0;
  const fallbackYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, index) => currentYear - index);
  }, []);
  const availableYears = data.aniosDisponibles.length > 0 ? data.aniosDisponibles : fallbackYears;
  const hasPeriodFilter = Boolean(year || month);

  const metrics = [
    { label: "Sindicatos", value: String(data.sindicatos.length), icon: UsersRound, tone: "text-blue-600 bg-blue-50 dark:bg-blue-950/50 ring-blue-600/10" },
    { label: "Total ingresos", value: formatCurrency(totals.ingresos), icon: ArrowUpRight, tone: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 ring-emerald-600/10" },
    { label: "Total gastado (egresos)", value: formatCurrency(totals.egresos), icon: ArrowDownRight, tone: "text-rose-600 bg-rose-50 dark:bg-rose-950/50 ring-rose-600/10" },
    { label: "Saldo", value: formatCurrency(totals.ingresos - totals.egresos), icon: Scale, tone: "text-teal-600 bg-teal-50 dark:bg-teal-950/50 ring-teal-600/10" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finanzas"
        title="Sindicatos"
        description="Balance de ingresos y gastos por sindicato, calculado desde los documentos registrados."
      />
      {error && <Alert>{error}</Alert>}

      <Alert variant="info" className="flex items-start gap-2">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          Los sindicatos se reconocen solos: es todo documento cuya <strong>Entidad</strong> sea de tipo <strong>Sindicato</strong>.
          Para sumar uno nuevo, regístralo como entidad con ese tipo; no hace falta crear nada aquí.
        </span>
      </Alert>

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 font-bold"><CalendarRange className="size-5 text-teal-700" />Periodo de análisis</div>
            <p className="mt-1 text-sm text-slate-500">Filtra el balance de todos los sindicatos por mes y año.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[180px_150px_auto]">
            <label>
              <span className="mb-1 block text-xs font-semibold text-slate-500">Mes</span>
              <Select className="w-full" value={month} onChange={(event) => setMonth(event.target.value)}>
                <option value="">Todos los meses</option>
                {months.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
              </Select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold text-slate-500">Año</span>
              <Select className="w-full" value={year} onChange={(event) => setYear(event.target.value)}>
                <option value="">Todos los años</option>
                {availableYears.map((value) => <option key={value} value={value}>{value}</option>)}
              </Select>
            </label>
            <Button variant="secondary" className="self-end" disabled={!hasPeriodFilter} onClick={() => { setMonth(""); setYear(""); }}>Limpiar</Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon, tone }, index) => (
          <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
            <Card className="p-3 sm:p-5">
              <div className={`mb-3 grid size-9 place-items-center rounded-2xl ring-1 ring-inset sm:mb-4 sm:size-10 ${tone}`}><Icon className="size-4 sm:size-5" /></div>
              {loading ? <Skeleton className="h-7 w-24" /> : <p className="break-words text-lg font-black sm:text-2xl">{value}</p>}
              <p className="mt-1 text-xs text-slate-500">{label}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      {hasMovements && (
        <Card className="min-w-0 overflow-hidden p-5">
          <h2 className="font-bold">Ingresos y gastos por sindicato</h2>
          <p className="text-sm text-slate-500">Comparativo del periodo seleccionado</p>
          <ChartFrame height={300} className="mt-5">
            {({ width, height }) => (
              <BarChart width={width} height={height} data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridStroke} />
                <XAxis dataKey="corto" tick={chartAxisTick} />
                <YAxis tick={chartAxisTick} tickFormatter={(value) => `${value / 1000}K`} />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.nombre ?? ""}
                  contentStyle={chartTooltipStyle}
                  labelStyle={chartTooltipLabelStyle}
                />
                <Bar dataKey="ingresos" name="Ingresos" fill="#0f766e" radius={[6, 6, 0, 0]} />
                <Bar dataKey="egresos" name="Gastos" fill="#f97316" radius={[6, 6, 0, 0]} />
              </BarChart>
            )}
          </ChartFrame>
        </Card>
      )}

      {loading && !data.sindicatos.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => <Skeleton key={item} className="h-48 rounded-2xl" />)}
        </div>
      ) : !data.sindicatos.length ? (
        <EmptyState
          icon={<UsersRound />}
          title="Aún no hay sindicatos"
          description='Registra una entidad con tipo "Sindicato" (al subir o editar un documento, o desde Catálogos) y aparecerá aquí automáticamente.'
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.sindicatos.map((item, index) => (
            <motion.div key={item.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
              <Card
                className="cursor-pointer p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
                onClick={() => navigate(`/sindicatos/${item.id}`)}
                role="link"
                tabIndex={0}
                onKeyDown={(event) => { if (event.key === "Enter") navigate(`/sindicatos/${item.id}`); }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words font-bold leading-snug">{item.nombre}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.totalDocumentos} {item.totalDocumentos === 1 ? "documento" : "documentos"}
                      {item.ultimaFecha ? ` · último ${formatDate(item.ultimaFecha)}` : ""}
                    </p>
                  </div>
                  <ChevronRight className="mt-1 size-5 shrink-0 text-slate-400" />
                </div>
                <dl className="mt-5 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500">Ingresos</dt>
                    <dd className="mt-1 font-bold text-emerald-600">{formatCurrency(item.totalIngresos)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Gastado</dt>
                    <dd className="mt-1 font-bold text-rose-600">{formatCurrency(item.totalEgresos)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Saldo</dt>
                    <dd className="mt-1 font-black">{formatCurrency(item.balance)}</dd>
                  </div>
                </dl>
                {item.totalIngresos === 0 && item.totalEgresos === 0 && (
                  <Badge tone="slate" className="mt-4">Sin montos registrados</Badge>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
