import { useCallback, useEffect, useState } from "react";
import { listBackups, requestBackup } from "../services/backups.service";
import type { Backup } from "../types";

export function useBackups() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setBackups(await listBackups());
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el historial de respaldos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const generate = async (filters: { anio: number; categoriaId?: string | null; archivadorId?: string | null }) => {
    setGenerating(true);
    try {
      await requestBackup(filters);
      await refresh();
    } finally {
      setGenerating(false);
    }
  };

  return { backups, loading, generating, error, refresh, generate };
}
