import { Columns3 } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui";

export function ColumnsMenu({
  columns,
  isVisible,
  toggle,
}: {
  columns: { id: string; label: string }[];
  isVisible: (columnId: string) => boolean;
  toggle: (columnId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button type="button" variant="secondary" onClick={() => setOpen((value) => !value)}>
        <Columns3 className="size-4" />Columnas
      </Button>
      {open && (
        <>
          <button type="button" aria-label="Cerrar" className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 max-h-80 w-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            {columns.map((column) => (
              <label key={column.id} className="flex cursor-pointer items-center gap-2 rounded-xl p-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                <input type="checkbox" checked={isVisible(column.id)} onChange={() => toggle(column.id)} />
                <span className="truncate">{column.label}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
