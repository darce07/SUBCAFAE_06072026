begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nombre_completo text,
  avatar_url text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notificaciones (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null,
  descripcion text not null,
  tipo text not null check (tipo in ('documental', 'financiero', 'auditoria', 'seguridad')),
  event_key text not null,
  leida_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, event_key)
);

create index if not exists idx_notificaciones_user_unread
on public.notificaciones(user_id, created_at desc)
where leida_at is null;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(id, email, nombre_completo, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    nullif(trim(new.raw_user_meta_data ->> 'avatar_url'), '')
  )
  on conflict (id) do update
  set email = excluded.email,
      nombre_completo = coalesce(public.profiles.nombre_completo, excluded.nombre_completo),
      avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_sigdaf on auth.users;
create trigger on_auth_user_created_sigdaf
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_new_auth_user();

insert into public.profiles(id, email, nombre_completo, avatar_url)
select
  u.id,
  u.email,
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
    split_part(coalesce(u.email, ''), '@', 1)
  ),
  nullif(trim(u.raw_user_meta_data ->> 'avatar_url'), '')
from auth.users u
on conflict (id) do update
set email = excluded.email,
    nombre_completo = coalesce(public.profiles.nombre_completo, excluded.nombre_completo),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    updated_at = now();

create or replace function public.is_authenticated_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.activo
    );
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.notify_documento_observado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado text;
begin
  select nombre into v_estado
  from public.catalogo_estado_documento
  where id = new.estado_id;

  if v_estado = 'Observado'
    and (tg_op = 'INSERT' or new.estado_id is distinct from old.estado_id) then
    insert into public.notificaciones(
      user_id, titulo, descripcion, tipo, event_key
    )
    values (
      new.created_by,
      'Documento observado',
      new.codigo_documento || ' requiere revisión.',
      'documental',
      'documento-observado:' || new.id::text
    )
    on conflict (user_id, event_key) do update
    set descripcion = excluded.descripcion,
        leida_at = null,
        created_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_documento_observado_notification on public.documentos;
create trigger trg_documento_observado_notification
after insert or update of estado_id on public.documentos
for each row execute function public.notify_documento_observado();

alter table public.profiles enable row level security;
alter table public.notificaciones enable row level security;

revoke all on public.profiles from anon;
revoke all on public.profiles from authenticated;
grant select on public.profiles to authenticated;
revoke all on public.notificaciones from anon;
revoke all on public.notificaciones from authenticated;
grant select, update on public.notificaciones to authenticated;

drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin
on public.profiles for select
to authenticated
using (
  id = auth.uid()
  or public.is_admin()
);

drop policy if exists notificaciones_select_own on public.notificaciones;
create policy notificaciones_select_own
on public.notificaciones for select
to authenticated
using (user_id = auth.uid());

drop policy if exists notificaciones_update_own on public.notificaciones;
create policy notificaciones_update_own
on public.notificaciones for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.obtener_mi_contexto()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'email', p.email,
    'nombreCompleto', p.nombre_completo,
    'avatarUrl', p.avatar_url,
    'activo', p.activo,
    'roles', coalesce((
      select jsonb_agg(distinct r.nombre order by r.nombre)
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = p.id
        and ur.activo
        and r.activo
    ), '[]'::jsonb),
    'permisos', coalesce((
      select jsonb_agg(distinct (per.modulo || ':' || per.accion) order by (per.modulo || ':' || per.accion))
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      join public.role_permissions rp on rp.role_id = ur.role_id
      join public.permissions per on per.id = rp.permission_id
      where ur.user_id = p.id
        and ur.activo
        and r.activo
    ), '[]'::jsonb)
  )
  from public.profiles p
  where p.id = auth.uid()
    and public.is_authenticated_user();
$$;

revoke all on function public.obtener_mi_contexto() from public, anon;
grant execute on function public.obtener_mi_contexto() to authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.notify_documento_observado() from public, anon, authenticated;
revoke all on function public.is_authenticated_user() from public, anon;
grant execute on function public.is_authenticated_user() to authenticated;

create or replace function public.listar_usuarios_administracion()
returns table (
  id uuid,
  email text,
  nombre_completo text,
  activo boolean,
  role_id uuid,
  role_nombre text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.email,
    p.nombre_completo,
    p.activo,
    role_data.role_id,
    role_data.role_nombre
  from public.profiles p
  left join lateral (
    select r.id role_id, r.nombre role_nombre
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = p.id
      and ur.activo
      and r.activo
    order by r.nombre
    limit 1
  ) role_data on true
  where public.is_admin()
  order by p.nombre_completo nulls last, p.email;
$$;

create or replace function public.asignar_rol_usuario(
  p_user_id uuid,
  p_role_id uuid,
  p_activo boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Solo un administrador puede asignar roles';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception using errcode = '23503', message = 'El usuario no existe';
  end if;

  if not exists (select 1 from public.roles where id = p_role_id and activo) then
    raise exception using errcode = '23503', message = 'El rol no existe o está inactivo';
  end if;

  update public.user_roles
  set activo = false,
      updated_at = now()
  where user_id = p_user_id;

  insert into public.user_roles(user_id, role_id, activo)
  values (p_user_id, p_role_id, p_activo)
  on conflict (user_id, role_id) do update
  set activo = excluded.activo,
      updated_at = now();
end;
$$;

revoke all on function public.listar_usuarios_administracion() from public, anon;
revoke all on function public.asignar_rol_usuario(uuid, uuid, boolean) from public, anon;
grant execute on function public.listar_usuarios_administracion() to authenticated;
grant execute on function public.asignar_rol_usuario(uuid, uuid, boolean) to authenticated;

do $$
declare
  admin_email text := 'pillaca98@gmail.com';
  v_user_id uuid;
  v_role_id uuid;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = lower(admin_email)
  limit 1;

  if v_user_id is null then
    raise exception 'No existe el usuario % en Supabase Auth', admin_email;
  end if;

  select id into v_role_id
  from public.roles
  where nombre = 'Administrador'
    and activo;

  if v_role_id is null then
    raise exception 'No existe el rol Administrador activo';
  end if;

  insert into public.user_roles(user_id, role_id, activo)
  values (v_user_id, v_role_id, true)
  on conflict (user_id, role_id) do update
  set activo = true,
      updated_at = now();
end $$;

commit;

-- Verificación esperada para pillaca98@gmail.com:
select
  u.email,
  p.nombre_completo,
  r.nombre as rol,
  ur.activo
from auth.users u
left join public.profiles p on p.id = u.id
left join public.user_roles ur on ur.user_id = u.id
left join public.roles r on r.id = ur.role_id
where lower(u.email) = lower('pillaca98@gmail.com');
