import type { EstadoInventarioItem } from "../../types";

export const ESTADO_INVENTARIO_OPTIONS: EstadoInventarioItem[] = [
  "nuevo",
  "usado_buen_estado",
  "usado_mal_estado",
  "mal_estado",
];

export const estadoInventarioLabel: Record<EstadoInventarioItem, string> = {
  nuevo: "Nuevo",
  usado_buen_estado: "Usado – buen estado",
  usado_mal_estado: "Usado – mal estado",
  mal_estado: "Mal estado",
};

export const estadoInventarioTone: Record<EstadoInventarioItem, "green" | "blue" | "amber" | "red"> = {
  nuevo: "green",
  usado_buen_estado: "blue",
  usado_mal_estado: "amber",
  mal_estado: "red",
};
