import { supabase } from "../lib/supabase";
import { getSupabaseErrorMessage } from "../lib/supabase-error";
import type { AppNotification, HistoricalRecord } from "../types";

export async function getHistoricalRecords(search = "", limit = 500): Promise<HistoricalRecord[]> {
  if (!supabase) return [];
  let query = supabase
    .from("estructura_historica")
    .select("*")
    .order("fecha_importacion", { ascending: false })
    .limit(limit);
  if (search.trim()) {
    const term = search.replaceAll(",", " ");
    query = query.or(`nombre_archivo.ilike.%${term}%,ruta_original.ilike.%${term}%,nivel_1.ilike.%${term}%`);
  }
  const { data, error } = await query;
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo cargar la estructura histórica."));
  return (data ?? []) as HistoricalRecord[];
}

export async function getNotifications(): Promise<AppNotification[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("notificaciones")
    .select("id,titulo,descripcion,tipo,leida_at,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudieron cargar las notificaciones."));
  return (data ?? []) as AppNotification[];
}

export async function markAllNotificationsRead() {
  if (!supabase) return;
  const { error } = await supabase
    .from("notificaciones")
    .update({ leida_at: new Date().toISOString() })
    .is("leida_at", null);
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudieron actualizar las notificaciones."));
}
