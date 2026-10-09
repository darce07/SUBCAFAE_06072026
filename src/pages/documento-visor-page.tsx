import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Download, ExternalLink, FileText, LoaderCircle, X } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button } from "../components/ui";
import { TextFilePreview } from "../components/text-file-preview";
import { useAuth } from "../features/auth/auth-context";
import { formatCurrency, formatDate, getStatusTone } from "../lib/utils";
import { getDocumentoById } from "../services/documentos.service";
import { downloadDocumentoFile, getDocumentoPreview, releaseDocumentoPreview } from "../services/storage.service";
import type { Documento } from "../types";

type Preview = { objectUrl: string; signedUrl: string; mimeType: string | null };

const WORD_MIME = ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

function mimeFromExtension(extension?: string | null) {
  const value = extension?.toLocaleLowerCase("es");
  if (value === "pdf") return "application/pdf";
  if (["jpg", "jpeg"].includes(value ?? "")) return "image/jpeg";
  if (value === "png") return "image/png";
  if (value === "webp") return "image/webp";
  if (value === "doc") return WORD_MIME[0];
  if (value === "docx") return WORD_MIME[1];
  if (value === "txt") return "text/plain";
  return null;
}

// Visor para comparar: el archivo a un lado y los datos del documento al otro.
// Se abre en una ventana propia (sin menú lateral) para poder ponerla junto a
// otra ventana, otro documento o el papel que se está revisando.
export function DocumentoVisorPage() {
  const { id } = useParams();
  const { userContext } = useAuth();
  const [documento, setDocumento] = useState<Documento | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let objectUrl = "";
    void (async () => {
      try {
        const row = await getDocumentoById(id);
        if (cancelled) return;
        setDocumento(row);
        if (row) document.title = `${row.codigo_documento} · ${row.titulo}`;
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

  if (loading) return <div className="grid min-h-dvh place-items-center bg-slate-50 dark:bg-slate-950"><LoaderCircle className="size-8 animate-spin text-teal-600" /></div>;
  if (!documento) {
    return (
      <div className="grid min-h-dvh place-items-center bg-slate-50 p-6 text-center dark:bg-slate-950">
        <div>
          <FileText className="mx-auto mb-3 size-10 text-slate-400" />
          <h1 className="font-bold">{error ?? "Documento no encontrado"}</h1>
          <p className="mt-1 text-sm text-slate-500">El registro no existe o no tienes acceso a él.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-slate-100 dark:bg-slate-950">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-teal-700 dark:text-teal-400">{documento.codigo_documento}</p>
          <h1 className="truncate text-sm font-bold" title={documento.titulo}>{documento.titulo}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {preview?.signedUrl && (
            <Button size="sm" variant="secondary" onClick={() => window.open(preview.signedUrl, "_blank", "noopener,noreferrer")}><ExternalLink className="size-4" />Abrir archivo</Button>
          )}
          <Button size="sm" variant="secondary" disabled={!documento.archivo_path} onClick={() => void download()}><Download className="size-4" />Descargar</Button>
          <Link to={`/documentos/${documento.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <FileText className="size-4" />Detalle completo
          </Link>
          <Button size="sm" variant="ghost" aria-label="Cerrar ventana" onClick={() => window.close()}><X className="size-4" /></Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
        <section className="min-h-[60dvh] min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:min-h-0">
          <FilePane preview={preview} title={documento.titulo} hasFile={Boolean(documento.archivo_path)} />
        </section>

        <aside className="min-h-0 min-w-0 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3">
            <Badge tone={getStatusTone(documento.estado?.nombre)}>{documento.estado?.nombre ?? "Sin estado"}</Badge>
            <p className="text-right text-lg font-black">{formatCurrency(Number(documento.monto || 0))}</p>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-4">
            <Field label="Fecha del documento" value={formatDate(documento.fecha_documento)} />
            <Field label="Categoría" value={documento.categoria?.nombre} />
            <Field label="Tipo de gestión" value={documento.tipo_categoria?.nombre} />
            <Field label="Entidad" value={documento.entidad?.nombre} />
            <Field label="Tipo de entidad" value={documento.tipo_entidad?.nombre} />
            <Field label="Ingreso / Egreso" value={documento.tipo_movimiento?.nombre} />
            <Field label="Tipo de operación" value={documento.tipo_operacion?.nombre} />
            <Field label="Archivador" value={documento.archivador?.nombre ?? "Sin archivador"} />
            <Field label="Extensión" value={documento.extension?.toUpperCase()} />
            <Field label="Fecha de registro" value={documento.created_at ? formatDate(documento.created_at) : null} />
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
    </div>
  );
}

function Field({ label, value, wide }: { label: string; value?: string | null; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-slate-800 dark:text-slate-200">{value || "—"}</dd>
    </div>
  );
}

function FilePane({ preview, title, hasFile }: { preview: Preview | null; title: string; hasFile: boolean }) {
  if (!hasFile) return <Message title="Sin archivo digital" text="Este documento no tiene un archivo asociado." />;
  if (!preview) return <Message title="No se pudo cargar el archivo" text="Prueba con Abrir archivo o Descargar, en la parte de arriba." />;
  const mime = preview.mimeType;
  if (mime?.startsWith("image/")) {
    return <div className="grid h-full place-items-center overflow-auto bg-slate-100 p-3 dark:bg-slate-950"><img src={preview.objectUrl} alt={title} className="max-h-full max-w-full object-contain" /></div>;
  }
  if (mime === "application/pdf") return <iframe src={preview.objectUrl} title={title} className="h-full w-full" />;
  if (mime && WORD_MIME.includes(mime)) {
    return <iframe src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(preview.signedUrl)}`} title={title} className="h-full w-full" />;
  }
  if (mime?.startsWith("text/")) return <div className="h-full overflow-auto p-3"><TextFilePreview url={preview.objectUrl} /></div>;
  return <Message title="Vista previa no disponible" text="Este tipo de archivo se puede abrir o descargar con los botones de arriba." />;
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <div className="grid h-full min-h-48 place-items-center p-6 text-center">
      <div>
        <FileText className="mx-auto mb-3 size-10 text-teal-700" />
        <h2 className="font-bold">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{text}</p>
      </div>
    </div>
  );
}
