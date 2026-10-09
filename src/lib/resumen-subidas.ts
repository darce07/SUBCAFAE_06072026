import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReporteActividadDiaria, SubidaDetalle } from "../types";

// Horario laboral de SUBCAFAE: de 8:00 a 17:00 (hora de Lima). La hora 17 ya queda fuera.
export const HORARIO_INICIO = 8;
export const HORARIO_FIN = 17;
export const HORAS = Array.from({ length: 24 }, (_, hora) => hora);

export const dentroDeHorario = (hora: number) => hora >= HORARIO_INICIO && hora < HORARIO_FIN;
export const etiquetaHora = (hora: number) => `${String(hora).padStart(2, "0")}:00`;
export const rangoHora = (hora: number) => `${etiquetaHora(hora)} – ${etiquetaHora((hora + 1) % 24)}`;
// Etiqueta del eje: "8 am", "12 pm", "5 pm".
export const etiquetaCorta = (hora: number) => `${hora % 12 === 0 ? 12 : hora % 12} ${hora < 12 ? "am" : "pm"}`;

const horaDeIso = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Lima" }) : null);

export const duracion = (minutos: number) => {
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
};

const formatoFechaHora = new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export interface Subida {
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

export interface Persona {
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

export interface ResumenSubidas {
  subidas: Subida[];
  personas: Persona[];
  equipo: { porHora: number[]; total: number; dentro: number; fuera: number; horaPico: number | null; maximo: number };
  // Horas que se dibujan: el horario laboral (con una hora de margen) y cualquier hora con subidas.
  horasVisibles: number[];
  fueraDeHorario: Subida[];
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

// Cuenta SOLO lo que la persona subió (documentos que siguen activos y anexos agregados); editar o
// eliminar no cuenta. Une las subidas con los datos de conexión de cada persona.
export function calcularResumen(filas: SubidaDetalle[], conexiones: ReporteActividadDiaria[]): ResumenSubidas {
  const subidas = filas.map(aSubida);
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
  const personas: Persona[] = [...ids]
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

  const porHora = HORAS.map((hora) => subidas.filter((subida) => subida.hora === hora).length);
  const dentro = porHora.reduce((suma, valor, hora) => suma + (dentroDeHorario(hora) ? valor : 0), 0);
  const maximo = Math.max(...porHora);
  const equipo = { porHora, total: subidas.length, dentro, fuera: subidas.length - dentro, horaPico: maximo > 0 ? porHora.indexOf(maximo) : null, maximo };

  const conSubidas = HORAS.filter((hora) => porHora[hora] > 0);
  const primera = Math.min(HORARIO_INICIO - 1, ...conSubidas);
  const ultima = Math.max(HORARIO_FIN, ...conSubidas);
  const horasVisibles = HORAS.filter((hora) => hora >= primera && hora <= ultima);

  const clave = (subida: Subida) => `${subida.fecha.split("/").reverse().join("")}${String(subida.hora * 60 + subida.minutos).padStart(4, "0")}`;
  const fueraDeHorario = subidas.filter((subida) => !dentroDeHorario(subida.hora)).sort((a, b) => clave(b).localeCompare(clave(a)));

  return { subidas, personas, equipo, horasVisibles, fueraDeHorario };
}

// Dibuja el resumen (gráfico por hora + tabla por persona) en un canvas. Sirve para la imagen que
// se comparte por WhatsApp y para la primera página del PDF.
export function dibujarResumenCanvas(resumen: ResumenSubidas, subtitulo: string): HTMLCanvasElement | null {
  const { personas, horasVisibles: horas } = resumen;
  const porHora = resumen.equipo.porHora;
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
  if (!ctx) return null;
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
  const base = baseGrafico - 40;
  ctx.strokeStyle = "#cbd5e1";
  ctx.beginPath();
  ctx.moveTo(izquierda, base);
  ctx.lineTo(ancho - 32, base);
  ctx.stroke();
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
  return canvas;
}

// Descarga el resumen como imagen PNG, pensada para compartir por WhatsApp.
export function descargarResumenPng(resumen: ResumenSubidas, subtitulo: string) {
  const canvas = dibujarResumenCanvas(resumen, subtitulo);
  if (!canvas) return;
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = `subidas-por-hora-${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}

// PDF del reporte diario: página 1 con el resumen (gráfico por hora y tabla por persona), luego la
// lista de subidas fuera de horario y el detalle diario.
export function exportarReporteDiarioPdf(opciones: { titulo: string; subtitulo: string; resumen: ResumenSubidas; encabezadoDetalle: string[]; filasDetalle: (string | number)[][]; archivo: string }) {
  const { titulo, subtitulo, resumen, encabezadoDetalle, filasDetalle, archivo } = opciones;
  const doc = new jsPDF({ orientation: "portrait", format: "a4" });
  doc.setFontSize(14);
  doc.text(titulo, 14, 15);
  doc.setFontSize(9);
  doc.text(`Generado: ${new Date().toLocaleString("es-PE")}`, 14, 21);

  const canvas = dibujarResumenCanvas(resumen, subtitulo);
  if (canvas) {
    const proporcion = canvas.height / canvas.width;
    const ancho = Math.min(182, (297 - 26 - 14) / proporcion);
    doc.addImage(canvas.toDataURL("image/png"), "PNG", 14, 26, ancho, ancho * proporcion);
  }

  doc.addPage("a4", "landscape");
  doc.setFontSize(12);
  doc.text(`Subidas fuera del horario laboral (${resumen.fueraDeHorario.length})`, 14, 15);
  if (resumen.fueraDeHorario.length) {
    autoTable(doc, {
      head: [["Fecha", "Hora", "Persona", "Qué subió", "Documento"]],
      body: resumen.fueraDeHorario.map((subida) => [subida.fecha, subida.textoHora, subida.nombre, subida.tipo === "anexo" ? "Anexo" : "Documento", `${subida.codigo ?? ""} ${subida.titulo ?? ""}`.trim()]),
      startY: 20,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [234, 88, 12] }
    });
  } else {
    doc.setFontSize(9);
    doc.text("Nadie subió nada fuera del horario laboral en este rango.", 14, 22);
  }

  const despues = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 22;
  let yTitulo = despues + 14;
  if (yTitulo > 180) {
    doc.addPage("a4", "landscape");
    yTitulo = 15;
  }
  doc.setFontSize(12);
  doc.text("Detalle diario por persona", 14, yTitulo);
  autoTable(doc, {
    head: [encabezadoDetalle],
    body: filasDetalle,
    startY: yTitulo + 5,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [15, 118, 110] }
  });
  doc.save(archivo.endsWith(".pdf") ? archivo : `${archivo}.pdf`);
}
