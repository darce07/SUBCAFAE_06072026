begin;

-- Los tickets se creaban siempre en estado 'abierto' (cerrar_chat_soporte,
-- 035_chat_soporte.sql) y no habia forma de marcarlos 'resuelto' despues.
create or replace function public.actualizar_estado_ticket_soporte(
  p_ticket_id uuid,
  p_estado text
)
returns public.soporte_tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket public.soporte_tickets;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Solo un administrador puede actualizar tickets de soporte';
  end if;

  if p_estado not in ('abierto', 'resuelto') then
    raise exception using errcode = '22023', message = 'Estado de ticket invalido';
  end if;

  update public.soporte_tickets
  set estado = p_estado
  where id = p_ticket_id
  returning * into v_ticket;

  if not found then
    raise exception using errcode = '23503', message = 'El ticket no existe';
  end if;

  return v_ticket;
end;
$$;

revoke all on function public.actualizar_estado_ticket_soporte(uuid, text) from public, anon;
grant execute on function public.actualizar_estado_ticket_soporte(uuid, text) to authenticated;

commit;
