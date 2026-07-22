import { useEffect, useState } from "react";
import { getControlInternoHoy } from "../services/admin.service";
import type { ControlInternoHoy } from "../types";

export function useControlInternoHoy() {
  const [data, setData] = useState<ControlInternoHoy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void getControlInternoHoy()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la actividad de hoy.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { data, loading, error };
}
