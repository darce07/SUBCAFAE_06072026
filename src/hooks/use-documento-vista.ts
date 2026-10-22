import { useEffect, useState } from "react";
import type { Preview } from "../components/documento-vista";
import { mimeFromExtension } from "../lib/documento-mime";
import { getDocumentoById } from "../services/documentos.service";
import { getSignedUrl } from "../services/storage.service";
import type { Documento } from "../types";

// Carga un documento para mostrarlo en una vista previa (ventana emergente o panel lateral).
// `inicial` es la fila que ya tiene la lista: con ella los datos se ven al instante y solo falta pedir
// el enlace firmado del archivo, que se muestra directo (el visor del navegador lo va leyendo por
// partes) sin descargarlo completo antes. Quien lo use debe montarlo de nuevo por documento (key=id).
export function useDocumentoVista(id: string, inicial: Documento | null) {
  const [documento, setDocumento] = useState<Documento | null>(inicial);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(!inicial);
  const [cargandoArchivo, setCargandoArchivo] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const row = inicial ?? await getDocumentoById(id);
        if (cancelled) return;
        setDocumento(row);
        setLoading(false);
        if (row?.archivo_path) {
          const signedUrl = await getSignedUrl(row.archivo_path, 300);
          if (cancelled) return;
          if (signedUrl) setPreview({ objectUrl: signedUrl, signedUrl, mimeType: mimeFromExtension(row.extension) });
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el documento.");
      } finally {
        if (!cancelled) { setLoading(false); setCargandoArchivo(false); }
      }
    })();
    return () => { cancelled = true; };
    // `inicial` es la fila de este mismo id (el componente se monta de nuevo por documento).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return { documento, preview, loading, cargandoArchivo, error };
}
