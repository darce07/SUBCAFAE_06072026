import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { ChartColumn } from "lucide-react";
import { Alert, Card, EmptyState, Skeleton } from "./ui";
import { ChartFrame } from "./chart-frame";
import { getBalanceSindicatosMensual } from "../services/sindicatos.service";
import { formatCurrency } from "../lib/utils";
import { chartAxisTick, chartGridStroke, chartTooltipLabelStyle, chartTooltipStyle } from "../lib/chart-theme";
import type { BalanceSindicatosMensual } from "../types";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const COLOR_INGRESOS = "#2563eb";

// Tonos de naranja, del más intenso al más claro, para distinguir a cada sindicato dentro de la pila.
function colorSindicato(indice: number, total: number) {
  const paso = total > 1 ? indice / (total - 1) : 0;
  return `hsl(${24 + paso * 14}, ${92 - paso * 8}%, ${40 + paso * 32}%)`;
}

type Fila = { mes: string; mesNumero: number; ingresos: number; egresosGenerales: number; gastoSindicatos: number } & Record<string, number | string>;

// Gasto mensual por sindicato (pila naranja, un tramo por sindicato) junto al ingreso del mes. El saldo
// del mes (ingresos menos todos los egresos) se ve en el indicador al pasar el mouse.
export function SindicatosGraficoMensual({ anio }: { anio: number }) {
  const [data, setData] = useState<BalanceSindicatosMensual | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getBalanceSindicatosMensual(anio)
      .then((result) => { if (active) { setData(result); setError(null); } })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el gráfico mensual."); });
    return () => { active = false; };
  }, [anio]);

  // Mientras llega el año nuevo se sigue mostrando el anterior; solo se usa si coincide.
  const vigente = data && data.anio === anio ? data : null;

  const sindicatos = useMemo(() => {
    const nombres = new Map<string, string>();
    for (const mes of vigente?.meses ?? []) for (const item of mes.sindicatos) nombres.set(item.id, item.nombre);
    return [...nombres.entries()].map(([id, nombre], indice, lista) => ({ id, nombre, clave: `s${indice}`, color: colorSindicato(indice, lista.length) }));
  }, [vigente]);

  const filas = useMemo<Fila[]>(() => (vigente?.meses ?? []).map((mes) => {
    const fila: Fila = { mes: MESES[mes.mes - 1], mesNumero: mes.mes, ingresos: mes.ingresos, egresosGenerales: mes.egresos, gastoSindicatos: 0 };
    for (const sindicato of sindicatos) {
      const monto = mes.sindicatos.find((item) => item.id === sindicato.id)?.egresos ?? 0;
      fila[sindicato.clave] = monto;
      fila.gastoSindicatos += monto;
    }
    return fila;
  }), [vigente, sindicatos]);

  const hayDatos = filas.some((fila) => fila.gastoSindicatos > 0 || fila.ingresos > 0);

  const indicador = ({ active, payload }: TooltipContentProps) => {
    if (!active || !payload?.length) return null;
    const fila = payload[0].payload as Fila;
    const saldo = fila.ingresos - fila.egresosGenerales;
    return (
      <div className="min-w-56 rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900" style={chartTooltipStyle}>
        <p className="mb-2 font-bold" style={chartTooltipLabelStyle}>{MESES[fila.mesNumero - 1]} {anio}</p>
        <p className="mb-1 font-semibold text-orange-600">Dado a los sindicatos: {formatCurrency(fila.gastoSindicatos)}</p>
        <ul className="mb-2 space-y-0.5">
          {sindicatos.filter((sindicato) => Number(fila[sindicato.clave]) > 0).map((sindicato) => (
            <li key={sindicato.id} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ backgroundColor: sindicato.color }} />{sindicato.nombre}</span>
              <span className="font-semibold">{formatCurrency(Number(fila[sindicato.clave]))}</span>
            </li>
          ))}
          {fila.gastoSindicatos === 0 && <li className="text-slate-500">Sin gasto en sindicatos</li>}
        </ul>
        <div className="space-y-0.5 border-t border-slate-200 pt-2 dark:border-slate-700">
          <p className="flex justify-between gap-3"><span style={{ color: COLOR_INGRESOS }} className="font-semibold">Ingresos del mes</span><span className="font-semibold">{formatCurrency(fila.ingresos)}</span></p>
          <p className="flex justify-between gap-3"><span className="text-slate-500">Egresos del mes (todos)</span><span>{formatCurrency(fila.egresosGenerales)}</span></p>
          <p className="flex justify-between gap-3 font-bold"><span>Saldo del mes</span><span className={saldo < 0 ? "text-rose-600" : "text-emerald-600"}>{formatCurrency(saldo)}</span></p>
        </div>
      </div>
    );
  };

  return (
    <Card className="min-w-0 overflow-hidden p-5">
      <h2 className="font-bold">Gasto mensual por sindicato e ingreso del mes</h2>
      <p className="text-sm text-slate-500">Año {anio}. En naranja, lo dado a cada sindicato apilado; en azul, el ingreso del mes. Pasa el mouse sobre un mes para ver el detalle y el saldo.</p>

      {error && <div className="mt-4"><Alert variant="warning">{error}</Alert></div>}

      {!vigente ? (
        error ? null : <Skeleton className="mt-5 h-72" />
      ) : !hayDatos ? (
        <div className="mt-4"><EmptyState icon={<ChartColumn />} title="Sin movimientos en este año" description="No hay documentos de ingreso ni gasto en sindicatos durante el año seleccionado." /></div>
      ) : (
        <>
          <ChartFrame height={320} className="mt-5">
            {({ width, height }) => (
              <BarChart width={width} height={height} data={filas} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridStroke} />
                <XAxis dataKey="mes" tick={chartAxisTick} />
                <YAxis tick={chartAxisTick} tickFormatter={(value) => (Number(value) >= 1000 ? `${Number(value) / 1000}K` : String(value))} />
                <Tooltip content={indicador} cursor={{ fill: "rgba(148,163,184,0.12)" }} />
                {sindicatos.map((sindicato, indice) => (
                  <Bar key={sindicato.id} dataKey={sindicato.clave} name={sindicato.nombre} stackId="gasto" fill={sindicato.color} radius={indice === sindicatos.length - 1 ? [4, 4, 0, 0] : 0} />
                ))}
                <Bar dataKey="ingresos" name="Ingresos del mes" stackId="ingreso" fill={COLOR_INGRESOS} radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ChartFrame>
          <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300">
            {sindicatos.map((sindicato) => (
              <li key={sindicato.id} className="flex items-center gap-1.5"><span className="size-3 rounded-sm" style={{ backgroundColor: sindicato.color }} />{sindicato.nombre}</li>
            ))}
            <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm" style={{ backgroundColor: COLOR_INGRESOS }} />Ingresos del mes</li>
          </ul>
        </>
      )}
    </Card>
  );
}
