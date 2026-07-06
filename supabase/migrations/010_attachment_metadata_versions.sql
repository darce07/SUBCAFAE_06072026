begin;

alter table public.documento_anexos
  add column if not exists titulo text,
  add column if not exists version_actual integer not null default 1;

update public.documento_anexos
set titulo = coalesce(nullif(trim(titulo), ''), nombre_archivo)
where titulo is null;

alter table public.documento_anexos
  drop constraint if exists documento_anexos_titulo_check;

alter table public.documento_anexos
  add constraint documento_anexos_titulo_check
  check (titulo is null or length(trim(titulo)) >= 2);

alter table public.documento_anexos
  alter column titulo set not null;

create table if not exists public.documento_anexo_versiones (
  id uuid primary key default gen_random_uuid(),
  anexo_id uuid not null references public.documento_anexos(id) on delete cascade,
  version_numero integer not null,
  titulo text not null,
  tipo_anexo_id uuid not null references public.catalogo_tipo_anexo(id),
  descripcion text,
  nombre_archivo text not null,
  archivo_path text not null,
  extension text,
  mime_type text,
  size_bytes bigint not null default 0,
  accion text not null check (accion in ('CREADO', 'EDITADO', 'REEMPLAZADO', 'ELIMINADO')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_documento_anexo_versiones_anexo
on public.documento_anexo_versiones(anexo_id, version_numero desc);

insert into public.catalogo_tipo_anexo(nombre, descripcion)
values
  ('Oficio', 'Oficio asociado al documento principal'),
  ('Memorando', 'Memorando asociado al documento principal')
on conflict (nombre) do update
set descripcion = excluded.descripcion,
    activo = true,
    updated_at = now();

insert into public.permissions(modulo, accion)
values ('anexos', 'editar')
on conflict (modulo, accion) do nothing;

insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.nombre = 'Administrador'
  and r.activo
  and p.modulo = 'anexos'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p
  on p.modulo = 'anexos'
 and p.accion = 'editar'
where r.nombre in ('Archivo documental', 'Tesorería')
  and r.activo
on conflict (role_id, permission_id) do nothing;

create or replace function public.snapshot_documento_anexo(
  p_anexo public.documento_anexos,
  p_accion text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.documento_anexo_versiones(
    anexo_id,
    version_numero,
    titulo,
    tipo_anexo_id,
    descripcion,
    nombre_archivo,
    archivo_path,
    extension,
    mime_type,
    size_bytes,
    accion,
    created_by
  )
  values (
    p_anexo.id,
    p_anexo.version_actual,
    p_anexo.titulo,
    p_anexo.tipo_anexo_id,
    p_anexo.descripcion,
    p_anexo.nombre_archivo,
    p_anexo.archivo_path,
    p_anexo.extension,
    p_anexo.mime_type,
    p_anexo.size_bytes,
    p_accion,
    auth.uid()
  );
end;
$$;

create or replace function public.validate_documento_anexo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not (
      public.is_authenticated_user()
      and (
        public.is_admin()
        or public.has_permission('anexos', 'crear')
        or public.has_permission('documentos', 'crear')
        or public.has_permission('documentos', 'editar')
      )
    ) then
      raise exception using errcode = '42501', message = 'No tienes permiso para registrar anexos';
    end if;

    if new.created_by is distinct from auth.uid() then
      raise exception using errcode = '42501', message = 'El anexo no contiene una identidad válida';
    end if;

    new.titulo = trim(new.titulo);
  end if;

  if tg_op = 'UPDATE' and old.activo and not new.activo then
    if not (
      public.is_admin()
      or public.has_permission('anexos', 'eliminar')
      or public.has_permission('documentos', 'eliminar')
    ) then
      raise exception using errcode = '42501', message = 'No tienes permiso para eliminar anexos';
    end if;

    if new.eliminado_por is distinct from auth.uid()
      or new.eliminado_at is null then
      raise exception using errcode = '42501', message = 'La baja del anexo no contiene una identidad válida';
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    if not (
      public.is_admin()
      or public.has_permission('anexos', 'editar')
      or public.has_permission('documentos', 'editar')
    ) then
      raise exception using errcode = '42501', message = 'No tienes permiso para editar anexos';
    end if;

    if new.documento_id is distinct from old.documento_id
      or new.created_by is distinct from old.created_by then
      raise exception using errcode = '22023', message = 'No se pueden cambiar campos protegidos del anexo';
    end if;

    new.updated_by = auth.uid();
    new.titulo = trim(new.titulo);
  end if;

  if not exists (
    select 1 from public.documentos d
    where d.id = new.documento_id
      and d.activo
  ) then
    raise exception using errcode = '23503', message = 'El documento no existe o está inactivo';
  end if;

  if not exists (
    select 1 from public.catalogo_tipo_anexo t
    where t.id = new.tipo_anexo_id
      and t.activo
  ) then
    raise exception using errcode = '23503', message = 'El tipo de anexo no existe o está inactivo';
  end if;

  if not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'documentos'
      and o.name = new.archivo_path
  ) then
    raise exception using errcode = '23503', message = 'El archivo del anexo no fue encontrado en el almacenamiento';
  end if;

  return new;
end;
$$;

create or replace function public.audit_documento_anexo_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.snapshot_documento_anexo(new, 'CREADO');
    return new;
  end if;

  if tg_op = 'UPDATE' and old.activo and not new.activo then
    perform public.snapshot_documento_anexo(old, 'ELIMINADO');
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.archivo_path is distinct from old.archivo_path then
      perform public.snapshot_documento_anexo(old, 'REEMPLAZADO');
    else
      perform public.snapshot_documento_anexo(old, 'EDITADO');
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_documento_anexo_versiones on public.documento_anexos;
create trigger trg_documento_anexo_versiones
after insert or update on public.documento_anexos
for each row execute function public.audit_documento_anexo_version();

create or replace function public.registrar_documento_anexo(
  p_documento_id uuid,
  p_tipo_anexo_id uuid,
  p_titulo text,
  p_nombre_archivo text,
  p_descripcion text,
  p_archivo_path text,
  p_extension text,
  p_mime_type text,
  p_size_bytes bigint
)
returns public.documento_anexos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anexo public.documento_anexos;
begin
  if not public.is_authenticated_user() then
    raise exception using errcode = '42501', message = 'Usuario no autenticado o inactivo';
  end if;

  if not (
    public.is_admin()
    or public.has_permission('anexos', 'crear')
    or public.has_permission('documentos', 'crear')
    or public.has_permission('documentos', 'editar')
  ) then
    raise exception using errcode = '42501', message = 'No tienes permiso para registrar anexos';
  end if;

  insert into public.documento_anexos(
    documento_id,
    tipo_anexo_id,
    titulo,
    nombre_archivo,
    descripcion,
    archivo_path,
    extension,
    mime_type,
    size_bytes,
    created_by
  )
  values (
    p_documento_id,
    p_tipo_anexo_id,
    trim(p_titulo),
    trim(p_nombre_archivo),
    nullif(trim(coalesce(p_descripcion, '')), ''),
    trim(p_archivo_path),
    lower(nullif(trim(coalesce(p_extension, '')), '')),
    nullif(trim(coalesce(p_mime_type, '')), ''),
    coalesce(p_size_bytes, 0),
    auth.uid()
  )
  returning * into v_anexo;

  return v_anexo;
end;
$$;

create or replace function public.actualizar_documento_anexo(
  p_anexo_id uuid,
  p_tipo_anexo_id uuid,
  p_titulo text,
  p_descripcion text,
  p_nombre_archivo text default null,
  p_archivo_path text default null,
  p_extension text default null,
  p_mime_type text default null,
  p_size_bytes bigint default null
)
returns public.documento_anexos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anexo public.documento_anexos;
begin
  if not public.is_authenticated_user() then
    raise exception using errcode = '42501', message = 'Usuario no autenticado o inactivo';
  end if;

  if not (
    public.is_admin()
    or public.has_permission('anexos', 'editar')
    or public.has_permission('documentos', 'editar')
  ) then
    raise exception using errcode = '42501', message = 'No tienes permiso para editar anexos';
  end if;

  update public.documento_anexos
  set tipo_anexo_id = p_tipo_anexo_id,
      titulo = trim(p_titulo),
      descripcion = nullif(trim(coalesce(p_descripcion, '')), ''),
      nombre_archivo = coalesce(nullif(trim(coalesce(p_nombre_archivo, '')), ''), nombre_archivo),
      archivo_path = coalesce(nullif(trim(coalesce(p_archivo_path, '')), ''), archivo_path),
      extension = coalesce(lower(nullif(trim(coalesce(p_extension, '')), '')), extension),
      mime_type = coalesce(nullif(trim(coalesce(p_mime_type, '')), ''), mime_type),
      size_bytes = coalesce(p_size_bytes, size_bytes),
      version_actual = case
        when p_archivo_path is not null and trim(p_archivo_path) <> '' and trim(p_archivo_path) is distinct from archivo_path
        then version_actual + 1
        else version_actual
      end
  where id = p_anexo_id
    and activo
  returning * into v_anexo;

  if v_anexo.id is null then
    raise exception using errcode = 'P0002', message = 'Anexo no encontrado o inactivo';
  end if;

  return v_anexo;
end;
$$;

alter table public.documento_anexo_versiones enable row level security;
grant select on public.documento_anexo_versiones to authenticated;

drop policy if exists documento_anexo_versiones_select on public.documento_anexo_versiones;
create policy documento_anexo_versiones_select
on public.documento_anexo_versiones for select to authenticated
using (
  public.is_admin()
  or public.has_permission('anexos', 'ver')
  or public.has_permission('auditoria', 'ver')
);

revoke all on function public.registrar_documento_anexo(
  uuid, uuid, text, text, text, text, text, text, bigint
) from public, anon;

grant execute on function public.registrar_documento_anexo(
  uuid, uuid, text, text, text, text, text, text, bigint
) to authenticated;

revoke all on function public.actualizar_documento_anexo(
  uuid, uuid, text, text, text, text, text, text, bigint
) from public, anon;

grant execute on function public.actualizar_documento_anexo(
  uuid, uuid, text, text, text, text, text, text, bigint
) to authenticated;

revoke all on function public.snapshot_documento_anexo(public.documento_anexos, text) from public, anon, authenticated;
revoke all on function public.audit_documento_anexo_version() from public, anon, authenticated;

commit;
