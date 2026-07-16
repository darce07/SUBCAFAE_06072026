import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

export function TextFilePreview({ url }: { url: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setError(false);
    fetch(url)
      .then((response) => response.text())
      .then((text) => { if (!cancelled) setContent(text); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [url]);

  if (error) return <p className="text-sm text-slate-500">No se pudo cargar el contenido del archivo.</p>;
  if (content === null) return <LoaderCircle className="size-6 animate-spin text-teal-600" />;
  return (
    <pre className="h-full w-full overflow-auto whitespace-pre-wrap break-words rounded-xl bg-white p-4 text-left font-mono text-xs text-slate-800 dark:bg-slate-950 dark:text-slate-200">
      {content}
    </pre>
  );
}
