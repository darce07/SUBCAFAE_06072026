begin;

-- Los tickets de soporte (035_chat_soporte.sql) ya eran consultables via RLS
-- (soporte_tickets_select, solo is_admin()), pero no habia forma de listarlos
-- con el nombre/email del usuario y del admin sin exponer toda public.profiles.
-- Este RPC arma esa vista de solo lectura para el nuevo apartado de tickets.
create or replace function public.listar_tickets_soporte()
returns table (
  id uuid,
  usuario_id uuid,
  usuario_nombre text,
  usuario_email text,
  admin_id uuid,
  admin_nombre text,
  admin_email text,
  transcripcion jsonb,
  estado text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.id,
    t.usuario_id,
    pu.nombre_completo,
    pu.email,
    t.admin_id,
    pa.nombre_completo,
    pa.email,
    t.transcripcion,
    t.estado,
    t.created_at
  from public.soporte_tickets t
  left join public.profiles pu on pu.id = t.usuario_id
  left join public.profiles pa on pa.id = t.admin_id
  where public.is_admin()
  order by t.created_at desc;
$$;

revoke all on function public.listar_tickets_soporte() from public, anon;
grant execute on function public.listar_tickets_soporte() to authenticated;

commit;
