// Tipos de archivo que el sistema sabe mostrar en vista previa.
export const WORD_MIME = ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

export function mimeFromExtension(extension?: string | null) {
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
