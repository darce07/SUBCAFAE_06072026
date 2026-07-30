import { useEffect, useState } from "react";
import { Input } from "./ui";

function formatWithThousands(rawDigits: string, decimalPart: string | null) {
  const grouped = rawDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimalPart === null ? grouped : `${grouped}.${decimalPart}`;
}

function parseDisplayValue(input: string) {
  const cleaned = input.replace(/,/g, "").replace(/[^\d.]/g, "");
  const [intPartRaw, ...rest] = cleaned.split(".");
  const intPart = intPartRaw || "";
  const hasDot = cleaned.includes(".");
  const decimalPart = hasDot ? rest.join("").slice(0, 2) : null;
  return { intPart, decimalPart, hasDot };
}

// Input type="number" no permite mostrar separador de miles mientras se
// tipea (el navegador rechaza cualquier caracter no numérico). Este
// componente es solo estético: el usuario ve "24,760" para guiarse, pero
// lo que llega a react-hook-form/la base de datos es siempre el número
// limpio (24760), nunca el texto formateado.
export function MontoInput({
  value,
  onChange,
  disabled,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [text, setText] = useState(() => {
    if (!value) return "";
    const [intPart, decPart] = String(value).split(".");
    return formatWithThousands(intPart, decPart ?? null);
  });
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (focused) return;
    if (!value) {
      setText("");
      return;
    }
    const [intPart, decPart] = String(value).split(".");
    setText(formatWithThousands(intPart, decPart ?? null));
  }, [value, focused]);

  return (
    <Input
      type="text"
      inputMode="decimal"
      disabled={disabled}
      className={className}
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(event) => {
        const { intPart, decimalPart, hasDot } = parseDisplayValue(event.target.value);
        setText(formatWithThousands(intPart, hasDot ? (decimalPart ?? "") : null));
        const numeric = Number(`${intPart || "0"}${hasDot ? `.${decimalPart ?? ""}` : ""}`);
        onChange(Number.isFinite(numeric) ? numeric : 0);
      }}
    />
  );
}
