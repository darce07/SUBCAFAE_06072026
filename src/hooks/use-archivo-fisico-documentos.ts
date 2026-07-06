import { useCallback, useEffect, useRef, useState } from "react";
import { isSupabaseConfigured } from "../lib/supabase";
import { mockDocumentos } from "../mocks/supabase-data";
import {
  getArchivoFisicoDocumentos,
  getArchivoFisicoResumen,
  type ArchivoFisicoFilters,
  type ArchivoFisicoResumen,
} from "../services/archivo-fisico.service";
import type { Documento } from "../types";

const emptyResumen: ArchivoFisicoResumen = {
  asignados: 0,
  sinArchivador: 0,
  porArchivador: {},
};

export function useArchivoFisicoDocumentos(filters: ArchivoFisicoFilters = {}) {
  const [documentos, setDocumentos] = useState<Documento[]>(isSupabaseConfigured ? [] : mockDocumentos.filter((item) => item.archivador_id));
  const [count, setCount] = useState(isSupabaseConfigured ? 0 : mockDocumentos.filter((item) => item.archivador_id).length);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const filterKey = JSON.stringify(filters);

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await getArchivoFisicoDocumentos(filters);
      if (currentRequest !== requestId.current) return;
      setDocumentos(result.data);
      setCount(result.count);
    } catch (loadError) {
      if (currentRequest !== requestId.current) return;
      setDocumentos([]);
      setCount(0);
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el archivo físico.");
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [filterKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { documentos, count, loading, error, refresh };
}

export function useArchivoFisicoResumen(search?: string) {
  const [resumen, setResumen] = useState<ArchivoFisicoResumen>(emptyResumen);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    getArchivoFisicoResumen(search)
      .then((result) => {
        if (currentRequest !== requestId.current) return;
        setResumen(result);
      })
      .catch((loadError) => {
        if (currentRequest !== requestId.current) return;
        setResumen(emptyResumen);
        setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el resumen del archivo físico.");
      })
      .finally(() => {
        if (currentRequest === requestId.current) setLoading(false);
      });
  }, [search]);

  return { resumen, loading, error };
}
