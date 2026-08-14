import { supabase } from "../lib/supabase";
import { getSupabaseErrorMessage } from "../lib/supabase-error";
import { validateFileSignature } from "./storage.service";
import type { EstadoInventarioItem, InventarioArea, InventarioFoto, InventarioItem, InventarioItemPublico } from "../types";

const BUCKET = "inventario-fotos";
export const MAX_INVENTARIO_FOTO_SIZE = 8 * 1024 * 1024;
export const ALLOWED_INVENTARIO_FOTO_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const ITEM_COLUMNS = "id,codigo_barras,qr_token,nombre,descripcion,color,cantidad,estado,area_id,activo,created_by,created_at,updated_at";

// --- Áreas ---------------------------------------------------------------

export async function getInventarioAreas(): Promise<InventarioArea[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("inventario_areas")
    .select("id,nombre,activo,created_at,updated_at")
    .order("nombre", { ascending: true });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudieron cargar las áreas."));
  return (data ?? []) as InventarioArea[];
}

export async function createInventarioArea(nombre: string): Promise<InventarioArea> {
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { data, error } = await supabase
    .from("inventario_areas")
    .insert({ nombre: nombre.trim() })
    .select("id,nombre,activo,created_at,updated_at")
    .single();
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo crear el área."));
  return data as InventarioArea;
}

export async function setInventarioAreaActive(id: string, activo: boolean): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("inventario_areas").update({ activo }).eq("id", id);
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo actualizar el área."));
}

// --- Ítems -----------------------------------------------------------------

export async function getInventarioItems(): Promise<InventarioItem[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("inventario_items")
    .select(`${ITEM_COLUMNS},area:inventario_areas(id,nombre,activo),fotos:inventario_fotos(id,item_id,storage_path,created_at)`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudieron cargar los ítems de inventario."));
  return (data ?? []) as unknown as InventarioItem[];
}

export async function getInventarioItem(id: string): Promise<InventarioItem | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("inventario_items")
    .select(`${ITEM_COLUMNS},area:inventario_areas(id,nombre,activo),fotos:inventario_fotos(id,item_id,storage_path,created_at)`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo cargar el ítem de inventario."));
  return data as unknown as InventarioItem | null;
}

export interface InventarioItemInput {
  nombre: string;
  descripcion: string | null;
  color: string | null;
  cantidad: number;
  estado: EstadoInventarioItem;
  areaId: string | null;
}

export async function createInventarioItem(input: InventarioItemInput): Promise<InventarioItem> {
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { data, error } = await supabase.rpc("crear_item_inventario", {
    p_nombre: input.nombre.trim(),
    p_descripcion: input.descripcion,
    p_color: input.color,
    p_cantidad: input.cantidad,
    p_estado: input.estado,
    p_area_id: input.areaId,
  });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo crear el ítem de inventario."));
  return data as InventarioItem;
}

export async function updateInventarioItem(id: string, input: InventarioItemInput & { activo: boolean }): Promise<InventarioItem> {
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { data, error } = await supabase.rpc("actualizar_item_inventario", {
    p_item_id: id,
    p_nombre: input.nombre.trim(),
    p_descripcion: input.descripcion,
    p_color: input.color,
    p_cantidad: input.cantidad,
    p_estado: input.estado,
    p_area_id: input.areaId,
    p_activo: input.activo,
  });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo actualizar el ítem de inventario."));
  return data as InventarioItem;
}

export async function buscarInventarioItemPorCodigoBarras(codigo: string): Promise<InventarioItem | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("buscar_item_por_codigo_barras", { p_codigo_barras: codigo.trim() });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo buscar el ítem por código de barras."));
  return (data as InventarioItem | null) ?? null;
}

export async function getInventarioItemPublico(qrToken: string): Promise<InventarioItemPublico | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("obtener_item_inventario_publico", { p_qr_token: qrToken });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo cargar el ítem."));
  const row = Array.isArray(data) ? data[0] : data;
  return (row as InventarioItemPublico | undefined) ?? null;
}

// --- Fotos -------------------------------------------------------------

function validateInventarioFoto(file: File) {
  if (file.size > MAX_INVENTARIO_FOTO_SIZE) {
    throw new Error("La foto supera el tamaño máximo permitido de 8 MB.");
  }
  if (file.type && !ALLOWED_INVENTARIO_FOTO_MIME_TYPES.has(file.type)) {
    throw new Error("Solo se permiten fotos en formato JPEG, PNG o WEBP.");
  }
}

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-|-$/g, "");

export async function uploadInventarioFoto(itemId: string, file: File): Promise<InventarioFoto> {
  if (!supabase) throw new Error("Supabase no está configurado.");
  validateInventarioFoto(file);
  await validateFileSignature(file);

  const path = `${itemId}/${Date.now()}-${slugify(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type || "application/octet-stream" });
  if (uploadError) throw new Error(getSupabaseErrorMessage(uploadError, "No se pudo subir la foto."));

  const { data, error } = await supabase
    .from("inventario_fotos")
    .insert({ item_id: itemId, storage_path: path })
    .select("id,item_id,storage_path,created_at")
    .single();
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo registrar la foto."));
  return data as InventarioFoto;
}

export async function removeInventarioFoto(foto: InventarioFoto): Promise<void> {
  if (!supabase) return;
  const { error: deleteRowError } = await supabase.from("inventario_fotos").delete().eq("id", foto.id);
  if (deleteRowError) throw new Error(getSupabaseErrorMessage(deleteRowError, "No se pudo eliminar la foto."));
  await supabase.storage.from(BUCKET).remove([foto.storage_path]);
}

export function getInventarioFotoPublicUrl(path: string): string {
  if (!supabase) return "";
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
