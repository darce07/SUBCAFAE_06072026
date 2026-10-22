import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Download, ExternalLink, BanknoteX, FileText, LoaderCircle, Maximize2, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button } from "./ui";
import { ConfirmDialog } from "./confirm-dialog";
import { Field, FilePane } from "./documento-vista";
import { useAuth } from "../features/auth/auth-context";
import { useDocumentoVista } from "../hooks/use-documento-vista";
import { usePermissions } from "../hooks/use-permissions";
import { formatCurrency, formatDate, formatDateTime, getStatusTone } from "../lib/utils";
import { deleteDocumento, editDocumento } from "../services/documentos.service";
import { downloadDocumentoFile } from "../services/storage.service";
import type { Documento } from "../types";

// Panel lateral para revisar documentos uno tras otro sin perder la lista: NO bloquea la página, así que
// se puede hacer clic en otro documento y el panel cambia. Muestra el monto bien visible junto al
// archivo, para comprobar de un vistazo si el monto registrado es el correcto.
// El padre lo monta con `key` = id del documento, así cada documento empieza limpio.
export function DocumentoPanel({ id, inicial, onClose, onCambio }: { id: string; inicial: Documento | null; onClose: () => void; onCambio?: () => void }) {
  const { userContext } = useAuth();
  const { canEdit, canDelete } = usePermissions();
  const [confirmando, setConfirmando] = useState<"eliminar" | "documentario" | null>(null);
  const [procesando, setProcesando] = useState(false);
  const { documento, preview, loading, cargandoArchivo, error } = useDocumentoVista(id, inicial);
  // Los datos secundarios van plegados para que el archivo ocupe casi todo el panel.
  const [masDatos, setMasDatos] = useState(false);

  const descargar = async () => {
    if (!documento?.archivo_path) return;
    try {
      await downloadDocumentoFile(
        documento.archivo_path,
        `${documento.codigo_documento}.${documento.extension ?? "archivo"}`,
        { codigo: documento.codigo_documento, usuario: userContext?.nombreCompleto ?? userContext?.email ?? "usuario del sistema" },
      );
    } catch (downloadError) {
      toast.error(downloadError instanceof Error ? downloadError.message : "No se pudo descargar el archivo.");
    }
  };

  const esFinanciero = documento?.tipo_movimiento?.nombre === "Ingreso" || documento?.tipo_movimiento?.nombre === "Egreso";

  // Eliminar manda el documento a la Papelera (se puede restaurar); el monto deja de contar mientras esté ahí.
  const eliminar = async () => {
    if (!documento) return;
    setProcesando(true);
    try {
      await deleteDocumento(documento.id);
      toast.success(`${documento.codigo_documento} enviado a la Papelera.`);
      setConfirmando(null);
      onCambio?.();
      onClose();
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar el documento.");
    } finally {
      setProcesando(false);
    }
  };

  // Pasar a documentario: monto 0 y sin naturaleza, operación, tipo de gestión ni periodo. Así deja de
  // contarse como ingreso o egreso. El monto anterior queda en el historial de auditoría.
  const pasarADocumentario = async () => {
    if (!documento) return;
    setProcesando(true);
    try {
      await editDocumento(documento.id, {
        fechaDocumento: documento.fecha_documento,
        categoriaId: documento.categoria_id,
        tipoEntidadId: documento.tipo_entidad_id ?? null,
        entidadId: documento.entidad_id ?? null,
        tipoCategoriaId: null,
        estadoId: documento.estado_id,
        titulo: documento.titulo,
        descripcion: documento.descripcion ?? null,
        rutaHistorica: documento.ruta_historica ?? null,
        archivadorId: documento.archivador_id ?? null,
        archivoPath: documento.archivo_path ?? null,
        extension: documento.extension ?? null,
        monto: 0,
        tipoMovimientoId: null,
        tipoOperacionId: null,
        periodoMes: null,
        periodoAnio: null,
      });
      toast.success(`${documento.codigo_documento} ahora es documentario: ya no cuenta como ${documento.tipo_movimiento?.nombre?.toLowerCase() ?? "movimiento"}.`);
      setConfirmando(null);
      onCambio?.();
      onClose();
    } catch (editError) {
      toast.error(editError instanceof Error ? editError.message : "No se pudo cambiar el tipo de registro.");
    } finally {
      setProcesando(false);
    }
  };

  const esIngreso = documento?.tipo_movimiento?.nombre === "Ingreso";
  const esEgreso = documento?.tipo_movimiento?.nombre === "Egreso";
  const botonIcono = "inline-grid size-11 sm:size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";

  return (
    <section aria-label="Vista previa del documento" className="flex h-full min-h-0 flex-col overflow-hidden overscroll-contain rounded-2xl border border-slate-200 bg-slate-100 shadow-xl dark:border-slate-800 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-teal-700 dark:text-teal-400">{documento?.codigo_documento ?? "Documento"}</p>
            <h2 className="line-clamp-2 break-words text-sm font-bold" title={documento?.titulo}>{documento?.titulo ?? (loading ? "Cargando…" : "Documento no disponible")}</h2>
          </div>
          <Button size="sm" variant="ghost" aria-label="Cerrar panel" onClick={onClose}><X className="size-4" /></Button>
        </div>
        {documento && (
          <div className="mt-2 flex items-center gap-1.5">
            {preview?.signedUrl && <Button size="icon" variant="secondary" title="Abrir el archivo en una pestaña" aria-label="Abrir el archivo en una pestaña" onClick={() => window.open(preview.signedUrl, "_blank", "noopener,noreferrer")}><ExternalLink className="size-4" /></Button>}
            <Button size="icon" variant="secondary" title="Descargar" aria-label="Descargar" disabled={!documento.archivo_path} onClick={() => void descargar()}><Download className="size-4" /></Button>
            <Link to={`/documentos/${documento.id}/visor`} target="_blank" rel="noopener noreferrer" title="Pantalla completa (pestaña nueva)" aria-label="Pantalla completa" className={botonIcono}><Maximize2 className="size-4" /></Link>
            <Link to={`/documentos/${documento.id}`} title="Detalle completo del documento" aria-label="Detalle completo" className={botonIcono}><FileText className="size-4" /></Link>
            {canEdit("documentos") && esFinanciero && (
              <Button size="icon" variant="secondary" title="Pasar a documentario: el monto deja de contar como ingreso o egreso" aria-label="Pasar a documentario" onClick={() => setConfirmando("documentario")}><BanknoteX className="size-4" /></Button>
            )}
            {canDelete("documentos") && (
              <Button size="icon" variant="danger" title="Eliminar el documento (va a la Papelera)" aria-label="Eliminar documento" onClick={() => setConfirmando("eliminar")}><Trash2 className="size-4" /></Button>
            )}
            {canEdit("documentos") && (
              <Link to={`/documentos/${documento.id}/editar`} target="_blank" rel="noopener noreferrer" title="Abre la edición en una pestaña nueva" className="ml-auto inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl bg-teal-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-700">
                <Pencil className="size-4" />Corregir monto o datos
              </Link>
            )}
          </div>
        )}
      </header>

      {loading ? (
        <div className="grid flex-1 place-items-center"><LoaderCircle className="size-8 animate-spin text-teal-600" /></div>
      ) : !documento ? (
        <div className="grid flex-1 place-items-center p-6 text-center">
          <div>
            <FileText className="mx-auto mb-3 size-10 text-slate-400" />
            <h3 className="font-bold">{error ?? "Documento no encontrado"}</h3>
            <p className="mt-1 text-sm text-slate-500">El registro no existe o no tienes acceso a él.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="border-b border-slate-200 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Monto registrado ({documento.tipo_movimiento?.nombre ?? "sin naturaleza"})</p>
                <p className={`text-2xl font-black leading-tight ${esIngreso ? "text-emerald-600" : esEgreso ? "text-rose-600" : "text-slate-700 dark:text-slate-200"}`}>
                  {esIngreso ? "+ " : esEgreso ? "- " : ""}{formatCurrency(Number(documento.monto || 0))}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge tone={getStatusTone(documento.estado?.nombre)}>{documento.estado?.nombre ?? "Sin estado"}</Badge>
                <span className="text-[11px] font-semibold text-slate-500">{esFinanciero ? "Registro financiero" : "Registro documentario"}</span>
              </div>
            </div>
            <p className="mt-1 truncate text-xs text-slate-500" title={`${formatDate(documento.fecha_documento)} · ${documento.categoria?.nombre ?? "Sin categoría"} · ${documento.archivador?.nombre ?? "Sin archivador"}`}>
              {formatDate(documento.fecha_documento)} · {documento.categoria?.nombre ?? "Sin categoría"} · {documento.archivador?.nombre ?? "Sin archivador"}
            </p>
            <button type="button" aria-expanded={masDatos} onClick={() => setMasDatos((value) => !value)} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline dark:text-teal-400">
              {masDatos ? "Ocultar datos" : "Más datos"}<ChevronDown className={`size-3.5 transition ${masDatos ? "rotate-180" : ""}`} />
            </button>
            {masDatos && (
              <dl className="mt-2 grid max-h-40 grid-cols-2 gap-x-4 gap-y-2.5 overflow-y-auto overscroll-contain">
                <Field label="Subido el" value={documento.created_at ? formatDateTime(documento.created_at) : null} />
                <Field label="Entidad" value={documento.entidad?.nombre} />
                <Field label="Operación" value={documento.tipo_operacion?.nombre} />
                <Field label="Subido por" value={documento.usuario?.nombre_completo ?? documento.usuario?.email} />
                {documento.descripcion && <Field label="Descripción" value={documento.descripcion} wide />}
              </dl>
            )}
          </div>
          <div className="min-h-0 min-w-0 flex-1 overflow-hidden bg-white dark:bg-slate-900">
            <FilePane preview={preview} title={documento.titulo} hasFile={Boolean(documento.archivo_path)} loading={cargandoArchivo} />
          </div>
        </>
      )}
      <ConfirmDialog
        open={confirmando === "eliminar"}
        onOpenChange={(abierto) => { if (!abierto) setConfirmando(null); }}
        title="Eliminar documento"
        description={documento ? `¿Eliminar ${documento.codigo_documento}? Se enviará a la Papelera (se puede restaurar) y su monto de ${formatCurrency(Number(documento.monto || 0))} dejará de sumar mientras esté allí.` : ""}
        confirmLabel="Eliminar"
        loading={procesando}
        onConfirm={() => void eliminar()}
      />
      <ConfirmDialog
        open={confirmando === "documentario"}
        onOpenChange={(abierto) => { if (!abierto) setConfirmando(null); }}
        title="Pasar a documentario"
        description={documento ? `${documento.codigo_documento} dejará de ser financiero: su monto de ${formatCurrency(Number(documento.monto || 0))} pasará a S/ 0.00 y ya no contará como ${documento.tipo_movimiento?.nombre?.toLowerCase() ?? "movimiento"} (desaparecerá de esta lista y de los totales). El monto anterior queda en el historial de auditoría. Para volver a financiero hay que editar el documento e indicar de nuevo naturaleza, monto y operación.` : ""}
        confirmLabel="Pasar a documentario"
        variant="primary"
        loading={procesando}
        onConfirm={() => void pasarADocumentario()}
      />
    </section>
  );
}
