import { useCallback, useEffect, useRef, useState } from "react";
import { searchEntidades } from "../services/catalogos.service";
import type { Entidad } from "../types";
import { useDebounce } from "./use-debounce";

export function useEntitySearch(tipoEntidadId: string, search: string) {
  const debouncedSearch = useDebounce(search, 300);
  const [entities, setEntities] = useState<Entidad[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async (searchOverride?: string) => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    return searchEntidades(tipoEntidadId, searchOverride ?? debouncedSearch, 5)
      .then((results) => {
        if (currentRequest === requestId.current) {
          setEntities(results);
          return results;
        }
        return [];
      })
      .catch((loadError) => {
        if (currentRequest !== requestId.current) return;
        setEntities([]);
        setError(loadError instanceof Error ? loadError.message : "No se pudieron buscar las entidades.");
      })
      .finally(() => {
        if (currentRequest === requestId.current) setLoading(false);
      });
  }, [debouncedSearch, tipoEntidadId]);

  useEffect(() => {
    void refresh();
  }, [debouncedSearch, tipoEntidadId]);

  return { entities, loading, error, refresh };
}
