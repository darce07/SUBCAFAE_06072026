import { useEffect, useMemo, useState } from "react";
import { Clock, Info } from "lucide-react";
import { Alert, Card, EmptyState, Skeleton } from "./ui";
import { getSubidasDetalle } from "../services/admin.service";
import type { SubidaDetalle } from "../types";

// Horario laboral de SUBCAFAE: de 8:00 a 17:00 (hora de Lima). La hora 17 ya queda fuera.
const HORARIO_INICIO = 8;
const HORARIO_FIN = 17;
const HORAS = Array.from({ length: 24 }, (_, hora) => hora);

const dentroDeHorario = (hora: number) => hora >= HORARIO_INICIO && hora < HORARIO_FIN;
const etiquetaHora = (hora: number) => `${String(hora).padStart(2, "0")}:00`;
const rangoHora = (hora: number) => `${etiquetaHora(hora)} – ${etiquetaHora((hora + 1) % 24)}`;

const formatoFechaHora = new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

interface Subida {
  usuarioId: string;
  nombre: string;
  tipo: SubidaDetalle["tipo"];
  codigo: string | null;
  titulo: string | null;
  fecha: string;
  hora: number;
  minutos: number;
  textoHora: string;
}

interface Persona {
  id: string;
  nombre: string;
  porHora: number[];
  total: number;
  dentro: number;
  fuera: number;
  horaPico: number | null;
  masTemprano: string;
  masTarde: string;
}

const aSubida = (row: SubidaDetalle): Subida => {
  const partes = Object.fromEntries(formatoFechaHora.formatToParts(new Date(row.momento)).map((parte) => [parte.type, parte.value]));
  const hora = Number(partes.hour);
  const minutos = Number(partes.minute);
  return {
    usuarioId: row.usuario_id,
    nombre: row.usuario_nombre ?? "Usuario sin perfil",
    tipo: row.tipo,
    codigo: row.codigo,
    titulo: row.titulo,
    fecha: `${partes.day}/${partes.month}/${partes.year}`,
    hora,
    minutos,
    textoHora: `${String(hora).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`
  };
};

// Subidas por hora del día. Cuenta SOLO lo que la persona subió (documentos que siguen activos y
// anexos agregados); editar o eliminar no cuenta. Se vuelve a montar al cambiar el rango (key en
// el padre), por eso empieza siempre en "cargando".
export function ControlInternoMapaCalor({ desde, hasta, usuarioId }: { desde: string; hasta: string; usuarioId?: string }) {
  const [rows, setRows] = useState<SubidaDetalle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getSubidasDetalle(desde, hasta, usuarioId)
      .then((result) => { if (active) setRows(result); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las subidas."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [desde, hasta, usuarioId]);

  const subidas = useMemo(() => rows.map(aSubida), [rows]);

  const personas = useMemo<Persona[]>(() => {
    const mapa = new Map<string, Subida[]>();
    for (const subida of subidas) mapa.set(subida.usuarioId, [...(mapa.get(subida.usuarioId) ?? []), subida]);
    return [...mapa.entries()]
      .map(([id, lista]) => {
        const porHora = Array.from({ length: 24 }, () => 0);
        for (const subida of lista) porHora[subida.hora] += 1;
        const dentro = porHora.reduce((suma, valor, hora) => suma + (dentroDeHorario(hora) ? valor : 0), 0);
        const maximo = Math.max(...porHora);
        const ordenadas = [...lista].sort((a, b) => a.hora * 60 + a.minutos - (b.hora * 60 + b.minutos));
        return {
          id,
          nombre: lista[0].nombre,
          porHora,
          total: lista.length,
          dentro,
          fuera: lista.length - dentro,
          horaPico: maximo > 0 ? porHora.indexOf(maximo) : null,
          masTemprano: ordenadas[0].textoHora,
          masTarde: ordenadas[ordenadas.length - 1].textoHora
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [subidas]);

  const equipo = useMemo(() => {
    const porHora = HORAS.map((hora) => subidas.filter((subida) => subida.hora === hora).length);
    const total = subidas.length;
    const dentro = porHora.reduce((suma, valor, hora) => suma + (dentroDeHorario(hora) ? valor : 0), 0);
    const maximo = Math.max(...porHora);
    return { porHora, total, dentro, fuera: total - dentro, horaPico: maximo > 0 ? porHora.indexOf(maximo) : null, maximo };
  }, [subidas]);

  const fueraDeHorario = useMemo(
    () => subidas.filter((subida) => !dentroDeHorario(subida.hora)).sort((a, b) => b.fecha.split("/").reverse().join("") .localeCompare(a.fecha.split("/").reverse().join("")) || b.hora * 60 + b.minutos - (a.hora * 60 + a.minutos)),
    [subidas]
  );

  return (
    <Card className="min-w-0 overflow-hidden">
      <div className="border-b border-slate-200 p-5 dark:border-slate-800">
        <h2 className="font-bold">¿A qué hora subieron documentos?</h2>
        <p className="text-sm text-slate-500">Solo cuenta lo que se subió. Horario laboral: {etiquetaHora(HORARIO_INICIO)} a {etiquetaHora(HORARIO_FIN)} (hora de Lima).</p>
      </div>

      {error && <div className="p-4"><Alert variant="warning">{error}</Alert></div>}

      {loading ? (
        <div className="space-y-2 p-4">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-10" />)}</div>
      ) : !subidas.length ? (
        <div className="p-3 sm:p-4"><EmptyState icon={<Clock />} title="Sin subidas en este rango" description="No hay documentos ni anexos subidos entre esas fechas." /></div>
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
            <p className="mb-3 text-sm font-semibold">Subidas por hora (todo el equipo)</p>
            <div className="table-scroll" tabIndex={0}>
              <div className="flex h-40 min-w-[34rem] items-end gap-1">
                {HORAS.map((hora) => {
                  const valor = equipo.porHora[hora];
                  const dentro = dentroDeHorario(hora);
                  return (
                    <div key={hora} className="flex h-full flex-1 flex-col justify-end text-center" title={`${rangoHora(hora)}: ${valor} ${valor === 1 ? "subida" : "subidas"}${dentro ? "" : " (fuera de horario)"}`}>
                      <span className="text-xs font-bold">{valor > 0 ? valor : ""}</span>
                      <div className={`rounded-t ${dentro ? "bg-teal-600" : "bg-orange-500"}`} style={{ height: `${equipo.maximo ? (valor / equipo.maximo) * 100 : 0}%`, minHeight: valor > 0 ? 4 : 0 }} />
                      <span className={`mt-1 text-xs ${dentro ? "text-slate-500" : "font-semibold text-orange-600 dark:text-orange-400"}`}>{hora}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-teal-600" />Dentro del horario ({HORARIO_INICIO}:00–{HORARIO_FIN}:00)</span>
              <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-orange-500" />Fuera del horario</span>
              <span>El número de abajo es la hora del día (0 a 23).</span>
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
                  <th className="px-4 py-3">Subió desde</th>
                  <th className="px-4 py-3">Hasta</th>
                  <th className="px-4 py-3">Hora en que más subió</th>
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
