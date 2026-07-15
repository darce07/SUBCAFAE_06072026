import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArchiveX,
  CalendarRange,
  FileQuestion,
  Files,
  FolderX,
  Landmark,
  RotateCcw,
  Scale,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Alert, Button, Card, EmptyState, PageHeader, Select } from "../components/ui";
import { ChartFrame } from "../components/chart-frame";
import { useDashboardResumen } from "../hooks/use-dashboard-resumen";
import { formatCurrency } from "../lib/utils";
import { chartAxisTick, chartGridStroke, chartTooltipLabelStyle, chartTooltipStyle } from "../lib/chart-theme";

const chartColors = ["#0f766e", "#2563eb", "#7c3aed", "#f97316", "#e11d48", "#64748b", "#0891b2"];
const months = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function DashboardPage() {
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const filters = useMemo(() => ({
    anio: year ? Number(year) : undefined,
    mes: month ? Number(month) : undefined,
  }), [month, year]);
  const { data, loading, error } = useDashboardResumen(filters);
  const summary = data ?? {
    totalDocumentos: 0, totalIngresos: 0, totalEgresos: 0, balanceGeneral: 0,
    sinArchivo: 0, sinArchivador: 0, sinRutaHistorica: 0,
    porCategoria: [], porEstado: [], balanceMensual: [], aniosDisponibles: [],
  };
  const statusData = summary.porEstado.map((item, index) => ({ ...item, color: chartColors[index % chartColors.length] }));
  const fallbackYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 15 }, (_, index) => currentYear - index);
  }, []);
  const availableYears = summary.aniosDisponibles.length > 0 ? summary.aniosDisponibles : fallbackYears;
  const hasPeriodFilter = Boolean(year || month);
  const periodLabel = [
    month ? months[Number(month) - 1] : null,
    year || null,
  ].filter(Boolean).join(" de ");

  const metrics = [
    { label: "Total documentos", value: summary.totalDocumentos.toLocaleString("es-PE"), icon: Files, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/50", ring: "ring-blue-600/10" },
    { label: "Total ingresos", value: formatCurrency(summary.totalIngresos), icon: Landmark, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/50", ring: "ring-emerald-600/10" },
    { label: "Total egresos", value: formatCurrency(summary.totalEgresos), icon: Wallet, color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-950/50", ring: "ring-rose-600/10" },
    { label: "Balance general", value: formatCurrency(summary.balanceGeneral), icon: Scale, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/50", ring: "ring-violet-600/10" },
    { label: "Sin archivo digital", value: String(summary.sinArchivo), icon: FileQuestion, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/50", ring: "ring-red-600/10" },
    { label: "Sin archivador", value: String(summary.sinArchivador), icon: ArchiveX, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/50", ring: "ring-amber-600/10" },
    { label: "Sin ruta histórica", value: String(summary.sinRutaHistorica), icon: FolderX, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/50", ring: "ring-orange-600/10" },
    { label: "Estados configurados", value: String(summary.porEstado.length), icon: AlertTriangle, color: "text-teal-600", bg: "bg-teal-50 dark:bg-teal-950/50", ring: "ring-teal-600/10" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Resumen ejecutivo"
        title="Panel de control"
        description="Indicadores consolidados para el seguimiento documental y financiero."
        action={<div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">{loading ? "Actualizando..." : hasPeriodFilter ? periodLabel : "Todos los periodos"}</div>}
      />
      {error && <Alert variant="warning">{error}</Alert>}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 font-bold text-slate-950 dark:text-white"><CalendarRange className="size-5 text-teal-700" />Periodo de análisis</div>
            <p className="mt-1 text-sm text-slate-500">Filtra todos los indicadores y gráficos por mes y año.</p>
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
            <Button
              variant="secondary"
              className="self-end"
              disabled={!hasPeriodFilter}
              onClick={() => {
                setMonth("");
                setYear("");
              }}
            >
              <RotateCcw className="size-4" />Restablecer
            </Button>
          </div>
        </div>
      </Card>
      {!loading && hasPeriodFilter && summary.totalDocumentos === 0 && (
        <EmptyState
          icon={<CalendarRange />}
          title="No hay información para el periodo seleccionado"
          description="Prueba con otro mes o año, o restablece el filtro para consultar todos los periodos."
        />
      )}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon, color, bg, ring }, index) => (
          <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
            <Card className="group p-3 transition hover:-translate-y-0.5 hover:shadow-lg sm:p-5">
              <div className={`grid size-9 place-items-center rounded-2xl ring-1 ring-inset sm:size-11 ${bg} ${color} ${ring}`}><Icon className="size-4 sm:size-5" /></div>
              <p className="mt-3 break-words text-lg font-black tracking-tight text-slate-950 dark:text-white sm:mt-5 sm:text-2xl">{value}</p>
              <p className="mt-1 text-xs text-slate-500 sm:text-sm">{label}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
        <Card className="min-w-0 overflow-hidden p-5 sm:p-6">
          <h2 className="font-bold text-slate-950 dark:text-white">Balance mensual</h2>
          <p className="text-sm text-slate-500">Ingresos y egresos del periodo consultado</p>
          <ChartFrame height={310} className="mt-5">
            {({ width, height }) => (
              <BarChart width={width} height={height} data={summary.balanceMensual} barGap={6}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridStroke} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={chartAxisTick} />
                <YAxis axisLine={false} tickLine={false} tick={chartAxisTick} tickFormatter={(value) => `${value / 1000}K`} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} />
                <Legend wrapperStyle={{ color: "var(--chart-text)", fontSize: 12 }} />
                <Bar dataKey="ingresos" name="Ingresos" fill="#0f766e" radius={[6, 6, 0, 0]} />
                <Bar dataKey="egresos" name="Egresos" fill="#f97316" radius={[6, 6, 0, 0]} />
              </BarChart>
            )}
          </ChartFrame>
        </Card>
        <Card className="min-w-0 overflow-hidden p-5 sm:p-6">
          <h2 className="font-bold text-slate-950 dark:text-white">Documentos por estado</h2>
          <p className="text-sm text-slate-500">Distribución de los registros consultados</p>
          <ChartFrame height={240}>
            {({ width, height }) => (
              <PieChart width={width} height={height}>
                <Pie data={statusData} dataKey="value" innerRadius={62} outerRadius={92} paddingAngle={3}>
                  {statusData.map((item) => <Cell key={item.name} fill={item.color} />)}
                </Pie>
                <Tooltip contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} />
              </PieChart>
            )}
          </ChartFrame>
          <div className="grid grid-cols-2 gap-3">
            {statusData.map((item) => <div key={item.name} className="flex items-center gap-2 text-xs"><span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} /><span className="truncate text-slate-500">{item.name}</span><strong className="ml-auto">{item.value}</strong></div>)}
          </div>
        </Card>
      </div>

      <Card className="min-w-0 overflow-hidden p-5 sm:p-6">
        <h2 className="font-bold text-slate-950 dark:text-white">Documentos por categoría</h2>
        <p className="mb-4 text-sm text-slate-500">Distribución por clasificación documental</p>
        <ChartFrame height={288}>
          {({ width, height }) => (
            <BarChart width={width} height={height} data={summary.porCategoria.slice(0, 10)} layout="vertical" margin={{ left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={chartGridStroke} />
              <XAxis type="number" allowDecimals={false} tick={chartAxisTick} />
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={140} tick={chartAxisTick} />
              <Tooltip contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} />
              <Bar dataKey="value" name="Documentos" fill="#0d9488" radius={[0, 8, 8, 0]} barSize={18} />
            </BarChart>
          )}
        </ChartFrame>
      </Card>
    </div>
  );
}
