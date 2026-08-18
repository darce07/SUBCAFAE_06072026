import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Clipboard, Download, ExternalLink, FileText, History, LoaderCircle, MapPin, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { DocumentAuditRecord, Documento, DocumentoAnexo, PendingDocumentoAnexo } from "../types";
import { Badge, Button, Card, EmptyState, PageHeader } from "../components/ui";
import { DocumentAttachmentsSection } from "../components/document-attachments-section";
import { ConfirmDialog } from "../components/confirm-dialog";
import { TextFilePreview } from "../components/text-file-preview";
import { deleteDocumento, getDocumentoById, getDocumentoHistory } from "../services/documentos.service";
import { deleteDocumentoAnexo, getDocumentoAnexos } from "../services/anexos.service";
import { formatCurrency, formatDate, getStatusTone } from "../lib/utils";
import { downloadDocumentoFile, getDocumentoPreview, releaseDocumentoPreview } from "../services/storage.service";
import { usePermissions } from "../hooks/use-permissions";
import { useCatalogos } from "../hooks/use-catalogos";
import { useAuth } from "../features/auth/auth-context";

export function DocumentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const catalogos = useCatalogos();
  const { canDelete, canEdit, can } = usePermissions();
  const { userContext } = useAuth();
  const watermarkUsuario = userContext?.nombreCompleto ?? userContext?.email ?? "usuario del sistema";
  const [documento, setDocumento] = useState<Documento | null>(null);
  const [anexos, setAnexos] = useState<DocumentoAnexo[]>([]);
  const [history, setHistory] = useState<DocumentAuditRecord[]>([]);
  const [viewer, setViewer] = useState<{ title: string; objectUrl: string; signedUrl: string; mimeType: string | null } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingRemoveAnexo, setPendingRemoveAnexo] = useState<DocumentoAnexo | null>(null);
  const [pendingRemoveDocument, setPendingRemoveDocument] = useState(false);
  const canManageAnexos = can("anexos", "editar") || canEdit("documentos");

  useEffect(() => () => {
    if (viewer?.objectUrl) releaseDocumentoPreview(viewer.objectUrl);
  }, [viewer]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    void Promise.all([getDocumentoById(id), getDocumentoHistory(id), getDocumentoAnexos(id)])
      .then(([documentRow, historyRows, anexosRows]) => {
        if (cancelled) return;
        setDocumento(documentRow);
        setHistory(historyRows);
        setAnexos(anexosRows);
      })
      .catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "No se pudo cargar el documento.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <div className="grid min-h-96 place-items-center"><LoaderCircle className="size-8 animate-spin text-teal-600" /></div>;
  if (!documento) return <EmptyState icon={<FileText />} title="Documento no encontrado" description="El registro solicitado no existe o no está disponible." />;

  const viewMainFile = async () => {
    if (!documento.archivo_path) return;
    try {
      const preview = await getDocumentoPreview(documento.archivo_path);
      setViewer({ title: documento.titulo, ...preview, mimeType: preview.objectUrl ? preview.mimeType ?? mimeFromExtension(documento.extension) : null });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo abrir el archivo.");
    }
  };

  const downloadMainFile = async () => {
    if (!documento.archivo_path) return;
    try {
      await downloadDocumentoFile(
        documento.archivo_path,
        `${documento.codigo_documento}.${documento.extension ?? "archivo"}`,
        { codigo: documento.codigo_documento, usuario: watermarkUsuario },
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo descargar el archivo.");
    }
  };

  const viewAnexo = async (anexo: DocumentoAnexo) => {
    try {
      const preview = await getDocumentoPreview(anexo.archivo_path);
      setViewer({ title: anexo.titulo, ...preview, mimeType: preview.objectUrl ? preview.mimeType ?? anexo.mime_type : null });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo abrir el anexo.");
    }
  };

  const downloadAnexo = async (anexo: DocumentoAnexo) => {
    try {
      await downloadDocumentoFile(anexo.archivo_path, anexo.nombre_archivo, {
        codigo: documento?.codigo_documento ?? anexo.nombre_archivo,
        usuario: watermarkUsuario,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo descargar el anexo.");
    }
  };

  const removeAnexo = async (anexo: DocumentoAnexo) => {
    try {
      await deleteDocumentoAnexo(anexo.id);
      setAnexos((current) => current.filter((item) => item.id !== anexo.id));
      toast.success("Anexo eliminado correctamente.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar el anexo.");
    } finally {
      setPendingRemoveAnexo(null);
    }
  };

  const removeDocument = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteDocumento(documento.id);
      toast.success("Documento eliminado de forma segura.");
      navigate("/documentos");
    } catch (removeError) {
      toast.error(removeError instanceof Error ? removeError.message : "No se pudo eliminar el documento.");
    } finally {
      setDeleting(false);
      setPendingRemoveDocument(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={documento.codigo_documento}
        title={documento.titulo}
        description={`${documento.categoria?.nombre ?? "Sin categoría"} · ${formatDate(documento.fecha_documento)}`}
        action={(
          <div className="flex flex-wrap gap-2">
            {canEdit("documentos") && <Button variant="secondary" onClick={() => navigate(`/documentos/${documento.id}/editar`)}><Pencil className="size-4" />Editar</Button>}
            <Button variant="secondary" disabled={!documento.archivo_path} onClick={() => void viewMainFile()}><ExternalLink className="size-4" />Ver</Button>
            <Button disabled={!documento.archivo_path} onClick={() => void downloadMainFile()}><Download className="size-4" />Descargar</Button>
            {canDelete("documentos") && <Button variant="danger" loading={deleting} onClick={() => setPendingRemoveDocument(true)}><Trash2 className="size-4" />Eliminar</Button>}
          </div>
        )}
      />

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-bold">Documento Principal</h2>
          <p className="text-sm text-slate-500">Información general, archivo principal y trazabilidad del registro.</p>
        </div>
        <div className="grid min-w-0 gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Estado actual</p>
                <div className="mt-2"><Badge tone={getStatusTone(documento.estado?.nombre)}>{documento.estado?.nombre ?? "Sin estado"}</Badge></div>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase text-slate-400">Monto</p>
                <p className="text-xl font-black">{formatCurrency(Number(documento.monto || 0))}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-6 sm:gap-5 dark:border-slate-800">
              <Info label="Categoría" value={documento.categoria?.nombre} />
              <Info label="Tipo de gestión" value={documento.tipo_categoria?.nombre} />
              <Info label="Tipo de entidad" value={documento.tipo_entidad?.nombre} />
              <Info label="Entidad" value={documento.entidad?.nombre} />
              <Info label="Ingreso / Egreso" value={documento.tipo_movimiento?.nombre} />
              <Info label="Tipo de operación" value={documento.tipo_operacion?.nombre} />
              <Info label="Extensión" value={documento.extension?.toUpperCase()} />
              <Info label="Fecha del documento" value={formatDate(documento.fecha_documento)} />
              <Info label="Fecha de registro" value={documento.created_at ? formatDate(documento.created_at) : null} />
              <Info label="Subido por" value={documento.usuario?.nombre_completo ?? documento.usuario?.email ?? "Dato no disponible"} />
            </div>
            {documento.descripcion && (
              <div className="border-t border-slate-100 pt-6 dark:border-slate-800">
                <p className="text-xs font-semibold uppercase text-slate-400">Descripción</p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{documento.descripcion}</p>
              </div>
            )}
          </div>
          <div className="space-y-4">
            <Card className="p-5">
              <h3 className="font-bold">Archivo principal</h3>
              <p className="mt-2 text-xs text-slate-500">
                {documento.archivo_path
                  ? "Disponible para consulta y descarga. Usa los botones \"Ver\" y \"Descargar\" de la parte superior."
                  : "No existe un archivo digital asociado."}
              </p>
            </Card>
            <Card className="p-5">
              <div className="mb-4 flex items-center gap-2"><MapPin className="size-5 text-orange-600" /><h3 className="font-bold">Ubicación física</h3></div>
              <p className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-950">{documento.archivador?.nombre ?? "Sin archivador asignado"}</p>
            </Card>
            <Card className="p-5">
              <h3 className="font-bold">Ruta histórica</h3>
              <p className="mt-4 break-all rounded-xl bg-slate-50 p-4 font-mono text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-400">{documento.ruta_historica ?? "Sin ruta histórica"}</p>
              <Button variant="secondary" className="mt-4 w-full" disabled={!documento.ruta_historica} onClick={() => { void navigator.clipboard.writeText(documento.ruta_historica ?? ""); toast.success("Ruta copiada."); }}><Clipboard className="size-4" />Copiar ruta</Button>
            </Card>
          </div>
        </div>
      </Card>

      <DocumentAttachmentsSection
        tiposAnexo={catalogos.tiposAnexo}
        existing={anexos}
        pending={[] as PendingDocumentoAnexo[]}
        onPendingChange={() => undefined}
        allowAdd={false}
        canEditExisting={canManageAnexos}
        canDeleteExisting={canDelete("anexos")}
        onViewExisting={viewAnexo}
        onDownloadExisting={downloadAnexo}
        onEditExisting={() => navigate(`/documentos/${documento.id}/editar`)}
        onDeleteExisting={setPendingRemoveAnexo}
      />

      <Card className="p-6">
        <div className="mb-5 flex items-center gap-2"><History className="size-5 text-teal-700" /><h2 className="font-bold">Historial de cambios</h2></div>
        {history.length === 0 ? <p className="text-sm text-slate-500">Todavía no existen eventos de auditoría visibles.</p> : <div>{history.map((event, index) => {
          const changes = changedFields(event.valor_anterior, event.valor_nuevo);
          return <motion.div key={event.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.04 }} className="relative border-l-2 border-teal-200 pb-6 pl-6 last:pb-0 dark:border-teal-900"><span className="absolute -left-[7px] top-1 size-3 rounded-full bg-teal-600 ring-4 ring-white dark:ring-slate-900" /><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{event.accion === "INSERT" ? "Documento registrado" : event.accion === "UPDATE" ? "Documento actualizado" : "Documento eliminado"}</p><span className="text-xs text-slate-500">{new Date(event.created_at).toLocaleString("es-PE")}</span></div><p className="mt-1 text-xs text-slate-500">{event.usuario_nombre || event.usuario_email || "Usuario del sistema"}</p>{changes.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{changes.map((field) => <Badge key={field} tone="slate">{field}</Badge>)}</div>}</motion.div>;
        })}</div>}
      </Card>

      {viewer && <FileViewerModal preview={viewer} onClose={() => setViewer(null)} />}

      <ConfirmDialog
        open={pendingRemoveAnexo !== null}
        onOpenChange={(nextOpen) => { if (!nextOpen) setPendingRemoveAnexo(null); }}
        title="Eliminar anexo"
        description={pendingRemoveAnexo ? `¿Eliminar el anexo ${pendingRemoveAnexo.titulo}?` : ""}
        confirmLabel="Eliminar"
        onConfirm={() => { if (pendingRemoveAnexo) void removeAnexo(pendingRemoveAnexo); }}
      />
      <ConfirmDialog
        open={pendingRemoveDocument}
        onOpenChange={setPendingRemoveDocument}
        title="Eliminar documento"
        description={`¿Eliminar el documento ${documento.codigo_documento}? La baja quedará registrada en auditoría.`}
        confirmLabel="Eliminar"
        loading={deleting}
        onConfirm={() => void removeDocument()}
      />
    </div>
  );
}

function FileViewerModal({ preview, onClose }: { preview: { title: string; objectUrl: string; signedUrl: string; mimeType: string | null }; onClose: () => void }) {
  const isImage = preview.mimeType?.startsWith("image/");
  const isPdf = preview.mimeType === "application/pdf";
  const isText = preview.mimeType?.startsWith("text/");
  const isWord = preview.mimeType === "application/msword" || preview.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const url = preview.objectUrl;
  const title = preview.title;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm">
      <div className="flex h-[92dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="min-w-0">
            <h2 className="truncate font-bold">{preview.title}</h2>
            <p className="text-xs text-slate-500">Vista integrada</p>
          </div>
          <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => window.open(preview.signedUrl, "_blank", "noopener,noreferrer")}><ExternalLink className="size-4" />Abrir en nueva pestaña</Button><button onClick={onClose} className="rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="size-5" /></button></div>
        </div>
        <div className="grid min-h-0 flex-1 place-items-center bg-slate-100 p-3 dark:bg-slate-950">
          {isImage ? <img src={url} alt={title} className="max-h-full rounded-xl object-contain" /> : isPdf ? <iframe src={url} title={title} className="h-full w-full rounded-xl bg-white" /> : isWord ? <iframe src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(preview.signedUrl)}`} title={title} className="h-full w-full rounded-xl bg-white" /> : isText ? <TextFilePreview url={url} /> : <div className="max-w-md rounded-2xl bg-white p-6 text-center shadow-sm dark:bg-slate-900"><FileText className="mx-auto mb-3 size-10 text-teal-700" /><h3 className="font-bold">Vista previa no disponible</h3><p className="mt-2 text-sm text-slate-500">Este tipo de archivo puede descargarse para revisarlo con una aplicación compatible.</p></div>}
        </div>
      </div>
    </div>
  );
}

const auditLabels: Record<string, string> = {
  fecha_documento: "Fecha del documento",
  categoria_id: "Categoría",
  tipo_entidad_id: "Tipo de entidad",
  entidad_id: "Entidad",
  tipo_categoria_id: "Tipo de gestión",
  estado_id: "Estado",
  titulo: "Título",
  descripcion: "Descripción",
  ruta_historica: "Ruta histórica",
  archivador_id: "Archivador",
  archivo_path: "Archivo digital",
  extension: "Extensión",
  monto: "Monto",
  tipo_movimiento_id: "Movimiento",
  tipo_operacion_id: "Operación",
};

function changedFields(previous: Record<string, unknown> | null, next: Record<string, unknown> | null) {
  if (!previous || !next) return [];
  return Object.keys(auditLabels).filter((key) => previous[key] !== next[key]).map((key) => auditLabels[key]);
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-800 dark:text-slate-200">{value || "—"}</p></div>;
}

function mimeFromExtension(extension?: string | null) {
  const value = extension?.toLocaleLowerCase("es");
  if (value === "pdf") return "application/pdf";
  if (["jpg", "jpeg"].includes(value ?? "")) return "image/jpeg";
  if (value === "png") return "image/png";
  if (value === "webp") return "image/webp";
  return null;
}
