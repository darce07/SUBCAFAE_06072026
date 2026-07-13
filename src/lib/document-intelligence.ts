import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import Tesseract from "tesseract.js";
import mammoth from "mammoth/mammoth.browser";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface ExtractedDocumentText {
  text: string;
  source: "pdf-text" | "ocr" | "docx" | "unsupported" | "empty";
}

const maxPdfPages = 3;
const maxOcrPages = 2;
const ocrScale = 3.1;

export function canExtractDocumentText(file: File) {
  const extension = file.name.split(".").pop()?.toLocaleLowerCase("es") ?? "";
  return file.type === "application/pdf"
    || file.type.startsWith("image/")
    || extension === "pdf"
    || extension === "docx";
}

export async function extractDocumentText(file: File): Promise<ExtractedDocumentText> {
  const extension = file.name.split(".").pop()?.toLocaleLowerCase("es") ?? "";
  if (file.type.startsWith("image/")) return extractImageText(file);
  if (file.type === "application/pdf" || extension === "pdf") return extractPdfText(file);
  if (extension === "docx") return extractDocxText(file);
  return { text: "", source: "unsupported" };
}

async function extractImageText(file: File): Promise<ExtractedDocumentText> {
  const worker = await Tesseract.createWorker("spa+eng");
  try {
    const text = await recognizeBestImageText(file, worker);
    return { text, source: text.trim() ? "ocr" : "empty" };
  } finally {
    await worker.terminate();
  }
}

async function extractPdfText(file: File): Promise<ExtractedDocumentText> {
  const data = await file.arrayBuffer();
  const pdfDocument = await pdfjsLib.getDocument({ data }).promise;
  const directText = await extractEmbeddedPdfText(pdfDocument);
  if (directText.trim().length > 80) return { text: directText, source: "pdf-text" };

  const pageCount = Math.min(pdfDocument.numPages, maxOcrPages);
  const pageTexts: string[] = [];
  const worker = await Tesseract.createWorker("spa+eng");
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale: ocrScale });
    const canvas = globalThis.document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) continue;
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    pageTexts.push(await recognizeBestCanvasText(canvas, worker));
    if (pageNumber === 1) {
      const titleCrop = cropCanvas(canvas, 0.14, 0.18, 0.76, 0.3);
      const stampCrop = cropCanvas(canvas, 0.62, 0.04, 0.34, 0.24);
      const wideStampCrop = cropCanvas(canvas, 0.52, 0.02, 0.44, 0.32);
      const dateCrop = cropCanvas(canvas, 0.48, 0.28, 0.48, 0.22);
      const tightDateCrop = cropCanvas(canvas, 0.54, 0.32, 0.38, 0.12);
      const summaryCrop = cropCanvas(canvas, 0.12, 0.38, 0.78, 0.26);
      pageTexts.push(await recognizeBestCanvasText(titleCrop, worker));
      pageTexts.push(await recognizeCanvasTextCandidates(upscaleCanvas(stampCrop, 2.4), worker));
      pageTexts.push(await recognizeDateText(wideStampCrop, worker));
      pageTexts.push(await recognizeDateText(stampCrop, worker));
      pageTexts.push(await recognizeDateText(dateCrop, worker));
      pageTexts.push(await recognizeCanvasTextCandidates(dateCrop, worker));
      pageTexts.push(await recognizeCanvasTextCandidates(upscaleCanvas(tightDateCrop, 2.2), worker));
      pageTexts.push(await recognizeBestCanvasText(summaryCrop, worker));
    }
  }
  await worker.terminate();

  const ocrText = pageTexts.join("\n").trim();
  return { text: ocrText || directText, source: ocrText ? "ocr" : directText.trim() ? "pdf-text" : "empty" };
}

async function extractEmbeddedPdfText(document: pdfjsLib.PDFDocumentProxy) {
  const pageCount = Math.min(document.numPages, maxPdfPages);
  const pageTexts: string[] = [];
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => "str" in item ? item.str : "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) pageTexts.push(text);
  }
  return pageTexts.join("\n");
}

async function extractDocxText(file: File): Promise<ExtractedDocumentText> {
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  const text = result.value.trim();
  return { text, source: text ? "docx" : "empty" };
}

async function recognizeBestImageText(image: File | Blob, worker: Tesseract.Worker) {
  const imageElement = await blobToImage(image);
  const canvas = globalThis.document.createElement("canvas");
  canvas.width = imageElement.naturalWidth;
  canvas.height = imageElement.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) return "";
  context.drawImage(imageElement, 0, 0);
  URL.revokeObjectURL(imageElement.src);
  return recognizeBestCanvasText(canvas, worker);
}

async function recognizeBestCanvasText(canvas: HTMLCanvasElement, worker: Tesseract.Worker) {
  const candidates = await recognizeCanvasCandidates(canvas, worker);
  return candidates[0]?.text ?? "";
}

async function recognizeCanvasTextCandidates(canvas: HTMLCanvasElement, worker: Tesseract.Worker) {
  const candidates = await recognizeCanvasCandidates(canvas, worker);
  return candidates.slice(0, 4).map((candidate) => candidate.text).join("\n");
}

async function recognizeCanvasCandidates(canvas: HTMLCanvasElement, worker: Tesseract.Worker) {
  const rotations = [0, 90, -90, 180];
  const candidates: Array<{ text: string; score: number }> = [];
  for (const rotation of rotations) {
    const rotated = rotateCanvas(canvas, rotation);
    const variants = [rotated, thresholdCanvas(rotated), colorInkCanvas(rotated)];
    for (const variant of variants) {
      const blob = await canvasToBlob(variant);
      if (!blob) continue;
      const result = await worker.recognize(blob);
      const text = result.data.text.trim();
      if (!text) continue;
      const score = scoreOcrText(text, result.data.confidence);
      candidates.push({ text, score });
    }
  }
  return candidates
    .sort((left, right) => right.score - left.score)
    .filter((candidate, index, array) => array.findIndex((item) => item.text === candidate.text) === index);
}

async function recognizeDateText(canvas: HTMLCanvasElement, worker: Tesseract.Worker) {
  const dateCanvases = [
    canvas,
    upscaleCanvas(canvas, 2),
    thresholdCanvas(upscaleCanvas(canvas, 2.6), 210),
    colorInkCanvas(upscaleCanvas(canvas, 2.8)),
  ];
  const previousParams = {
    tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
    tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÁÉÍÓÚáéíóúÑñ/.-:,_°º ",
    preserve_interword_spaces: "1",
  };
  await worker.setParameters(previousParams);
  const candidates: string[] = [];
  for (const dateCanvas of dateCanvases) {
    for (const rotation of [0, 90, -90, 180]) {
      const rotated = rotateCanvas(dateCanvas, rotation);
      const blob = await canvasToBlob(rotated);
      if (!blob) continue;
      const result = await worker.recognize(blob);
      if (result.data.text.trim()) candidates.push(result.data.text.trim());
    }
  }
  await worker.setParameters({
    tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
    tessedit_char_whitelist: "",
    preserve_interword_spaces: "0",
  });
  return candidates.join("\n");
}

function scoreOcrText(text: string, confidence = 0) {
  const normalized = text.toLocaleLowerCase("es");
  const usefulWords = [
    "resolucion",
    "resolución",
    "directoral",
    "considerando",
    "ugel",
    "subcafae",
    "fecha",
    "articulo",
    "artículo",
    "representantes",
    "reaperturar",
    "bbva",
  ];
  const wordScore = usefulWords.filter((word) => normalized.includes(word)).length * 80;
  const dateScore = /\b\d{1,2}\s+(?:de\s+)?(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|setiembre|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?20\d{2}\b/i.test(text) ? 250 : 0;
  const documentScore = /\b(?:rd|r\.d\.|resolucion|resolución)\s*(?:n[°º.]?\s*)?\d{2,5}[-\s]*20\d{2}\b/i.test(text) ? 120 : 0;
  const letterCount = text.match(/[a-záéíóúñ]/gi)?.length ?? 0;
  return confidence + wordScore + dateScore + documentScore + Math.min(letterCount, 1200) / 4;
}

function rotateCanvas(source: HTMLCanvasElement, degrees: number) {
  if (degrees === 0) return source;
  const radians = degrees * Math.PI / 180;
  const swap = Math.abs(degrees) === 90;
  const canvas = globalThis.document.createElement("canvas");
  canvas.width = swap ? source.height : source.width;
  canvas.height = swap ? source.width : source.height;
  const context = canvas.getContext("2d");
  if (!context) return source;
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(radians);
  context.drawImage(source, -source.width / 2, -source.height / 2);
  return canvas;
}

function cropCanvas(source: HTMLCanvasElement, xRatio: number, yRatio: number, widthRatio: number, heightRatio: number) {
  const x = Math.max(0, Math.floor(source.width * xRatio));
  const y = Math.max(0, Math.floor(source.height * yRatio));
  const width = Math.min(source.width - x, Math.floor(source.width * widthRatio));
  const height = Math.min(source.height - y, Math.floor(source.height * heightRatio));
  const canvas = globalThis.document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return source;
  context.drawImage(source, x, y, width, height, 0, 0, width, height);
  return canvas;
}

function thresholdCanvas(source: HTMLCanvasElement, threshold = 185) {
  const canvas = globalThis.document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return source;
  context.drawImage(source, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < imageData.data.length; index += 4) {
    const red = imageData.data[index];
    const green = imageData.data[index + 1];
    const blue = imageData.data[index + 2];
    const gray = red * 0.299 + green * 0.587 + blue * 0.114;
    const value = gray < threshold ? 0 : 255;
    imageData.data[index] = value;
    imageData.data[index + 1] = value;
    imageData.data[index + 2] = value;
  }
  context.putImageData(imageData, 0, 0);
  return canvas;
}

function colorInkCanvas(source: HTMLCanvasElement) {
  const canvas = globalThis.document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return source;
  context.drawImage(source, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < imageData.data.length; index += 4) {
    const red = imageData.data[index];
    const green = imageData.data[index + 1];
    const blue = imageData.data[index + 2];
    const isRedInk = red > 110 && red > green * 1.25 && red > blue * 1.1;
    const isBlueInk = blue > 105 && blue > red * 1.08 && blue > green * 1.02;
    const isDarkInk = red < 120 && green < 120 && blue < 120;
    const value = isRedInk || isBlueInk || isDarkInk ? 0 : 255;
    imageData.data[index] = value;
    imageData.data[index + 1] = value;
    imageData.data[index + 2] = value;
  }
  context.putImageData(imageData, 0, 0);
  return canvas;
}

function upscaleCanvas(source: HTMLCanvasElement, scale: number) {
  const canvas = globalThis.document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(source.width * scale));
  canvas.height = Math.max(1, Math.floor(source.height * scale));
  const context = canvas.getContext("2d");
  if (!context) return source;
  context.imageSmoothingEnabled = false;
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function blobToImage(blob: File | Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo preparar la imagen para OCR."));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png", 0.92);
  });
}
