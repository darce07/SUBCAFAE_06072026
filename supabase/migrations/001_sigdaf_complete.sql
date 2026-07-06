begin;

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  descripcion text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  modulo text not null,
  accion text not null,
  created_at timestamptz not null default now(),
  unique (modulo, accion)
);

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  unique (role_id, permission_id)
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, role_id)
);

create table if not exists public.catalogo_categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (length(trim(nombre)) >= 2),
  descripcion text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalogo_tipo_entidad (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (length(trim(nombre)) >= 2),
  descripcion text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entidades (
  id uuid primary key default gen_random_uuid(),
  tipo_entidad_id uuid references public.catalogo_tipo_entidad(id),
  nombre text not null check (length(trim(nombre)) >= 2),
  descripcion text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tipo_entidad_id, nombre)
);

create table if not exists public.catalogo_tipo_categoria (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (length(trim(nombre)) >= 2),
  descripcion text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalogo_estado_documento (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (length(trim(nombre)) >= 2),
  descripcion text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalogo_archivadores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (length(trim(nombre)) >= 2),
  descripcion text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalogo_tipo_movimiento (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (nombre in ('Ingreso', 'Egreso', 'No aplica')),
  descripcion text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalogo_tipo_operacion (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (length(trim(nombre)) >= 2),
  descripcion text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.estructura_historica (
  id uuid primary key default gen_random_uuid(),
  nivel_1 text,
  nivel_2 text,
  nivel_3 text,
  nivel_4 text,
  nivel_5 text,
  nivel_6 text,
  nivel_7 text,
  nombre_archivo text,
  extension text,
  ruta_original text,
  folder_archivador text,
  fecha_importacion timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.documentos (
  id uuid primary key default gen_random_uuid(),
  codigo_documento text not null unique,
  categoria_id uuid not null references public.catalogo_categorias(id),
  fecha_documento date not null,
  anio integer generated always as (extract(year from fecha_documento)::integer) stored,
  mes integer generated always as (extract(month from fecha_documento)::integer) stored,
  dia integer generated always as (extract(day from fecha_documento)::integer) stored,
  tipo_entidad_id uuid references public.catalogo_tipo_entidad(id),
  entidad_id uuid references public.entidades(id),
  tipo_categoria_id uuid references public.catalogo_tipo_categoria(id),
  estado_id uuid not null references public.catalogo_estado_documento(id),
  titulo text not null check (length(trim(titulo)) >= 3),
  descripcion text,
  ruta_historica text,
  estructura_historica_id uuid references public.estructura_historica(id),
  archivador_id uuid references public.catalogo_archivadores(id),
  archivo_path text check (archivo_path is null or length(trim(archivo_path)) >= 3),
  archivo_url text,
  extension text,
  monto numeric(14,2) not null default 0 check (monto >= 0),
  tipo_movimiento_id uuid references public.catalogo_tipo_movimiento(id),
  tipo_operacion_id uuid references public.catalogo_tipo_operacion(id),
  idempotency_key text not null check (length(trim(idempotency_key)) >= 12),
  activo boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (created_by, idempotency_key)
);

create table if not exists public.auditoria (
  id bigint generated always as identity primary key,
  tabla text not null,
  registro_id uuid,
  accion text not null check (accion in ('INSERT', 'UPDATE', 'DELETE')),
  valor_anterior jsonb,
  valor_nuevo jsonb,
  usuario_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create or replace function public.is_authenticated_user()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    auth.uid() is not null
    and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

create or replace function public.has_permission(p_modulo text, p_accion text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_authenticated_user() and exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = auth.uid()
      and ur.activo
      and r.activo
      and p.modulo = p_modulo
      and p.accion = p_accion
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_authenticated_user() and exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and ur.activo
      and r.activo
      and r.nombre = 'Administrador'
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.validate_documento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_movimiento text;
  v_entidad_tipo uuid;
begin
  if new.archivo_url is not null then
    raise exception using errcode = '22023', message = 'No se deben guardar URLs firmadas o públicas; use archivo_path';
  end if;

  if new.archivo_path is not null and new.archivo_path not like new.created_by::text || '/%' then
    raise exception using errcode = '22023', message = 'La ruta del archivo no pertenece al usuario creador';
  end if;

  if not exists (select 1 from public.catalogo_categorias c where c.id = new.categoria_id and c.activo) then
    raise exception using errcode = '23503', message = 'La categoría no existe o está inactiva';
  end if;

  if not exists (select 1 from public.catalogo_estado_documento e where e.id = new.estado_id and e.activo) then
    raise exception using errcode = '23503', message = 'El estado no existe o está inactivo';
  end if;

  if new.entidad_id is not null then
    select e.tipo_entidad_id into v_entidad_tipo
    from public.entidades e
    where e.id = new.entidad_id and e.activo;

    if not found then
      raise exception using errcode = '23503', message = 'La entidad no existe o está inactiva';
    end if;

    if new.tipo_entidad_id is not null and v_entidad_tipo is distinct from new.tipo_entidad_id then
      raise exception using errcode = '22023', message = 'La entidad no corresponde al tipo de entidad seleccionado';
    end if;
  end if;

  if new.tipo_movimiento_id is not null then
    select m.nombre into v_movimiento
    from public.catalogo_tipo_movimiento m
    where m.id = new.tipo_movimiento_id and m.activo;

    if not found then
      raise exception using errcode = '23503', message = 'El tipo de movimiento no existe o está inactivo';
    end if;
  else
    v_movimiento := 'No aplica';
  end if;

  if v_movimiento in ('Ingreso', 'Egreso') and new.tipo_operacion_id is null then
    raise exception using errcode = '22023', message = 'El tipo de operación es obligatorio para ingresos o egresos';
  end if;

  if v_movimiento = 'No aplica' and (new.monto <> 0 or new.tipo_operacion_id is not null) then
    raise exception using errcode = '22023', message = 'No aplica requiere monto 0 y ninguna operación';
  end if;

  if tg_op = 'UPDATE' then
    if new.created_by is distinct from old.created_by then
      raise exception using errcode = '22023', message = 'No se puede cambiar el usuario creador';
    end if;
    if new.idempotency_key is distinct from old.idempotency_key then
      raise exception using errcode = '22023', message = 'No se puede cambiar la clave de idempotencia';
    end if;
    if not public.has_permission('documentos', 'editar') then
      if not public.has_permission('documentos', 'desactivar')
        or new.activo
        or (to_jsonb(new) - 'activo' - 'updated_at') is distinct from
           (to_jsonb(old) - 'activo' - 'updated_at') then
        raise exception using errcode = '42501', message = 'Solo tienes permiso para desactivar documentos';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.auditoria(tabla, registro_id, accion, valor_nuevo, usuario_id)
    values (tg_table_name, new.id, 'INSERT', to_jsonb(new), auth.uid());
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.auditoria(tabla, registro_id, accion, valor_anterior, valor_nuevo, usuario_id)
    values (tg_table_name, new.id, 'UPDATE', to_jsonb(old), to_jsonb(new), auth.uid());
    return new;
  else
    insert into public.auditoria(tabla, registro_id, accion, valor_anterior, usuario_id)
    values (tg_table_name, old.id, 'DELETE', to_jsonb(old), auth.uid());
    return old;
  end if;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'roles', 'user_roles', 'catalogo_categorias', 'catalogo_tipo_entidad',
    'entidades', 'catalogo_tipo_categoria', 'catalogo_estado_documento',
    'catalogo_archivadores', 'catalogo_tipo_movimiento',
    'catalogo_tipo_operacion', 'documentos'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || table_name || '_updated_at', table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      'trg_' || table_name || '_updated_at',
      table_name
    );
  end loop;
end $$;

drop trigger if exists trg_documentos_validate on public.documentos;
create trigger trg_documentos_validate
before insert or update on public.documentos
for each row execute function public.validate_documento();

drop trigger if exists trg_documentos_audit on public.documentos;
create trigger trg_documentos_audit
after insert or update or delete on public.documentos
for each row execute function public.audit_trigger();

create index if not exists idx_user_roles_user_active on public.user_roles(user_id) where activo;
create index if not exists idx_role_permissions_role on public.role_permissions(role_id);
create index if not exists idx_entidades_tipo_active on public.entidades(tipo_entidad_id) where activo;
create index if not exists idx_documentos_fecha_active on public.documentos(fecha_documento desc) where activo;
create index if not exists idx_documentos_categoria_active on public.documentos(categoria_id) where activo;
create index if not exists idx_documentos_estado_active on public.documentos(estado_id) where activo;
create index if not exists idx_documentos_anio_mes_active on public.documentos(anio, mes) where activo;
create index if not exists idx_documentos_movimiento_active on public.documentos(tipo_movimiento_id) where activo;
create index if not exists idx_documentos_created_by on public.documentos(created_by);
create index if not exists idx_documentos_titulo_trgm on public.documentos using gin (titulo gin_trgm_ops);
create index if not exists idx_documentos_codigo_trgm on public.documentos using gin (codigo_documento gin_trgm_ops);
create index if not exists idx_documentos_ruta_trgm on public.documentos using gin (ruta_historica gin_trgm_ops);
create index if not exists idx_auditoria_registro on public.auditoria(tabla, registro_id, created_at desc);
create index if not exists idx_auditoria_usuario on public.auditoria(usuario_id, created_at desc);

insert into public.catalogo_categorias (nombre, descripcion)
values
  ('Donaciones', 'Documentos relacionados con donaciones'),
  ('Actas Orden', 'Actas u órdenes institucionales'),
  ('Cartas Orden', 'Cartas orden'),
  ('Claves de Acceso', 'Credenciales o documentos de acceso'),
  ('Constancia de Estímulos', 'Constancias de estímulos'),
  ('Contratos', 'Contratos institucionales'),
  ('Cuentas Bancarias', 'Documentos de cuentas bancarias'),
  ('Oficios-Carta Orden', 'Oficios vinculados a carta orden'),
  ('Facturas', 'Facturas y comprobantes'),
  ('Inasistencias, Tardanzas o Permisos', 'Documentos de asistencia'),
  ('Oficios', 'Oficios institucionales'),
  ('Pagos', 'Documentos de pagos'),
  ('Planilla Incentivos', 'Planillas de incentivos'),
  ('Reclamos', 'Documentos de reclamos'),
  ('Reglamento Interno', 'Reglamentos internos'),
  ('Caja Chica', 'Rendiciones y movimientos de caja chica'),
  ('Requisitos', 'Documentos de requisitos'),
  ('Resolución', 'Resoluciones'),
  ('Recibos por Honorarios', 'Recibos por honorarios'),
  ('Solicitudes', 'Solicitudes varias'),
  ('SUNARP', 'Documentos SUNARP'),
  ('Trámites', 'Documentos de trámites'),
  ('Incentivos', 'Documentos de incentivos')
on conflict (nombre) do update
set descripcion = excluded.descripcion, activo = true, updated_at = now();

insert into public.catalogo_tipo_entidad (nombre, descripcion)
values
  ('Persona Natural', 'Persona individual'),
  ('Persona Jurídica', 'Empresa, asociación u organización'),
  ('Institución Pública', 'Entidad del Estado'),
  ('Institución Privada', 'Entidad privada'),
  ('Banco', 'Entidad bancaria'),
  ('Proveedor', 'Proveedor de bienes o servicios'),
  ('Trabajador', 'Personal vinculado'),
  ('UGEL', 'Unidad de Gestión Educativa Local'),
  ('Otro', 'Otro tipo de entidad')
on conflict (nombre) do update
set descripcion = excluded.descripcion, activo = true, updated_at = now();

insert into public.catalogo_tipo_categoria (nombre, descripcion)
values
  ('Documental', 'Clasificación principalmente documental'),
  ('Financiera', 'Clasificación vinculada a dinero'),
  ('Administrativa', 'Gestión administrativa'),
  ('Contable', 'Gestión contable'),
  ('Tesorería', 'Gestión de tesorería'),
  ('Legal', 'Documentación legal'),
  ('Recursos Humanos', 'Documentación de personal'),
  ('Archivo', 'Clasificación archivística'),
  ('Otro', 'Otra clasificación')
on conflict (nombre) do update
set descripcion = excluded.descripcion, activo = true, updated_at = now();

insert into public.catalogo_estado_documento (nombre, descripcion)
values
  ('Pendiente', 'Documento pendiente de revisión'),
  ('Verificado', 'Documento verificado físico y digitalmente'),
  ('Observado', 'Documento con observaciones'),
  ('No encontrado', 'Documento físico o digital no encontrado'),
  ('Archivado', 'Documento archivado correctamente'),
  ('Anulado', 'Documento anulado'),
  ('Borrador', 'Documento en registro preliminar')
on conflict (nombre) do update
set descripcion = excluded.descripcion, activo = true, updated_at = now();

insert into public.catalogo_archivadores (nombre, descripcion)
values
  ('Pendiente de asignar', 'Sin ubicación física definida'),
  ('Archivo Central', 'Archivo físico principal'),
  ('Archivador A', 'Archivador físico A'),
  ('Archivador B', 'Archivador físico B'),
  ('Archivador C', 'Archivador físico C'),
  ('Archivador D', 'Archivador físico D'),
  ('Tesorería', 'Archivador de tesorería'),
  ('Contabilidad', 'Archivador de contabilidad'),
  ('Caja Chica', 'Archivador de caja chica'),
  ('Contratos', 'Archivador de contratos')
on conflict (nombre) do update
set descripcion = excluded.descripcion, activo = true, updated_at = now();

insert into public.catalogo_tipo_movimiento (nombre, descripcion)
values
  ('Ingreso', 'Movimiento económico de entrada'),
  ('Egreso', 'Movimiento económico de salida'),
  ('No aplica', 'Documento sin movimiento económico')
on conflict (nombre) do update
set descripcion = excluded.descripcion, activo = true, updated_at = now();

insert into public.catalogo_tipo_operacion (nombre, descripcion)
values
  ('Donación', 'Ingreso por donación'),
  ('Compra', 'Egreso por compra'),
  ('Pago', 'Pago realizado'),
  ('Caja Chica', 'Movimiento de caja chica'),
  ('Incentivo', 'Movimiento por incentivo'),
  ('Servicio', 'Pago por servicio'),
  ('Mantenimiento', 'Gasto de mantenimiento'),
  ('Reembolso', 'Reembolso'),
  ('Trámite', 'Pago o ingreso por trámite'),
  ('Honorarios', 'Recibo por honorarios'),
  ('Banco', 'Movimiento bancario'),
  ('Otro', 'Otra operación')
on conflict (nombre) do update
set descripcion = excluded.descripcion, activo = true, updated_at = now();

insert into public.roles (nombre, descripcion)
values
  ('Administrador', 'Acceso total al sistema'),
  ('Archivo documental', 'Gestión documental y archivo físico'),
  ('Tesorería', 'Gestión de ingresos, egresos y balances'),
  ('Auditor', 'Consulta y auditoría'),
  ('Consulta', 'Solo lectura'),
  ('Registrador', 'Registro básico de documentos')
on conflict (nombre) do update
set descripcion = excluded.descripcion, activo = true, updated_at = now();

insert into public.permissions (modulo, accion)
values
  ('documentos', 'ver'), ('documentos', 'crear'), ('documentos', 'editar'),
  ('documentos', 'desactivar'), ('documentos', 'exportar'),
  ('catalogos', 'ver'), ('catalogos', 'crear'), ('catalogos', 'editar'),
  ('finanzas', 'ver'), ('finanzas', 'crear'), ('finanzas', 'editar'), ('finanzas', 'exportar'),
  ('auditoria', 'ver'), ('usuarios', 'ver'), ('usuarios', 'editar'),
  ('configuracion', 'ver'), ('configuracion', 'editar'),
  ('storage', 'subir'), ('storage', 'ver'), ('storage', 'eliminar')
on conflict (modulo, accion) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.nombre = 'Administrador'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on
  (p.modulo = 'documentos' and p.accion in ('ver', 'crear', 'editar', 'exportar'))
  or (p.modulo = 'catalogos' and p.accion = 'ver')
  or (p.modulo = 'storage' and p.accion in ('subir', 'ver'))
where r.nombre = 'Archivo documental'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on
  (p.modulo = 'documentos' and p.accion in ('ver', 'crear', 'editar'))
  or (p.modulo = 'finanzas' and p.accion in ('ver', 'crear', 'editar', 'exportar'))
  or (p.modulo = 'catalogos' and p.accion = 'ver')
  or (p.modulo = 'storage' and p.accion in ('subir', 'ver'))
where r.nombre = 'Tesorería'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on
  (p.modulo in ('documentos', 'finanzas', 'auditoria') and p.accion in ('ver', 'exportar'))
  or (p.modulo = 'storage' and p.accion = 'ver')
where r.nombre = 'Auditor'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on
  (p.modulo in ('documentos', 'finanzas') and p.accion = 'ver')
  or (p.modulo = 'storage' and p.accion = 'ver')
where r.nombre = 'Consulta'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on
  (p.modulo = 'documentos' and p.accion in ('ver', 'crear'))
  or (p.modulo = 'catalogos' and p.accion = 'ver')
  or (p.modulo = 'storage' and p.accion in ('subir', 'ver'))
where r.nombre = 'Registrador'
on conflict (role_id, permission_id) do nothing;

create or replace function public.registrar_documento_seguro(
  p_idempotency_key text,
  p_categoria_id uuid,
  p_fecha_documento date,
  p_tipo_entidad_id uuid default null,
  p_entidad_id uuid default null,
  p_tipo_categoria_id uuid default null,
  p_estado_id uuid default null,
  p_titulo text default null,
  p_descripcion text default null,
  p_ruta_historica text default null,
  p_estructura_historica_id uuid default null,
  p_archivador_id uuid default null,
  p_archivo_path text default null,
  p_extension text default null,
  p_monto numeric default 0,
  p_tipo_movimiento_id uuid default null,
  p_tipo_operacion_id uuid default null
)
returns public.documentos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.documentos;
  v_documento public.documentos;
  v_codigo text;
begin
  if not public.is_authenticated_user() then
    raise exception using errcode = '42501', message = 'Usuario no autenticado';
  end if;

  if not public.has_permission('documentos', 'crear') then
    raise exception using errcode = '42501', message = 'No tienes permiso para crear documentos';
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 12 then
    raise exception using errcode = '22023', message = 'idempotency_key inválido';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(auth.uid()::text || ':' || trim(p_idempotency_key), 0)
  );

  select d.* into v_existing
  from public.documentos d
  where d.created_by = auth.uid()
    and d.idempotency_key = trim(p_idempotency_key)
  limit 1;

  if found then
    return v_existing;
  end if;

  if p_categoria_id is null or p_fecha_documento is null or p_estado_id is null then
    raise exception using errcode = '22023', message = 'Categoría, fecha y estado son obligatorios';
  end if;

  if p_titulo is null or length(trim(p_titulo)) < 3 then
    raise exception using errcode = '22023', message = 'El título es obligatorio';
  end if;

  if p_archivo_path is null or p_archivo_path not like auth.uid()::text || '/%' then
    raise exception using errcode = '22023', message = 'La ruta del archivo es inválida';
  end if;

  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'documentos'
      and o.name = p_archivo_path
      and o.owner_id = auth.uid()::text
  ) then
    raise exception using errcode = '22023', message = 'El archivo no existe en Storage o no pertenece al usuario';
  end if;

  v_codigo := 'DOC-' || extract(year from p_fecha_documento)::integer || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.documentos (
    codigo_documento, categoria_id, fecha_documento, tipo_entidad_id,
    entidad_id, tipo_categoria_id, estado_id, titulo, descripcion,
    ruta_historica, estructura_historica_id, archivador_id, archivo_path,
    archivo_url, extension, monto, tipo_movimiento_id, tipo_operacion_id,
    idempotency_key, created_by
  )
  values (
    v_codigo, p_categoria_id, p_fecha_documento, p_tipo_entidad_id,
    p_entidad_id, p_tipo_categoria_id, p_estado_id, trim(p_titulo),
    nullif(trim(coalesce(p_descripcion, '')), ''),
    nullif(trim(coalesce(p_ruta_historica, '')), ''),
    p_estructura_historica_id, p_archivador_id, trim(p_archivo_path),
    null, lower(nullif(trim(coalesce(p_extension, '')), '')),
    coalesce(p_monto, 0), p_tipo_movimiento_id, p_tipo_operacion_id,
    trim(p_idempotency_key), auth.uid()
  )
  returning * into v_documento;

  return v_documento;
end;
$$;

create or replace function public.obtener_dashboard_resumen()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.has_permission('documentos', 'ver') then
    raise exception using errcode = '42501', message = 'No tienes permiso para ver el dashboard';
  end if;

  select jsonb_build_object(
    'totalDocumentos', count(*)::integer,
    'totalIngresos', coalesce(sum(d.monto) filter (where tm.nombre = 'Ingreso'), 0),
    'totalEgresos', coalesce(sum(d.monto) filter (where tm.nombre = 'Egreso'), 0),
    'balanceGeneral',
      coalesce(sum(d.monto) filter (where tm.nombre = 'Ingreso'), 0) -
      coalesce(sum(d.monto) filter (where tm.nombre = 'Egreso'), 0),
    'sinArchivo', count(*) filter (where d.archivo_path is null)::integer,
    'sinArchivador', count(*) filter (where d.archivador_id is null)::integer,
    'sinRutaHistorica', count(*) filter (where d.ruta_historica is null)::integer,
    'porCategoria', (
      select coalesce(jsonb_agg(jsonb_build_object('name', x.nombre, 'value', x.total) order by x.total desc), '[]'::jsonb)
      from (
        select c.nombre, count(*)::integer total
        from public.documentos dc
        join public.catalogo_categorias c on c.id = dc.categoria_id
        where dc.activo
        group by c.nombre
      ) x
    ),
    'porEstado', (
      select coalesce(jsonb_agg(jsonb_build_object('name', x.nombre, 'value', x.total) order by x.total desc), '[]'::jsonb)
      from (
        select e.nombre, count(*)::integer total
        from public.documentos de
        join public.catalogo_estado_documento e on e.id = de.estado_id
        where de.activo
        group by e.nombre
      ) x
    ),
    'balanceMensual', (
      select jsonb_agg(
        jsonb_build_object(
          'month', m.nombre,
          'ingresos', coalesce(x.ingresos, 0),
          'egresos', coalesce(x.egresos, 0),
          'balance', coalesce(x.ingresos, 0) - coalesce(x.egresos, 0)
        ) order by m.numero
      )
      from (
        values
          (1, 'Ene'), (2, 'Feb'), (3, 'Mar'), (4, 'Abr'),
          (5, 'May'), (6, 'Jun'), (7, 'Jul'), (8, 'Ago'),
          (9, 'Sep'), (10, 'Oct'), (11, 'Nov'), (12, 'Dic')
      ) m(numero, nombre)
      left join (
        select
          dm.mes,
          coalesce(sum(dm.monto) filter (where tmm.nombre = 'Ingreso'), 0) ingresos,
          coalesce(sum(dm.monto) filter (where tmm.nombre = 'Egreso'), 0) egresos
        from public.documentos dm
        left join public.catalogo_tipo_movimiento tmm on tmm.id = dm.tipo_movimiento_id
        where dm.activo and dm.anio = extract(year from current_date)::integer
        group by dm.mes
      ) x on x.mes = m.numero
    )
  )
  into v_result
  from public.documentos d
  left join public.catalogo_tipo_movimiento tm on tm.id = d.tipo_movimiento_id
  where d.activo;

  return v_result;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos',
  'documentos',
  false,
  52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.catalogo_categorias enable row level security;
alter table public.catalogo_tipo_entidad enable row level security;
alter table public.entidades enable row level security;
alter table public.catalogo_tipo_categoria enable row level security;
alter table public.catalogo_estado_documento enable row level security;
alter table public.catalogo_archivadores enable row level security;
alter table public.catalogo_tipo_movimiento enable row level security;
alter table public.catalogo_tipo_operacion enable row level security;
alter table public.estructura_historica enable row level security;
alter table public.documentos enable row level security;
alter table public.auditoria enable row level security;

revoke all on all tables in schema public from anon;
revoke all on public.documentos from authenticated;
grant select, update on public.documentos to authenticated;
grant select on public.estructura_historica, public.auditoria to authenticated;
grant select, insert, update on
  public.catalogo_categorias,
  public.catalogo_tipo_entidad,
  public.entidades,
  public.catalogo_tipo_categoria,
  public.catalogo_estado_documento,
  public.catalogo_archivadores,
  public.catalogo_tipo_movimiento,
  public.catalogo_tipo_operacion
to authenticated;
grant select, insert, update, delete on
  public.roles,
  public.permissions,
  public.role_permissions,
  public.user_roles
to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'catalogo_categorias', 'catalogo_tipo_entidad', 'entidades',
    'catalogo_tipo_categoria', 'catalogo_estado_documento',
    'catalogo_archivadores', 'catalogo_tipo_movimiento',
    'catalogo_tipo_operacion'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_select', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.has_permission(''catalogos'', ''ver''))',
      table_name || '_select', table_name
    );
    execute format('drop policy if exists %I on public.%I', table_name || '_insert', table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.has_permission(''catalogos'', ''crear''))',
      table_name || '_insert', table_name
    );
    execute format('drop policy if exists %I on public.%I', table_name || '_update', table_name);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.has_permission(''catalogos'', ''editar'')) with check (public.has_permission(''catalogos'', ''editar''))',
      table_name || '_update', table_name
    );
  end loop;
end $$;

drop policy if exists documentos_select on public.documentos;
create policy documentos_select
on public.documentos for select to authenticated
using (public.has_permission('documentos', 'ver'));

drop policy if exists documentos_update on public.documentos;
create policy documentos_update
on public.documentos for update to authenticated
using (
  activo
  and (
    public.has_permission('documentos', 'editar')
    or public.has_permission('documentos', 'desactivar')
  )
)
with check (
  public.has_permission('documentos', 'editar')
  or public.has_permission('documentos', 'desactivar')
);

drop policy if exists estructura_select on public.estructura_historica;
create policy estructura_select
on public.estructura_historica for select to authenticated
using (public.has_permission('documentos', 'ver'));

drop policy if exists auditoria_select on public.auditoria;
create policy auditoria_select
on public.auditoria for select to authenticated
using (public.has_permission('auditoria', 'ver'));

drop policy if exists roles_admin on public.roles;
create policy roles_admin on public.roles for all to authenticated
using (public.is_admin()) with check (public.is_admin());
drop policy if exists permissions_admin on public.permissions;
create policy permissions_admin on public.permissions for all to authenticated
using (public.is_admin()) with check (public.is_admin());
drop policy if exists role_permissions_admin on public.role_permissions;
create policy role_permissions_admin on public.role_permissions for all to authenticated
using (public.is_admin()) with check (public.is_admin());
drop policy if exists user_roles_admin on public.user_roles;
create policy user_roles_admin on public.user_roles for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists documentos_storage_select on storage.objects;
create policy documentos_storage_select
on storage.objects for select to authenticated
using (
  bucket_id = 'documentos'
  and public.has_permission('storage', 'ver')
);

drop policy if exists documentos_storage_insert on storage.objects;
create policy documentos_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'documentos'
  and public.has_permission('storage', 'subir')
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists documentos_storage_update on storage.objects;
create policy documentos_storage_update
on storage.objects for update to authenticated
using (
  bucket_id = 'documentos'
  and owner_id = auth.uid()::text
  and public.has_permission('storage', 'subir')
)
with check (
  bucket_id = 'documentos'
  and owner_id = auth.uid()::text
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.has_permission('storage', 'subir')
);

drop policy if exists documentos_storage_delete on storage.objects;
create policy documentos_storage_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'documentos'
  and (
    (owner_id = auth.uid()::text and public.has_permission('storage', 'subir'))
    or public.has_permission('storage', 'eliminar')
    or public.is_admin()
  )
);

revoke all on function public.is_authenticated_user() from public, anon;
revoke all on function public.has_permission(text, text) from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.registrar_documento_seguro(
  text, uuid, date, uuid, uuid, uuid, uuid, text, text, text,
  uuid, uuid, text, text, numeric, uuid, uuid
) from public, anon;
revoke all on function public.obtener_dashboard_resumen() from public, anon;
revoke all on function public.audit_trigger() from public, anon, authenticated;
revoke all on function public.validate_documento() from public, anon, authenticated;

grant execute on function public.is_authenticated_user() to authenticated;
grant execute on function public.has_permission(text, text) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.registrar_documento_seguro(
  text, uuid, date, uuid, uuid, uuid, uuid, text, text, text,
  uuid, uuid, text, text, numeric, uuid, uuid
) to authenticated;
grant execute on function public.obtener_dashboard_resumen() to authenticated;

do $$
declare
  admin_email text := 'pillaca98@gmail.com';
  v_user_id uuid;
  v_role_id uuid;
begin
  select id into v_user_id from auth.users where lower(email) = lower(admin_email) limit 1;
  select id into v_role_id from public.roles where nombre = 'Administrador';

  if v_user_id is null then
    raise notice 'Crea primero el usuario % en Supabase Auth y vuelve a ejecutar este bloque.', admin_email;
  else
    insert into public.user_roles(user_id, role_id, activo)
    values (v_user_id, v_role_id, true)
    on conflict (user_id, role_id) do update
    set activo = true, updated_at = now();
  end if;
end $$;

commit;
