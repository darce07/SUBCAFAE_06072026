import { FileText, LoaderCircle } from "lucide-react";
import { TextFilePreview } from "./text-file-preview";
import { WORD_MIME } from "../lib/documento-mime";

// Piezas compartidas por el visor en pestaña propia y la ventana emergente de vista previa.
export type Preview = { objectUrl: string; signedUrl: string; mimeType: string | null };

export function Field({ label, value, wide }: { label: string; value?: string | null; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-slate-800 dark:text-slate-200">{value || "—"}</dd>
    </div>
  );
}

export function FilePane({ preview, title, hasFile, loading = false }: { preview: Preview | null; title: string; hasFile: boolean; loading?: boolean }) {
  if (loading && !preview) return <div className="grid h-full min-h-48 place-items-center text-sm text-slate-500"><div className="text-center"><LoaderCircle className="mx-auto mb-2 size-7 animate-spin text-teal-600" />Cargando archivo…</div></div>;
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

export function Message({ title, text }: { title: string; text: string }) {
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
