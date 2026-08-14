begin;

-- Módulo nuevo, aislado del resto de SIGDAF: "Inventariado Interno" para el
-- inventario físico de bienes/muebles (mesas, sillas, refrigeradoras, etc.).
-- No comparte tablas ni catálogos con `documentos` / `catalogos`. Cada ítem
-- tiene un código de barras correlativo (generado en el servidor) para uso
-- interno, y un token QR opaco separado para la vista pública de invitado
-- (que nunca expone el código de barras ni el id real).

insert into public.permissions (modulo, accion)
values
  ('inventario', 'ver'),
  ('inventario', 'crear'),
  ('inventario', 'editar'),
  ('inventario', 'eliminar')
on conflict (modulo, accion) do nothing;

-- No se asigna automáticamente a ningún rol existente (salvo el bypass de
-- administrador vía has_permission/is_admin, ver 030). Un administrador
-- habilita el módulo a los roles que corresponda desde Roles y permisos.

create table public.inventario_areas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(nombre)) >= 2)
);

create sequence public.inventario_items_codigo_seq;

create table public.inventario_items (
  id uuid primary key default gen_random_uuid(),
  codigo_barras text not null unique,
  qr_token uuid not null unique default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  color text,
  cantidad integer not null default 1 check (cantidad > 0),
  estado text not null check (estado in ('nuevo', 'usado_buen_estado', 'usado_mal_estado', 'mal_estado')),
  area_id uuid references public.inventario_areas(id),
  activo boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(nombre)) >= 2)
);

create index inventario_items_area_idx on public.inventario_items(area_id);
create index inventario_items_activo_idx on public.inventario_items(activo);
create index inventario_items_qr_token_idx on public.inventario_items(qr_token);

create table public.inventario_fotos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventario_items(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index inventario_fotos_item_idx on public.inventario_fotos(item_id);

drop trigger if exists trg_inventario_areas_updated_at on public.inventario_areas;
create trigger trg_inventario_areas_updated_at
before update on public.inventario_areas
for each row execute function public.set_updated_at();

drop trigger if exists trg_inventario_items_updated_at on public.inventario_items;
create trigger trg_inventario_items_updated_at
before update on public.inventario_items
for each row execute function public.set_updated_at();

alter table public.inventario_areas enable row level security;
alter table public.inventario_items enable row level security;
alter table public.inventario_fotos enable row level security;

-- inventario_areas: catálogo simple, escritura directa desde el cliente
-- (no hay generación de valores en servidor que proteger).
revoke all on public.inventario_areas from public, anon;
grant select, insert, update on public.inventario_areas to authenticated;

drop policy if exists inventario_areas_select on public.inventario_areas;
create policy inventario_areas_select
on public.inventario_areas for select to authenticated
using (public.has_permission('inventario', 'ver'));

drop policy if exists inventario_areas_insert on public.inventario_areas;
create policy inventario_areas_insert
on public.inventario_areas for insert to authenticated
with check (public.has_permission('inventario', 'crear'));

drop policy if exists inventario_areas_update on public.inventario_areas;
create policy inventario_areas_update
on public.inventario_areas for update to authenticated
using (public.has_permission('inventario', 'editar'))
with check (public.has_permission('inventario', 'editar'));

-- inventario_items: el código de barras se genera solo en el servidor (ver
-- crear_item_inventario), por lo que la creación y edición pasan únicamente
-- por RPCs security definer. El cliente autenticado solo puede leer.
revoke all on public.inventario_items from public, anon;
grant select on public.inventario_items to authenticated;

drop policy if exists inventario_items_select on public.inventario_items;
create policy inventario_items_select
on public.inventario_items for select to authenticated
using (public.has_permission('inventario', 'ver'));

-- inventario_fotos: las fotos se suben directo a Storage desde el cliente y
-- la fila que las referencia se inserta directo (no requiere generación en
-- servidor), así que sí tiene policies de insert/delete además de select.
revoke all on public.inventario_fotos from public, anon;
grant select, insert, delete on public.inventario_fotos to authenticated;

drop policy if exists inventario_fotos_select on public.inventario_fotos;
create policy inventario_fotos_select
on public.inventario_fotos for select to authenticated
using (public.has_permission('inventario', 'ver'));

drop policy if exists inventario_fotos_insert on public.inventario_fotos;
create policy inventario_fotos_insert
on public.inventario_fotos for insert to authenticated
with check (
  public.has_permission('inventario', 'crear')
  or public.has_permission('inventario', 'editar')
);

drop policy if exists inventario_fotos_delete on public.inventario_fotos;
create policy inventario_fotos_delete
on public.inventario_fotos for delete to authenticated
using (
  public.has_permission('inventario', 'crear')
  or public.has_permission('inventario', 'editar')
);

-- crear_item_inventario: genera el código de barras correlativo desde la
-- secuencia (nunca provisto por el cliente) y crea el ítem.
create or replace function public.crear_item_inventario(
  p_nombre text,
  p_descripcion text,
  p_color text,
  p_cantidad integer,
  p_estado text,
  p_area_id uuid
)
returns public.inventario_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.inventario_items;
  v_codigo text;
begin
  if not public.is_authenticated_user() then
    raise exception using errcode = '42501', message = 'Usuario no autenticado o inactivo';
  end if;

  if not public.has_permission('inventario', 'crear') then
    raise exception using errcode = '42501', message = 'No tienes permiso para crear ítems de inventario';
  end if;

  if length(trim(coalesce(p_nombre, ''))) < 2 then
    raise exception using errcode = '22023', message = 'El nombre del ítem es obligatorio';
  end if;

  if p_estado not in ('nuevo', 'usado_buen_estado', 'usado_mal_estado', 'mal_estado') then
    raise exception using errcode = '22023', message = 'El estado del ítem no es válido';
  end if;

  if coalesce(p_cantidad, 0) <= 0 then
    raise exception using errcode = '22023', message = 'La cantidad debe ser mayor a cero';
  end if;

  if p_area_id is not null and not exists (select 1 from public.inventario_areas where id = p_area_id) then
    raise exception using errcode = '23503', message = 'El área seleccionada no existe';
  end if;

  v_codigo := 'INV-' || lpad(nextval('public.inventario_items_codigo_seq')::text, 6, '0');

  insert into public.inventario_items (
    codigo_barras, nombre, descripcion, color, cantidad, estado, area_id, created_by
  )
  values (
    v_codigo,
    trim(p_nombre),
    nullif(trim(coalesce(p_descripcion, '')), ''),
    nullif(trim(coalesce(p_color, '')), ''),
    p_cantidad,
    p_estado,
    p_area_id,
    auth.uid()
  )
  returning * into v_item;

  return v_item;
end;
$$;

-- actualizar_item_inventario: edita los campos editables; el código de
-- barras y el qr_token nunca cambian.
create or replace function public.actualizar_item_inventario(
  p_item_id uuid,
  p_nombre text,
  p_descripcion text,
  p_color text,
  p_cantidad integer,
  p_estado text,
  p_area_id uuid,
  p_activo boolean
)
returns public.inventario_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.inventario_items;
begin
  if not public.is_authenticated_user() then
    raise exception using errcode = '42501', message = 'Usuario no autenticado o inactivo';
  end if;

  if not public.has_permission('inventario', 'editar') then
    raise exception using errcode = '42501', message = 'No tienes permiso para editar ítems de inventario';
  end if;

  if length(trim(coalesce(p_nombre, ''))) < 2 then
    raise exception using errcode = '22023', message = 'El nombre del ítem es obligatorio';
  end if;

  if p_estado not in ('nuevo', 'usado_buen_estado', 'usado_mal_estado', 'mal_estado') then
    raise exception using errcode = '22023', message = 'El estado del ítem no es válido';
  end if;

  if coalesce(p_cantidad, 0) <= 0 then
    raise exception using errcode = '22023', message = 'La cantidad debe ser mayor a cero';
  end if;

  if p_area_id is not null and not exists (select 1 from public.inventario_areas where id = p_area_id) then
    raise exception using errcode = '23503', message = 'El área seleccionada no existe';
  end if;

  update public.inventario_items
  set nombre = trim(p_nombre),
      descripcion = nullif(trim(coalesce(p_descripcion, '')), ''),
      color = nullif(trim(coalesce(p_color, '')), ''),
      cantidad = p_cantidad,
      estado = p_estado,
      area_id = p_area_id,
      activo = coalesce(p_activo, activo)
  where id = p_item_id
  returning * into v_item;

  if not found then
    raise exception using errcode = 'P0002', message = 'Ítem de inventario no encontrado';
  end if;

  return v_item;
end;
$$;

-- buscar_item_por_codigo_barras: usado por el escáner en la app para saltar
-- directo al ítem tras leer su código Code128.
create or replace function public.buscar_item_por_codigo_barras(p_codigo_barras text)
returns public.inventario_items
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_item public.inventario_items;
begin
  if not public.is_authenticated_user() then
    raise exception using errcode = '42501', message = 'Usuario no autenticado o inactivo';
  end if;

  if not public.has_permission('inventario', 'ver') then
    raise exception using errcode = '42501', message = 'No tienes permiso para consultar el inventario';
  end if;

  select * into v_item
  from public.inventario_items
  where codigo_barras = trim(p_codigo_barras);

  return v_item;
end;
$$;

-- obtener_item_inventario_publico: la única función de este módulo llamable
-- sin sesión (rol anon), vía el token QR opaco. Nunca expone id, código de
-- barras ni created_by.
create or replace function public.obtener_item_inventario_publico(p_qr_token uuid)
returns table (
  nombre text,
  descripcion text,
  color text,
  estado text,
  area_nombre text,
  cantidad integer,
  fotos text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.nombre,
    i.descripcion,
    i.color,
    i.estado,
    a.nombre as area_nombre,
    i.cantidad,
    coalesce(
      (select array_agg(f.storage_path order by f.created_at) from public.inventario_fotos f where f.item_id = i.id),
      array[]::text[]
    ) as fotos
  from public.inventario_items i
  left join public.inventario_areas a on a.id = i.area_id
  where i.qr_token = p_qr_token
    and i.activo;
$$;

revoke all on function public.crear_item_inventario(text, text, text, integer, text, uuid) from public, anon;
grant execute on function public.crear_item_inventario(text, text, text, integer, text, uuid) to authenticated;

revoke all on function public.actualizar_item_inventario(uuid, text, text, text, integer, text, uuid, boolean) from public, anon;
grant execute on function public.actualizar_item_inventario(uuid, text, text, text, integer, text, uuid, boolean) to authenticated;

revoke all on function public.buscar_item_por_codigo_barras(text) from public, anon;
grant execute on function public.buscar_item_por_codigo_barras(text) to authenticated;

-- Única función de todo el módulo abierta a anon: la consulta pública por QR.
revoke all on function public.obtener_item_inventario_publico(uuid) from public;
grant execute on function public.obtener_item_inventario_publico(uuid) to anon, authenticated;

-- Bucket de fotos: lectura pública (la vista de invitado por QR debe mostrar
-- fotos sin sesión), escritura restringida a usuarios autenticados con
-- permiso de crear/editar inventario. Convención de ruta: {item_id}/{archivo}.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inventario-fotos',
  'inventario-fotos',
  true,
  8388608, -- 8 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists inventario_fotos_storage_select on storage.objects;
create policy inventario_fotos_storage_select
on storage.objects for select to anon, authenticated
using (bucket_id = 'inventario-fotos');

drop policy if exists inventario_fotos_storage_insert on storage.objects;
create policy inventario_fotos_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'inventario-fotos'
  and (
    public.has_permission('inventario', 'crear')
    or public.has_permission('inventario', 'editar')
  )
  and exists (
    select 1 from public.inventario_items i
    where i.id::text = (storage.foldername(name))[1]
  )
);

drop policy if exists inventario_fotos_storage_update on storage.objects;
create policy inventario_fotos_storage_update
on storage.objects for update to authenticated
using (
  bucket_id = 'inventario-fotos'
  and (
    public.has_permission('inventario', 'crear')
    or public.has_permission('inventario', 'editar')
  )
)
with check (
  bucket_id = 'inventario-fotos'
  and (
    public.has_permission('inventario', 'crear')
    or public.has_permission('inventario', 'editar')
  )
);

drop policy if exists inventario_fotos_storage_delete on storage.objects;
create policy inventario_fotos_storage_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'inventario-fotos'
  and (
    public.has_permission('inventario', 'crear')
    or public.has_permission('inventario', 'editar')
  )
);

commit;
