import { useCallback, useEffect, useState } from "react";
import {
  createCatalogItem,
  deleteCatalogItem,
  getArchivadores,
  getCategorias,
  getEntidades,
  getEstadosDocumento,
  getTiposCategoria,
  getTiposEntidad,
  getTiposMovimiento,
  getTiposOperacion,
  getTiposAnexo,
  getPersonalNatural,
  setCatalogItemActive,
  updateCatalogItem,
  isSupabaseConfigured,
} from "../services/catalogos.service";
import { mockCatalogos } from "../mocks/supabase-data";
import type { CatalogItem, CatalogosData, CatalogTable } from "../types";

const emptyCatalogos: CatalogosData = {
  categorias: [],
  tiposEntidad: [],
  entidades: [],
  tiposCategoria: [],
  estadosDocumento: [],
  archivadores: [],
  tiposMovimiento: [],
  tiposOperacion: [],
  tiposAnexo: [],
  personalNatural: [],
};

export function useCatalogos(options: { includeEntidades?: boolean } = {}) {
  const includeEntidades = options.includeEntidades ?? true;
  const [data, setData] = useState<CatalogosData>(isSupabaseConfigured ? emptyCatalogos : mockCatalogos);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [categorias, tiposEntidad, entidades, tiposCategoria, estadosDocumento, archivadores, tiposMovimiento, tiposOperacion, tiposAnexo, personalNatural] =
        await Promise.all([
          getCategorias(), getTiposEntidad(), includeEntidades ? getEntidades() : Promise.resolve([]), getTiposCategoria(),
          getEstadosDocumento(), getArchivadores(), getTiposMovimiento(), getTiposOperacion(), getTiposAnexo(), getPersonalNatural(),
        ]);
      setData({ categorias, tiposEntidad, entidades, tiposCategoria, estadosDocumento, archivadores, tiposMovimiento, tiposOperacion, tiposAnexo, personalNatural });
      setUsingFallback(!isSupabaseConfigured);
    } catch (loadError) {
      setData(isSupabaseConfigured ? emptyCatalogos : mockCatalogos);
      setUsingFallback(!isSupabaseConfigured);
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los catálogos.");
    } finally {
      setLoading(false);
    }
  }, [includeEntidades]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const keyForTable: Record<CatalogTable, keyof CatalogosData> = {
    catalogo_categorias: "categorias",
    catalogo_tipo_entidad: "tiposEntidad",
    entidades: "entidades",
    catalogo_tipo_categoria: "tiposCategoria",
    catalogo_estado_documento: "estadosDocumento",
    catalogo_archivadores: "archivadores",
    catalogo_tipo_movimiento: "tiposMovimiento",
    catalogo_tipo_operacion: "tiposOperacion",
    catalogo_tipo_anexo: "tiposAnexo",
    personal_natural: "personalNatural",
  };

  const create = async (table: CatalogTable, values: Pick<CatalogItem, "nombre" | "descripcion"> & { tipo_entidad_id?: string | null; dni?: string | null; ruc?: string | null; fecha_nacimiento?: string | null; cargo?: string | null }) => {
    if (!isSupabaseConfigured) {
      const key = keyForTable[table];
      const created = {
        id: crypto.randomUUID(),
        nombre: values.nombre,
        descripcion: values.descripcion,
        activo: true,
        ...("tipo_entidad_id" in values ? { tipo_entidad_id: values.tipo_entidad_id ?? null } : {}),
        ...(table === "personal_natural" ? { dni: values.dni ?? null, ruc: values.ruc ?? null, fecha_nacimiento: values.fecha_nacimiento ?? null, cargo: values.cargo ?? null } : {}),
      };
      setData((current) => ({ ...current, [key]: [...current[key], created] }));
      return;
    }
    await createCatalogItem(table, values);
    await refresh();
  };

  const update = async (table: CatalogTable, id: string, values: Partial<Pick<CatalogItem, "nombre" | "descripcion">> & { tipo_entidad_id?: string | null; dni?: string | null; ruc?: string | null; fecha_nacimiento?: string | null; cargo?: string | null }) => {
    if (!isSupabaseConfigured) {
      const key = keyForTable[table];
      setData((current) => ({
        ...current,
        [key]: current[key].map((item) => item.id === id ? { ...item, ...values } : item),
      }));
      return;
    }
    await updateCatalogItem(table, id, values);
    await refresh();
  };

  const toggleActive = async (table: CatalogTable, item: CatalogItem) => {
    if (!isSupabaseConfigured) {
      const key = keyForTable[table];
      setData((current) => ({
        ...current,
        [key]: current[key].map((currentItem) => currentItem.id === item.id ? { ...currentItem, activo: !currentItem.activo } : currentItem),
      }));
      return;
    }
    await setCatalogItemActive(table, item.id, !item.activo);
    await refresh();
  };

  const remove = async (table: CatalogTable, item: CatalogItem) => {
    const key = keyForTable[table];
    if (!isSupabaseConfigured) {
      setData((current) => ({
        ...current,
        [key]: current[key].filter((currentItem) => currentItem.id !== item.id),
      }));
      return;
    }
    await deleteCatalogItem(table, item.id);
    await refresh();
  };

  return { ...data, loading, error, usingFallback, refresh, create, update, toggleActive, remove };
}
