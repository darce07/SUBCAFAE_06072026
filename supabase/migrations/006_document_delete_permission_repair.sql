begin;

insert into public.permissions(modulo, accion)
values ('documentos', 'eliminar')
on conflict (modulo, accion) do nothing;

insert into public.role_permissions(role_id, permission_id)
select legacy.role_id, delete_permission.id
from public.role_permissions legacy
join public.permissions legacy_permission
  on legacy_permission.id = legacy.permission_id
 and legacy_permission.modulo = 'documentos'
 and legacy_permission.accion = 'desactivar'
cross join public.permissions delete_permission
where delete_permission.modulo = 'documentos'
  and delete_permission.accion = 'eliminar'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions(role_id, permission_id)
select administrator.id, delete_permission.id
from public.roles administrator
cross join public.permissions delete_permission
where administrator.nombre = 'Administrador'
  and administrator.activo
  and delete_permission.modulo = 'documentos'
  and delete_permission.accion = 'eliminar'
on conflict (role_id, permission_id) do nothing;

commit;

select
  r.nombre as rol,
  p.modulo,
  p.accion
from public.roles r
join public.role_permissions rp on rp.role_id = r.id
join public.permissions p on p.id = rp.permission_id
where r.nombre = 'Administrador'
  and p.modulo = 'documentos'
  and p.accion = 'eliminar';
