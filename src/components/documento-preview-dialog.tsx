import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { Download, ExternalLink, FileText, LoaderCircle, Maximize2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button } from "./ui";
import { Field, FilePane, type Preview } from "./documento-vista";
import { mimeFromExtension } from "../lib/documento-mime";
import { useAuth } from "../features/auth/auth-context";
import { usePermissions } from "../hooks/use-permissions";
import { formatCurrency, formatDate, getStatusTone } from "../lib/utils";
import { getDocumentoById } from "../services/documentos.service";
import { downloadDocumentoFile, getDocumentoPreview, releaseDocumentoPreview } from "../services/storage.service";
import type { Documento } from "../types";

// Vista previa en una ventana emergente, sin salir de la página: el archivo a un lado y los datos del
// documento al otro. Para leer rápido; el visor en pestaña y el detalle siguen disponibles.
export function DocumentoPreviewDialog({ documentoId, onClose }: { documentoId: string | null; onClose: () => void }) {
  return (
    <Dialog.Root open={Boolean(documentoId)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed inset-2 z-[101] flex flex-col overflow-hidden rounded-2xl bg-slate-100 shadow-2xl outline-none dark:bg-slate-950 sm:inset-5 lg:inset-8"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          {/* Se monta al abrir y se desmonta al cerrar: cada documento empieza limpio y libera su archivo. */}
          {documentoId && <Contenido key={documentoId} id={documentoId} onClose={onClose} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Contenido({ id, onClose }: { id: string; onClose: () => void }) {
  const { userContext } = useAuth();
  const { canEdit } = usePermissions();
  const [documento, setDocumento] = useState<Documento | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    void (async () => {
      try {
        const row = await getDocumentoById(id);
        if (cancelled) return;
        setDocumento(row);
        if (row?.archivo_path) {
          const result = await getDocumentoPreview(row.archivo_path);
          objectUrl = result.objectUrl;
          if (cancelled) { if (objectUrl) releaseDocumentoPreview(objectUrl); return; }
          setPreview({ ...result, mimeType: result.mimeType ?? mimeFromExtension(row.extension) });
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el documento.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) releaseDocumentoPreview(objectUrl);
    };
  }, [id]);

  const download = async () => {
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

  const botonEnlace = "inline-flex min-h-8 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-teal-700 dark:text-teal-400">{documento?.codigo_documento ?? "Documento"}</p>
          <Dialog.Title className="truncate text-sm font-bold" title={documento?.titulo}>{documento?.titulo ?? (loading ? "Cargando…" : "Documento no disponible")}</Dialog.Title>
          <Dialog.Description className="sr-only">Vista previa del documento con sus datos</Dialog.Description>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {preview?.signedUrl && (
            <Button size="sm" variant="secondary" onClick={() => window.open(preview.signedUrl, "_blank", "noopener,noreferrer")}><ExternalLink className="size-4" />Abrir archivo</Button>
          )}
          <Button size="sm" variant="secondary" disabled={!documento?.archivo_path} onClick={() => void download()}><Download className="size-4" />Descargar</Button>
          {documento && (
            <>
              <Link to={`/documentos/${documento.id}/visor`} target="_blank" rel="noopener noreferrer" className={botonEnlace}><Maximize2 className="size-4" />Pantalla completa</Link>
              <Link to={`/documentos/${documento.id}`} className={botonEnlace} onClick={onClose}><FileText className="size-4" />Detalle completo</Link>
              {canEdit("documentos") && (
                <Link to={`/documentos/${documento.id}/editar`} className="inline-flex min-h-8 items-center justify-center gap-2 rounded-xl bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-700" onClick={onClose}>
                  <Pencil className="size-4" />Editar datos
                </Link>
              )}
            </>
          )}
          <Dialog.Close asChild><Button size="sm" variant="ghost" aria-label="Cerrar vista previa"><X className="size-4" /></Button></Dialog.Close>
        </div>
      </header>

      {loading ? (
        <div className="grid flex-1 place-items-center"><LoaderCircle className="size-8 animate-spin text-teal-600" /></div>
      ) : !documento ? (
        <div className="grid flex-1 place-items-center p-6 text-center">
          <div>
            <FileText className="mx-auto mb-3 size-10 text-slate-400" />
            <h2 className="font-bold">{error ?? "Documento no encontrado"}</h2>
            <p className="mt-1 text-sm text-slate-500">El registro no existe o no tienes acceso a él.</p>
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)] lg:overflow-hidden">
          <section className="min-h-[60dvh] min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:min-h-0">
            <FilePane preview={preview} title={documento.titulo} hasFile={Boolean(documento.archivo_path)} />
          </section>
          <aside className="min-h-0 min-w-0 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <Badge tone={getStatusTone(documento.estado?.nombre)}>{documento.estado?.nombre ?? "Sin estado"}</Badge>
              <p className="text-right text-lg font-black">{formatCurrency(Number(documento.monto || 0))}</p>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-4">
              <Field label="Fecha del documento" value={formatDate(documento.fecha_documento)} />
              <Field label="Categoría" value={documento.categoria?.nombre} />
              <Field label="Entidad" value={documento.entidad?.nombre} />
              <Field label="Ingreso / Egreso" value={documento.tipo_movimiento?.nombre} />
              <Field label="Archivador" value={documento.archivador?.nombre ?? "Sin archivador"} />
              <Field label="Extensión" value={documento.extension?.toUpperCase()} />
              <Field label="Subido por" value={documento.usuario?.nombre_completo ?? documento.usuario?.email} wide />
            </dl>
            {documento.descripcion && (
              <div className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-800">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Descripción</p>
                <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-slate-600 dark:text-slate-300">{documento.descripcion}</p>
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
