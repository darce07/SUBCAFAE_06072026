begin;

-- Chat interno de soporte: solo el admin puede abrir conversacion con un
-- usuario. Es efimero por diseno - mientras esta abierta vive en
-- chat_conversaciones/chat_mensajes (necesario para tiempo real y para
-- reconstruir el hilo), pero al cerrarse (boton, logout manual o
-- inactividad) se resume en un ticket permanente (soporte_tickets) con
-- transcripcion + capturas, y las filas crudas del chat se borran. El chat
-- en si nunca queda como historial navegable; el ticket si.

create table public.chat_conversaciones (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id),
  usuario_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (admin_id <> usuario_id)
);

create unique index chat_conversaciones_una_activa_por_usuario
  on public.chat_conversaciones (usuario_id);

create table public.chat_mensajes (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references public.chat_conversaciones(id) on delete cascade,
  autor_id uuid not null references auth.users(id),
  contenido text,
  archivo_path text,
  archivo_mime text,
  created_at timestamptz not null default now(),
  check (coalesce(trim(contenido), '') <> '' or archivo_path is not null)
);

create index chat_mensajes_conversacion_idx on public.chat_mensajes (conversacion_id, created_at);

create table public.soporte_tickets (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id),
  admin_id uuid not null references auth.users(id),
  transcripcion jsonb not null,
  estado text not null default 'abierto' check (estado in ('abierto', 'resuelto')),
  created_at timestamptz not null default now()
);

alter table public.chat_conversaciones enable row level security;
alter table public.chat_mensajes enable row level security;
alter table public.soporte_tickets enable row level security;

revoke all on public.chat_conversaciones from public, anon;
revoke all on public.chat_mensajes from public, anon;
revoke all on public.soporte_tickets from public, anon;
grant select, insert on public.chat_conversaciones to authenticated;
grant select, insert on public.chat_mensajes to authenticated;
grant select on public.soporte_tickets to authenticated;

create policy chat_conversaciones_select on public.chat_conversaciones
  for select to authenticated
  using (admin_id = auth.uid() or usuario_id = auth.uid());

create policy chat_conversaciones_insert on public.chat_conversaciones
  for insert to authenticated
  with check (public.is_admin() and admin_id = auth.uid());

create policy chat_mensajes_select on public.chat_mensajes
  for select to authenticated
  using (
    exists (
      select 1 from public.chat_conversaciones c
      where c.id = conversacion_id
        and (c.admin_id = auth.uid() or c.usuario_id = auth.uid())
    )
  );

create policy chat_mensajes_insert on public.chat_mensajes
  for insert to authenticated
  with check (
    autor_id = auth.uid()
    and exists (
      select 1 from public.chat_conversaciones c
      where c.id = conversacion_id
        and (c.admin_id = auth.uid() or c.usuario_id = auth.uid())
    )
  );

-- Los tickets son solo para revision administrativa (el usuario ya vio el
-- contenido en vivo durante el chat; el ticket es la memoria del admin).
create policy soporte_tickets_select on public.soporte_tickets
  for select to authenticated
  using (public.is_admin());

-- abrir_chat_soporte: solo admin. Si ya hay una conversacion activa con ese
-- usuario, la reutiliza (el indice unico usuario_id impide duplicados).
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

-- cerrar_chat_soporte: cualquiera de los 2 participantes puede cerrar
-- (boton, logout manual, o el hook de inactividad). Arma la transcripcion,
-- la guarda en soporte_tickets, y borra la conversacion (cascada borra los
-- mensajes). Idempotente: si la conversacion ya no existe, no falla.
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
    and (admin_id = auth.uid() or usuario_id = auth.uid());

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

revoke all on function public.abrir_chat_soporte(uuid) from public, anon;
grant execute on function public.abrir_chat_soporte(uuid) to authenticated;
revoke all on function public.cerrar_chat_soporte(uuid) from public, anon;
grant execute on function public.cerrar_chat_soporte(uuid) to authenticated;

-- Bucket para capturas/imagenes del chat. Se mantiene mientras el chat esta
-- abierto; el path referenciado en la transcripcion del ticket sigue
-- siendo legible despues solo para admins (ver policy select abajo).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-temporal',
  'chat-temporal',
  false,
  8388608, -- 8 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Convencion de ruta: {conversacion_id}/{autor_id}/{archivo}
create policy chat_temporal_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-temporal'
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (
      select 1 from public.chat_conversaciones c
      where c.id::text = (storage.foldername(name))[1]
        and (c.admin_id = auth.uid() or c.usuario_id = auth.uid())
    )
  );

create policy chat_temporal_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-temporal'
    and (
      public.is_admin()
      or exists (
        select 1 from public.chat_conversaciones c
        where c.id::text = (storage.foldername(name))[1]
          and (c.admin_id = auth.uid() or c.usuario_id = auth.uid())
      )
    )
  );

-- Habilita Realtime (postgres_changes) sobre los mensajes para que ambos
-- participantes vean llegar mensajes/capturas sin recargar.
alter publication supabase_realtime add table public.chat_mensajes;

commit;
