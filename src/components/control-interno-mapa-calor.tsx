import { useEffect, useMemo, useState } from "react";
import { Clock, Download, Info } from "lucide-react";
import { Alert, Button, Card, EmptyState, Skeleton } from "./ui";
import { getSubidasDetalle } from "../services/admin.service";
import type { ReporteActividadDiaria, SubidaDetalle } from "../types";

// Horario laboral de SUBCAFAE: de 8:00 a 17:00 (hora de Lima). La hora 17 ya queda fuera.
const HORARIO_INICIO = 8;
const HORARIO_FIN = 17;
const HORAS = Array.from({ length: 24 }, (_, hora) => hora);

const dentroDeHorario = (hora: number) => hora >= HORARIO_INICIO && hora < HORARIO_FIN;
const etiquetaHora = (hora: number) => `${String(hora).padStart(2, "0")}:00`;
const rangoHora = (hora: number) => `${etiquetaHora(hora)} – ${etiquetaHora((hora + 1) % 24)}`;
// Etiqueta del eje: "8 am", "12 pm", "5 pm".
const etiquetaCorta = (hora: number) => `${hora % 12 === 0 ? 12 : hora % 12} ${hora < 12 ? "am" : "pm"}`;

// Dibuja un resumen (gráfico por hora + tabla por persona) en un canvas y lo descarga como imagen
// PNG, pensada para compartir por WhatsApp.
function descargarResumenPng(porHora: number[], horas: number[], personas: Persona[], subtitulo: string) {
  const escala = 2;
  const ancho = 960;
  const filaAlto = 34;
  const baseGrafico = 400;
  const topeTabla = baseGrafico + 70;
  const alto = topeTabla + 40 + personas.length * filaAlto + 70;
  const canvas = document.createElement("canvas");
  canvas.width = ancho * escala;
  canvas.height = alto * escala;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(escala, escala);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, ancho, alto);
  ctx.textAlign = "left";
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 22px sans-serif";
  ctx.fillText("Subidas por hora del día", 32, 40);
  ctx.fillStyle = "#64748b";
  ctx.font = "13px sans-serif";
  ctx.fillText(subtitulo, 32, 62);

  const izquierda = 40;
  const tope = 110;
  const maximo = Math.max(1, ...horas.map((hora) => porHora[hora]));
  const paso = (ancho - izquierda - 32) / horas.length;
  ctx.strokeStyle = "#cbd5e1";
  ctx.beginPath();
  ctx.moveTo(izquierda, baseGrafico - 40);
  ctx.lineTo(ancho - 32, baseGrafico - 40);
  ctx.stroke();
  const base = baseGrafico - 40;
  ctx.textAlign = "center";
  horas.forEach((hora, indice) => {
    const valor = porHora[hora];
    const x = izquierda + indice * paso;
    const alturaBarra = (valor / maximo) * (base - tope);
    ctx.fillStyle = dentroDeHorario(hora) ? "#0d9488" : "#f97316";
    ctx.fillRect(x + 4, base - alturaBarra, paso - 8, alturaBarra);
    if (valor > 0) {
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(String(valor), x + paso / 2, base - alturaBarra - 6);
    }
    ctx.fillStyle = dentroDeHorario(hora) ? "#64748b" : "#ea580c";
    ctx.font = "12px sans-serif";
    ctx.fillText(etiquetaCorta(hora), x + paso / 2, base + 18);
  });
  ctx.fillStyle = "#64748b";
  ctx.font = "13px sans-serif";
  ctx.fillText("Hora del día (hora de Lima) · el número sobre cada barra es la cantidad de subidas", (izquierda + ancho - 32) / 2, base + 42);
  ctx.textAlign = "left";
  ctx.fillStyle = "#0d9488";
  ctx.fillRect(32, baseGrafico + 20, 12, 12);
  ctx.fillStyle = "#475569";
  ctx.fillText(`Dentro del horario (${etiquetaCorta(HORARIO_INICIO)} a ${etiquetaCorta(HORARIO_FIN)})`, 50, baseGrafico + 31);
  ctx.fillStyle = "#f97316";
  ctx.fillRect(330, baseGrafico + 20, 12, 12);
  ctx.fillStyle = "#475569";
  ctx.fillText("Fuera del horario", 348, baseGrafico + 31);

  // Tabla por persona
  const columnas = [32, 250, 320, 385, 450, 535, 625, 735];
  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(24, topeTabla, ancho - 48, 32);
  ctx.fillStyle = "#475569";
  ctx.font = "bold 12px sans-serif";
  ["PERSONA", "SUBIDAS", "DENTRO", "FUERA", "1ª SUBIDA", "ÚLT. SUBIDA", "CONECTADO", "ÚLT. CONEXIÓN"].forEach((texto, indice) => ctx.fillText(texto, columnas[indice], topeTabla + 21));
  personas.forEach((persona, indice) => {
    const y = topeTabla + 32 + indice * filaAlto;
    ctx.strokeStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(24, y + filaAlto);
    ctx.lineTo(ancho - 24, y + filaAlto);
    ctx.stroke();
    ctx.font = "bold 14px sans-serif";
    ctx.fillStyle = "#0f172a";
    ctx.fillText(persona.nombre.length > 32 ? `${persona.nombre.slice(0, 31)}…` : persona.nombre, columnas[0], y + 22);
    ctx.fillText(String(persona.total), columnas[1], y + 22);
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#0f766e";
    ctx.fillText(String(persona.dentro), columnas[2], y + 22);
    ctx.fillStyle = persona.fuera > 0 ? "#ea580c" : "#64748b";
    ctx.font = persona.fuera > 0 ? "bold 14px sans-serif" : "14px sans-serif";
    ctx.fillText(String(persona.fuera), columnas[3], y + 22);
    ctx.fillStyle = "#0f172a";
    ctx.font = "14px sans-serif";
    ctx.fillText(persona.masTemprano, columnas[4], y + 22);
    ctx.fillText(persona.masTarde, columnas[5], y + 22);
    ctx.fillText(persona.minutosConectado ? duracion(persona.minutosConectado) : "—", columnas[6], y + 22);
    ctx.fillText(persona.ultimaConexion, columnas[7], y + 22);
  });
  ctx.fillStyle = "#94a3b8";
  ctx.font = "12px sans-serif";
  ctx.fillText("Cuenta solo documentos subidos y anexos agregados; editar o eliminar no cuenta. SIGDAF · SUBCAFAE", 32, alto - 24);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = `subidas-por-hora-${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
  }, "image/png");
}

const horaDeIso = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Lima" }) : null);
const duracion = (minutos: number) => {
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
};

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
  minutosConectado: number;
  entro: string;
  ultimaConexion: string;
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
export function ControlInternoMapaCalor({ desde, hasta, usuarioId, conexiones = [] }: { desde: string; hasta: string; usuarioId?: string; conexiones?: ReporteActividadDiaria[] }) {
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
    const porUsuario = new Map<string, Subida[]>();
    for (const subida of subidas) porUsuario.set(subida.usuarioId, [...(porUsuario.get(subida.usuarioId) ?? []), subida]);
    const conexionPorUsuario = new Map<string, { nombre: string; minutos: number; entro: string | null; ultima: string | null }>();
    for (const row of conexiones) {
      const actual = conexionPorUsuario.get(row.usuario_id) ?? { nombre: row.usuario_nombre ?? row.usuario_email ?? "Usuario sin perfil", minutos: 0, entro: null, ultima: null };
      const entro = horaDeIso(row.primera_conexion);
      const ultima = horaDeIso(row.ultima_conexion);
      actual.minutos += row.minutos_conectado ?? 0;
      if (entro && (!actual.entro || entro < actual.entro)) actual.entro = entro;
      if (ultima && (!actual.ultima || ultima > actual.ultima)) actual.ultima = ultima;
      conexionPorUsuario.set(row.usuario_id, actual);
    }
    const ids = new Set([...porUsuario.keys(), ...conexionPorUsuario.keys()]);
    return [...ids]
      .map((id) => {
        const lista = porUsuario.get(id) ?? [];
        const conexion = conexionPorUsuario.get(id);
        const porHora = Array.from({ length: 24 }, () => 0);
        for (const subida of lista) porHora[subida.hora] += 1;
        const dentro = porHora.reduce((suma, valor, hora) => suma + (dentroDeHorario(hora) ? valor : 0), 0);
        const maximo = Math.max(...porHora);
        const ordenadas = [...lista].sort((a, b) => a.hora * 60 + a.minutos - (b.hora * 60 + b.minutos));
        return {
          id,
          nombre: lista[0]?.nombre ?? conexion?.nombre ?? "Usuario sin perfil",
          porHora,
          total: lista.length,
          dentro,
          fuera: lista.length - dentro,
          horaPico: maximo > 0 ? porHora.indexOf(maximo) : null,
          masTemprano: ordenadas[0]?.textoHora ?? "—",
          masTarde: ordenadas[ordenadas.length - 1]?.textoHora ?? "—",
          minutosConectado: conexion?.minutos ?? 0,
          entro: conexion?.entro ?? "—",
          ultimaConexion: conexion?.ultima ?? "—"
        };
      })
      .sort((a, b) => b.total - a.total || b.minutosConectado - a.minutosConectado);
  }, [subidas, conexiones]);

  const equipo = useMemo(() => {
    const porHora = HORAS.map((hora) => subidas.filter((subida) => subida.hora === hora).length);
    const total = subidas.length;
    const dentro = porHora.reduce((suma, valor, hora) => suma + (dentroDeHorario(hora) ? valor : 0), 0);
    const maximo = Math.max(...porHora);
    return { porHora, total, dentro, fuera: total - dentro, horaPico: maximo > 0 ? porHora.indexOf(maximo) : null, maximo };
  }, [subidas]);

  // Solo se muestran las horas útiles: el horario laboral (con una hora de margen) y cualquier hora con subidas.
  const horasVisibles = useMemo(() => {
    const conSubidas = HORAS.filter((hora) => equipo.porHora[hora] > 0);
    const primera = Math.min(HORARIO_INICIO - 1, ...conSubidas);
    const ultima = Math.max(HORARIO_FIN, ...conSubidas);
    return HORAS.filter((hora) => hora >= primera && hora <= ultima);
  }, [equipo]);

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
              <Button variant="secondary" onClick={() => descargarResumenPng(equipo.porHora, horasVisibles, personas, desde === hasta ? `Fecha: ${desde}` : `Del ${desde} al ${hasta}`)}>
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
