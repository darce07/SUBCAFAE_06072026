import { useEffect, useMemo, useState } from "react";
import { Clock, Info } from "lucide-react";
import { Alert, Card, EmptyState, Skeleton } from "./ui";
import { getActividadPorHora } from "../services/admin.service";
import type { ActividadPorHora } from "../types";

// Horario laboral de SUBCAFAE: de 8:00 a 17:00 (hora de Lima). La hora 17 ya queda fuera.
const HORARIO_INICIO = 8;
const HORARIO_FIN = 17;
const HORAS = Array.from({ length: 24 }, (_, hora) => hora);

const dentroDeHorario = (hora: number) => hora >= HORARIO_INICIO && hora < HORARIO_FIN;
const etiquetaHora = (hora: number) => `${String(hora).padStart(2, "0")}:00`;

interface Persona {
  id: string;
  nombre: string;
  porHora: number[];
  total: number;
  dentro: number;
  fuera: number;
  horaPico: number | null;
}

// Mapa de calor de la actividad (subidos + editados + anexos) por hora del día. Las horas
// fuera del horario laboral se marcan en naranja. Se vuelve a montar al cambiar el rango
// (key en el padre), por eso empieza siempre en "cargando".
export function ControlInternoMapaCalor({ desde, hasta, usuarioId }: { desde: string; hasta: string; usuarioId?: string }) {
  const [rows, setRows] = useState<ActividadPorHora[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getActividadPorHora(desde, hasta, usuarioId)
      .then((result) => { if (active) setRows(result); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la actividad por hora."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [desde, hasta, usuarioId]);

  const personas = useMemo<Persona[]>(() => {
    const mapa = new Map<string, Persona>();
    for (const row of rows) {
      const cantidad = row.subidos + row.editados + row.anexos;
      if (cantidad === 0) continue;
      const persona = mapa.get(row.usuario_id) ?? { id: row.usuario_id, nombre: row.usuario_nombre ?? "Usuario sin perfil", porHora: Array.from({ length: 24 }, () => 0), total: 0, dentro: 0, fuera: 0, horaPico: null };
      persona.porHora[row.hora] += cantidad;
      mapa.set(row.usuario_id, persona);
    }
    return [...mapa.values()]
      .map((persona) => {
        const total = persona.porHora.reduce((suma, valor) => suma + valor, 0);
        const dentro = persona.porHora.reduce((suma, valor, hora) => suma + (dentroDeHorario(hora) ? valor : 0), 0);
        const maximo = Math.max(...persona.porHora);
        return { ...persona, total, dentro, fuera: total - dentro, horaPico: maximo > 0 ? persona.porHora.indexOf(maximo) : null };
      })
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  const equipo = useMemo(() => {
    const porHora = HORAS.map((hora) => personas.reduce((suma, persona) => suma + persona.porHora[hora], 0));
    const total = porHora.reduce((suma, valor) => suma + valor, 0);
    const dentro = porHora.reduce((suma, valor, hora) => suma + (dentroDeHorario(hora) ? valor : 0), 0);
    const maximo = Math.max(...porHora);
    return { porHora, total, dentro, fuera: total - dentro, horaPico: maximo > 0 ? porHora.indexOf(maximo) : null, maximo };
  }, [personas]);

  const maximoCelda = Math.max(1, ...personas.flatMap((persona) => persona.porHora));

  const colorCelda = (valor: number, hora: number) => {
    if (valor === 0) return { backgroundColor: dentroDeHorario(hora) ? "transparent" : "rgba(148,163,184,0.10)" };
    const intensidad = 0.2 + 0.8 * (valor / maximoCelda);
    return { backgroundColor: dentroDeHorario(hora) ? `rgba(13,148,136,${intensidad})` : `rgba(249,115,22,${intensidad})`, color: intensidad > 0.55 ? "#fff" : undefined };
  };

  return (
    <Card className="min-w-0 overflow-hidden">
      <div className="border-b border-slate-200 p-5 dark:border-slate-800">
        <h2 className="font-bold">Actividad por hora del día</h2>
        <p className="text-sm text-slate-500">Subidos, editados y anexos según la hora en que se registraron. Horario laboral: {etiquetaHora(HORARIO_INICIO)} a {etiquetaHora(HORARIO_FIN)} (hora de Lima).</p>
      </div>

      {error && <div className="p-4"><Alert variant="warning">{error}</Alert></div>}

      {loading ? (
        <div className="space-y-2 p-4">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-10" />)}</div>
      ) : !personas.length ? (
        <div className="p-3 sm:p-4"><EmptyState icon={<Clock />} title="Sin actividad en este rango" description="No hay documentos subidos, editados ni anexos entre esas fechas." /></div>
      ) : (
        <>
          <div className="grid gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
              <p className="text-xs text-slate-500">Hora de más actividad (equipo)</p>
              <p className="mt-1 text-lg font-black">{equipo.horaPico === null ? "—" : `${etiquetaHora(equipo.horaPico)} – ${etiquetaHora((equipo.horaPico + 1) % 24)}`}</p>
              <p className="text-xs text-slate-500">{equipo.maximo} acciones en esa hora</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
              <p className="text-xs text-slate-500">Dentro del horario laboral</p>
              <p className="mt-1 text-lg font-black text-teal-700 dark:text-teal-400">{equipo.dentro} <span className="text-sm font-semibold text-slate-500">de {equipo.total}</span></p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
              <p className="text-xs text-slate-500">Fuera del horario laboral</p>
              <p className="mt-1 text-lg font-black text-orange-600 dark:text-orange-400">{equipo.fuera} <span className="text-sm font-semibold text-slate-500">({equipo.total ? Math.round((equipo.fuera / equipo.total) * 100) : 0}%)</span></p>
            </div>
          </div>

          <div className="table-scroll p-4" tabIndex={0}>
            <table className="border-separate border-spacing-0.5 text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 min-w-36 bg-white pr-3 text-left font-semibold text-slate-500 dark:bg-slate-900">Persona</th>
                  {HORAS.map((hora) => (
                    <th key={hora} className={`w-8 min-w-8 rounded-md py-1 text-center font-semibold ${dentroDeHorario(hora) ? "bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300" : "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300"}`}>{hora}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {personas.map((persona) => (
                  <tr key={persona.id}>
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-white pr-3 font-semibold dark:bg-slate-900">{persona.nombre}</td>
                    {HORAS.map((hora) => {
                      const valor = persona.porHora[hora];
                      return (
                        <td
                          key={hora}
                          title={`${persona.nombre} · ${etiquetaHora(hora)}: ${valor} ${valor === 1 ? "acción" : "acciones"}${dentroDeHorario(hora) ? "" : " (fuera de horario)"}`}
                          className="h-8 w-8 min-w-8 rounded-md text-center font-bold"
                          style={colorCelda(valor, hora)}
                        >
                          {valor > 0 ? valor : ""}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-teal-600" />Dentro del horario ({HORARIO_INICIO}:00–{HORARIO_FIN}:00)</span>
              <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-orange-500" />Fuera del horario</span>
              <span>Cuanto más oscuro, más acciones en esa hora.</span>
            </div>
          </div>

          <div className="table-scroll border-t border-slate-200 dark:border-slate-800" tabIndex={0}>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-3">Persona</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Dentro de horario</th>
                  <th className="px-4 py-3 text-right">Fuera de horario</th>
                  <th className="px-4 py-3 text-right">% fuera</th>
                  <th className="px-4 py-3">Hora de más actividad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {personas.map((persona) => {
                  const porcentaje = persona.total ? Math.round((persona.fuera / persona.total) * 100) : 0;
                  return (
                    <tr key={persona.id}>
                      <td className="px-4 py-3 font-semibold">{persona.nombre}</td>
                      <td className="px-4 py-3 text-right font-bold">{persona.total}</td>
                      <td className="px-4 py-3 text-right text-teal-700 dark:text-teal-400">{persona.dentro}</td>
                      <td className="px-4 py-3 text-right font-semibold text-orange-600 dark:text-orange-400">{persona.fuera}</td>
                      <td className="px-4 py-3 text-right">{porcentaje}%</td>
                      <td className="px-4 py-3">{persona.horaPico === null ? "—" : `${etiquetaHora(persona.horaPico)} – ${etiquetaHora((persona.horaPico + 1) % 24)}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="border-t border-slate-200 p-4 dark:border-slate-800">
        <Alert variant="info" className="flex items-start gap-2">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>
            Cuenta documentos subidos (que siguen activos), editados y anexos; no cuenta eliminaciones. La hora es la del registro en el sistema. Una acción fuera de horario
            es un dato para revisar, no una prueba por sí sola: puede haber trabajo autorizado fuera de hora, trabajo remoto o tareas pendientes. Los fines de semana
            y feriados no se distinguen: solo cuenta la hora del día.
          </span>
        </Alert>
      </div>
    </Card>
  );
}
