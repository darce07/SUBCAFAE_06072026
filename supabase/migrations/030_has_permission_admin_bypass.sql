begin;

-- Clase de bug recurrente: cada permiso nuevo (ver 022_backup_permiso_administrador_repair.sql)
-- se creaba sin asignarlo al rol Administrador, porque el cross-join que le
-- da "todos los permisos" en 001_sigdaf_complete.sql solo corrió una vez,
-- contra los permisos que existían en ese momento. has_permission() no
-- tenía bypass de admin, solo consultaba role_permissions — así que un
-- Administrador podía quedar sin acceso a una función nueva hasta que
-- alguien lo notara y reparara la fila a mano.
--
-- Esta migración mueve el bypass a la función misma: is_admin() ya existe
-- y es la fuente de verdad de "es administrador"; has_permission() ahora la
-- consulta primero. Un permiso nuevo nunca vuelve a requerir un repair
-- posterior para el rol Administrador.

create or replace function public.has_permission(p_modulo text, p_accion text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_authenticated_user() and (
    public.is_admin()
    or exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      join public.role_permissions rp on rp.role_id = ur.role_id
      join public.permissions p on p.id = rp.permission_id
      where ur.user_id = auth.uid()
        and ur.activo
        and r.activo
        and p.modulo = p_modulo
        and p.accion = p_accion
    )
  );
$$;

commit;
