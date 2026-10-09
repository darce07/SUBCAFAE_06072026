import { useEffect, useRef } from "react";

// Casilla de selección. `indeterminate` muestra el estado "algunos" del
// encabezado cuando solo parte de la página está marcada.
export function SelectCheckbox({
  checked,
  indeterminate = false,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={onChange}
      onClick={(event) => event.stopPropagation()}
      className="size-4 cursor-pointer rounded border-slate-300 accent-teal-600"
    />
  );
}
