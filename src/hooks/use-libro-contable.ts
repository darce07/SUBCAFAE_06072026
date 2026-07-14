import { useCallback, useEffect, useRef, useState } from "react";
import { getAllDocumentosMovimientoLigero } from "../services/documentos.service";
import type { Documento, DocumentoFilters } from "../types";

export function useLibroContable(filters: Omit<DocumentoFilters, "page" | "pageSize" | "orderBy" | "orderDirection"> = {}) {
  const [movimientos, setMovimientos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const filterKey = JSON.stringify(filters);

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getAllDocumentosMovimientoLigero(filters);
      if (currentRequest !== requestId.current) return;
      setMovimientos(data);
    } catch (loadError) {
      if (currentRequest !== requestId.current) return;
      setMovimientos([]);
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el libro contable.");
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { movimientos, loading, error, refresh };
}
