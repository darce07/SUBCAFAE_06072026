import { useEffect, useState } from "react";
import { getControlInternoUsuarios } from "../services/admin.service";
import type { ControlInternoFilters, ControlInternoUsuario } from "../types";

export function useControlInterno(filters: ControlInternoFilters = {}) {
  const [data, setData] = useState<ControlInternoUsuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void getControlInternoUsuarios(filters)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el control interno.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filters.anio, filters.mes]);

  return { data, loading, error };
}
