begin;

-- getMisConversaciones hacia un select directo a chat_conversaciones no
-- puede traer el nombre del otro participante: profiles_select_self_or_admin
-- solo deja ver el propio perfil o, si sos admin, cualquiera - un usuario
-- normal no puede leer el perfil del admin con quien esta chateando. Este
-- RPC (security definer) resuelve ambos nombres sin depender de esa RLS.
create or replace function public.obtener_mis_conversaciones()
returns table (
  id uuid,
  admin_id uuid,
  usuario_id uuid,
  created_at timestamptz,
  admin_nombre text,
  usuario_nombre text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.admin_id,
    c.usuario_id,
    c.created_at,
    pa.nombre_completo,
    pu.nombre_completo
  from public.chat_conversaciones c
  left join public.profiles pa on pa.id = c.admin_id
  left join public.profiles pu on pu.id = c.usuario_id
  where c.admin_id = auth.uid() or c.usuario_id = auth.uid()
  order by c.created_at desc;
$$;

revoke all on function public.obtener_mis_conversaciones() from public, anon;
grant execute on function public.obtener_mis_conversaciones() to authenticated;

commit;
