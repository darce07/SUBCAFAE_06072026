import { supabase } from "../lib/supabase";
import { getSupabaseErrorMessage } from "../lib/supabase-error";
import type { AdminUser, AuditFilters, AuditRecord, CatalogItem, PaginatedResult, RolePermissionRow } from "../types";

export async function getAdminUsers(): Promise<AdminUser[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("listar_usuarios_administracion");
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudieron cargar los usuarios."));
  return (data ?? []) as AdminUser[];
}

export async function getRoles(): Promise<CatalogItem[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("roles").select("id,nombre,descripcion,activo").eq("activo", true).order("nombre");
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudieron cargar los roles."));
  return (data ?? []) as CatalogItem[];
}

export async function assignUserRole(userId: string, roleId: string, active = true) {
  if (!supabase) return;
  const { error } = await supabase.rpc("asignar_rol_usuario", {
    p_user_id: userId,
    p_role_id: roleId,
    p_activo: active,
  });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo asignar el rol."));
}

export async function getAuditRecords(filters: AuditFilters = {}): Promise<PaginatedResult<AuditRecord>> {
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.min(Math.max(filters.pageSize ?? 10, 1), 100);
  if (!supabase) return { data: [], count: 0, page, pageSize };
  const { data, error } = await supabase.rpc("obtener_auditoria_paginada", {
    p_busqueda: filters.search?.trim() || null,
    p_accion: filters.action ?? null,
    p_fecha_desde: filters.dateFrom || null,
    p_fecha_hasta: filters.dateTo || null,
    p_pagina: page,
    p_tamano_pagina: pageSize,
  });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo consultar la auditoría."));
  const result = data as { data?: AuditRecord[]; count?: number; page?: number; pageSize?: number } | null;
  return {
    data: result?.data ?? [],
    count: Number(result?.count ?? 0),
    page: Number(result?.page ?? page),
    pageSize: Number(result?.pageSize ?? pageSize),
  };
}

export async function getRolePermissions(): Promise<RolePermissionRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("listar_roles_permisos");
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo cargar la matriz de permisos."));
  return (data ?? []) as RolePermissionRow[];
}

export async function setRolePermission(roleId: string, permissionId: string, assigned: boolean) {
  if (!supabase) return;
  const { error } = await supabase.rpc("actualizar_permiso_rol", {
    p_role_id: roleId,
    p_permission_id: permissionId,
    p_asignado: assigned,
  });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No se pudo actualizar el permiso."));
}
