import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";

export interface WatermarkInfo {
  codigo: string;
  usuario: string;
  fecha: string;
}

const WATERMARK_TITLE = "SIGDAF";
const WATERMARK_SUBTITLE = "UGEL 06";

export async function watermarkPdfBlob(blob: Blob, info: WatermarkInfo): Promise<Blob> {
  try {
    const bytes = await blob.arrayBuffer();
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const font = await pdf.embedFont(StandardFonts.HelveticaBold);
    const smallFont = await pdf.embedFont(StandardFonts.Helvetica);

    for (const page of pdf.getPages()) {
      const { width, height } = page.getSize();
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.16;

      page.drawEllipse({
        x: centerX,
        y: centerY,
        xScale: radius,
        yScale: radius,
        borderColor: rgb(0.1, 0.15, 0.2),
        borderWidth: 1.4,
        borderOpacity: 0.18,
        rotate: degrees(20),
      });

      const title = WATERMARK_TITLE;
      const titleSize = radius * 0.42;
      page.drawText(title, {
        x: centerX - font.widthOfTextAtSize(title, titleSize) / 2,
        y: centerY + radius * 0.06,
        size: titleSize,
        font,
        color: rgb(0.1, 0.15, 0.2),
        opacity: 0.14,
        rotate: degrees(20),
      });

      const subtitle = WATERMARK_SUBTITLE;
      const subtitleSize = radius * 0.16;
      page.drawText(subtitle, {
        x: centerX - font.widthOfTextAtSize(subtitle, subtitleSize) / 2,
        y: centerY - radius * 0.32,
        size: subtitleSize,
        font,
        color: rgb(0.1, 0.15, 0.2),
        opacity: 0.14,
        rotate: degrees(20),
      });

      const footer = `${info.codigo} · descargado por ${info.usuario} · ${info.fecha}`;
      const footerSize = 7;
      page.drawText(footer, {
        x: 24,
        y: 16,
        size: footerSize,
        font: smallFont,
        color: rgb(0.35, 0.4, 0.45),
        opacity: 0.75,
      });
    }

    const output = await pdf.save();
    return new Blob([output.buffer as ArrayBuffer], { type: "application/pdf" });
  } catch {
    return blob;
  }
}

export async function watermarkImageBlob(blob: Blob, info: WatermarkInfo, mimeType: string): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return blob;

    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.22;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((-20 * Math.PI) / 180);

    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = "#1a2530";
    ctx.lineWidth = Math.max(2, radius * 0.02);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#1a2530";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${Math.round(radius * 0.42)}px "Georgia", serif`;
    ctx.fillText(WATERMARK_TITLE, 0, -radius * 0.05);
    ctx.font = `${Math.round(radius * 0.16)}px "Georgia", serif`;
    ctx.fillText(WATERMARK_SUBTITLE, 0, radius * 0.34);
    ctx.restore();

    ctx.globalAlpha = 0.8;
    ctx.fillStyle = "#334155";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = `${Math.max(11, Math.round(canvas.width * 0.014))}px sans-serif`;
    ctx.fillText(`${info.codigo} · descargado por ${info.usuario} · ${info.fecha}`, 12, canvas.height - 12);

    const output = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, 0.92));
    return output ?? blob;
  } catch {
    return blob;
  }
}

export function isWatermarkableMime(mimeType: string) {
  return mimeType === "application/pdf" || mimeType.startsWith("image/");
}
