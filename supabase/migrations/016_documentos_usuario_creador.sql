-- Permite listar nombre/email de los usuarios que registraron documentos,
-- sin exponer la tabla profiles completa (RLS de profiles solo deja ver el propio perfil o admin).
create or replace function public.obtener_perfiles_basico(p_ids uuid[])
returns table (
  id uuid,
  nombre_completo text,
  email text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.nombre_completo, p.email
  from public.profiles p
  where p.id = any(p_ids)
    and public.has_permission('documentos', 'ver');
$$;

revoke all on function public.obtener_perfiles_basico(uuid[]) from public, anon;
grant execute on function public.obtener_perfiles_basico(uuid[]) to authenticated;
