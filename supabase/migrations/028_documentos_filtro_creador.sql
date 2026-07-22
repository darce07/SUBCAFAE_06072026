begin;

-- Filtro "Subido por" en Documentos: lista de usuarios que han creado al
-- menos un documento activo, para poblar el selector sin exponer toda la
-- tabla profiles. Gate por has_permission('documentos','ver') (no solo
-- admin) para que cualquiera con acceso a Documentos pueda filtrar,
-- siguiendo el mismo patron que obtener_perfiles_basico.

create or replace function public.obtener_usuarios_creadores_documentos()
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
  select distinct p.id, p.nombre_completo, p.email
  from public.documentos d
  join public.profiles p on p.id = d.created_by
  where public.has_permission('documentos', 'ver')
    and d.activo
  order by p.nombre_completo nulls last, p.email;
$$;

revoke all on function public.obtener_usuarios_creadores_documentos() from public, anon;
grant execute on function public.obtener_usuarios_creadores_documentos() to authenticated;

commit;
