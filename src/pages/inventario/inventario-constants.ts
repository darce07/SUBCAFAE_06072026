import type { EstadoInventarioItem } from "../../types";

export const ESTADO_INVENTARIO_OPTIONS: EstadoInventarioItem[] = [
  "nuevo",
  "usado_buen_estado",
  "usado_mal_estado",
  "mal_estado",
  "en_reparacion",
  "prestado",
  "de_baja",
  "perdido",
];

export const estadoInventarioLabel: Record<EstadoInventarioItem, string> = {
  nuevo: "Nuevo",
  usado_buen_estado: "Usado – buen estado",
  usado_mal_estado: "Usado – mal estado",
  mal_estado: "Mal estado",
  en_reparacion: "En reparación",
  prestado: "Prestado",
  de_baja: "Dado de baja",
  perdido: "Perdido / extraviado",
};

export const estadoInventarioTone: Record<EstadoInventarioItem, "green" | "blue" | "amber" | "red" | "violet" | "orange" | "slate"> = {
  nuevo: "green",
  usado_buen_estado: "blue",
  usado_mal_estado: "amber",
  mal_estado: "red",
  en_reparacion: "orange",
  prestado: "violet",
  de_baja: "slate",
  perdido: "red",
};
