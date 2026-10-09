import { useEffect, useMemo, useState } from "react";
import { CalendarRange, Clock, Download, FilePlus2, FileX2, Info, PenSquare, UsersRound } from "lucide-react";
import { Alert, Button, Card, EmptyState, Input, Select, Skeleton } from "./ui";
import { useControlInterno } from "../hooks/use-control-interno";
import { exportToPdf } from "../lib/export";
import { getReporteActividadDiaria } from "../services/admin.service";
import type { ReporteActividadDiaria } from "../types";

const ZONA = "America/Lima";

function hoyLima() {
  return new Date().toLocaleDateString("en-CA", { timeZone: ZONA });
}

function sumarDias(fecha: string, dias: number) {
  const date = new Date(`${fecha}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + dias);
  return date.toISOString().slice(0, 10);
}

function hora(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: ZONA });
}

function fechaLarga(fecha: string) {
  return new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-PE", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

// Aporte del día: lo que la persona produjo. Eliminar es limpieza y no suma; escanear sí,
// aunque la persona no haya entrado a subir nada.
function totalTrabajado(row: ReporteActividadDiaria) {
  return row.subidos + row.editados + row.anexos + row.escaneados;
}

function duracion(minutos: number) {
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function ControlInternoReporteDiario() {
  const [desde, setDesde] = useState(() => sumarDias(hoyLima(), -6));
  const [hasta, setHasta] = useState(() => hoyLima());
  const [usuarioId, setUsuarioId] = useState("");
  const [rows, setRows] = useState<ReporteActividadDiaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Lista de personas para el filtro: las que tienen alguna actividad registrada.
  const { data: usuarios } = useControlInterno();

  const rangoValido = Boolean(desde && hasta && desde <= hasta);

  useEffect(() => {
    if (!rangoValido) return;
    let active = true;
    void getReporteActividadDiaria(desde, hasta, usuarioId || undefined)
      .then((result) => { if (active) { setRows(result); setError(null); } })
      .catch((loadError) => { if (active) { setRows([]); setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el reporte."); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [desde, hasta, usuarioId, rangoValido]);

  const cambiarRango = (nuevoDesde: string, nuevoHasta: string) => {
    setLoading(true);
    setDesde(nuevoDesde);
    setHasta(nuevoHasta);
  };

  const totales = useMemo(() => ({
    personas: new Set(rows.map((row) => row.usuario_id)).size,
    subidos: rows.reduce((total, row) => total + row.subidos, 0),
    editados: rows.reduce((total, row) => total + row.editados, 0),
    eliminados: rows.reduce((total, row) => total + row.eliminados, 0),
  }), [rows]);

  const periodo = desde === hasta ? fechaLarga(desde) : `${fechaLarga(desde)} al ${fechaLarga(hasta)}`;

  const exportarPdf = () => {
    exportToPdf(
      `Reporte diario de actividad · ${periodo}`,
      ["Fecha", "Usuario", "Entró", "Última conexión", "Tiempo conectado", "Subidos", "Editados", "Eliminados", "Anexos", "Escaneados", "Total", "Última acción"],
      rows.map((row) => [row.fecha, row.usuario_nombre ?? row.usuario_email ?? "Sin perfil", hora(row.primera_conexion), hora(row.ultima_conexion), duracion(row.minutos_conectado), row.subidos, row.editados, row.eliminados, row.anexos, row.escaneados, totalTrabajado(row), hora(row.ultima_accion)]),
      `actividad-diaria-${desde}-a-${hasta}`,
    );
  };

  const exportarCsv = () => {
    const encabezado = ["Fecha", "Usuario", "Correo", "Entró", "Última conexión", "Minutos conectado", "Subidos", "Editados", "Eliminados", "Anexos", "Escaneados", "Total", "Primera acción", "Última acción", "Minutos con acciones"];
    const lineas = rows.map((row) => [row.fecha, row.usuario_nombre ?? "", row.usuario_email ?? "", hora(row.primera_conexion), hora(row.ultima_conexion), row.minutos_conectado, row.subidos, row.editados, row.eliminados, row.anexos, row.escaneados, totalTrabajado(row), hora(row.primera_accion), hora(row.ultima_accion), row.minutos_activos]);
    const csv = [encabezado, ...lineas].map((linea) => linea.map((celda) => `"${String(celda).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([String.fromCharCode(0xfeff) + csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `actividad-diaria-${desde}-a-${hasta}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const atajos = [
    { label: "Hoy", rango: () => [hoyLima(), hoyLima()] as const },
    { label: "Ayer", rango: () => [sumarDias(hoyLima(), -1), sumarDias(hoyLima(), -1)] as const },
    { label: "Últimos 7 días", rango: () => [sumarDias(hoyLima(), -6), hoyLima()] as const },
    { label: "Este mes", rango: () => [`${hoyLima().slice(0, 8)}01`, hoyLima()] as const },
  ];

  const metricas = [
    { label: "Personas activas", value: totales.personas, icon: UsersRound, color: "text-teal-600", bg: "bg-teal-50 dark:bg-teal-950/50" },
    { label: "Documentos subidos", value: totales.subidos, icon: FilePlus2, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/50" },
    { label: "Documentos editados", value: totales.editados, icon: PenSquare, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/50" },
    { label: "Documentos eliminados", value: totales.eliminados, icon: FileX2, color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-950/50" },
  ];

  return (
    <div className="space-y-6">
      {error && <Alert variant="warning">{error}</Alert>}

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-center gap-2 font-bold"><CalendarRange className="size-5 text-teal-700" />Rango del reporte</div>
            <p className="mt-1 text-sm text-slate-500">Actividad de cada persona, día por día (hora de Lima).</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {atajos.map((atajo) => (
              <Button key={atajo.label} size="sm" variant="secondary" onClick={() => { const [d, h] = atajo.rango(); cambiarRango(d, h); }}>{atajo.label}</Button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label>
              <span className="mb-1 block text-xs font-semibold text-slate-500">Desde</span>
              <Input type="date" value={desde} max={hasta} onChange={(event) => cambiarRango(event.target.value, hasta)} />
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold text-slate-500">Hasta</span>
              <Input type="date" value={hasta} min={desde} max={hoyLima()} onChange={(event) => cambiarRango(desde, event.target.value)} />
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold text-slate-500">Persona</span>
              <Select className="w-full" value={usuarioId} onChange={(event) => { setLoading(true); setUsuarioId(event.target.value); }}>
                <option value="">Todas</option>
                {usuarios.map((usuario) => <option key={usuario.usuario_id} value={usuario.usuario_id}>{usuario.usuario_nombre || usuario.usuario_email}</option>)}
              </Select>
            </label>
          </div>
          {!rangoValido && <Alert variant="warning">La fecha "Desde" no puede ser posterior a "Hasta".</Alert>}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {metricas.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="p-3 sm:p-5">
            <div className={`mb-3 grid size-9 place-items-center rounded-2xl ${bg}`}><Icon className={`size-4 sm:size-5 ${color}`} /></div>
            {loading ? <Skeleton className="h-7 w-16" /> : <p className="text-lg font-black sm:text-2xl">{value.toLocaleString("es-PE")}</p>}
            <p className="mt-1 text-xs text-slate-500">{label}</p>
          </Card>
        ))}
      </div>

      <Card className="min-w-0 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold">Actividad por persona y día</h2>
            <p className="text-sm text-slate-500">{periodo}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={!rows.length} onClick={exportarCsv}><Download className="size-4" />Excel (CSV)</Button>
            <Button size="sm" variant="secondary" disabled={!rows.length} onClick={exportarPdf}><Download className="size-4" />PDF</Button>
          </div>
        </div>
        {loading ? (
          <div className="space-y-2 p-4">{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-10" />)}</div>
        ) : !rows.length ? (
          <div className="p-3 sm:p-4"><EmptyState icon={<Clock />} title="Sin actividad en este rango" description="Nadie subió, editó o eliminó documentos entre esas fechas." /></div>
        ) : (
          <div className="table-scroll" tabIndex={0}>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">Fecha</th>
                  <th className="whitespace-nowrap px-4 py-3">Usuario</th>
                  <th className="whitespace-nowrap px-4 py-3">Entró</th>
                  <th className="whitespace-nowrap px-4 py-3">Última conexión</th>
                  <th className="whitespace-nowrap px-4 py-3">Tiempo conectado</th>
                  <th className="px-4 py-3 text-right">Subidos</th>
                  <th className="px-4 py-3 text-right">Editados</th>
                  <th className="px-4 py-3 text-right">Eliminados</th>
                  <th className="px-4 py-3 text-right">Anexos</th>
                  <th className="px-4 py-3 text-right">Escaneados</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="whitespace-nowrap px-4 py-3">Última acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((row) => (
                  <tr key={`${row.fecha}-${row.usuario_id}`}>
                    <td className="whitespace-nowrap px-4 py-3 capitalize">{fechaLarga(row.fecha)}</td>
                    <td className="px-4 py-3 font-semibold">{row.usuario_nombre ?? row.usuario_email ?? "Usuario sin perfil"}</td>
                    <td className="whitespace-nowrap px-4 py-3">{hora(row.primera_conexion)}</td>
                    <td className="whitespace-nowrap px-4 py-3">{hora(row.ultima_conexion)}</td>
                    <td className="whitespace-nowrap px-4 py-3">{row.primera_conexion ? duracion(row.minutos_conectado) : "—"}</td>
                    <td className="px-4 py-3 text-right">{row.subidos}</td>
                    <td className="px-4 py-3 text-right">{row.editados}</td>
                    <td className="px-4 py-3 text-right">{row.eliminados}</td>
                    <td className="px-4 py-3 text-right">{row.anexos}</td>
                    <td className="px-4 py-3 text-right">{row.escaneados}</td>
                    <td className="px-4 py-3 text-right font-bold">{totalTrabajado(row)}</td>
                    <td className="whitespace-nowrap px-4 py-3">{hora(row.ultima_accion)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Alert variant="info" className="flex items-start gap-2">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          <strong>Entró</strong>, <strong>Última conexión</strong> y <strong>Tiempo conectado</strong> salen del registro de conexión: el sistema anota cada pocos minutos
          que la persona lo tiene abierto y activo (pestaña visible y con uso en los últimos 5 minutos), aunque solo consulte. Solo existe desde que se activó
          este registro; los días anteriores muestran "—". Las columnas de acciones (<strong>Subidos, Editados, Eliminados, Anexos</strong>) salen de la auditoría
          y "Subidos" cuenta solo los documentos que siguen activos. <strong>Escaneados</strong> son los documentos que la persona escaneó mientras otra los digitaba (se indica en cada documento con "Escaneado por"), contados el día en que se digitalizaron. <strong>Total</strong> suma lo que la persona produjo: subidos, editados, anexos y escaneados (eliminar no cuenta), así quien solo escanea también refleja su aporte. Se guarda únicamente fecha y hora, nunca el contenido, y cada persona recibe un aviso la primera vez.
        </span>
      </Alert>
    </div>
  );
}
