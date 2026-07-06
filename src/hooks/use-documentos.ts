import { useCallback, useEffect, useRef, useState } from "react";
import { getDocumentos } from "../services/documentos.service";
import { mockDocumentos } from "../mocks/supabase-data";
import type { Documento, DocumentoFilters } from "../types";
import { isSupabaseConfigured } from "../lib/supabase";

export function useDocumentos(filters: DocumentoFilters = {}) {
  const [documentos, setDocumentos] = useState<Documento[]>(isSupabaseConfigured ? [] : mockDocumentos);
  const [count, setCount] = useState(isSupabaseConfigured ? 0 : mockDocumentos.length);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const filterKey = JSON.stringify(filters);

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await getDocumentos(filters);
      if (currentRequest !== requestId.current) return;
      setDocumentos(result.data);
      setCount(result.count);
      setUsingFallback(!isSupabaseConfigured);
    } catch (loadError) {
      if (currentRequest !== requestId.current) return;
      const page = Math.max(filters.page ?? 1, 1);
      const pageSize = filters.pageSize ?? 10;
      setDocumentos(isSupabaseConfigured ? [] : mockDocumentos.slice((page - 1) * pageSize, page * pageSize));
      setCount(isSupabaseConfigured ? 0 : mockDocumentos.length);
      setUsingFallback(!isSupabaseConfigured);
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los documentos.");
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [filterKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { documentos, count, loading, error, usingFallback, refresh };
}
