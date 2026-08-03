import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// "Diego Andrés Falcón Ramírez" -> "Diego F." (primer nombre + inicial del
// primer apellido). Con nombre completo de 2-3 palabras, el penultimo/ultimo
// termino sigue siendo el primer apellido bajo la convencion peruana
// (nombre[s] + apellido paterno + apellido materno).
export function formatShortName(fullName?: string | null): string {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  const nombre = parts[0];
  const apellido = parts.length >= 3 ? parts[parts.length - 2] : parts[1];
  return `${nombre} ${apellido[0].toLocaleUpperCase("es")}.`;
}

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(value);

const dateFormatter = new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const dateTimeFormatter = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export const parseDateValue = (value: string) => {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  return new Date(value);
};

export const formatDate = (value: string) => dateFormatter.format(parseDateValue(value));

export const formatDateTime = (value: string) => dateTimeFormatter.format(new Date(value));

const relativeTimeFormatter = new Intl.RelativeTimeFormat("es-PE", { numeric: "auto" });

const relativeTimeUnits: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
  { unit: "year", seconds: 31536000 },
  { unit: "month", seconds: 2592000 },
  { unit: "week", seconds: 604800 },
  { unit: "day", seconds: 86400 },
  { unit: "hour", seconds: 3600 },
  { unit: "minute", seconds: 60 },
];

export const formatRelativeTime = (value: string) => {
  const diffSeconds = (new Date(value).getTime() - Date.now()) / 1000;
  for (const { unit, seconds } of relativeTimeUnits) {
    if (Math.abs(diffSeconds) >= seconds) {
      return relativeTimeFormatter.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  return relativeTimeFormatter.format(Math.round(diffSeconds), "second");
};

export type StatusTone = "green" | "amber" | "orange" | "red" | "slate";

/**
 * Única fuente de verdad para el color de un estado de documento. Antes cada página
 * mapeaba "Observado" a un color distinto (naranja, rojo, ámbar) — con esto el mismo
 * estado siempre se ve igual en todo el sistema.
 */
export const getStatusTone = (status?: string): StatusTone => {
  const normalized = status?.toLocaleLowerCase("es") ?? "";
  if (normalized.includes("verific")) return "green";
  if (normalized.includes("pend")) return "amber";
  if (normalized.includes("observ")) return "orange";
  if (normalized.includes("no encontr")) return "red";
  return "slate";
};
