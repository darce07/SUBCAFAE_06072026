begin;

alter table public.soporte_tickets
  add column if not exists titulo text,
  add column if not exists categoria text not null default 'sin_categorizar'
    check (categoria in ('bug', 'consulta', 'solicitud', 'otro', 'sin_categorizar')),
  add column if not exists prioridad text not null default 'media'
    check (prioridad in ('baja', 'media', 'alta'));

alter table public.soporte_tickets drop constraint if exists soporte_tickets_estado_check;
alter table public.soporte_tickets
  add constraint soporte_tickets_estado_check
  check (estado in ('abierto', 'en_progreso', 'resuelto', 'cerrado'));

-- Solo admin puede actualizar el estado/categoria/prioridad/titulo de un ticket.
create policy soporte_tickets_update on public.soporte_tickets
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Se dropea la firma vieja (solo uuid) antes de recrear con mas parametros -
-- mismo motivo que en 034/035: create or replace con distinta lista de
-- parametros deja un overload ambiguo si no se dropea primero.
drop function if exists public.cerrar_chat_soporte(uuid);

-- cerrar_chat_soporte gana control sobre si se crea ticket, y con que datos.
-- p_crear_ticket=false: se borra la conversacion sin dejar ticket (decision
-- del admin en el cierre manual). Cierres automaticos (inactividad/logout)
-- siguen enviando p_crear_ticket=true con valores por defecto como red de
-- seguridad, para no perder informacion nunca sin que un admin la revise.
create or replace function public.cerrar_chat_soporte(
  p_conversacion_id uuid,
  p_crear_ticket boolean default true,
  p_titulo text default null,
  p_categoria text default 'sin_categorizar',
  p_prioridad text default 'media'
)
returns public.soporte_tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversacion public.chat_conversaciones;
  v_transcripcion jsonb;
  v_ticket public.soporte_tickets;
begin
  select * into v_conversacion
  from public.chat_conversaciones
  where id = p_conversacion_id
    and (admin_id = auth.uid() or usuario_id = auth.uid());

  if not found then
    return null;
  end if;

  if p_crear_ticket then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'autor_id', m.autor_id,
        'contenido', m.contenido,
        'archivo_path', m.archivo_path,
        'archivo_mime', m.archivo_mime,
        'created_at', m.created_at
      ) order by m.created_at
    ), '[]'::jsonb) into v_transcripcion
    from public.chat_mensajes m
    where m.conversacion_id = p_conversacion_id;

    insert into public.soporte_tickets (usuario_id, admin_id, titulo, categoria, prioridad, transcripcion)
    values (
      v_conversacion.usuario_id,
      v_conversacion.admin_id,
      nullif(trim(coalesce(p_titulo, '')), ''),
      coalesce(nullif(p_categoria, ''), 'sin_categorizar'),
      coalesce(nullif(p_prioridad, ''), 'media'),
      v_transcripcion
    )
    returning * into v_ticket;
  end if;

  delete from public.chat_conversaciones where id = p_conversacion_id;

  return v_ticket;
end;
$$;

revoke all on function public.cerrar_chat_soporte(uuid, boolean, text, text, text) from public, anon;
grant execute on function public.cerrar_chat_soporte(uuid, boolean, text, text, text) to authenticated;

-- actualizar_soporte_ticket: solo admin, para llevar el estado del ticket
-- (abierto -> en_progreso -> resuelto/cerrado) desde la pantalla de tickets.
create or replace function public.actualizar_soporte_ticket(
  p_ticket_id uuid,
  p_estado text default null,
  p_categoria text default null,
  p_prioridad text default null
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
    raise exception using errcode = '42501', message = 'Solo un administrador puede actualizar tickets';
  end if;

  update public.soporte_tickets
  set estado = coalesce(nullif(p_estado, ''), estado),
      categoria = coalesce(nullif(p_categoria, ''), categoria),
      prioridad = coalesce(nullif(p_prioridad, ''), prioridad)
  where id = p_ticket_id
  returning * into v_ticket;

  if not found then
    raise exception using errcode = 'P0002', message = 'Ticket no encontrado';
  end if;

  return v_ticket;
end;
$$;

revoke all on function public.actualizar_soporte_ticket(uuid, text, text, text) from public, anon;
grant execute on function public.actualizar_soporte_ticket(uuid, text, text, text) to authenticated;

commit;
