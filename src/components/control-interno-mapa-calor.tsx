import { Clock, Download, Info } from "lucide-react";
import { Alert, Button, Card, EmptyState, Skeleton } from "./ui";
import { HORARIO_FIN, HORARIO_INICIO, descargarResumenPng, dentroDeHorario, duracion, etiquetaCorta, etiquetaHora, rangoHora, type ResumenSubidas } from "../lib/resumen-subidas";

// Subidas por hora del día. Cuenta SOLO lo que la persona subió (documentos que siguen activos y
// anexos agregados); editar o eliminar no cuenta. Los datos los carga el reporte diario.
export function ControlInternoMapaCalor({ resumen, loading, desde, hasta }: { resumen: ResumenSubidas; loading: boolean; desde: string; hasta: string }) {
  const { personas, equipo, horasVisibles, fueraDeHorario } = resumen;

  return (
    <Card className="min-w-0 overflow-hidden">
      <div className="border-b border-slate-200 p-5 dark:border-slate-800">
        <h2 className="font-bold">¿A qué hora subieron documentos?</h2>
        <p className="text-sm text-slate-500">Solo cuenta lo que se subió. Horario laboral: {etiquetaHora(HORARIO_INICIO)} a {etiquetaHora(HORARIO_FIN)} (hora de Lima).</p>
      </div>

      {loading ? (
        <div className="space-y-2 p-4">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-10" />)}</div>
      ) : !personas.length ? (
        <div className="p-3 sm:p-4"><EmptyState icon={<Clock />} title="Sin actividad en este rango" description="No hay subidas ni conexiones entre esas fechas." /></div>
      ) : (
        <>
          <div className="grid gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
              <p className="text-xs text-slate-500">Hora en que más se subió (equipo)</p>
              <p className="mt-1 text-lg font-black">{equipo.horaPico === null ? "—" : rangoHora(equipo.horaPico)}</p>
              <p className="text-xs text-slate-500">{equipo.maximo} {equipo.maximo === 1 ? "subida" : "subidas"} en esa hora</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
              <p className="text-xs text-slate-500">Subidas dentro del horario</p>
              <p className="mt-1 text-lg font-black text-teal-700 dark:text-teal-400">{equipo.dentro} <span className="text-sm font-semibold text-slate-500">de {equipo.total}</span></p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
              <p className="text-xs text-slate-500">Subidas fuera del horario</p>
              <p className="mt-1 text-lg font-black text-orange-600 dark:text-orange-400">{equipo.fuera} <span className="text-sm font-semibold text-slate-500">({equipo.total ? Math.round((equipo.fuera / equipo.total) * 100) : 0}%)</span></p>
            </div>
          </div>

          <div className="border-b border-slate-200 p-4 dark:border-slate-800">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">Subidas por hora del día (todo el equipo)</p>
              <Button variant="secondary" onClick={() => descargarResumenPng(resumen, desde === hasta ? `Fecha: ${desde}` : `Del ${desde} al ${hasta}`)}>
                <Download className="size-4" />Descargar imagen (WhatsApp)
              </Button>
            </div>
            <div className="table-scroll" tabIndex={0}>
              <div className="flex h-44 min-w-[34rem] items-end gap-1">
                {horasVisibles.map((hora) => {
                  const valor = equipo.porHora[hora];
                  const dentro = dentroDeHorario(hora);
                  return (
                    <div key={hora} className="flex h-full min-w-0 flex-1 flex-col justify-end text-center" title={`${rangoHora(hora)}: ${valor} ${valor === 1 ? "subida" : "subidas"}${dentro ? "" : " (fuera de horario)"}`}>
                      <span className="text-xs font-bold">{valor > 0 ? valor : ""}</span>
                      <div className={`rounded-t ${dentro ? "bg-teal-600" : "bg-orange-500"}`} style={{ height: `${equipo.maximo ? (valor / equipo.maximo) * 100 : 0}%`, minHeight: valor > 0 ? 4 : 0 }} />
                      <span className={`mt-1 whitespace-nowrap text-xs ${dentro ? "text-slate-500" : "font-semibold text-orange-600 dark:text-orange-400"}`}>{etiquetaCorta(hora)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="mt-2 text-center text-xs text-slate-500">Hora del día (hora de Lima). Cada barra es una hora; el número encima es la cantidad de subidas.</p>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-teal-600" />Dentro del horario ({etiquetaCorta(HORARIO_INICIO)} a {etiquetaCorta(HORARIO_FIN)})</span>
              <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-orange-500" />Fuera del horario</span>
            </div>
          </div>

          <div className="table-scroll" tabIndex={0}>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-3">Persona</th>
                  <th className="px-4 py-3 text-right">Subidas</th>
                  <th className="px-4 py-3 text-right">Dentro de horario</th>
                  <th className="px-4 py-3 text-right">Fuera de horario</th>
                  <th className="px-4 py-3">Primera subida</th>
                  <th className="px-4 py-3">Última subida</th>
                  <th className="px-4 py-3">Hora en que más subió</th>
                  <th className="px-4 py-3">Tiempo conectado</th>
                  <th className="px-4 py-3">Entró</th>
                  <th className="px-4 py-3">Última conexión</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {personas.map((persona) => (
                  <tr key={persona.id}>
                    <td className="px-4 py-3 font-semibold">{persona.nombre}</td>
                    <td className="px-4 py-3 text-right font-bold">{persona.total}</td>
                    <td className="px-4 py-3 text-right text-teal-700 dark:text-teal-400">{persona.dentro}</td>
                    <td className="px-4 py-3 text-right font-semibold text-orange-600 dark:text-orange-400">{persona.fuera}</td>
                    <td className="px-4 py-3">{persona.masTemprano}</td>
                    <td className="px-4 py-3">{persona.masTarde}</td>
                    <td className="px-4 py-3">{persona.horaPico === null ? "—" : rangoHora(persona.horaPico)}</td>
                    <td className="whitespace-nowrap px-4 py-3">{persona.minutosConectado ? duracion(persona.minutosConectado) : "—"}</td>
                    <td className="px-4 py-3">{persona.entro}</td>
                    <td className="px-4 py-3">{persona.ultimaConexion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800">
            <p className="px-4 pt-4 text-sm font-semibold">Subidas fuera del horario ({fueraDeHorario.length})</p>
            {!fueraDeHorario.length ? (
              <p className="px-4 pb-4 pt-1 text-sm text-slate-500">Nadie subió nada fuera del horario laboral en este rango.</p>
            ) : (
              <div className="table-scroll max-h-96 overflow-y-auto" tabIndex={0}>
                <table className="mt-2 w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                    <tr>
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3">Hora</th>
                      <th className="px-4 py-3">Persona</th>
                      <th className="px-4 py-3">Qué subió</th>
                      <th className="px-4 py-3">Documento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {fueraDeHorario.map((subida, index) => (
                      <tr key={`${subida.usuarioId}-${subida.fecha}-${subida.textoHora}-${index}`}>
                        <td className="whitespace-nowrap px-4 py-3">{subida.fecha}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-orange-600 dark:text-orange-400">{subida.textoHora}</td>
                        <td className="px-4 py-3">{subida.nombre}</td>
                        <td className="px-4 py-3">{subida.tipo === "anexo" ? "Anexo" : "Documento"}</td>
                        <td className="px-4 py-3"><span className="font-mono text-xs text-slate-500">{subida.codigo ?? ""}</span> {subida.titulo ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <div className="border-t border-slate-200 p-4 dark:border-slate-800">
        <Alert variant="info" className="flex items-start gap-2">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>
            Cuenta solo documentos subidos (que siguen activos) y anexos agregados. Editar, eliminar o guardar sin cambios no cuenta, porque no demuestra trabajo nuevo.
            La hora es la del registro en el sistema. Una subida fuera de horario es un dato para revisar, no una prueba por sí sola: puede haber trabajo autorizado
            fuera de hora o tareas pendientes. Los fines de semana y feriados no se distinguen: solo cuenta la hora del día.
          </span>
        </Alert>
      </div>
    </Card>
  );
}
