import { useCallback, useMemo, useState } from "react";

// Selección múltiple que se conserva al cambiar de página. Guarda solo ids.
export function useRowSelection() {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  const toggle = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const addMany = useCallback((ids: string[]) => {
    setSelected((current) => new Set([...current, ...ids]));
  }, []);

  const removeMany = useCallback((ids: string[]) => {
    setSelected((current) => {
      const next = new Set(current);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const pageState = useCallback((ids: string[]) => {
    const count = ids.filter((id) => selected.has(id)).length;
    return { all: ids.length > 0 && count === ids.length, some: count > 0 && count < ids.length };
  }, [selected]);

  const togglePage = useCallback((ids: string[]) => {
    const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
    if (allSelected) removeMany(ids);
    else addMany(ids);
  }, [addMany, removeMany, selected]);

  const ids = useMemo(() => [...selected], [selected]);

  return { count: selected.size, ids, isSelected, toggle, addMany, removeMany, clear, pageState, togglePage };
}

// Recorre todas las páginas de un listado y devuelve los ids (para "seleccionar
// todos" más allá de la página visible). Tope de seguridad de 2.000.
export async function collectAllIds(
  fetchPage: (page: number) => Promise<{ data: Array<{ id: string }>; count: number }>,
): Promise<string[]> {
  const ids: string[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const result = await fetchPage(page);
    ids.push(...result.data.map((row) => row.id));
    if (!result.data.length || ids.length >= result.count) break;
  }
  return ids;
}
