begin;

-- La migración 021 creó el permiso 'sistema:respaldar' pero no lo asignó al
-- rol Administrador. El cross join que le da todos los permisos al
-- Administrador (001_sigdaf_complete.sql) solo corrió una vez, contra los
-- permisos que existían en ese momento: cualquier permiso nuevo creado
-- después (como este) queda sin asignar y has_permission() responde false
-- aunque el usuario sea Administrador, porque esa función no tiene bypass
-- de admin, solo consulta role_permissions.

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.nombre = 'Administrador'
  and p.modulo = 'sistema'
  and p.accion = 'respaldar'
on conflict (role_id, permission_id) do nothing;

commit;
