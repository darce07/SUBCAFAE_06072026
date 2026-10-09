import { PDFDocument } from "pdf-lib";

// Cantidad de páginas de un archivo: PDF por sus páginas, imagen = 1. Word, Excel y otros
// formatos no tienen un conteo fiable en el navegador, así que devuelven null.
export async function contarPaginas(bytes: ArrayBuffer, tipo: { mime?: string | null; extension?: string | null }): Promise<number | null> {
  const mime = (tipo.mime ?? "").toLocaleLowerCase("es");
  const extension = (tipo.extension ?? "").toLocaleLowerCase("es").replace(/^\./, "");
  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif"].includes(extension)) return 1;
  if (mime === "application/pdf" || extension === "pdf") {
    try {
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
      return pdf.getPageCount();
    } catch {
      return null;
    }
  }
  return null;
}
