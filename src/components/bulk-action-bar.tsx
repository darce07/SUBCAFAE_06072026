import type { ReactNode } from "react";

// Barra que aparece sobre la tabla cuando hay filas seleccionadas.
export function BulkActionBar({
  count,
  total,
  onSelectAll,
  selectingAll,
  onClear,
  children,
}: {
  count: number;
  total: number;
  onSelectAll: () => void;
  selectingAll: boolean;
  onClear: () => void;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="flex flex-col gap-2 border-b border-teal-200 bg-teal-50 px-4 py-3 text-sm dark:border-teal-900 dark:bg-teal-950/40 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <strong>{count} {count === 1 ? "seleccionado" : "seleccionados"}</strong>
        {count < total && (
          <button type="button" disabled={selectingAll} onClick={onSelectAll} className="font-semibold text-teal-700 underline-offset-2 hover:underline disabled:opacity-60 dark:text-teal-300">
            {selectingAll ? "Seleccionando..." : `Seleccionar los ${total}`}
          </button>
        )}
        <button type="button" onClick={onClear} className="text-slate-500 underline-offset-2 hover:underline">Limpiar selección</button>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
