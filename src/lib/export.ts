import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\n;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

// El paquete "xlsx" (SheetJS) tiene CVEs sin parche en npm; para exportar
// planillas usamos CSV con BOM UTF-8, que Excel abre nativo y sin
// dependencias de riesgo.
export function exportToExcel(headers: string[], rows: (string | number)[][], filename: string) {
  const lines = [headers, ...rows].map((row) => row.map(csvEscape).join(","));
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

export function exportToPdf(title: string, headers: string[], rows: (string | number)[][], filename: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(title, 14, 15);
  doc.setFontSize(9);
  doc.text(new Date().toLocaleString("es-PE"), 14, 21);
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 26,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [15, 118, 110] },
  });
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
