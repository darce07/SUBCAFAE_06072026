begin;

-- Los 4 estados originales (nuevo/usado buen estado/usado mal estado/mal
-- estado) no cubren el ciclo de vida real de un bien: falta poder marcarlo
-- en reparacion, prestado a otra area, dado de baja, o perdido/extraviado.

alter table public.inventario_items
  drop constraint if exists inventario_items_estado_check;
alter table public.inventario_items
  add constraint inventario_items_estado_check
  check (estado in (
    'nuevo', 'usado_buen_estado', 'usado_mal_estado', 'mal_estado',
    'en_reparacion', 'prestado', 'de_baja', 'perdido'
  ));

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

  if p_estado not in ('nuevo', 'usado_buen_estado', 'usado_mal_estado', 'mal_estado', 'en_reparacion', 'prestado', 'de_baja', 'perdido') then
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

  if p_estado not in ('nuevo', 'usado_buen_estado', 'usado_mal_estado', 'mal_estado', 'en_reparacion', 'prestado', 'de_baja', 'perdido') then
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

commit;
