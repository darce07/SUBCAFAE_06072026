import type { CatalogItem } from "../types";

// El anexo se clasifica con la lista de Categorías del documento principal. En la base cada
// categoría se refleja como un tipo de anexo con el mismo nombre (migración 060), así que
// aquí se ofrecen solo los tipos que coinciden con una categoría activa. Un anexo antiguo
// con un tipo que no es categoría (Sustento, Evidencia...) conserva su valor al editarlo.
export function categoriasParaAnexo(tiposAnexo: CatalogItem[], categorias: CatalogItem[], actualId?: string | null): CatalogItem[] {
  const nombres = new Set(categorias.filter((categoria) => categoria.activo).map((categoria) => categoria.nombre.trim().toLocaleLowerCase("es")));
  const opciones = tiposAnexo
    .filter((tipo) => tipo.activo && nombres.has(tipo.nombre.trim().toLocaleLowerCase("es")))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  if (actualId && !opciones.some((opcion) => opcion.id === actualId)) {
    const actual = tiposAnexo.find((tipo) => tipo.id === actualId);
    if (actual) return [...opciones, { ...actual, nombre: `${actual.nombre} (tipo anterior)` }];
  }
  return opciones;
}
