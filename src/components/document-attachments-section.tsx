import { Download, Eye, Paperclip, Pencil, Plus, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Card, Input, Select } from "./ui";
import { formatDate } from "../lib/utils";
import { validateDocumentoFile } from "../services/storage.service";
import type { CatalogItem, DocumentoAnexo, PendingDocumentoAnexo } from "../types";

interface Props {
  tiposAnexo: CatalogItem[];
  pending: PendingDocumentoAnexo[];
  onPendingChange: (items: PendingDocumentoAnexo[]) => void;
  existing?: DocumentoAnexo[];
  loadingExisting?: boolean;
  allowAdd?: boolean;
  canEditExisting?: boolean;
  canDeleteExisting?: boolean;
  onViewExisting?: (anexo: DocumentoAnexo) => void;
  onDownloadExisting?: (anexo: DocumentoAnexo) => void;
  onEditExisting?: (anexo: DocumentoAnexo) => void;
  onDeleteExisting?: (anexo: DocumentoAnexo) => void;
}

export function DocumentAttachmentsSection({
  tiposAnexo,
  pending,
  onPendingChange,
  existing = [],
  loadingExisting = false,
  allowAdd = true,
  canEditExisting = false,
  canDeleteExisting = false,
  onViewExisting,
  onDownloadExisting,
  onEditExisting,
  onDeleteExisting,
}: Props) {
  const defaultType = tiposAnexo.find((item) => item.activo)?.id ?? "";

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const nextItems: PendingDocumentoAnexo[] = [];
    for (const file of Array.from(files)) {
      try {
        validateDocumentoFile(file);
      } catch (error) {
        toast.error(error instanceof Error ? `${file.name}: ${error.message}` : "No se pudo validar el archivo.");
        continue;
      }
      nextItems.push({
        id: crypto.randomUUID(),
        file,
        titulo: file.name.replace(/\.[^.]+$/, ""),
        tipoAnexoId: defaultType,
        descripcion: "",
      });
    }
    if (nextItems.length) onPendingChange([...pending, ...nextItems]);
  };

  const updatePending = (id: string, values: Partial<PendingDocumentoAnexo>) => {
    onPendingChange(pending.map((item) => item.id === id ? { ...item, ...values } : item));
  };

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-teal-50 p-2.5 text-teal-700 dark:bg-teal-950">
            <Paperclip className="size-5" />
          </div>
          <div>
            <h2 className="font-bold">Anexos y Documentos Complementarios</h2>
            <p className="text-xs text-slate-500">Administra documentos de sustento, referencia o evidencia sin alterar el archivo principal.</p>
          </div>
        </div>
        {allowAdd && (
          <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800">
            <Plus className="size-4" />
            Agregar anexos
            <input type="file" className="hidden" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.txt" onChange={(event) => addFiles(event.target.files)} />
          </label>
        )}
      </div>

      <div className="space-y-4">
        {loadingExisting && <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-800">Cargando anexos...</div>}
        {existing.map((anexo) => (
          <div key={anexo.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_150px_270px] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="break-words font-bold text-slate-900 dark:text-white">{anexo.titulo}</p>
                  <Badge tone="blue">{anexo.tipo_anexo?.nombre ?? "Anexo"}</Badge>
                  <Badge tone="slate">v{anexo.version_actual ?? 1}</Badge>
                </div>
                {anexo.descripcion && <p className="mt-1 break-words text-sm text-slate-500">{anexo.descripcion}</p>}
                <p className="mt-1 break-words text-xs text-slate-400">
                  {anexo.nombre_archivo} · {formatSize(anexo.size_bytes)} · {anexo.extension?.toUpperCase() ?? "ARCHIVO"}
                </p>
              </div>
              <Meta label="Fecha" value={formatDate(anexo.created_at)} />
              <Meta label="Usuario" value={anexo.creador?.nombre_completo ?? anexo.creador?.email ?? "Usuario registrado"} />
              <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                <Button type="button" size="sm" variant="secondary" onClick={() => onViewExisting?.(anexo)}>
                  <Eye className="size-4" />Ver
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => onDownloadExisting?.(anexo)}>
                  <Download className="size-4" />Descargar
                </Button>
                {canEditExisting && (
                  <Button type="button" size="sm" variant="secondary" onClick={() => onEditExisting?.(anexo)}>
                    <Pencil className="size-4" />Editar
                  </Button>
                )}
                {canDeleteExisting && (
                  <Button type="button" size="sm" variant="danger" onClick={() => onDeleteExisting?.(anexo)}>
                    <Trash2 className="size-4" />Eliminar
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}

        {pending.map((item) => (
          <div key={item.id} className="rounded-2xl border border-dashed border-teal-300 bg-teal-50/40 p-4 dark:border-teal-900 dark:bg-teal-950/20">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_220px_minmax(0,1fr)_auto] lg:items-end">
              <div className="min-w-0">
                <p className="flex items-center gap-2 break-words font-bold text-slate-900 dark:text-white"><UploadCloud className="size-4 text-teal-700" />{item.file.name}</p>
                <p className="mt-1 text-xs text-slate-500">{formatSize(item.file.size)} · {item.file.type || "Archivo"}</p>
              </div>
              <label>
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Título *</span>
                <Input value={item.titulo} onChange={(event) => updatePending(item.id, { titulo: event.target.value })} placeholder="Título del anexo" />
              </label>
              <label>
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Tipo *</span>
                <Select className="w-full" value={item.tipoAnexoId} onChange={(event) => updatePending(item.id, { tipoAnexoId: event.target.value })}>
                  <option value="">Seleccionar tipo</option>
                  {tiposAnexo.filter((type) => type.activo).map((type) => <option key={type.id} value={type.id}>{type.nombre}</option>)}
                </Select>
              </label>
              <label>
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Descripción opcional</span>
                <Input value={item.descripcion} onChange={(event) => updatePending(item.id, { descripcion: event.target.value })} placeholder="Detalle breve del anexo" />
              </label>
              <Button type="button" variant="danger" onClick={() => onPendingChange(pending.filter((pendingItem) => pendingItem.id !== item.id))}>
                <Trash2 className="size-4" />Quitar
              </Button>
            </div>
          </div>
        ))}

        {!loadingExisting && !existing.length && !pending.length && (
          <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm text-slate-500 dark:border-slate-800">
            {allowAdd ? "No hay anexos registrados. Puedes agregarlos ahora o incorporarlos posteriormente desde la edición del documento." : "No hay anexos registrados para este documento."}
          </div>
        )}
      </div>
    </Card>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="break-words text-sm text-slate-600 dark:text-slate-300">{value}</p>
    </div>
  );
}

function formatSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)} MB`;
  return `${(size / 1024).toFixed(1)} KB`;
}
