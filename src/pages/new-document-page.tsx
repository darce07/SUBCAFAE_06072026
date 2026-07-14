import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, ClipboardPaste, ExternalLink, Eye, FileText, Landmark, MapPin, Paperclip, Save, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Input, PageHeader, Select } from "../components/ui";
import { useCatalogos } from "../hooks/use-catalogos";
import { useUploadDocumento } from "../hooks/use-upload-documento";
import { createDocumento } from "../services/documentos.service";
import { useAuth } from "../features/auth/auth-context";
import { isSupabaseConfigured } from "../lib/supabase";
import { usePermissions } from "../hooks/use-permissions";
import { EntityCombobox, type EntityDraft } from "../components/entity-combobox";
import { Field, SectionTitle } from "../components/form-field";
import { createOrGetEntidad } from "../services/catalogos.service";
import { DocumentAttachmentsSection } from "../components/document-attachments-section";
import { createDocumentoAnexo } from "../services/anexos.service";
import { uploadDocumentoAnexoFile } from "../services/storage.service";
import type { PendingDocumentoAnexo } from "../types";
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

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titleFromFileName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function dateFromFileName(fileName: string) {
  const normalized = fileName.replace(/[_ .]/g, "-");
  const yearFirst = normalized.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (yearFirst) return safeDate(yearFirst[1], yearFirst[2], yearFirst[3]);
  const dayFirst = normalized.match(/\b(\d{1,2})[-/](\d{1,2})[-/](20\d{2})\b/);
  if (dayFirst) return safeDate(dayFirst[3], dayFirst[2], dayFirst[1]);
  return dateFromSpanishText(fileName);
}

function dateFromEvidence(evidence: string) {
  const documentDate = dateFromDocumentText(evidence);
  if (documentDate) return documentDate;
  return dateFromFileName(evidence);
}

function safeDate(year: string, month: string, day: string) {
  const anio = Number(year);
  const mes = Number(month);
  const dia = Number(day);
  if (anio < minDocumentYear || anio > maxDocumentYear || mes < 1 || mes > 12 || dia < 1 || dia > 31) return "";
  const date = new Date(Date.UTC(anio, mes - 1, dia));
  if (date.getUTCFullYear() !== anio || date.getUTCMonth() !== mes - 1 || date.getUTCDate() !== dia) return "";
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

const spanishMonthMap: Record<string, string> = {
  enero: "01",
  ene: "01",
  febrero: "02",
  feb: "02",
  marzo: "03",
  mar: "03",
  abril: "04",
  abr: "04",
  mayo: "05",
  may: "05",
  junio: "06",
  jun: "06",
  julio: "07",
  jul: "07",
  agosto: "08",
  ago: "08",
  setiembre: "09",
  septiembre: "09",
  sep: "09",
  set: "09",
  octubre: "10",
  oct: "10",
  noviembre: "11",
  nov: "11",
  diciembre: "12",
  dic: "12",
};

function dateFromSpanishText(text: string) {
  const monthNames = Object.keys(spanishMonthMap).join("|");
  const match = normalizeText(text).match(new RegExp(`\\b(\\d{1,2})\\s+(?:de\\s+)?(${monthNames})\\s+(?:(?:de|del)\\s+)?(20\\d{2})\\b`));
  if (!match) return "";
  return safeDate(match[3], spanishMonthMap[match[2]], match[1]);
}

function dateFromDocumentText(text: string) {
  const monthPattern = "(?:ene(?:ro)?|feb(?:rero)?|mar(?:zo)?|abr(?:il)?|may(?:o)?|jun(?:io)?|jul(?:io)?|ago(?:sto)?|set(?:iembre)?|sep(?:tiembre)?|oct(?:ubre)?|nov(?:iembre)?|dic(?:iembre)?)";
  const candidates = [
    { regex: new RegExp(`\\blima\\s*,?\\s*(\\d{1,2})\\s+(?:de\\s+)?(${monthPattern})\\s+(?:(?:de|del)\\s+)?(20\\d{2})\\b`, "i"), score: 100 },
    { regex: new RegExp(`\\bfecha\\s+(\\d{1,2})\\s+(?:de\\s+)?(${monthPattern})\\s+(?:(?:de|del)\\s+)?(20\\d{2})\\b`, "i"), score: 90 },
    { regex: new RegExp(`\\b(\\d{1,2})\\s+(?:de\\s+)?(${monthPattern})\\s+(?:(?:de|del)\\s+)?(20\\d{2})\\b`, "i"), score: 70 },
  ];
  let best: { value: string; score: number } | null = null;
  for (const candidate of candidates) {
    const match = text.match(candidate.regex);
    if (!match) continue;
    const value = dateFromSpanishText(`${match[1]} ${match[2]} ${match[3]}`);
    if (value && (!best || candidate.score > best.score)) best = { value, score: candidate.score };
  }
  const fuzzyDate = fuzzyDateFromOcrText(text);
  if (fuzzyDate && (!best || best.score < 95)) return fuzzyDate;
  return best?.value ?? fuzzyDate;
}

function fuzzyDateFromOcrText(text: string) {
  const normalized = normalizeText(text);
  const numeric = normalized.match(/\b(\d{1,2})\s+(\d{1,2})\s+(20\d{2})\b/);
  if (numeric) return safeDate(numeric[3], numeric[2], numeric[1]);

  const words = normalized.split(/\s+/).filter(Boolean);
  const monthAliases = Object.keys(spanishMonthMap);
  let best: { value: string; score: number } | null = null;
  for (let index = 0; index < words.length - 2; index += 1) {
    const day = words[index];
    const monthToken = words[index + 1];
    const year = words[index + 2];
    if (!/^\d{1,2}$/.test(day) || !/^20\d{2}$/.test(year)) continue;
    const month = closestMonth(monthToken, monthAliases);
    if (!month) continue;
    const value = safeDate(year, spanishMonthMap[month.alias], day);
    if (value && (!best || month.score > best.score)) best = { value, score: month.score };
  }
  return best?.value ?? "";
}

function closestMonth(token: string, aliases: string[]) {
  if (spanishMonthMap[token]) return { alias: token, score: 1 };
  let best: { alias: string; score: number } | null = null;
  for (const alias of aliases) {
    const distance = levenshtein(token.slice(0, Math.max(3, alias.length)), alias);
    const allowed = alias.length <= 3 ? 1 : 2;
    if (distance <= allowed) {
      const score = 1 - distance / Math.max(token.length, alias.length);
      if (!best || score > best.score) best = { alias, score };
    }
  }
  return best;
}

function levenshtein(left: string, right: string) {
  const costs = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let previous = costs[0];
    costs[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const current = costs[rightIndex];
      costs[rightIndex] = left[leftIndex - 1] === right[rightIndex - 1]
        ? previous
        : Math.min(previous, costs[rightIndex - 1], costs[rightIndex]) + 1;
      previous = current;
    }
  }
  return costs[right.length];
}

function amountFromText(text: string) {
  const match = text.match(/(?:S\/|S\.|soles?)\s*([0-9][0-9.,]*)/i) ?? text.match(/\b([0-9]{1,3}(?:[.,][0-9]{3})*[.,][0-9]{2})\b/);
  if (!match) return null;
  const normalized = match[1].replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function localRouteFromFile(file: File) {
  const fileWithPath = file as File & { path?: string };
  if (fileWithPath.path) return fileWithPath.path;
  const relativePath = "webkitRelativePath" in file ? String(file.webkitRelativePath || "") : "";
  return relativePath ? relativePath.replaceAll("/", "\\") : "";
}

function firstActiveMatch<T extends { nombre: string; descripcion?: string | null; activo?: boolean }>(items: T[], keywords: string[]) {
  return items.find((item) => item.activo !== false && matchesAny(`${item.nombre} ${item.descripcion ?? ""}`, keywords));
}

function firstActive<T extends { activo?: boolean }>(items: T[]) {
  return items.find((item) => item.activo !== false) ?? null;
}

function shouldUseAmount(evidence: string) {
  return matchesAny(evidence, ["factura", "voucher", "recibo por honorarios", "recibos por honorarios", "honorario", "rhe"]);
}

function isResolutionEvidence(evidence: string) {
  return matchesAny(evidence, ["resolucion", "resolución", "directoral"]) || /\br\.?\s*d\.?\s*\d{2,5}[-\s]*20\d{2}\b/i.test(evidence);
}

function documentCodeFromEvidence(evidence: string) {
  const rd = evidence.match(/\br\.?\s*d\.?\s*(?:n[°º.]?\s*)?(\d{2,5})[-\s]*(20\d{2})\b/i);
  if (rd) return `RD ${rd[1].padStart(5, "0")}-${rd[2]}`;
  const resolution = evidence.match(/\bresoluci[oó]n\s+directoral\s*(?:n[°º.]?\s*)?(\d{2,5})[-\s]*(20\d{2})\b/i);
  if (resolution) return `Resolución Directoral ${resolution[1].padStart(5, "0")}-${resolution[2]}`;
  return "";
}

function documentEntityName(evidence: string) {
  const ugelMatch = evidence.match(/\bUGEL\s*(?:N[°º.]?\s*)?0?(\d{1,2})\b/i);
  if (ugelMatch) return `UGEL ${ugelMatch[1].padStart(2, "0")}`;
  if (matchesAny(evidence, ["subcafae"])) return "SUBCAFAE";
  if (matchesAny(evidence, ["sunat"])) return "SUNAT";
  if (isResolutionEvidence(evidence)) return "UGEL 06";
  return "";
}

function descriptionSuggestion(evidence: string) {
  const code = documentCodeFromEvidence(evidence);
  const date = dateFromEvidence(evidence);
  const dateLabel = date ? formatIsoDateForDescription(date) : "";
  const topics = [
    matchesAny(evidence, ["reaperturar", "reapertura"]) ? "reapertura" : "",
    matchesAny(evidence, ["bbva"]) ? "BBVA" : "",
    matchesAny(evidence, ["representantes"]) ? "representantes" : "",
  ].filter(Boolean);
  if (isResolutionEvidence(evidence)) {
    const topicText = topics.length ? ` sobre ${topics.join(", ")}` : "";
    const suffix = dateLabel ? `, emitida el ${dateLabel}${topicText}.` : `${topicText}.`;
    return `${code || "Resolución Directoral"}${suffix}`;
  }
  if (matchesAny(evidence, ["oficio"])) return `${code || "Oficio"} para trámite administrativo.`;
  if (shouldUseAmount(evidence)) return "Documento de sustento económico sujeto a revisión de monto y operación.";
  return "";
}

function formatIsoDateForDescription(value: string) {
  const [year, month, day] = value.split("-");
  const monthNames = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre"];
  const monthName = monthNames[Number(month) - 1];
  if (!year || !monthName || !day) return "";
  return `${Number(day)} de ${monthName} de ${year}`;
}

function matchesAny(value: string, keywords: string[]) {
  const normalized = normalizeText(value);
  return keywords.some((keyword) => normalized.includes(normalizeText(keyword)));
}

export function NewDocumentPage() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
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
    getValues,
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

  const applyFileSuggestions = (file: File, notify = true) => {
    const fileTitle = titleFromFileName(file.name);
    const evidence = fileTitle;
    const useAmount = shouldUseAmount(evidence);
    const suggestions: string[] = [];
    const current = getValues();

    type SuggestibleField = "titulo" | "ruta_historica" | "fecha_documento" | "categoria_id" | "estado_id" | "tipo_categoria_id" | "tipo_movimiento_id" | "monto" | "tipo_operacion_id" | "tipo_entidad_id" | "archivador_id" | "descripcion";
    const fillIfEmpty = (field: SuggestibleField, value: string | number, label: string, validate = false) => {
      const existing = current[field];
      const isEmpty = typeof existing === "number" ? existing === 0 : !existing?.toString().trim();
      if (!isEmpty) return;
      setValue(field as never, value as never, { shouldDirty: true, shouldValidate: validate });
      suggestions.push(label);
    };

    fillIfEmpty("titulo", fileTitle, "título", true);

    const localRoute = localRouteFromFile(file);
    if (localRoute) fillIfEmpty("ruta_historica", localRoute, "ruta histórica");

    const inferredDate = dateFromEvidence(evidence);
    if (inferredDate) fillIfEmpty("fecha_documento", inferredDate, "fecha", true);

    const categoryKeywords = [
      { keywords: ["resolucion", "resolución", "rd", "r d", "directoral"], targets: ["resolucion", "resolución"] },
      { keywords: ["oficio", "carta orden"], targets: ["oficio"] },
      { keywords: ["factura", "boleta", "comprobante"], targets: ["factura"] },
      { keywords: ["recibo", "honorario", "rhe"], targets: ["recibo", "honorario"] },
      { keywords: ["acta"], targets: ["acta"] },
      { keywords: ["contrato"], targets: ["contrato"] },
      { keywords: ["pago"], targets: ["pago"] },
      { keywords: ["caja chica"], targets: ["caja chica"] },
    ];
    const categoryRule = isResolutionEvidence(evidence)
      ? categoryKeywords[0]
      : categoryKeywords.find((rule) => matchesAny(evidence, rule.keywords));
    const category = categoryRule
      ? catalogos.categorias.find((item) => item.activo && matchesAny(item.nombre, categoryRule.targets))
      : catalogos.categorias.find((item) => item.activo && matchesAny(evidence, [item.nombre]));
    if (category) fillIfEmpty("categoria_id", category.id, "categoría", true);

    const verified = catalogos.estadosDocumento.find((item) => item.activo && normalizeText(item.nombre).includes("verific"));
    if (verified) fillIfEmpty("estado_id", verified.id, "estado", true);

    const administrativeType = firstActiveMatch(catalogos.tiposCategoria, ["administrativo", "administrativa"]);
    const financialType = firstActiveMatch(catalogos.tiposCategoria, ["financiero", "financiera", "contable", "tesoreria", "tesorería"]);
    const legalType = firstActiveMatch(catalogos.tiposCategoria, ["legal"]);
    const laborType = firstActiveMatch(catalogos.tiposCategoria, ["laboral", "recursos humanos"]);
    const typeCategory = useAmount ? financialType
      : matchesAny(evidence, ["contrato"]) ? legalType
      : matchesAny(evidence, ["planilla", "inasistencia", "tardanza", "permiso", "honorario"]) ? laborType
      : (isResolutionEvidence(evidence) || matchesAny(evidence, ["oficio", "acta", "carta"])) ? administrativeType
      : null;
    if (typeCategory) fillIfEmpty("tipo_categoria_id", typeCategory.id, "tipo de categoría");

    const noAplicaMovement = catalogos.tiposMovimiento.find((item) => item.activo && normalizeText(item.nombre).includes("no aplica"));
    const egresoMovement = catalogos.tiposMovimiento.find((item) => item.activo && normalizeText(item.nombre).includes("egreso"));
    if (useAmount && egresoMovement) {
      fillIfEmpty("tipo_movimiento_id", egresoMovement.id, "movimiento");
    } else if (noAplicaMovement) {
      fillIfEmpty("tipo_movimiento_id", noAplicaMovement.id, "movimiento");
    }

    const amount = useAmount ? amountFromText(evidence) : null;
    if (amount !== null) fillIfEmpty("monto", amount, "monto", true);

    const paymentOperation = firstActiveMatch(catalogos.tiposOperacion, ["pago", "proveedor", "servicio"]);
    if (useAmount && paymentOperation) fillIfEmpty("tipo_operacion_id", paymentOperation.id, "tipo de operación");

    const publicEntity = catalogos.tiposEntidad.find((item) => item.activo && matchesAny(item.nombre, ["institucion publica", "institución pública", "entidad publica", "entidad pública", "ugel"]));
    const naturalEntity = catalogos.tiposEntidad.find((item) => item.activo && matchesAny(item.nombre, ["persona natural", "trabajador"]));
    const legalEntity = catalogos.tiposEntidad.find((item) => item.activo && matchesAny(item.nombre, ["juridica", "jurídica", "proveedor"]));
    const entityType = (isResolutionEvidence(evidence) || matchesAny(evidence, ["ugel", "directoral", "oficio"])) ? publicEntity
      : matchesAny(evidence, ["dni", "honorario"]) ? naturalEntity
      : matchesAny(evidence, ["ruc", "factura", "proveedor"]) ? legalEntity
      : null;
    if (entityType) fillIfEmpty("tipo_entidad_id", entityType.id, "tipo de entidad");

    const suggestedEntityName = documentEntityName(evidence);
    if (suggestedEntityName && entityType && !entityDraft.nombre.trim()) {
      setEntityDraft((prev) => (prev.nombre.trim() ? prev : { ...prev, nombre: suggestedEntityName }));
      suggestions.push("entidad");
    }

    const archiveKeywords = useAmount ? ["tesoreria", "tesorería", "factura", "recibo", "voucher", "finanza", "contable", "t-"]
      : (isResolutionEvidence(evidence) || matchesAny(evidence, ["oficio", "acta"])) ? ["administracion", "administración", "resolucion", "resolución", "oficio", "archivo central", "a-"]
      : [category?.nombre ?? "", typeCategory?.nombre ?? ""].filter(Boolean);
    const archive = firstActiveMatch(catalogos.archivadores, archiveKeywords) ?? firstActive(catalogos.archivadores);
    if (archive) fillIfEmpty("archivador_id", archive.id, "archivador");

    const detectedDescription = descriptionSuggestion(evidence);
    if (detectedDescription) fillIfEmpty("descripcion", detectedDescription, "descripción");

    if (notify && suggestions.length) {
      toast.success(`Se autocompletó: ${Array.from(new Set(suggestions)).join(", ")}.`);
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setValue("archivo", file, { shouldValidate: true });
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const nextPreviewUrl = file.type.startsWith("image/") || file.type === "application/pdf" ? URL.createObjectURL(file) : null;
    setPreviewUrl(nextPreviewUrl);
    setPreviewOpen(false);
    applyFileSuggestions(file, false);
  };

  const clearForm = () => {
    reset();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewOpen(false);
    setEntityDraft({ nombre: "", tipoDocumento: "", numeroDocumento: "" });
    setPendingAnexos([]);
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
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setPreviewOpen(false);
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
                <div className="relative"><CalendarDays className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input type="date" min={`${minDocumentYear}-01-01`} max={`${maxDocumentYear}-12-31`} className="pl-9" {...register("fecha_documento")} /></div>
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
              <Field label="Tipo de entidad"><Select
                className="w-full"
                {...register("tipo_entidad_id", {
                  onChange: () => {
                    setValue("entidad_id", "", { shouldDirty: true });
                    setEntityDraft({ nombre: "", tipoDocumento: "", numeroDocumento: "" });
                  },
                })}
              ><option value="">No especificado</option>{catalogos.tiposEntidad.filter((item) => item.activo).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</Select></Field>
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
          {isImage ? <img src={url} alt={title} className="max-h-full rounded-xl object-contain" /> : isPdf ? <iframe src={url} title={title} className="h-full w-full rounded-xl bg-white" /> : <div className="max-w-md rounded-2xl bg-white p-6 text-center shadow-sm dark:bg-slate-900"><FileText className="mx-auto mb-3 size-10 text-teal-700" /><h3 className="font-bold">Vista previa no disponible</h3><p className="mt-2 text-sm text-slate-500">Este tipo de archivo puede abrirse con una aplicación compatible.</p></div>}
        </div>
      </div>
    </div>
  );
}
