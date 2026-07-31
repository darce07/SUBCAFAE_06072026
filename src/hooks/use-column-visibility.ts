import { useEffect, useState } from "react";

export function useColumnVisibility(storageKey: string, defaultVisibility: Record<string, boolean> = {}) {
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? { ...defaultVisibility, ...JSON.parse(stored) } : defaultVisibility;
    } catch {
      return defaultVisibility;
    }
  });
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(visibility));
  }, [storageKey, visibility]);
  const isVisible = (columnId: string) => visibility[columnId] !== false;
  const toggle = (columnId: string) => setVisibility((current) => ({ ...current, [columnId]: !isVisible(columnId) }));
  return { isVisible, toggle };
}
