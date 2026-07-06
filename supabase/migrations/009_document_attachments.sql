begin;

create table if not exists public.catalogo_tipo_anexo (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  descripcion text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(nombre)) >= 2)
);

create table if not exists public.documento_anexos (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.documentos(id) on delete cascade,
  tipo_anexo_id uuid not null references public.catalogo_tipo_anexo(id),
  nombre_archivo text not null,
  descripcion text,
  archivo_path text not null,
  extension text,
  mime_type text,
  size_bytes bigint not null default 0 check (size_bytes >= 0 and size_bytes <= 52428800),
  activo boolean not null default true,
  created_by uuid not null references auth.users(id),
  updated_by uuid references auth.users(id),
  eliminado_at timestamptz,
  eliminado_por uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(nombre_archivo)) >= 2),
  check (archivo_path like created_by::text || '/%'),
  check (
    extension is null
    or extension in ('pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'webp', 'txt')
  ),
  check (
    mime_type is null
    or mime_type in (
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/webp',
      'text/plain'
    )
  )
);

create index if not exists idx_documento_anexos_documento_active
on public.documento_anexos(documento_id, created_at desc)
where activo;

create index if not exists idx_documento_anexos_tipo_active
on public.documento_anexos(tipo_anexo_id)
where activo;

insert into public.catalogo_tipo_anexo(nombre, descripcion)
values
  ('Voucher', 'Comprobante o voucher bancario'),
  ('Balance', 'Balance o detalle de gastos'),
  ('Informe', 'Informe complementario'),
  ('Informe técnico', 'Informe técnico de sustento'),
  ('Acta', 'Acta asociada al documento'),
  ('Evidencia', 'Evidencia documental o fotográfica'),
  ('Sustento', 'Documento de sustento'),
  ('Referencia', 'Documento de referencia'),
  ('Otro', 'Otro documento complementario')
on conflict (nombre) do update
set descripcion = excluded.descripcion,
    activo = true,
    updated_at = now();

insert into public.permissions(modulo, accion)
values
  ('anexos', 'ver'),
  ('anexos', 'crear'),
  ('anexos', 'eliminar')
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
 and p.accion in ('ver', 'crear')
where r.nombre in ('Archivo documental', 'Tesorería', 'Registrador')
  and r.activo
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p
  on p.modulo = 'anexos'
 and p.accion = 'ver'
where r.nombre in ('Auditor', 'Consulta')
  and r.activo
on conflict (role_id, permission_id) do nothing;

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

  if tg_op = 'UPDATE' then
    if new.documento_id is distinct from old.documento_id
      or new.created_by is distinct from old.created_by
      or new.archivo_path is distinct from old.archivo_path then
      raise exception using errcode = '22023', message = 'No se pueden cambiar campos protegidos del anexo';
    end if;

    new.updated_by = auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_documento_anexos_updated_at on public.documento_anexos;
create trigger trg_documento_anexos_updated_at
before update on public.documento_anexos
for each row execute function public.set_updated_at();

drop trigger if exists trg_catalogo_tipo_anexo_updated_at on public.catalogo_tipo_anexo;
create trigger trg_catalogo_tipo_anexo_updated_at
before update on public.catalogo_tipo_anexo
for each row execute function public.set_updated_at();

drop trigger if exists trg_validate_documento_anexos on public.documento_anexos;
create trigger trg_validate_documento_anexos
before insert or update on public.documento_anexos
for each row execute function public.validate_documento_anexo();

drop trigger if exists trg_audit_documento_anexos on public.documento_anexos;
create trigger trg_audit_documento_anexos
after insert or update or delete on public.documento_anexos
for each row execute function public.audit_trigger();

alter table public.catalogo_tipo_anexo enable row level security;
alter table public.documento_anexos enable row level security;

grant select on public.catalogo_tipo_anexo to authenticated;
grant insert, update on public.catalogo_tipo_anexo to authenticated;
grant select on public.documento_anexos to authenticated;

drop policy if exists catalogo_tipo_anexo_select on public.catalogo_tipo_anexo;
create policy catalogo_tipo_anexo_select
on public.catalogo_tipo_anexo for select to authenticated
using (public.has_permission('catalogos', 'ver'));

drop policy if exists catalogo_tipo_anexo_insert on public.catalogo_tipo_anexo;
create policy catalogo_tipo_anexo_insert
on public.catalogo_tipo_anexo for insert to authenticated
with check (public.has_permission('catalogos', 'crear'));

drop policy if exists catalogo_tipo_anexo_update on public.catalogo_tipo_anexo;
create policy catalogo_tipo_anexo_update
on public.catalogo_tipo_anexo for update to authenticated
using (public.has_permission('catalogos', 'editar'))
with check (public.has_permission('catalogos', 'editar'));

drop policy if exists documento_anexos_select on public.documento_anexos;
create policy documento_anexos_select
on public.documento_anexos for select to authenticated
using (
  activo
  and (
    public.is_admin()
    or public.has_permission('anexos', 'ver')
    or public.has_permission('documentos', 'ver')
  )
);

drop policy if exists documento_anexos_insert on public.documento_anexos;
create policy documento_anexos_insert
on public.documento_anexos for insert to authenticated
with check (
  activo
  and created_by = auth.uid()
  and (
    public.is_admin()
    or public.has_permission('anexos', 'crear')
    or public.has_permission('documentos', 'crear')
    or public.has_permission('documentos', 'editar')
  )
);

drop policy if exists documento_anexos_update on public.documento_anexos;
create policy documento_anexos_update
on public.documento_anexos for update to authenticated
using (
  activo
  and (
    public.is_admin()
    or public.has_permission('anexos', 'eliminar')
    or public.has_permission('documentos', 'eliminar')
  )
)
with check (
  public.is_admin()
  or public.has_permission('anexos', 'eliminar')
  or public.has_permission('documentos', 'eliminar')
);

create or replace function public.registrar_documento_anexo(
  p_documento_id uuid,
  p_tipo_anexo_id uuid,
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

create or replace function public.eliminar_documento_anexo(p_anexo_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_authenticated_user() then
    raise exception using errcode = '42501', message = 'Usuario no autenticado o inactivo';
  end if;

  if not (
    public.is_admin()
    or public.has_permission('anexos', 'eliminar')
    or public.has_permission('documentos', 'eliminar')
  ) then
    raise exception using errcode = '42501', message = 'No tienes permiso para eliminar anexos';
  end if;

  update public.documento_anexos
  set activo = false,
      eliminado_at = now(),
      eliminado_por = auth.uid()
  where id = p_anexo_id
    and activo;

  if not found then
    raise exception using errcode = 'P0002', message = 'Anexo no encontrado o ya eliminado';
  end if;
end;
$$;

revoke all on function public.registrar_documento_anexo(
  uuid, uuid, text, text, text, text, text, bigint
) from public, anon;
grant execute on function public.registrar_documento_anexo(
  uuid, uuid, text, text, text, text, text, bigint
) to authenticated;

revoke all on function public.eliminar_documento_anexo(uuid) from public, anon;
grant execute on function public.eliminar_documento_anexo(uuid) to authenticated;

revoke all on function public.validate_documento_anexo() from public, anon, authenticated;

commit;
