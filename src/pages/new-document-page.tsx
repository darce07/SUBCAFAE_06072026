import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, FileText, Landmark, MapPin, Paperclip, Save, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Input, PageHeader, Select } from "../components/ui";
import { useCatalogos } from "../hooks/use-catalogos";
import { useUploadDocumento } from "../hooks/use-upload-documento";
import { createDocumento } from "../services/documentos.service";
import { useAuth } from "../features/auth/auth-context";
import { isSupabaseConfigured } from "../lib/supabase";
import { usePermissions } from "../hooks/use-permissions";
import { EntityCombobox, type EntityDraft } from "../components/entity-combobox";
import { createOrGetEntidad } from "../services/catalogos.service";
import { DocumentAttachmentsSection } from "../components/document-attachments-section";
import { createDocumentoAnexo } from "../services/anexos.service";
import { uploadDocumentoAnexoFile } from "../services/storage.service";
import type { PendingDocumentoAnexo } from "../types";
import { useEntitySearch } from "../hooks/use-entity-search";
import { findMatchingEntity, validateEntityDocument } from "../lib/entity-document";

const schema = z.object({
  categoria_id: z.string().min(1, "Selecciona una categoría."),
  fecha_documento: z.string().min(1, "Selecciona la fecha."),
  tipo_entidad_id: z.string().optional(),
  entidad_id: z.string().optional(),
  tipo_categoria_id: z.string().optional(),
  estado_id: z.string().min(1, "Selecciona un estado."),
  monto: z.number().min(0, "El monto debe ser 0 o un número positivo."),
  tipo_movimiento_id: z.string().optional(),
  tipo_movimiento_nombre: z.string().optional(),
  tipo_operacion_id: z.string().optional(),
  titulo: z.string().min(3, "Ingresa el título del archivo."),
  descripcion: z.string().optional(),
  ruta_historica: z.string().optional(),
  archivador_id: z.string().optional(),
  archivo: z.instanceof(File, { message: "Selecciona un archivo digital." }),
}).superRefine((values, context) => {
  const movement = values.tipo_movimiento_nombre?.toLocaleLowerCase("es") ?? "";
  if ((movement === "ingreso" || movement === "egreso") && !values.tipo_operacion_id) {
    context.addIssue({
      code: "custom",
      path: ["tipo_operacion_id"],
      message: "Selecciona el tipo de operación para ingresos o egresos.",
    });
  }
});

type FormValues = z.infer<typeof schema>;

export function NewDocumentPage() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [entityDraft, setEntityDraft] = useState<EntityDraft>({ nombre: "", tipoDocumento: "", numeroDocumento: "" });
  const [pendingAnexos, setPendingAnexos] = useState<PendingDocumentoAnexo[]>([]);
  const [savingAnexos, setSavingAnexos] = useState(false);
  const submissionInFlight = useRef(false);
  const catalogos = useCatalogos({ includeEntidades: false });
  const { upload, uploading, progress } = useUploadDocumento();
  const { session } = useAuth();
  const { canCreate } = usePermissions();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      categoria_id: "",
      fecha_documento: "",
      tipo_entidad_id: "",
      entidad_id: "",
      tipo_categoria_id: "",
      estado_id: "",
      monto: 0,
      tipo_movimiento_id: "",
      tipo_movimiento_nombre: "",
      tipo_operacion_id: "",
      titulo: "",
      descripcion: "",
      ruta_historica: "",
      archivador_id: "",
    },
  });

  const date = watch("fecha_documento");
  const selectedFile = watch("archivo");
  const selectedCategoryId = watch("categoria_id");
  const selectedEntityType = watch("tipo_entidad_id");
  const selectedEntityId = watch("entidad_id");
  const selectedMovementId = watch("tipo_movimiento_id");
  const selectedMovement = catalogos.tiposMovimiento.find((item) => item.id === selectedMovementId);
  const isNoAplica = selectedMovement?.nombre.toLocaleLowerCase("es") === "no aplica";
  const dateParts = useMemo(() => {
    if (!date) return null;
    const [anio, mes, dia] = date.split("-").map(Number);
    return { anio, mes, dia };
  }, [date]);
  const entitySearch = useEntitySearch(selectedEntityType ?? "", entityDraft.nombre);
  const selectedEntityTypeName = catalogos.tiposEntidad.find((item) => item.id === selectedEntityType)?.nombre;
  const selectedEntityRequiresIdentity = ["persona natural", "proveedor", "trabajador"].includes(selectedEntityTypeName?.toLocaleLowerCase("es") ?? "");

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
      toast.info("La entidad ya existe. Se seleccionó para continuar el registro.");
    } else {
      toast.info("Se actualizó la búsqueda de entidades.");
    }
    return results;
  };

  useEffect(() => {
    setValue("entidad_id", "");
    setEntityDraft({ nombre: "", tipoDocumento: "", numeroDocumento: "" });
  }, [selectedEntityType, setValue]);

  useEffect(() => {
    setValue("tipo_movimiento_nombre", selectedMovement?.nombre ?? "");
    if (isNoAplica) {
      setValue("monto", 0);
      setValue("tipo_operacion_id", "");
    }
  }, [isNoAplica, selectedMovement?.nombre, setValue]);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    setValue("archivo", file, { shouldValidate: true });
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(file.type.startsWith("image/") || file.type === "application/pdf" ? URL.createObjectURL(file) : null);
  };

  const onSubmit = async (values: FormValues) => {
    if (submissionInFlight.current) return;
    if (!dateParts) return;
    const category = catalogos.categorias.find((item) => item.id === selectedCategoryId);
    if (!category) {
      toast.error("La categoría seleccionada no está disponible.");
      return;
    }
    if (pendingAnexos.some((anexo) => !anexo.tipoAnexoId || anexo.titulo.trim().length < 2)) {
      toast.error("Completa el título y tipo de todos los anexos antes de guardar.");
      return;
    }

    if (isSupabaseConfigured && !session?.user) {
      toast.error("Tu sesión no es válida. Inicia sesión nuevamente.");
      return;
    }

    submissionInFlight.current = true;
    try {
      if (isSupabaseConfigured && catalogos.usingFallback) {
        toast.warning("El formulario usa catálogos de respaldo. No se enviaron datos para evitar relaciones inválidas.");
        return;
      }
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
      const uploaded = await upload(values.archivo, {
        userId: session?.user.id ?? "demo-user",
        idempotencyKey,
        categoria: category.nombre,
        ...dateParts,
      });
      const extension = uploaded.file.name.includes(".")
        ? uploaded.file.name.split(".").pop()?.toLowerCase() ?? null
        : null;
      const documento = await createDocumento({
        idempotencyKey,
        categoriaId: values.categoria_id,
        fechaDocumento: values.fecha_documento,
        tipoEntidadId: values.tipo_entidad_id || null,
        entidadId,
        tipoCategoriaId: values.tipo_categoria_id || null,
        estadoId: values.estado_id,
        titulo: values.titulo,
        descripcion: values.descripcion || null,
        rutaHistorica: values.ruta_historica || null,
        estructuraHistoricaId: null,
        archivadorId: values.archivador_id || null,
        archivoPath: uploaded.path,
        extension,
        monto: values.monto ?? 0,
        tipoMovimientoId: values.tipo_movimiento_id || null,
        tipoOperacionId: isNoAplica ? null : values.tipo_operacion_id || null,
      });
      if (pendingAnexos.length) {
        if (pendingAnexos.some((anexo) => !anexo.tipoAnexoId || anexo.titulo.trim().length < 2)) {
          toast.error("Completa el título y tipo de todos los anexos antes de guardar.");
          return;
        }
        setSavingAnexos(true);
        for (const anexo of pendingAnexos) {
          const uploadedAnexo = await uploadDocumentoAnexoFile(anexo.file, {
            userId: session?.user.id ?? "demo-user",
            idempotencyKey: crypto.randomUUID(),
            categoria: category.nombre,
            ...dateParts,
            documentoId: documento.id,
          });
          const anexoExtension = uploadedAnexo.file.name.includes(".")
            ? uploadedAnexo.file.name.split(".").pop()?.toLowerCase() ?? null
            : null;
          await createDocumentoAnexo({
            documentoId: documento.id,
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
      }
      toast.success(isSupabaseConfigured ? "Documento guardado correctamente." : "Documento validado en modo demostración.");
      reset();
      setPreviewUrl(null);
      setEntityDraft({ nombre: "", tipoDocumento: "", numeroDocumento: "" });
      setPendingAnexos([]);
      setIdempotencyKey(crypto.randomUUID());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo registrar el documento.");
    } finally {
      setSavingAnexos(false);
      submissionInFlight.current = false;
    }
  };

  if (!canCreate("documentos")) {
    return <Card className="p-8 text-center"><h1 className="text-xl font-bold">Acceso restringido</h1><p className="mt-2 text-sm text-slate-500">No tienes permiso para crear documentos.</p></Card>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gestión documental"
        title="Nuevo documento"
        description="Registra la información documental y adjunta su archivo digital."
      />
      {catalogos.usingFallback && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          La conexión institucional no está disponible. El formulario está en modo demostración y no guardará información definitiva.
        </div>
      )}
      {catalogos.error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {catalogos.error}
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <SectionTitle icon={<FileText />} title="Información documental" description="Clasificación y datos principales" />
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Categoría *" error={errors.categoria_id?.message}>
                <Select className="w-full" disabled={catalogos.loading} {...register("categoria_id")}>
                  <option value="">Seleccionar categoría</option>
                  {catalogos.categorias.filter((item) => item.activo).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                </Select>
              </Field>
              <Field label="Fecha *" error={errors.fecha_documento?.message}>
                <div className="relative"><CalendarDays className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input type="date" className="pl-9" {...register("fecha_documento")} /></div>
              </Field>
              <Field label="Año"><Input readOnly value={dateParts?.anio ?? ""} placeholder="Automático" /></Field>
              <Field label="Mes"><Input readOnly value={dateParts?.mes ?? ""} placeholder="Automático" /></Field>
              <Field label="Día"><Input readOnly value={dateParts?.dia ?? ""} placeholder="Automático" /></Field>
              <Field label="Estado *" error={errors.estado_id?.message}>
                <Select className="w-full" {...register("estado_id")}><option value="">Seleccionar estado</option>{catalogos.estadosDocumento.filter((item) => item.activo).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</Select>
              </Field>
              <Field label="Título del archivo *" error={errors.titulo?.message} className="md:col-span-2"><Input placeholder="Ej. Factura por servicio de mantenimiento" {...register("titulo")} /></Field>
              <Field label="Descripción" className="md:col-span-2"><textarea className="min-h-28 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 dark:border-slate-700 dark:bg-slate-950" {...register("descripcion")} /></Field>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <SectionTitle icon={<Landmark />} title="Entidad y operación" description="Relación administrativa y económica" />
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Tipo de entidad"><Select className="w-full" {...register("tipo_entidad_id")}><option value="">No especificado</option>{catalogos.tiposEntidad.filter((item) => item.activo).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</Select></Field>
              <Field label="Entidad" className="md:col-span-2">
                <input type="hidden" {...register("entidad_id")} />
                <EntityCombobox
                  entities={entitySearch.entities}
                  entityTypeId={selectedEntityType ?? ""}
                  entityTypeName={selectedEntityTypeName}
                  value={selectedEntityId ?? ""}
                  draft={entityDraft}
                  onChange={(id) => setValue("entidad_id", id, { shouldDirty: true })}
                  onDraftChange={setEntityDraft}
                  loading={entitySearch.loading}
                  error={entitySearch.error}
                  onRefresh={() => void refreshEntitySection()}
                />
              </Field>
              <Field label="Tipo de categoría"><Select className="w-full" {...register("tipo_categoria_id")}><option value="">No especificado</option>{catalogos.tiposCategoria.filter((item) => item.activo).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</Select></Field>
              <Field label="Ingreso / Egreso"><Select className="w-full" {...register("tipo_movimiento_id")}><option value="">No especificado</option>{catalogos.tiposMovimiento.filter((item) => item.activo).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</Select></Field>
              <Field label="Monto" error={errors.monto?.message}><Input type="number" min="0" step="0.01" disabled={isNoAplica} {...register("monto", { valueAsNumber: true })} /></Field>
              <Field label="Tipo de operación" error={errors.tipo_operacion_id?.message}><Select className="w-full" disabled={isNoAplica} {...register("tipo_operacion_id")}><option value="">Seleccionar operación</option>{catalogos.tiposOperacion.filter((item) => item.activo).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</Select></Field>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <SectionTitle icon={<MapPin />} title="Archivo y trazabilidad" description="Ubicación física y ruta histórica importada" />
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Archivador"><Select className="w-full" {...register("archivador_id")}><option value="">Sin archivador</option>{catalogos.archivadores.filter((item) => item.activo).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</Select></Field>
              <Field label="Ruta histórica" className="md:col-span-2"><textarea className="min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-sm outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-950" placeholder="Ruta antigua importada desde Excel..." {...register("ruta_historica")} /></Field>
            </div>
          </Card>

          <DocumentAttachmentsSection
            tiposAnexo={catalogos.tiposAnexo}
            pending={pendingAnexos}
            onPendingChange={setPendingAnexos}
          />

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => reset()}>Limpiar</Button>
            <Button type="submit" loading={isSubmitting || uploading || savingAnexos}><Save className="size-4" />Guardar documento</Button>
          </div>
        </div>

        <Card className="h-fit p-5 xl:sticky xl:top-28">
          <div className="mb-4 flex items-center gap-2"><Paperclip className="size-4 text-teal-700" /><h2 className="font-bold">Archivo digital *</h2></div>
          <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center transition hover:border-teal-500 hover:bg-teal-50/50 dark:border-slate-700 dark:bg-slate-950">
            <UploadCloud className="mb-3 size-8 text-teal-600" />
            <span className="text-sm font-semibold">{selectedFile?.name ?? "Selecciona o arrastra un archivo"}</span>
            <span className="mt-1 text-xs text-slate-500">PDF, Word, Excel o imagen · Máx. 20 MB</span>
            <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" onChange={(event) => handleFile(event.target.files?.[0])} />
          </label>
          {errors.archivo && <span className="mt-2 block text-xs text-rose-600">{errors.archivo.message}</span>}
          {uploading && <div className="mt-4"><div className="mb-1 flex justify-between text-xs"><span>Subiendo archivo</span><strong>{progress}%</strong></div><div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${progress}%` }} /></div></div>}
          {selectedFile && <div className="mt-3 rounded-xl bg-slate-100 p-3 text-xs dark:bg-slate-800"><strong>{selectedFile.type || "Archivo"}</strong><span className="ml-2 text-slate-500">{(selectedFile.size / 1024).toFixed(1)} KB</span></div>}
          {previewUrl && <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">{selectedFile?.type.startsWith("image/") ? <img src={previewUrl} alt="Vista previa" className="h-56 w-full object-contain" /> : <iframe src={previewUrl} title="Vista previa PDF" className="h-72 w-full" />}</div>}
        </Card>
      </form>
    </div>
  );
}

function SectionTitle({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-teal-50 p-2.5 text-teal-700 dark:bg-teal-950">{icon}</div><div><h2 className="font-bold">{title}</h2><p className="text-xs text-slate-500">{description}</p></div></div>;
}

function Field({ label, error, children, className = "" }: { label: string; error?: string; children: React.ReactNode; className?: string }) {
  return <label className={className}><span className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</span>{children}{error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}</label>;
}
