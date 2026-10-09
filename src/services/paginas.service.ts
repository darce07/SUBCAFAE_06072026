import { supabase } from "../lib/supabase";
import { getSupabaseErrorMessage } from "../lib/supabase-error";
import { contarPaginas } from "../lib/paginas-archivo";
import { getSignedUrl } from "./storage.service";

export async function registrarPaginas(documentoId: string, paginas: number): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc("registrar_paginas_documento", { p_documento_id: documentoId, p_paginas: paginas });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo guardar la cantidad de páginas."));
}

// Cuenta las páginas de un archivo recién elegido y las guarda. No debe impedir guardar el
// documento: cualquier fallo se ignora y la columna queda en "—" hasta recalcularla.
export async function registrarPaginasDeArchivo(documentoId: string, file: File): Promise<void> {
  try {
    const extension = file.name.includes(".") ? file.name.split(".").pop() : null;
    const paginas = await contarPaginas(await file.arrayBuffer(), { mime: file.type, extension });
    if (paginas) await registrarPaginas(documentoId, paginas);
  } catch {
    // Se puede recalcular después desde Archivo físico.
  }
}

// Para documentos ya subidos: baja el archivo del almacenamiento, cuenta y guarda.
// Devuelve las páginas, o null si el formato no se puede contar.
export async function calcularPaginasDeDocumento(documentoId: string, archivoPath: string, extension: string | null): Promise<number | null> {
  const url = await getSignedUrl(archivoPath, 120);
  if (!url) return null;
  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error("No se pudo descargar el archivo.");
  const paginas = await contarPaginas(await respuesta.arrayBuffer(), { mime: respuesta.headers.get("content-type"), extension });
  if (paginas) await registrarPaginas(documentoId, paginas);
  return paginas;
}
