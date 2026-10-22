import { Link } from "react-router-dom";
import { Download, ExternalLink, FileText, LoaderCircle, Maximize2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button } from "./ui";
import { Field, FilePane } from "./documento-vista";
import { useAuth } from "../features/auth/auth-context";
import { useDocumentoVista } from "../hooks/use-documento-vista";
import { usePermissions } from "../hooks/use-permissions";
import { formatCurrency, formatDate, formatDateTime, getStatusTone } from "../lib/utils";
import { downloadDocumentoFile } from "../services/storage.service";
import type { Documento } from "../types";

// Panel lateral para revisar documentos uno tras otro sin perder la lista: NO bloquea la página, así que
// se puede hacer clic en otro documento y el panel cambia. Muestra el monto bien visible junto al
// archivo, para comprobar de un vistazo si el monto registrado es el correcto.
// El padre lo monta con `key` = id del documento, así cada documento empieza limpio.
export function DocumentoPanel({ id, inicial, onClose }: { id: string; inicial: Documento | null; onClose: () => void }) {
  const { userContext } = useAuth();
  const { canEdit } = usePermissions();
  const { documento, preview, loading, cargandoArchivo, error } = useDocumentoVista(id, inicial);

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

  const esIngreso = documento?.tipo_movimiento?.nombre === "Ingreso";
  const esEgreso = documento?.tipo_movimiento?.nombre === "Egreso";
  const botonEnlace = "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";

  return (
    <section aria-label="Vista previa del documento" className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-xl dark:border-slate-800 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-teal-700 dark:text-teal-400">{documento?.codigo_documento ?? "Documento"}</p>
            <h2 className="line-clamp-2 break-words text-sm font-bold" title={documento?.titulo}>{documento?.titulo ?? (loading ? "Cargando…" : "Documento no disponible")}</h2>
          </div>
          <Button size="sm" variant="ghost" aria-label="Cerrar panel" onClick={onClose}><X className="size-4" /></Button>
        </div>
        {documento && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {preview?.signedUrl && <Button size="sm" variant="secondary" onClick={() => window.open(preview.signedUrl, "_blank", "noopener,noreferrer")}><ExternalLink className="size-4" />Abrir</Button>}
            <Button size="sm" variant="secondary" disabled={!documento.archivo_path} onClick={() => void descargar()}><Download className="size-4" />Descargar</Button>
            <Link to={`/documentos/${documento.id}/visor`} target="_blank" rel="noopener noreferrer" className={botonEnlace}><Maximize2 className="size-4" />Pantalla completa</Link>
            <Link to={`/documentos/${documento.id}`} className={botonEnlace}><FileText className="size-4" />Detalle</Link>
            {canEdit("documentos") && (
              <Link to={`/documentos/${documento.id}/editar`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-xl bg-teal-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-700">
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
          <div className="border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Monto registrado ({documento.tipo_movimiento?.nombre ?? "sin naturaleza"})</p>
                <p className={`text-2xl font-black ${esIngreso ? "text-emerald-600" : esEgreso ? "text-rose-600" : "text-slate-700 dark:text-slate-200"}`}>
                  {esIngreso ? "+ " : esEgreso ? "- " : ""}{formatCurrency(Number(documento.monto || 0))}
                </p>
              </div>
              <Badge tone={getStatusTone(documento.estado?.nombre)}>{documento.estado?.nombre ?? "Sin estado"}</Badge>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
              <Field label="Fecha del documento" value={formatDate(documento.fecha_documento)} />
              <Field label="Subido el" value={documento.created_at ? formatDateTime(documento.created_at) : null} />
              <Field label="Categoría" value={documento.categoria?.nombre} />
              <Field label="Archivador" value={documento.archivador?.nombre ?? "Sin archivador"} />
              <Field label="Entidad" value={documento.entidad?.nombre} />
              <Field label="Operación" value={documento.tipo_operacion?.nombre} />
              {documento.descripcion && <Field label="Descripción" value={documento.descripcion} wide />}
            </dl>
          </div>
          <div className="min-h-[50dvh] min-w-0 flex-1 overflow-hidden bg-white dark:bg-slate-900">
            <FilePane preview={preview} title={documento.titulo} hasFile={Boolean(documento.archivo_path)} loading={cargandoArchivo} />
          </div>
        </>
      )}
    </section>
  );
}
