import { useEffect, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const monthAbbrev = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"];

export function MonthYearPicker({
  value,
  onChange,
  minYear,
  maxYear,
}: {
  value: string;
  onChange: (value: string) => void;
  minYear: number;
  maxYear: number;
}) {
  const [open, setOpen] = useState(false);
  const parsed = value.match(/^(\d{4})-(\d{2})$/);
  const selectedYear = parsed ? Number(parsed[1]) : null;
  const selectedMonth = parsed ? Number(parsed[2]) : null;
  const [viewYear, setViewYear] = useState(selectedYear ?? new Date().getFullYear());

  useEffect(() => {
    if (selectedYear) setViewYear(selectedYear);
  }, [selectedYear]);

  const label = selectedYear && selectedMonth ? `${monthNames[selectedMonth - 1]} de ${selectedYear}` : "Sin periodo";

  const pick = (month: number) => {
    onChange(`${viewYear}-${String(month).padStart(2, "0")}`);
    setOpen(false);
  };

  const clear = () => {
    onChange("");
    setOpen(false);
  };

  const setThisMonth = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    onChange(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 dark:border-slate-700 dark:bg-slate-950"
      >
        <span className={selectedYear ? "" : "text-slate-400"}>{label}</span>
        <CalendarDays className="size-4 shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="absolute z-40 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" disabled={viewYear <= minYear} onClick={() => setViewYear((year) => year - 1)} aria-label="Año anterior" className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800">
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-bold">{viewYear}</span>
            <button type="button" disabled={viewYear >= maxYear} onClick={() => setViewYear((year) => year + 1)} aria-label="Año siguiente" className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800">
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {monthAbbrev.map((abbrev, index) => {
              const month = index + 1;
              const isSelected = selectedYear === viewYear && selectedMonth === month;
              return (
                <button
                  type="button"
                  key={abbrev}
                  onClick={() => pick(month)}
                  className={`rounded-lg py-2 text-xs font-semibold transition ${isSelected ? "bg-teal-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
                >
                  {abbrev}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-semibold dark:border-slate-800">
            <button type="button" onClick={clear} className="text-slate-500 hover:text-rose-600">Borrar</button>
            <button type="button" onClick={setThisMonth} className="text-teal-700 hover:text-teal-900 dark:text-teal-400">Este mes</button>
          </div>
        </div>
      )}
    </div>
  );
}
