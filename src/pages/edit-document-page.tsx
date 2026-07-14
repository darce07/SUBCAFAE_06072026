import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { CalendarDays, ExternalLink, FilePenLine, LoaderCircle, Paperclip, Save, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button, Card, Input, PageHeader, Select } from "../components/ui";
import { useAuth } from "../features/auth/auth-context";
import { useCatalogos } from "../hooks/use-catalogos";
import { usePermissions } from "../hooks/use-permissions";
import { useUploadDocumento } from "../hooks/use-upload-documento";
import { editDocumento, getDocumentoById } from "../services/documentos.service";
import { EntityCombobox, type EntityDraft } from "../components/entity-combobox";
import { Field, SectionTitle } from "../components/form-field";
import { createOrGetEntidad } from "../services/catalogos.service";
import { DocumentAttachmentsSection } from "../components/document-attachments-section";
import { createDocumentoAnexo, deleteDocumentoAnexo, getDocumentoAnexos, updateDocumentoAnexo } from "../services/anexos.service";
import { downloadDocumentoFile, getDocumentoPreview, releaseDocumentoPreview, removeDocumentoFile, uploadDocumentoAnexoFile } from "../services/storage.service";
import type { DocumentoAnexo, PendingDocumentoAnexo } from "../types";
import { useEntitySearch } from "../hooks/use-entity-search";
import { findMatchingEntity, validateEntityDocument } from "../lib/entity-document";

const minDocumentYear = 2000;
const maxDocumentYear = new Date().getFullYear() + 1;

function isValidDocumentDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  if (year < minDocumentYear || year > maxDocumentYear || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const schema = z.object({
  fecha_documento: z.string()
    .min(1, "Selecciona la fecha del documento.")
    .refine(isValidDocumentDate, `Ingresa una fecha válida entre ${minDocumentYear} y ${maxDocumentYear}.`),
  categoria_id: z.string().min(1, "Selecciona una categoría."),
  tipo_entidad_id: z.string().optional(),
  entidad_id: z.string().optional(),
  tipo_categoria_id: z.string().optional(),
  estado_id: z.string().min(1, "Selecciona un estado."),
  titulo: z.string().trim().min(3, "El título debe tener al menos 3 caracteres."),
  descripcion: z.string().optional(),
  ruta_historica: z.string().optional(),
  archivador_id: z.string().optional(),
  monto: z.number().min(0, "El monto no puede ser negativo."),
  tipo_movimiento_id: z.string().optional(),
  tipo_operacion_id: z.string().optional(),
  archivo: z.instanceof(File).optional(),
});

type FormValues = z.infer<typeof schema>;

export function EditDocumentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const catalogos = useCatalogos({ includeEntidades: false });
  const { session, userContext } = useAuth();
  const watermarkUsuario = userContext?.nombreCompleto ?? userContext?.email ?? "usuario del sistema";
  const { can, canEdit } = usePermissions();
  const canChangeDate = can("documentos", "cambiar_fecha");
  const { upload, uploading } = useUploadDocumento();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [currentExtension, setCurrentExtension] = useState<string | null>(null);
  const [confirmValues, setConfirmValues] = useState<FormValues | null>(null);
  const [entityDraft, setEntityDraft] = useState<EntityDraft>({ nombre: "", tipoDocumento: "", numeroDocumento: "" });
  const [anexos, setAnexos] = useState<DocumentoAnexo[]>([]);
  const [pendingAnexos, setPendingAnexos] = useState<PendingDocumentoAnexo[]>([]);
  const [editingAnexo, setEditingAnexo] = useState<DocumentoAnexo | null>(null);
  const [editAnexoFile, setEditAnexoFile] = useState<File | null>(null);
  const [viewer, setViewer] = useState<{ title: string; objectUrl: string; signedUrl: string; mimeType: string | null } | null>(null);
  const [loadingAnexos, setLoadingAnexos] = useState(false);
  const [savingAnexos, setSavingAnexos] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => () => {
    if (viewer?.objectUrl) releaseDocumentoPreview(viewer.objectUrl);
  }, [viewer]);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { monto: 0 },
  });

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    void getDocumentoById(id)
      .then((documento) => {
        if (!documento) throw new Error("Documento no encontrado.");
        reset({
          fecha_documento: documento.fecha_documento,
          categoria_id: documento.categoria_id,
          tipo_entidad_id: documento.tipo_entidad_id ?? "",
          entidad_id: documento.entidad_id ?? "",
          tipo_categoria_id: documento.tipo_categoria_id ?? "",
          estado_id: documento.estado_id,
          titulo: documento.titulo,
          descripcion: documento.descripcion ?? "",
          ruta_historica: documento.ruta_historica ?? "",
          archivador_id: documento.archivador_id ?? "",
          monto: Number(documento.monto ?? 0),
          tipo_movimiento_id: documento.tipo_movimiento_id ?? "",
          tipo_operacion_id: documento.tipo_operacion_id ?? "",
        });
        setCurrentPath(documento.archivo_path);
        setCurrentExtension(documento.extension);
        setEntityDraft({
          nombre: documento.entidad?.nombre ?? "",
          tipoDocumento: documento.entidad?.tipo_documento ?? "",
          numeroDocumento: documento.entidad?.numero_documento ?? "",
        });
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : "No se pudo cargar el documento."))
      .finally(() => setLoading(false));
  }, [id, reset]);

  useEffect(() => {
    if (!id) return;
    setLoadingAnexos(true);
    void getDocumentoAnexos(id)
      .then(setAnexos)
      .catch((error) => toast.error(error instanceof Error ? error.message : "No se pudieron cargar los anexos."))
      .finally(() => setLoadingAnexos(false));
  }, [id]);

  const selectedEntityType = watch("tipo_entidad_id");
  const selectedEntityId = watch("entidad_id");
  const selectedMovementId = watch("tipo_movimiento_id");
  const selectedFile = watch("archivo");
  const entitySearch = useEntitySearch(selectedEntityType ?? "", entityDraft.nombre);
  const movement = catalogos.tiposMovimiento.find((item) => item.id === selectedMovementId);
  const selectedEntityTypeName = catalogos.tiposEntidad.find((item) => item.id === selectedEntityType)?.nombre;
  const selectedEntityRequiresIdentity = ["persona natural", "proveedor", "trabajador"].includes(selectedEntityTypeName?.toLocaleLowerCase("es") ?? "");
  const noAplica = movement?.nombre.toLocaleLowerCase("es") === "no aplica";
  const canDeleteAnexos = can("anexos", "eliminar") || can("documentos", "eliminar");
  const canEditAnexos = can("anexos", "editar") || can("documentos", "editar");

  const refreshEntitySection = async () => {
    if (!selectedEntityType) {
      toast.error("Selecciona primero el tipo de entidad.");
      return [];
    }
    const results = await entitySearch.refresh(entityDraft.numeroDocumento || entityDraft.nombre) ?? [];
    const existing = findMatchingEntity(results, selectedEntityType, entityDraft.nombre, entityDraft.tipoDocumento, entityDraft.numeroDocumento);
    if (existing) {
      setValue("entidad_id", existing.id, { shouldDirty: true });
      setEntityDraft({
        nombre: existing.nombre,
        tipoDocumento: existing.tipo_documento ?? "",
        numeroDocumento: existing.numero_documento ?? "",
      });
      toast.info("La entidad ya existe. Se seleccionó para continuar la edición.");
    } else {
      toast.info("Se actualizó la búsqueda de entidades.");
    }
    return results;
  };

  useEffect(() => {
    if (noAplica) {
      setValue("monto", 0);
      setValue("tipo_operacion_id", "");
    }
  }, [noAplica, setValue]);

  const save = async (values: FormValues) => {
    if (!id || savingRef.current || !session?.user) return;
    if (pendingAnexos.some((anexo) => !anexo.tipoAnexoId || anexo.titulo.trim().length < 2)) {
      toast.error("Completa el título y tipo de todos los anexos antes de guardar.");
      return;
    }
    savingRef.current = true;
    try {
      let entidadId = values.entidad_id || null;
      if (!entidadId && entityDraft.nombre.trim()) {
        if (!values.tipo_entidad_id) {
          toast.error("Selecciona el tipo de entidad antes de registrar una entidad nueva.");
          return;
        }
        const documentError = validateEntityDocument(entityDraft.tipoDocumento, entityDraft.numeroDocumento, selectedEntityRequiresIdentity);
        if (documentError) {
          toast.error(documentError);
          return;
        }
        const refreshedEntities = await entitySearch.refresh(entityDraft.numeroDocumento || entityDraft.nombre) ?? [];
        const existingEntity = findMatchingEntity(refreshedEntities, values.tipo_entidad_id, entityDraft.nombre, entityDraft.tipoDocumento, entityDraft.numeroDocumento);
        if (existingEntity) {
          entidadId = existingEntity.id;
          setValue("entidad_id", existingEntity.id);
          setEntityDraft({
            nombre: existingEntity.nombre,
            tipoDocumento: existingEntity.tipo_documento ?? "",
            numeroDocumento: existingEntity.numero_documento ?? "",
          });
          toast.info("La entidad ya existe. Se usará ese registro para evitar duplicados.");
        } else {
          const createdEntity = await createOrGetEntidad({
          tipoEntidadId: values.tipo_entidad_id,
          nombre: entityDraft.nombre,
          tipoDocumento: entityDraft.tipoDocumento || null,
          numeroDocumento: entityDraft.numeroDocumento || null,
          });
          entidadId = createdEntity.id;
          setValue("entidad_id", createdEntity.id);
          await catalogos.refresh();
        }
      }
      let archivoPath = currentPath;
      let extension = currentExtension;
      if (values.archivo) {
        const category = catalogos.categorias.find((item) => item.id === values.categoria_id);
        const [anio, mes, dia] = values.fecha_documento.split("-").map(Number);
        const uploaded = await upload(values.archivo, {
          userId: session.user.id,
          idempotencyKey: crypto.randomUUID(),
          categoria: category?.nombre ?? "sin-categoria",
          anio,
          mes,
          dia,
        });
        archivoPath = uploaded.path;
        extension = uploaded.file.name.split(".").pop()?.toLowerCase() ?? null;
      }

      await editDocumento(id, {
        fechaDocumento: values.fecha_documento,
        categoriaId: values.categoria_id,
        tipoEntidadId: values.tipo_entidad_id || null,
        entidadId,
        tipoCategoriaId: values.tipo_categoria_id || null,
        estadoId: values.estado_id,
        titulo: values.titulo,
        descripcion: values.descripcion || null,
        rutaHistorica: values.ruta_historica || null,
        archivadorId: values.archivador_id || null,
        archivoPath,
        extension,
        monto: values.monto,
        tipoMovimientoId: values.tipo_movimiento_id || null,
        tipoOperacionId: noAplica ? null : values.tipo_operacion_id || null,
      });
      if (pendingAnexos.length) {
        if (pendingAnexos.some((anexo) => !anexo.tipoAnexoId || anexo.titulo.trim().length < 2)) {
          toast.error("Completa el título y tipo de todos los anexos antes de guardar.");
          return;
        }
        setSavingAnexos(true);
        const category = catalogos.categorias.find((item) => item.id === values.categoria_id);
        const [anio, mes, dia] = values.fecha_documento.split("-").map(Number);
        for (const anexo of pendingAnexos) {
          const uploadedAnexo = await uploadDocumentoAnexoFile(anexo.file, {
            userId: session.user.id,
            idempotencyKey: crypto.randomUUID(),
            categoria: category?.nombre ?? "sin-categoria",
            anio,
            mes,
            dia,
            documentoId: id,
          });
          const anexoExtension = uploadedAnexo.file.name.includes(".")
            ? uploadedAnexo.file.name.split(".").pop()?.toLowerCase() ?? null
            : null;
          await createDocumentoAnexo({
            documentoId: id,
            tipoAnexoId: anexo.tipoAnexoId,
            titulo: anexo.titulo,
            nombreArchivo: uploadedAnexo.file.name,
            descripcion: anexo.descripcion || null,
            archivoPath: uploadedAnexo.path,
            extension: anexoExtension,
            mimeType: uploadedAnexo.file.type || null,
            sizeBytes: uploadedAnexo.file.size,
          });
        }
        setAnexos(await getDocumentoAnexos(id));
        setPendingAnexos([]);
      }
      toast.success("Documento actualizado y auditado.");
      navigate(`/documentos/${id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el documento.");
    } finally {
      setSavingAnexos(false);
      savingRef.current = false;
      setConfirmValues(null);
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
        codigo: anexo.nombre_archivo,
        usuario: watermarkUsuario,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo descargar el anexo.");
    }
  };

  const saveEditedAnexo = async () => {
    if (!editingAnexo || !id || !session?.user) return;
    if (!editingAnexo.titulo.trim() || !editingAnexo.tipo_anexo_id) {
      toast.error("El título y tipo del anexo son obligatorios.");
      return;
    }
    setSavingAnexos(true);
    const previousPath = editingAnexo.archivo_path;
    try {
      let filePayload: Partial<{
        nombreArchivo: string;
        archivoPath: string;
        extension: string | null;
        mimeType: string | null;
        sizeBytes: number;
      }> = {};
      if (editAnexoFile) {
        const fecha = watch("fecha_documento");
        const [anio, mes, dia] = fecha.split("-").map(Number);
        const category = catalogos.categorias.find((item) => item.id === watch("categoria_id"));
        const uploaded = await uploadDocumentoAnexoFile(editAnexoFile, {
          userId: session.user.id,
          idempotencyKey: crypto.randomUUID(),
          categoria: category?.nombre ?? "sin-categoria",
          anio,
          mes,
          dia,
          documentoId: id,
        });
        filePayload = {
          nombreArchivo: uploaded.file.name,
          archivoPath: uploaded.path,
          extension: uploaded.file.name.split(".").pop()?.toLowerCase() ?? null,
          mimeType: uploaded.file.type || null,
          sizeBytes: uploaded.file.size,
        };
      }
      await updateDocumentoAnexo({
        id: editingAnexo.id,
        tipoAnexoId: editingAnexo.tipo_anexo_id,
        titulo: editingAnexo.titulo,
        descripcion: editingAnexo.descripcion || null,
        ...filePayload,
      });
      if (filePayload.archivoPath && previousPath !== filePayload.archivoPath) {
        await removeDocumentoFile(previousPath);
      }
      setAnexos(await getDocumentoAnexos(id));
      setEditingAnexo(null);
      setEditAnexoFile(null);
      toast.success("Anexo actualizado correctamente.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el anexo.");
    } finally {
      setSavingAnexos(false);
    }
  };

  const removeAnexo = async (anexo: DocumentoAnexo) => {
    try {
      await deleteDocumentoAnexo(anexo.id);
      setAnexos((current) => current.filter((item) => item.id !== anexo.id));
      toast.success("Anexo eliminado correctamente.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar el anexo.");
    }
  };

  if (!canEdit("documentos")) {
    return <Card className="p-8 text-center"><h1 className="text-xl font-bold">Acceso restringido</h1><p className="mt-2 text-sm text-slate-500">No tienes permiso para editar documentos.</p></Card>;
  }
  if (loading) return <DocumentFormSkeleton />;
  if (loadError) return <Card className="p-6 text-sm text-rose-700">{loadError}</Card>;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader
        eyebrow="Gestión documental"
        title="Editar documento"
        description="Actualiza únicamente los metadatos permitidos. Cada cambio queda registrado en auditoría."
      />
      <form onSubmit={handleSubmit(setConfirmValues)} className="space-y-6">
        <Card className="p-5 sm:p-6">
          <SectionTitle icon={<FilePenLine />} title="Datos editables" description="La información de control del registro permanece protegida." />
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Fecha del documento *" error={errors.fecha_documento?.message}>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input type="date" min={`${minDocumentYear}-01-01`} max={`${maxDocumentYear}-12-31`} readOnly={!canChangeDate} className={`pl-9 ${!canChangeDate ? "cursor-not-allowed bg-slate-100 text-slate-500 dark:bg-slate-800" : ""}`} {...register("fecha_documento")} />
              </div>
              {!canChangeDate && <span className="mt-1 block text-xs text-amber-700">Tu rol actual no permite modificar la fecha.</span>}
            </Field>
            <Field label="Categoría *" error={errors.categoria_id?.message}><Select className="w-full" {...register("categoria_id")}>{catalogos.categorias.filter((item) => item.activo).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</Select></Field>
            <Field label="Estado *" error={errors.estado_id?.message}><Select className="w-full" {...register("estado_id")}>{catalogos.estadosDocumento.filter((item) => item.activo).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</Select></Field>
            <Field label="Título *" error={errors.titulo?.message} className="md:col-span-2"><Input {...register("titulo")} /></Field>
            <Field label="Tipo de entidad">
              <Select
                className="w-full"
                {...register("tipo_entidad_id")}
                onChange={(event) => {
                  setValue("tipo_entidad_id", event.target.value, { shouldDirty: true });
                  setValue("entidad_id", "", { shouldDirty: true });
                  setEntityDraft({ nombre: "", tipoDocumento: "", numeroDocumento: "" });
                }}
              >
                <option value="">No especificado</option>
                {catalogos.tiposEntidad.filter((item) => item.activo).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
              </Select>
            </Field>
            <Field label="Entidad" className="md:col-span-2">
              <input type="hidden" {...register("entidad_id")} />
              <EntityCombobox
                entities={entitySearch.entities}
                entityTypeId={selectedEntityType ?? ""}
                entityTypeName={selectedEntityTypeName}
                value={selectedEntityId ?? ""}
                draft={entityDraft}
                onChange={(entityId) => setValue("entidad_id", entityId, { shouldDirty: true })}
                onDraftChange={setEntityDraft}
                loading={entitySearch.loading}
                error={entitySearch.error}
                onRefresh={() => void refreshEntitySection()}
              />
            </Field>
            <Field label="Tipo de categoría"><Select className="w-full" {...register("tipo_categoria_id")}><option value="">No especificado</option>{catalogos.tiposCategoria.filter((item) => item.activo).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</Select></Field>
            <Field label="Archivador"><Select className="w-full" {...register("archivador_id")}><option value="">Sin archivador</option>{catalogos.archivadores.filter((item) => item.activo).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</Select></Field>
            <Field label="Tipo de movimiento"><Select className="w-full" {...register("tipo_movimiento_id")}><option value="">No especificado</option>{catalogos.tiposMovimiento.filter((item) => item.activo).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</Select></Field>
            <Field label="Tipo de operación"><Select className="w-full" disabled={noAplica} {...register("tipo_operacion_id")}><option value="">No especificada</option>{catalogos.tiposOperacion.filter((item) => item.activo).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</Select></Field>
            <Field label="Monto" error={errors.monto?.message}><Input type="number" min="0" step="0.01" disabled={noAplica} {...register("monto", { valueAsNumber: true })} /></Field>
            <Field label="Descripción" className="md:col-span-2"><textarea className="min-h-28 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-950" {...register("descripcion")} /></Field>
            <Field label="Ruta histórica" className="md:col-span-2"><textarea className="min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-sm outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-950" {...register("ruta_historica")} /></Field>
          </div>
        </Card>
        <Card className="p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2"><Paperclip className="size-4 text-teal-700" /><h2 className="font-bold">Reemplazar archivo digital</h2></div>
          <p className="mb-4 break-all text-xs text-slate-500">Actual: {currentPath ?? "Sin archivo"}</p>
          <label className="flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed border-slate-300 p-5 transition hover:border-teal-500 dark:border-slate-700">
            <UploadCloud className="size-7 text-teal-600" />
            <div><p className="text-sm font-semibold">{selectedFile?.name ?? "Seleccionar un archivo nuevo"}</p><p className="text-xs text-slate-500">Es opcional. El archivo anterior conserva su trazabilidad en auditoría.</p></div>
            <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp" onChange={(event) => setValue("archivo", event.target.files?.[0])} />
          </label>
        </Card>
        <DocumentAttachmentsSection
          tiposAnexo={catalogos.tiposAnexo}
          existing={anexos}
          loadingExisting={loadingAnexos}
          pending={pendingAnexos}
          onPendingChange={setPendingAnexos}
          canEditExisting={canEditAnexos}
          canDeleteExisting={canDeleteAnexos}
          onViewExisting={viewAnexo}
          onDownloadExisting={downloadAnexo}
          onEditExisting={(anexo) => {
            setEditingAnexo({ ...anexo });
            setEditAnexoFile(null);
          }}
          onDeleteExisting={removeAnexo}
        />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate(`/documentos/${id}`)}>Cancelar</Button>
          <Button type="submit" loading={isSubmitting || uploading || savingAnexos}><Save className="size-4" />Revisar cambios</Button>
        </div>
      </form>
      {confirmValues && (
        <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-4">
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="modal-panel rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:p-6" style={{ "--modal-width": "32rem" } as React.CSSProperties}>
            <div className="flex items-start justify-between"><div><h2 className="text-lg font-bold">Confirmar actualización</h2><p className="mt-1 text-sm text-slate-500">Se guardarán los metadatos y se generará un registro de auditoría.</p></div><button onClick={() => setConfirmValues(null)}><X className="size-5" /></button></div>
            <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-950"><strong>{confirmValues.titulo}</strong><p className="mt-1 text-xs text-slate-500">{selectedFile ? `También se reemplazará por ${selectedFile.name}.` : "El archivo digital actual no cambiará."}</p></div>
            <div className="mt-6 flex justify-end gap-3"><Button variant="secondary" onClick={() => setConfirmValues(null)}>Volver</Button><Button loading={uploading || savingRef.current || savingAnexos} onClick={() => void save(confirmValues)}><Save className="size-4" />Guardar cambios</Button></div>
          </motion.div>
        </div>
      )}
      {editingAnexo && (
        <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-4">
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="modal-panel rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:p-6" style={{ "--modal-width": "42rem" } as React.CSSProperties}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">Editar anexo</h2>
                <p className="mt-1 text-sm text-slate-500">Actualiza metadatos o reemplaza el archivo complementario.</p>
              </div>
              <button onClick={() => { setEditingAnexo(null); setEditAnexoFile(null); }}><X className="size-5" /></button>
            </div>
            <div className="mt-5 grid gap-4">
              <label>
                <span className="mb-2 block text-sm font-semibold">Título *</span>
                <Input value={editingAnexo.titulo} onChange={(event) => setEditingAnexo({ ...editingAnexo, titulo: event.target.value })} />
              </label>
              <label>
                <span className="mb-2 block text-sm font-semibold">Tipo de documento *</span>
                <Select className="w-full" value={editingAnexo.tipo_anexo_id} onChange={(event) => setEditingAnexo({ ...editingAnexo, tipo_anexo_id: event.target.value })}>
                  {catalogos.tiposAnexo.filter((item) => item.activo).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                </Select>
              </label>
              <label>
                <span className="mb-2 block text-sm font-semibold">Descripción</span>
                <textarea value={editingAnexo.descripcion ?? ""} onChange={(event) => setEditingAnexo({ ...editingAnexo, descripcion: event.target.value })} className="min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-950" />
              </label>
              <label className="flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed border-slate-300 p-5 transition hover:border-teal-500 dark:border-slate-700">
                <UploadCloud className="size-7 text-teal-600" />
                <div>
                  <p className="text-sm font-semibold">{editAnexoFile?.name ?? "Reemplazar archivo físico del anexo"}</p>
                  <p className="text-xs text-slate-500">Opcional. Si subes uno nuevo, el archivo anterior se retirará del almacenamiento.</p>
                </div>
                <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.txt" onChange={(event) => setEditAnexoFile(event.target.files?.[0] ?? null)} />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => { setEditingAnexo(null); setEditAnexoFile(null); }}>Cancelar</Button>
              <Button loading={savingAnexos} onClick={() => void saveEditedAnexo()}><Save className="size-4" />Guardar anexo</Button>
            </div>
          </motion.div>
        </div>
      )}
      {viewer && <FileViewerModal preview={viewer} onClose={() => setViewer(null)} />}
    </motion.div>
  );
}

function FileViewerModal({ preview, onClose }: { preview: { title: string; objectUrl: string; signedUrl: string; mimeType: string | null }; onClose: () => void }) {
  const isImage = preview.mimeType?.startsWith("image/");
  const isPdf = preview.mimeType === "application/pdf";
  const title = preview.title;
  const url = preview.objectUrl;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm">
      <div className="flex h-[92dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="min-w-0">
            <h2 className="truncate font-bold">{title}</h2>
            <p className="text-xs text-slate-500">Vista integrada</p>
          </div>
          <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => window.open(preview.signedUrl, "_blank", "noopener,noreferrer")}><ExternalLink className="size-4" />Abrir en nueva pestaña</Button><Button variant="secondary" onClick={onClose}>Cerrar</Button></div>
        </div>
        <div className="grid min-h-0 flex-1 place-items-center bg-slate-100 p-3 dark:bg-slate-950">
          {isImage ? (
            <img src={url} alt={title} className="max-h-full rounded-xl object-contain" />
          ) : isPdf ? (
            <iframe src={url} title={title} className="h-full w-full rounded-xl bg-white" />
          ) : (
            <div className="max-w-md rounded-2xl bg-white p-6 text-center shadow-sm dark:bg-slate-900">
              <FilePenLine className="mx-auto mb-3 size-10 text-teal-700" />
              <h3 className="font-bold">Vista previa no disponible</h3>
              <p className="mt-2 text-sm text-slate-500">Este tipo de archivo puede descargarse para revisarlo con una aplicación compatible.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DocumentFormSkeleton() {
  return <div className="space-y-6"><div className="h-20 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" /><Card className="grid min-h-[520px] place-items-center"><LoaderCircle className="size-8 animate-spin text-teal-600" /></Card></div>;
}
