import type { ReactNode } from "react";
import { Info } from "lucide-react";

export function SectionTitle({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div className="rounded-xl bg-teal-50 p-2.5 text-teal-700 dark:bg-teal-950">{icon}</div>
      <div>
        <h2 className="font-bold">{title}</h2>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </div>
  );
}

export function Field({ label, hint, info, error, children, className = "" }: { label: string; hint?: string; info?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={className}>
      <span className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {label}
        {info && (
          <span tabIndex={0} className="group relative inline-flex focus:outline-none">
            <Info className="size-3.5 shrink-0 cursor-help text-slate-400 hover:text-teal-600" />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-60 -translate-x-1/2 rounded-lg bg-slate-900 p-2.5 text-[11px] font-normal normal-case leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 dark:bg-slate-700">
              {info}
            </span>
          </span>
        )}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  );
}
