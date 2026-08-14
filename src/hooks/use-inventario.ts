import { useCallback, useEffect, useState } from "react";
import {
  createInventarioArea,
  createInventarioItem,
  getInventarioAreas,
  getInventarioItems,
  setInventarioAreaActive,
  updateInventarioItem,
  type InventarioItemInput,
} from "../services/inventario.service";
import type { InventarioArea, InventarioItem } from "../types";

export function useInventarioItems() {
  const [items, setItems] = useState<InventarioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await getInventarioItems());
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los ítems de inventario.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const create = async (input: InventarioItemInput) => {
    const item = await createInventarioItem(input);
    await refresh();
    return item;
  };

  const update = async (id: string, input: InventarioItemInput & { activo: boolean }) => {
    const item = await updateInventarioItem(id, input);
    await refresh();
    return item;
  };

  return { items, loading, error, refresh, create, update };
}

export function useInventarioAreas() {
  const [areas, setAreas] = useState<InventarioArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setAreas(await getInventarioAreas());
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las áreas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const create = async (nombre: string) => {
    const area = await createInventarioArea(nombre);
    await refresh();
    return area;
  };

  const toggleActive = async (area: InventarioArea) => {
    await setInventarioAreaActive(area.id, !area.activo);
    await refresh();
  };

  return { areas, loading, error, refresh, create, toggleActive };
}
