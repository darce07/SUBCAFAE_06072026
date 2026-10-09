import { supabase } from "../lib/supabase";
import { getSupabaseErrorMessage } from "../lib/supabase-error";
import type { BalanceSindicato, BalanceSindicatos, DashboardFilters } from "../types";

// Los sindicatos no tienen tabla propia: son las entidades de tipo "Sindicato"
// y su balance sale de los documentos que las tienen como Entidad.
export async function getBalanceSindicatos(filters: DashboardFilters = {}): Promise<BalanceSindicatos> {
  if (!supabase) return { sindicatos: [], aniosDisponibles: [] };
  const { data, error } = await supabase.rpc("obtener_balance_sindicatos", {
    p_anio: filters.anio ?? null,
    p_mes: filters.mes ?? null,
  });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo cargar el balance de sindicatos."));
  return data as BalanceSindicatos;
}

export async function getBalanceSindicato(entidadId: string, anio?: number): Promise<BalanceSindicato> {
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { data, error } = await supabase.rpc("obtener_balance_sindicato", {
    p_entidad_id: entidadId,
    p_anio: anio ?? null,
  });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo cargar el balance del sindicato."));
  return data as BalanceSindicato;
}
