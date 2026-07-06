import { useEffect, useState } from "react";
import { getDashboardResumen } from "../services/documentos.service";
import type { DashboardFilters, DashboardResumen } from "../types";

export function useDashboardResumen(filters: DashboardFilters = {}) {
  const [data, setData] = useState<DashboardResumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void getDashboardResumen(filters)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el panel de control.");
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
