import { useEffect, useRef, useState } from "react";
import { getMontoTotal } from "../services/documentos.service";
import type { DocumentoFilters } from "../types";

export function useMontoTotal(filters: DocumentoFilters) {
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [recarga, setRecarga] = useState(0);
  const requestId = useRef(0);
  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    getMontoTotal(filters)
      .then((value) => {
        if (currentRequest === requestId.current) setTotal(value);
      })
      .catch(() => {
        if (currentRequest === requestId.current) setTotal(0);
      })
      .finally(() => {
        if (currentRequest === requestId.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, recarga]);

  // Vuelve a calcular el total (por ejemplo, después de eliminar un documento o cambiar su tipo).
  const refresh = () => setRecarga((valor) => valor + 1);

  return { total, loading, refresh };
}
