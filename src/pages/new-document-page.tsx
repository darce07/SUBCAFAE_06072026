import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, ClipboardPaste, ExternalLink, Eye, FileText, Landmark, MapPin, Paperclip, Save, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { Alert, Button, Card, Input, PageHeader, Select } from "../components/ui";
import { useCatalogos } from "../hooks/use-catalogos";
import { useUploadDocumento } from "../hooks/use-upload-documento";
import { buscarDocumentosPorHash, createDocumento } from "../services/documentos.service";
import { useAuth } from "../features/auth/auth-context";
import { isSupabaseConfigured } from "../lib/supabase";
import { hashFile } from "../lib/file-hash";
import { usePermissions } from "../hooks/use-permissions";
import { EntityCombobox, type EntityDraft } from "../components/entity-combobox";
import { FirmantesCombobox } from "../components/firmantes-combobox";
import { MonthYearPicker } from "../components/month-year-picker";
import { Field, SectionTitle } from "../components/form-field";
import { createOrGetEntidad, createOrGetPersonalNatural } from "../services/catalogos.service";
import { DocumentAttachmentsSection } from "../components/document-attachments-section";
import { TextFilePreview } from "../components/text-file-preview";
import { MontoInput } from "../components/monto-input";
import { createDocumentoAnexo } from "../services/anexos.service";
import { uploadDocumentoAnexoFile } from "../services/storage.service";
import { sincronizarDocumentoFirmantes } from "../services/firmantes.service";
import type { DocumentoHashMatch, PendingDocumentoAnexo, SincronizarFirmanteInput } from "../types";
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
  categoria_id: z.string().min(1, "Selecciona una categoría."),
  fecha_documento: z.string()
    .min(1, "Selecciona la fecha.")
    .refine(isValidDocumentDate, `Ingresa una fecha válida entre ${minDocumentYear} y ${maxDocumentYear}.`),
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
  periodo_mes: z.string().optional(),
  periodo_anio: z.string().optional(),
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
  if (Boolean(values.periodo_mes) !== Boolean(values.periodo_anio)) {
    context.addIssue({
      code: "custom",
      path: ["periodo_anio"],
      message: "Completa mes y año del periodo, o deja ambos vacíos.",
    });
  }
});

type FormValues = z.infer<typeof schema>;
type DraftValues = Omit<FormValues, "archivo">;

const DRAFT_STORAGE_KEY = "sigdaf:nuevo-documento:draft";

const blankValues: DraftValues = {
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
};

interface StoredDraft {
  values: DraftValues;
  entityDraft: EntityDraft;
  idempotencyKey: string;
  savedAt: string;
}

function readDraft(): StoredDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredDraft;
  } catch {
    return null;
  }
}

function localRouteFromFile(file: File) {
  const fileWithPath = file as File & { path?: string };
  if (fileWithPath.path) return fileWithPath.path;
  const relativePath = "webkitRelativePath" in file ? String(file.webkitRelativePath || "") : "";
  return relativePath ? relativePath.replaceAll("/", "\\") : "";
}

export function NewDocumentPage() {
  const initialDraft = useMemo(() => readDraft(), []);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => initialDraft?.idempotencyKey ?? crypto.randomUUID());
  const [entityDraft, setEntityDraft] = useState<EntityDraft>(initialDraft?.entityDraft ?? { nombre: "", tipoDocumento: "", numeroDocumento: "" });
  const [pendingAnexos, setPendingAnexos] = useState<PendingDocumentoAnexo[]>([]);
  const [emisorId, setEmisorId] = useState<string[]>([]);
  const [emisorRepresenta, setEmisorRepresenta] = useState<string | null>(null);
  const [receptorId, setReceptorId] = useState<string[]>([]);
  const [receptorRepresenta, setReceptorRepresenta] = useState<string | null>(null);
  const [firmanteIds, setFirmanteIds] = useState<string[]>([]);
  const [savingAnexos, setSavingAnexos] = useState(false);
  const [archivoHash, setArchivoHash] = useState<string | null>(null);
  const [hashMatches, setHashMatches] = useState<DocumentoHashMatch[]>([]);
  const submissionInFlight = useRef(false);
  const catalogos = useCatalogos({ includeEntidades: true });
  const { upload, uploading, progress } = useUploadDocumento();
  const { session } = useAuth();
  const { canCreate } = usePermissions();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...blankValues,
      ...initialDraft?.values,
    },
  });

  const date = watch("fecha_documento");
  const periodoMes = watch("periodo_mes");
  const periodoAnio = watch("periodo_anio");
  const periodoValue = periodoMes && periodoAnio ? `${periodoAnio}-${String(periodoMes).padStart(2, "0")}` : "";
  const onPeriodoChange = (value: string) => {
    if (!value) {
      setValue("periodo_mes", "", { shouldDirty: true });
      setValue("periodo_anio", "", { shouldDirty: true });
      return;
    }
    const [anio, mes] = value.split("-");
    setValue("periodo_mes", String(Number(mes)), { shouldDirty: true });
    setValue("periodo_anio", anio, { shouldDirty: true });
  };
  const selectedFile = watch("archivo");
  const selectedCategoryId = watch("categoria_id");
  const selectedEntityType = watch("tipo_entidad_id");
  const selectedEntityId = watch("entidad_id");
  const selectedMovementId = watch("tipo_movimiento_id");
  const selectedMovement = catalogos.tiposMovimiento.find((item) => item.id === selectedMovementId);
  const isNoAplica = selectedMovement?.nombre.toLocaleLowerCase("es") === "no aplica";
  const dateParts = useMemo(() => {
    if (!date || !isValidDocumentDate(date)) return null;
    const [anio, mes, dia] = date.split("-").map(Number);
    return { anio, mes, dia };
  }, [date]);
  const entitySearch = useEntitySearch(selectedEntityType ?? "", entityDraft.nombre);
  const selectedEntityTypeName = catalogos.tiposEntidad.find((item) => item.id === selectedEntityType)?.nombre;
  const selectedEntityRequiresIdentity = ["persona natural", "proveedor", "trabajador"].includes(selectedEntityTypeName?.toLocaleLowerCase("es") ?? "");

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!initialDraft) return;
    toast.info("Se recuperó un borrador guardado. Vuelve a adjuntar el archivo digital antes de guardar.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draftSaveTimeout = useRef<number | undefined>(undefined);
  useEffect(() => {
    const subscription = watch((values) => {
      window.clearTimeout(draftSaveTimeout.current);
      draftSaveTimeout.current = window.setTimeout(() => {
        const { archivo: _archivo, ...draftValues } = values as FormValues;
        const draft: StoredDraft = {
          values: draftValues,
          entityDraft,
          idempotencyKey,
          savedAt: new Date().toISOString(),
        };
        window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      }, 500);
    });
    return () => {
      subscription.unsubscribe();
      window.clearTimeout(draftSaveTimeout.current);
    };
  }, [entityDraft, idempotencyKey, watch]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const refreshEntitySection = async () => {
    const results = await entitySearch.refresh(entityDraft.numeroDocumento || entityDraft.nombre) ?? [];
    const existing = selectedEntityType
      ? findMatchingEntity(results, selectedEntityType, entityDraft.nombre, entityDraft.tipoDocumento, entityDraft.numeroDocumento)
      : null;
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
    if (!selectedEntityType || !entityDraft.nombre.trim() || selectedEntityId) return;
    const existing = findMatchingEntity(entitySearch.entities, selectedEntityType, entityDraft.nombre, entityDraft.tipoDocumento, entityDraft.numeroDocumento);
    if (existing) {
      setValue("entidad_id", existing.id, { shouldDirty: true });
      setEntityDraft({
        nombre: existing.nombre,
        tipoDocumento: existing.tipo_documento ?? "",
        numeroDocumento: existing.numero_documento ?? "",
      });
    }
  }, [entityDraft.nombre, entityDraft.numeroDocumento, entityDraft.tipoDocumento, entitySearch.entities, selectedEntityId, selectedEntityType, setValue]);

  useEffect(() => {
    setValue("tipo_movimiento_nombre", selectedMovement?.nombre ?? "");
    if (isNoAplica) {
      setValue("monto", 0);
      setValue("tipo_operacion_id", "");
    }
  }, [isNoAplica, selectedMovement?.nombre, setValue]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setValue("archivo", file, { shouldValidate: true });
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const nextPreviewUrl = file.type.startsWith("image/") || file.type === "application/pdf" ? URL.createObjectURL(file) : null;
    setPreviewUrl(nextPreviewUrl);
    setPreviewOpen(false);
    setArchivoHash(null);
    setHashMatches([]);
    if (!isSupabaseConfigured) return;
    try {
      const hash = await hashFile(file);
      setArchivoHash(hash);
      const matches = await buscarDocumentosPorHash(hash);
      setHashMatches(matches);
      if (matches.length) {
        toast.warning(`Posible duplicado: este mismo archivo ya está registrado como ${matches[0].codigo_documento} (${matches[0].titulo}).`);
      }
    } catch {
      // Verificación de duplicados es best-effort; no debe bloquear la selección del archivo.
    }
  };

  const clearForm = () => {
    reset(blankValues);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewOpen(false);
    setEntityDraft({ nombre: "", tipoDocumento: "", numeroDocumento: "" });
    setPendingAnexos([]);
    setEmisorId([]);
    setEmisorRepresenta(null);
    setReceptorId([]);
    setReceptorRepresenta(null);
    setFirmanteIds([]);
    setArchivoHash(null);
    setHashMatches([]);
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  };

  const pasteHistoricalRoute = async () => {
    if (!navigator.clipboard?.readText) {
      toast.error("El navegador no permite leer el portapapeles en este contexto.");
      return;
    }
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) {
        toast.info("No hay texto en el portapapeles.");
        return;
      }
      setValue("ruta_historica", text, { shouldDirty: true });
      toast.success("Ruta histórica pegada. Revísala antes de guardar.");
    } catch {
      toast.error("No se pudo leer el portapapeles. Pega la ruta manualmente.");
    }
  };

  const handleFolderFile = async (file: File | undefined) => {
    if (!file) return;
    await handleFile(file);
    const route = localRouteFromFile(file);
    if (route) {
      setValue("ruta_historica", route, { shouldDirty: true });
      toast.success("Se capturó la ruta relativa de la carpeta seleccionada.");
    }
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
        archivoHash: archivoHash,
        periodoMes: values.periodo_mes ? Number(values.periodo_mes) : null,
        periodoAnio: values.periodo_anio ? Number(values.periodo_anio) : null,
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
      const firmantesPayload: SincronizarFirmanteInput[] = [
        ...emisorId.map((personalNaturalId) => ({ personalNaturalId, rol: "emisor" as const, representaEntidadId: emisorRepresenta })),
        ...receptorId.map((personalNaturalId) => ({ personalNaturalId, rol: "receptor" as const, representaEntidadId: receptorRepresenta })),
        ...firmanteIds.map((personalNaturalId) => ({ personalNaturalId, rol: "firmante" as const, representaEntidadId: null })),
      ];
      if (firmantesPayload.length) {
        await sincronizarDocumentoFirmantes(documento.id, firmantesPayload);
      }
      toast.success(isSupabaseConfigured ? "Documento guardado correctamente." : "Documento validado en modo demostración.");
      reset(blankValues);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setPreviewOpen(false);
      setEntityDraft({ nombre: "", tipoDocumento: "", numeroDocumento: "" });
      setPendingAnexos([]);
      setEmisorId([]);
    setEmisorRepresenta(null);
    setReceptorId([]);
    setReceptorRepresenta(null);
    setFirmanteIds([]);
      setArchivoHash(null);
      setHashMatches([]);
      setIdempotencyKey(crypto.randomUUID());
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo registrar el documento.");
    } finally {
      setSavingAnexos(false);
      submissionInFlight.current = false;
    }
  };

  if (!canCreate("documentos")) {
    return <Card className="p-8 text-center"><h1 className="font-serif text-xl font-bold">Acceso restringido</h1><p className="mt-2 text-sm text-slate-500">No tienes permiso para crear documentos.</p></Card>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gestión documental"
        title="Nuevo documento"
        description="Registra la información documental y adjunta su archivo digital."
      />
      {catalogos.usingFallback && (
        <Alert variant="warning">
          La conexión institucional no está disponible. El formulario está en modo demostración y no guardará información definitiva.
        </Alert>
      )}
      {catalogos.error && <Alert>{catalogos.error}</Alert>}
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
              <Field
                label="Fecha *"
                error={errors.fecha_documento?.message}
                info="Es la fecha que trae el propio documento (la de su registro o emisión formal), no el periodo al que se refiere su contenido."
              >
                <div className="relative"><CalendarDays className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input type="date" min={`${minDocumentYear}-01-01`} max={`${maxDocumentYear}-12-31`} className="pl-9" {...register("fecha_documento")} /></div>
              </Field>
              <Field
                label="Periodo (opcional)"
                error={errors.periodo_mes?.message ?? errors.periodo_anio?.message}
                info="Úsalo solo si el documento se aprobó, emitió o publicó en un mes/año distinto al de su fecha — por ejemplo, si demoró en salir o corresponde a un periodo anterior."
              >
                <MonthYearPicker value={periodoValue} onChange={onPeriodoChange} minYear={minDocumentYear} maxYear={maxDocumentYear} />
              </Field>
              <Field label="Estado *" error={errors.estado_id?.message}>
                <Select className="w-full" {...register("estado_id")}><option value="">Seleccionar estado</option>{catalogos.estadosDocumento.filter((item) => item.activo).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</Select>
              </Field>
              <Field label="Título del archivo *" error={errors.titulo?.message} className="md:col-span-2"><Input placeholder="Ej. Factura por servicio de mantenimiento" {...register("titulo")} /></Field>
              <Field label="Descripción" className="md:col-span-2"><textarea className="min-h-28 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 dark:border-slate-700 dark:bg-slate-950" {...register("descripcion")} /></Field>
              <Field label="Emisor / remitente (opcional)" hint="Quién emite o remite el documento.">
                <FirmantesCombobox
                  single
                  personas={catalogos.personalNatural}
                  selectedIds={emisorId}
                  onChange={setEmisorId}
                  entidades={catalogos.entidades}
                  representaEntidadId={emisorRepresenta}
                  onRepresentaEntidadChange={setEmisorRepresenta}
                  onCreate={async (command) => {
                    const created = await createOrGetPersonalNatural(command);
                    await catalogos.refresh();
                    return created;
                  }}
                />
              </Field>
              <Field label="Receptor (opcional)" hint="A quién va dirigido el documento.">
                <FirmantesCombobox
                  single
                  personas={catalogos.personalNatural}
                  selectedIds={receptorId}
                  onChange={setReceptorId}
                  entidades={catalogos.entidades}
                  representaEntidadId={receptorRepresenta}
                  onRepresentaEntidadChange={setReceptorRepresenta}
                  onCreate={async (command) => {
                    const created = await createOrGetPersonalNatural(command);
                    await catalogos.refresh();
                    return created;
                  }}
                />
              </Field>
              <Field label="Otros firmantes (opcional)" className="md:col-span-2" hint="Otras personas que firmaron el documento (participantes, testigos, etc). Podés elegir varias.">
                <FirmantesCombobox
                  personas={catalogos.personalNatural}
                  selectedIds={firmanteIds}
                  onChange={setFirmanteIds}
                  onCreate={async (command) => {
                    const created = await createOrGetPersonalNatural(command);
                    await catalogos.refresh();
                    return created;
                  }}
                />
              </Field>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <SectionTitle icon={<Landmark />} title="Entidad y operación" description="Relación administrativa y económica" />
            <div className="grid gap-5 md:grid-cols-2">
              <input type="hidden" {...register("tipo_entidad_id")} />
              <Field label="Entidad" className="md:col-span-2" hint="Buscá por nombre o RUC — el tipo se completa solo al elegirla.">
                <input type="hidden" {...register("entidad_id")} />
                <EntityCombobox
                  entities={entitySearch.entities}
                  entityTypeId={selectedEntityType ?? ""}
                  entityTypeName={selectedEntityTypeName}
                  tiposEntidad={catalogos.tiposEntidad}
                  onEntityTypeChange={(id) => setValue("tipo_entidad_id", id, { shouldDirty: true })}
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
              <Field label="Naturaleza del documento" hint="¿Mueve dinero? Si es un oficio, memo o resolución, elige “No aplica”.">
                <Select className="w-full" {...register("tipo_movimiento_id")}><option value="">No especificado</option>{catalogos.tiposMovimiento.filter((item) => item.activo).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</Select>
              </Field>
              {!isNoAplica && (
                <>
                  <Field label="Monto" error={errors.monto?.message}>
                    <Controller
                      name="monto"
                      control={control}
                      render={({ field }) => <MontoInput value={field.value} onChange={field.onChange} />}
                    />
                  </Field>
                  <Field label="Tipo de operación" error={errors.tipo_operacion_id?.message}><Select className="w-full" {...register("tipo_operacion_id")}><option value="">Seleccionar operación</option>{catalogos.tiposOperacion.filter((item) => item.activo).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</Select></Field>
                </>
              )}
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <SectionTitle icon={<MapPin />} title="Archivo y trazabilidad" description="Ubicación física y ruta histórica importada" />
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Archivador"><Select className="w-full" {...register("archivador_id")}><option value="">Sin archivador</option>{catalogos.archivadores.filter((item) => item.activo).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</Select></Field>
              <Field label="Ruta histórica" className="md:col-span-2">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  <span>El navegador no entrega la ruta completa del archivo; pega aquí la ruta local real si la necesitas.</span>
                  <div className="flex flex-wrap gap-2">
                    <label htmlFor="documento-folder-input" className="inline-flex min-h-8 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><MapPin className="size-4" />Elegir carpeta</label>
                    <Button type="button" size="sm" variant="secondary" onClick={() => void pasteHistoricalRoute()}><ClipboardPaste className="size-4" />Pegar ruta</Button>
                  </div>
                </div>
                <textarea className="min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-sm outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-950" placeholder="Ej. C:\\SUBCAFAE\\SUBCAFAE\\REQUISITOS PARA REAPERTURAR - BBVA\\RD 00381-2025.pdf" {...register("ruta_historica")} />
              </Field>
            </div>
          </Card>

          <DocumentAttachmentsSection
            tiposAnexo={catalogos.tiposAnexo}
            pending={pendingAnexos}
            onPendingChange={setPendingAnexos}
          />

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={clearForm}>Limpiar</Button>
            <Button type="submit" loading={isSubmitting || uploading || savingAnexos}><Save className="size-4" />Guardar documento</Button>
          </div>
        </div>

        <Card className="h-fit p-5 xl:sticky xl:top-28">
          <div className="mb-4 flex items-center gap-2"><Paperclip className="size-4 text-teal-700" /><h2 className="font-bold">Archivo digital *</h2></div>
          <input id="documento-file-input" type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" onChange={(event) => void handleFile(event.target.files?.[0])} />
          <input id="documento-folder-input" type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" webkitdirectory="" onChange={(event) => void handleFolderFile(event.target.files?.[0])} />
          {selectedFile ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center dark:border-slate-700 dark:bg-slate-950">
              <button
                type="button"
                className="grid min-h-32 w-full place-items-center rounded-xl transition hover:bg-teal-50/70 focus:outline-none focus:ring-4 focus:ring-teal-500/10 dark:hover:bg-teal-950/30"
                onClick={() => previewUrl ? setPreviewOpen(true) : toast.info("Este tipo de archivo no tiene vista previa integrada.")}
              >
                <div>
                  <Eye className="mx-auto mb-3 size-8 text-teal-600" />
                  <span className="block break-words text-sm font-semibold">{selectedFile.name}</span>
                  <span className="mt-1 block text-xs text-slate-500">Click para previsualizar</span>
                </div>
              </button>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <Button type="button" size="sm" variant="secondary" disabled={!previewUrl} onClick={() => setPreviewOpen(true)}><Eye className="size-4" />Previsualizar</Button>
                <label htmlFor="documento-file-input" className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><UploadCloud className="size-4" />Cambiar</label>
                <label htmlFor="documento-folder-input" className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><MapPin className="size-4" />Con ruta</label>
              </div>
            </div>
          ) : (
            <label htmlFor="documento-file-input" className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center transition hover:border-teal-500 hover:bg-teal-50/50 dark:border-slate-700 dark:bg-slate-950">
              <UploadCloud className="mb-3 size-8 text-teal-600" />
              <span className="text-sm font-semibold">Selecciona o arrastra un archivo</span>
              <span className="mt-1 text-xs text-slate-500">PDF, Word, Excel o imagen · Máx. 20 MB</span>
              <span className="mt-2 text-[11px] text-slate-400">Para ruta relativa, usa “Elegir carpeta” en Ruta histórica.</span>
            </label>
          )}
          {errors.archivo && <span className="mt-2 block text-xs text-rose-600">{errors.archivo.message}</span>}
          {uploading && <div className="mt-4"><div className="mb-1 flex justify-between text-xs"><span>Subiendo archivo</span><strong>{progress}%</strong></div><div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${progress}%` }} /></div></div>}
          {selectedFile && <div className="mt-3 rounded-xl bg-slate-100 p-3 text-xs dark:bg-slate-800"><strong>{selectedFile.type || "Archivo"}</strong><span className="ml-2 text-slate-500">{(selectedFile.size / 1024).toFixed(1)} KB</span></div>}
          {hashMatches.length > 0 && (
            <Alert variant="warning" className="mt-3">
              Este archivo coincide con {hashMatches.length === 1 ? "un documento" : `${hashMatches.length} documentos`} ya registrado{hashMatches.length === 1 ? "" : "s"}: {hashMatches.map((match) => match.codigo_documento).join(", ")}. Revisa antes de guardar para evitar duplicados.
            </Alert>
          )}
          {previewUrl && <button type="button" onClick={() => setPreviewOpen(true)} className="mt-4 block w-full overflow-hidden rounded-xl border border-slate-200 text-left transition hover:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/10 dark:border-slate-700">{selectedFile?.type.startsWith("image/") ? <img src={previewUrl} alt="Vista previa" className="h-56 w-full object-contain" /> : <iframe src={previewUrl} title="Vista previa PDF" className="pointer-events-none h-72 w-full" />}</button>}
        </Card>
      </form>
      {previewOpen && previewUrl && selectedFile && (
        <LocalFileViewer
          title={selectedFile.name}
          url={previewUrl}
          mimeType={selectedFile.type || null}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}

function LocalFileViewer({ title, url, mimeType, onClose }: { title: string; url: string; mimeType: string | null; onClose: () => void }) {
  const isImage = mimeType?.startsWith("image/");
  const isPdf = mimeType === "application/pdf";
  const isText = mimeType?.startsWith("text/");
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm">
      <div className="flex h-[92dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="min-w-0">
            <h2 className="truncate font-bold">{title}</h2>
            <p className="text-xs text-slate-500">Vista previa antes de guardar</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => window.open(url, "_blank", "noopener,noreferrer")}><ExternalLink className="size-4" />Abrir</Button>
            <button type="button" onClick={onClose} aria-label="Cerrar previsualizador" className="rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="size-5" /></button>
          </div>
        </div>
        <div className="grid min-h-0 flex-1 place-items-center bg-slate-100 p-3 dark:bg-slate-950">
          {isImage ? <img src={url} alt={title} className="max-h-full rounded-xl object-contain" /> : isPdf ? <iframe src={url} title={title} className="h-full w-full rounded-xl bg-white" /> : isText ? <TextFilePreview url={url} /> : <div className="max-w-md rounded-2xl bg-white p-6 text-center shadow-sm dark:bg-slate-900"><FileText className="mx-auto mb-3 size-10 text-teal-700" /><h3 className="font-bold">Vista previa no disponible</h3><p className="mt-2 text-sm text-slate-500">Este tipo de archivo puede abrirse con una aplicación compatible.</p></div>}
        </div>
      </div>
    </div>
  );
}
