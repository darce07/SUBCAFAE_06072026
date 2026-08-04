begin;

-- El chat es efimero (chat_conversaciones) y el ticket es su archivo
-- historico (soporte_tickets): marcar un ticket "resuelto" no tocaba el
-- chat en vivo, asi que si el mismo usuario habia vuelto a abrir un chat
-- (o quedo huerfano de una prueba), la burbuja flotante seguia mostrandolo
-- aunque el ticket ya dijera resuelto - confuso para el admin. Ahora, al
-- marcar resuelto, tambien se borra cualquier chat en vivo abierto con ese
-- mismo usuario (sin generar un ticket nuevo por esa fila residual: no hay
-- conversacion real que archivar, es limpieza).
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

  if p_estado = 'resuelto' then
    delete from public.chat_conversaciones where usuario_id = v_ticket.usuario_id;
  end if;

  return v_ticket;
end;
$$;

commit;
