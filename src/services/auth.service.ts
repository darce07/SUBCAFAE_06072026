import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { getSupabaseErrorMessage } from "../lib/supabase-error";
import type { UserContext } from "../types";

export async function getCurrentSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo recuperar la sesión."));
  return data.session;
}

export async function signInWithPassword(email: string, password: string) {
  if (!supabase) throw new Error("La conexión institucional no está configurada.");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(getSupabaseErrorMessage(error, "Credenciales incorrectas."));
  if (data.user?.is_anonymous) {
    await supabase.auth.signOut();
    throw new Error("Los usuarios anónimos no tienen acceso a SIGDAF.");
  }
  return data.session;
}

export async function signOutSession() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo cerrar la sesión."));
}

export async function getMyUserContext(): Promise<UserContext | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("obtener_mi_contexto");
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo cargar tu perfil y permisos."));
  return data as UserContext | null;
}
