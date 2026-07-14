import { supabase } from "../lib/supabase";
import { getSupabaseErrorMessage } from "../lib/supabase-error";
import { isWatermarkableMime, watermarkImageBlob, watermarkPdfBlob, type WatermarkInfo } from "../lib/watermark";

const BUCKET = "documentos";
export const MAX_DOCUMENT_FILE_SIZE = 20 * 1024 * 1024;
export const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
]);

interface UploadMetadata {
  userId: string;
  idempotencyKey: string;
  categoria: string;
  anio: number;
  mes: number;
  dia: number;
}

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-|-$/g, "");

export async function uploadDocumentoFile(file: File, metadata: UploadMetadata) {
  const preparedFile = await prepareDocumentoFileForUpload(file);
  const safeName = slugify(preparedFile.name);
  const path = [
    metadata.userId,
    slugify(metadata.categoria),
    metadata.anio,
    String(metadata.mes).padStart(2, "0"),
    String(metadata.dia).padStart(2, "0"),
    `${metadata.idempotencyKey}-${safeName}`,
  ].join("/");

  if (!supabase) return { path, file: preparedFile };

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, preparedFile, { cacheControl: "3600", upsert: false, contentType: preparedFile.type });

  if (error && !String(error.message).toLocaleLowerCase("es").includes("already exists")) {
    throw new Error(getSupabaseErrorMessage(error, "No se pudo subir el archivo."));
  }
  return { path, file: preparedFile };
}

export async function uploadDocumentoAnexoFile(file: File, metadata: UploadMetadata & { documentoId: string }) {
  const preparedFile = await prepareDocumentoFileForUpload(file);
  const safeName = slugify(preparedFile.name);
  const path = [
    metadata.userId,
    "anexos",
    metadata.documentoId,
    `${metadata.idempotencyKey}-${safeName}`,
  ].join("/");

  if (!supabase) return { path, file: preparedFile };

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, preparedFile, { cacheControl: "3600", upsert: false, contentType: preparedFile.type || "application/octet-stream" });

  if (error && !String(error.message).toLocaleLowerCase("es").includes("already exists")) {
    throw new Error(getSupabaseErrorMessage(error, "No se pudo subir el anexo."));
  }
  return { path, file: preparedFile };
}

export async function prepareDocumentoFileForUpload(file: File): Promise<File> {
  validateDocumentoFile(file);
  await validateFileSignature(file);
  if (!file.type.startsWith("image/")) return file;
  const optimized = await optimizeImage(file);
  validateDocumentoFile(optimized);
  await validateFileSignature(optimized);
  return optimized;
}

export function validateDocumentoFile(file: File) {
  if (file.size > MAX_DOCUMENT_FILE_SIZE) {
    throw new Error("El archivo supera el tamaño máximo permitido de 20 MB.");
  }
  if (file.type && !ALLOWED_DOCUMENT_MIME_TYPES.has(file.type)) {
    throw new Error("El tipo de archivo no está permitido.");
  }
  const extension = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : "";
  const allowedExtensions = new Set(["pdf", "doc", "docx", "xls", "xlsx", "jpg", "jpeg", "png", "webp", "txt"]);
  if (!extension || !allowedExtensions.has(extension)) {
    throw new Error("La extensión del archivo no está permitida.");
  }
}

async function validateFileSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const header = Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const textHeader = new TextDecoder().decode(bytes);
  if (textHeader.startsWith("MZ")) {
    throw new Error("No se permiten archivos ejecutables.");
  }
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "pdf" && !textHeader.startsWith("%PDF")) {
    throw new Error("El contenido del PDF no coincide con su extensión.");
  }
  if ((extension === "png") && !header.startsWith("89504e47")) {
    throw new Error("El contenido de la imagen no coincide con su extensión.");
  }
  if ((extension === "jpg" || extension === "jpeg") && !header.startsWith("ffd8ff")) {
    throw new Error("El contenido de la imagen no coincide con su extensión.");
  }
  if (extension === "webp" && !(textHeader.startsWith("RIFF") && textHeader.includes("WEBP"))) {
    throw new Error("El contenido de la imagen no coincide con su extensión.");
  }
}

export async function getSignedUrl(path: string, expiresIn = 300) {
  if (!supabase) return "";
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo abrir el archivo."));
  return data.signedUrl;
}

export async function getDocumentoPreview(path: string) {
  const signedUrl = await getSignedUrl(path, 300);
  if (!signedUrl) return { objectUrl: "", signedUrl: "", mimeType: null as string | null };
  try {
    const response = await fetch(signedUrl, { cache: "no-store" });
    if (!response.ok) throw new Error("Preview unavailable");
    const blob = await response.blob();
    return {
      objectUrl: URL.createObjectURL(blob),
      signedUrl,
      mimeType: blob.type || null,
    };
  } catch {
    return { objectUrl: "", signedUrl, mimeType: null as string | null };
  }
}

export function releaseDocumentoPreview(objectUrl: string) {
  if (objectUrl.startsWith("blob:")) URL.revokeObjectURL(objectUrl);
}

export async function downloadDocumentoFile(path: string, filename: string, watermark?: Omit<WatermarkInfo, "fecha">) {
  const signedUrl = await getSignedUrl(path, 120);
  if (!signedUrl) return;
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error("No se pudo descargar el archivo.");
  let blob = await response.blob();

  if (watermark && isWatermarkableMime(blob.type)) {
    const info: WatermarkInfo = { ...watermark, fecha: new Date().toLocaleString("es-PE") };
    blob = blob.type === "application/pdf"
      ? await watermarkPdfBlob(blob, info)
      : await watermarkImageBlob(blob, info, blob.type);
  }

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function removeDocumentoFile(path: string) {
  if (!supabase) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo retirar el archivo."));
}

async function optimizeImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const maxSide = 1800;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const outputType = file.type === "image/png" ? "image/png" : "image/webp";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outputType, 0.82));
  if (!blob || blob.size >= file.size) return file;
  const baseName = file.name.replace(/\.[^.]+$/, "");
  const extension = outputType === "image/png" ? "png" : "webp";
  return new File([blob], `${baseName}.${extension}`, { type: outputType, lastModified: Date.now() });
}
