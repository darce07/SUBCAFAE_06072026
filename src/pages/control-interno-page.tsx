import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarRange, FilePlus2, FileX2, PenSquare, RotateCcw, Trophy, UserRoundCog } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Select, Skeleton } from "../components/ui";
import { ChartFrame } from "../components/chart-frame";
import { usePermissions } from "../hooks/use-permissions";
import { useControlInterno } from "../hooks/use-control-interno";
import { chartAxisTick, chartGridStroke, chartTooltipLabelStyle, chartTooltipStyle } from "../lib/chart-theme";

const months = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const podiumTone = ["amber", "slate", "orange"] as const;

export function ControlInternoPage() {
  const { isAdmin } = usePermissions();
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const filters = useMemo(() => ({
    anio: year ? Number(year) : undefined,
    mes: month ? Number(month) : undefined,
  }), [month, year]);
  const { data, loading, error } = useControlInterno(filters);
  const hasPeriodFilter = Boolean(year || month);

  const fallbackYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 10 }, (_, index) => currentYear - index);
  }, []);

  const totals = data.reduce(
    (acc, row) => ({
      subidos: acc.subidos + row.subidos,
      editados: acc.editados + row.editados,
      eliminados: acc.eliminados + row.eliminados,
    }),
    { subidos: 0, editados: 0, eliminados: 0 },
  );

  const top3 = [...data]
    .filter((row) => row.subidos > 0)
    .sort((a, b) => b.subidos - a.subidos)
    .slice(0, 3);

  const chartData = [...data]
    .sort((a, b) => (b.subidos + b.editados + b.eliminados) - (a.subidos + a.editados + a.eliminados))
    .slice(0, 10)
    .map((row) => ({
      name: (row.usuario_nombre || row.usuario_email || "Sin nombre").split(" ")[0],
      subidos: row.subidos,
      editados: row.editados,
      eliminados: row.eliminados,
    }));

  if (!isAdmin) {
    return (
      <Card className="p-8 text-center">
        <h1 className="text-xl font-bold">Acceso restringido</h1>
        <p className="mt-2 text-sm text-slate-500">Este módulo es exclusivo para administradores.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Supervisión"
        title="Control interno"
        description="Actividad documental por usuario: quién sube, edita y elimina, con filtro por periodo."
      />
      {error && <Alert variant="warning">{error}</Alert>}

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 font-bold text-slate-950 dark:text-white"><CalendarRange className="size-5 text-teal-700" />Periodo de análisis</div>
            <p className="mt-1 text-sm text-slate-500">Filtra la actividad de los usuarios por mes y año.</p>
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
                {fallbackYears.map((value) => <option key={value} value={value}>{value}</option>)}
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

      {!loading && data.length === 0 ? (
        <EmptyState
          icon={<UserRoundCog />}
          title="No hay actividad registrada para el periodo seleccionado"
          description="Prueba con otro mes o año, o restablece el filtro para ver todos los periodos."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
            {[
              { label: "Documentos subidos", value: totals.subidos, icon: FilePlus2, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/50", ring: "ring-emerald-600/10" },
              { label: "Documentos editados", value: totals.editados, icon: PenSquare, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/50", ring: "ring-blue-600/10" },
              { label: "Documentos eliminados", value: totals.eliminados, icon: FileX2, color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-950/50", ring: "ring-rose-600/10" },
            ].map(({ label, value, icon: Icon, color, bg, ring }, index) => (
              <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
                <Card className="group p-3 transition hover:-translate-y-0.5 hover:shadow-lg sm:p-5">
                  <div className={`grid size-9 place-items-center rounded-2xl ring-1 ring-inset sm:size-11 ${bg} ${color} ${ring}`}><Icon className="size-4 sm:size-5" /></div>
                  <p className="mt-3 text-lg font-black tracking-tight text-slate-950 dark:text-white sm:mt-5 sm:text-2xl">{value.toLocaleString("es-PE")}</p>
                  <p className="mt-1 text-xs text-slate-500 sm:text-sm">{label}</p>
                </Card>
              </motion.div>
            ))}
          </div>

          <Card className="p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2"><Trophy className="size-5 text-amber-500" /><h2 className="font-bold text-slate-950 dark:text-white">Top 3 · más documentos subidos</h2></div>
            {top3.length === 0 ? (
              <p className="text-sm text-slate-500">Nadie ha subido documentos en este periodo.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                {top3.map((row, index) => (
                  <div key={row.usuario_id} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <Badge tone={podiumTone[index]} className="shrink-0 !size-9 !rounded-full !p-0 text-center leading-9">{index + 1}</Badge>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{row.usuario_nombre || row.usuario_email || "Usuario sin perfil"}</p>
                      <p className="text-xs text-slate-500">{row.subidos.toLocaleString("es-PE")} documentos subidos</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="min-w-0 overflow-hidden p-5 sm:p-6">
            <h2 className="font-bold text-slate-950 dark:text-white">Actividad por usuario</h2>
            <p className="text-sm text-slate-500">Comparativo de los usuarios con más actividad en el periodo</p>
            <ChartFrame height={Math.max(chartData.length * 46, 220)} className="mt-5">
              {({ width, height }) => (
                <BarChart width={width} height={height} data={chartData} layout="vertical" barGap={4} margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={chartGridStroke} />
                  <XAxis type="number" allowDecimals={false} tick={chartAxisTick} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={90} tick={chartAxisTick} />
                  <Tooltip contentStyle={chartTooltipStyle} labelStyle={chartTooltipLabelStyle} />
                  <Bar dataKey="subidos" name="Subidos" stackId="a" fill="#10b981" />
                  <Bar dataKey="editados" name="Editados" stackId="a" fill="#2563eb" />
                  <Bar dataKey="eliminados" name="Eliminados" stackId="a" fill="#e11d48" radius={[0, 8, 8, 0]} />
                </BarChart>
              )}
            </ChartFrame>
          </Card>

          <Card>
            <div className="border-b border-slate-200 p-4 font-bold dark:border-slate-800">Detalle por usuario</div>
            {loading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-10 w-full" />)}
              </div>
            ) : (
              <div className="table-scroll responsive-table">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                    <tr>{["Usuario", "Subidos", "Editados", "Eliminados", "Total"].map((header) => <th key={header} className="whitespace-nowrap px-4 py-3">{header}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.map((row) => (
                      <tr key={row.usuario_id}>
                        <td className="px-4 py-3">
                          <p className="font-semibold">{row.usuario_nombre || "Usuario sin perfil"}</p>
                          {row.usuario_email && <p className="text-xs text-slate-400">{row.usuario_email}</p>}
                        </td>
                        <td className="px-4 py-3">{row.subidos.toLocaleString("es-PE")}</td>
                        <td className="px-4 py-3">{row.editados.toLocaleString("es-PE")}</td>
                        <td className="px-4 py-3">{row.eliminados.toLocaleString("es-PE")}</td>
                        <td className="px-4 py-3 font-semibold">{(row.subidos + row.editados + row.eliminados).toLocaleString("es-PE")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
