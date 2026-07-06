import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, ArrowDownRight, ArrowUpRight, Scale } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "../lib/utils";
import { Badge, Card, PageHeader } from "../components/ui";
import { useDashboardResumen } from "../hooks/use-dashboard-resumen";

const colors = ["#0f766e", "#f97316", "#6366f1", "#e11d48", "#0891b2", "#64748b"];

export function BalancePage() {
  const { data, loading, error } = useDashboardResumen();
  const summary = data ?? {
    totalDocumentos: 0,
    totalIngresos: 0,
    totalEgresos: 0,
    balanceGeneral: 0,
    sinArchivo: 0,
    sinArchivador: 0,
    sinRutaHistorica: 0,
    porCategoria: [],
    porEstado: [],
    balanceMensual: [],
    aniosDisponibles: [],
  };
  const categories = summary.porCategoria.map((item, index) => ({ ...item, color: colors[index % colors.length] }));
  let accumulated = 0;
  const balanceLine = summary.balanceMensual.map((item) => ({ ...item, saldo: (accumulated += item.balance) }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Análisis financiero"
        title="Balance económico"
        description="Resumen consolidado de ingresos, egresos y saldo institucional."
      />
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total ingresos", value: summary.totalIngresos, icon: ArrowUpRight, tone: "text-emerald-600 bg-emerald-50" },
          { label: "Total egresos", value: summary.totalEgresos, icon: ArrowDownRight, tone: "text-rose-600 bg-rose-50" },
          { label: "Balance general", value: summary.balanceGeneral, icon: Scale, tone: "text-teal-600 bg-teal-50" },
          { label: "Sin archivo", value: summary.sinArchivo, icon: AlertCircle, tone: "text-amber-600 bg-amber-50", count: true },
        ].map(({ label, value, icon: Icon, tone, count }) => (
          <Card key={label} className="p-5">
            <div className={`mb-4 grid size-10 place-items-center rounded-xl ${tone}`}><Icon className="size-5" /></div>
            <p className="text-2xl font-black">{count ? value : formatCurrency(value)}</p>
            <p className="mt-1 text-xs text-slate-500">{label}</p>
          </Card>
        ))}
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
        <Card className="min-w-0 overflow-hidden p-5">
          <h2 className="font-bold">Ingresos vs egresos</h2>
          <p className="text-sm text-slate-500">{loading ? "Actualizando..." : "Comparativo mensual real"}</p>
          <ChartFrame height={320} className="mt-5">
            {({ width, height }) => (
              <BarChart width={width} height={height} data={summary.balanceMensual}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `${value / 1000}K`} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="ingresos" fill="#0f766e" radius={[6, 6, 0, 0]} />
                <Bar dataKey="egresos" fill="#f97316" radius={[6, 6, 0, 0]} />
              </BarChart>
            )}
          </ChartFrame>
        </Card>

        <Card className="min-w-0 overflow-hidden p-5">
          <h2 className="font-bold">Documentos por categoría</h2>
          <p className="text-sm text-slate-500">Distribución de registros</p>
          <ChartFrame height={256}>
            {({ width, height }) => (
              <PieChart width={width} height={height}>
                <Pie data={categories} dataKey="value" innerRadius={55} outerRadius={88}>
                  {categories.map((item) => <Cell key={item.name} fill={item.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            )}
          </ChartFrame>
          <div className="space-y-2">
            {categories.slice(0, 6).map((item) => (
              <div key={item.name} className="flex items-center text-xs">
                <span className="mr-2 size-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="truncate text-slate-500">{item.name}</span>
                <strong className="ml-auto">{item.value}</strong>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="min-w-0 overflow-hidden p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold">Línea de saldo</h2>
            <p className="text-sm text-slate-500">Evolución acumulada del año actual</p>
          </div>
          <Badge tone={summary.balanceGeneral >= 0 ? "green" : "red"}>
            {summary.balanceGeneral >= 0 ? "Saldo positivo" : "Saldo negativo"}
          </Badge>
        </div>
        <ChartFrame height={288} className="mt-5">
          {({ width, height }) => (
            <LineChart width={width} height={height} data={balanceLine}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `${value / 1000}K`} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Line type="monotone" dataKey="saldo" stroke="#0f766e" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          )}
        </ChartFrame>
      </Card>
    </div>
  );
}

function ChartFrame({
  height,
  className = "",
  children,
}: {
  height: number;
  className?: string;
  children: (size: { width: number; height: number }) => ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setSize({
        width: Math.max(1, Math.floor(rect.width)),
        height: Math.max(1, Math.floor(rect.height || height)),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    window.addEventListener("resize", updateSize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, [height]);

  return (
    <div ref={containerRef} className={`min-w-0 ${className}`} style={{ height, minHeight: height }}>
      {size.width > 1 && size.height > 1 ? children(size) : null}
    </div>
  );
}
