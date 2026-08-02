begin;

-- Permite que cualquier usuario activo inicie su propio chat de soporte con
-- el administrador (antes solo el admin podia abrir chat). Ademas agrega el
-- bloqueo de cuenta: un admin puede desactivar el acceso (login, RLS y chat)
-- de un usuario que incumpla normas de convivencia, reutilizando el flag
-- profiles.activo que ya gatilla public.is_authenticated_user().

-- abrir_chat_soporte: agrega verificacion de que el usuario destino no este
-- bloqueado (antes solo validaba que no fuera el propio admin).
create or replace function public.abrir_chat_soporte(p_usuario_id uuid)
returns public.chat_conversaciones
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversacion public.chat_conversaciones;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Solo un administrador puede abrir un chat de soporte';
  end if;

  if p_usuario_id is null or p_usuario_id = auth.uid() then
    raise exception using errcode = '22023', message = 'Usuario de destino invalido';
  end if;

  if not exists (select 1 from public.profiles where id = p_usuario_id and activo) then
    raise exception using errcode = '22023', message = 'La cuenta de este usuario esta bloqueada';
  end if;

  select * into v_conversacion
  from public.chat_conversaciones
  where usuario_id = p_usuario_id;

  if found then
    return v_conversacion;
  end if;

  insert into public.chat_conversaciones (admin_id, usuario_id)
  values (auth.uid(), p_usuario_id)
  returning * into v_conversacion;

  return v_conversacion;
end;
$$;

-- abrir_chat_propio: version para que el propio usuario (no admin) inicie
-- el chat. Busca un administrador activo y reutiliza/crea la conversacion.
create or replace function public.abrir_chat_propio()
returns public.chat_conversaciones
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid;
  v_conversacion public.chat_conversaciones;
begin
  if not public.is_authenticated_user() then
    raise exception using errcode = '42501', message = 'Tu cuenta no tiene acceso al chat de soporte';
  end if;

  if public.is_admin() then
    raise exception using errcode = '22023', message = 'El administrador abre el chat desde la lista de usuarios';
  end if;

  select ur.user_id into v_admin_id
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  join public.profiles p on p.id = ur.user_id
  where ur.activo and r.activo and r.nombre = 'Administrador' and p.activo
  order by ur.created_at
  limit 1;

  if v_admin_id is null then
    raise exception using errcode = '22023', message = 'No hay un administrador disponible para el chat en este momento';
  end if;

  select * into v_conversacion
  from public.chat_conversaciones
  where usuario_id = auth.uid();

  if found then
    return v_conversacion;
  end if;

  insert into public.chat_conversaciones (admin_id, usuario_id)
  values (v_admin_id, auth.uid())
  returning * into v_conversacion;

  return v_conversacion;
end;
$$;

-- cerrar_chat_soporte: ahora tambien permite que cualquier admin cierre una
-- conversacion ajena (necesario para el bloqueo de cuenta, que debe poder
-- cerrar el chat de un usuario aunque lo haya abierto con otro admin).
create or replace function public.cerrar_chat_soporte(p_conversacion_id uuid)
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
    and (admin_id = auth.uid() or usuario_id = auth.uid() or public.is_admin());

  if not found then
    return null;
  end if;

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

  insert into public.soporte_tickets (usuario_id, admin_id, transcripcion)
  values (v_conversacion.usuario_id, v_conversacion.admin_id, v_transcripcion)
  returning * into v_ticket;

  delete from public.chat_conversaciones where id = p_conversacion_id;

  return v_ticket;
end;
$$;

-- bloquear_usuario: activa/desactiva el acceso de una cuenta (login, RLS y
-- chat quedan bloqueados via is_authenticated_user()). Al bloquear, cierra
-- de una vez cualquier chat abierto del usuario (genera su ticket).
create or replace function public.bloquear_usuario(p_user_id uuid, p_bloqueado boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversacion_id uuid;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Solo un administrador puede bloquear cuentas';
  end if;

  if p_user_id = auth.uid() then
    raise exception using errcode = '22023', message = 'No puedes bloquear tu propia cuenta';
  end if;

  update public.profiles
  set activo = not p_bloqueado, updated_at = now()
  where id = p_user_id;

  if not found then
    raise exception using errcode = '23503', message = 'El usuario no existe';
  end if;

  if p_bloqueado then
    for v_conversacion_id in
      select id from public.chat_conversaciones where usuario_id = p_user_id
    loop
      perform public.cerrar_chat_soporte(v_conversacion_id);
    end loop;
  end if;
end;
$$;

revoke all on function public.abrir_chat_propio() from public, anon;
grant execute on function public.abrir_chat_propio() to authenticated;
revoke all on function public.bloquear_usuario(uuid, boolean) from public, anon;
grant execute on function public.bloquear_usuario(uuid, boolean) to authenticated;

commit;
