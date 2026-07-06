begin;

alter table public.documentos
  add column if not exists eliminado_at timestamptz,
  add column if not exists eliminado_por uuid references auth.users(id);

insert into public.permissions(modulo, accion)
values
  ('documentos', 'cambiar_fecha'),
  ('documentos', 'eliminar')
on conflict (modulo, accion) do nothing;

insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p
  on p.modulo = 'documentos'
 and p.accion in ('cambiar_fecha', 'eliminar')
where r.nombre = 'Administrador'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions(role_id, permission_id)
select legacy.role_id, delete_permission.id
from public.role_permissions legacy
join public.permissions legacy_permission
  on legacy_permission.id = legacy.permission_id
 and legacy_permission.modulo = 'documentos'
 and legacy_permission.accion = 'desactivar'
cross join public.permissions delete_permission
where delete_permission.modulo = 'documentos'
  and delete_permission.accion = 'eliminar'
on conflict (role_id, permission_id) do nothing;

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
  if tg_op = 'UPDATE' and old.activo and not new.activo then
    if coalesce(current_setting('app.sigdaf_soft_delete', true), '') <> 'on' then
      raise exception using errcode = '42501', message = 'La eliminación debe realizarse mediante la función segura';
    end if;

    if not (
      public.is_admin()
      or public.has_permission('documentos', 'eliminar')
    ) then
      raise exception using errcode = '42501', message = 'No tienes permiso para eliminar documentos';
    end if;

    if new.eliminado_por is distinct from auth.uid()
      or new.eliminado_at is null then
      raise exception using errcode = '42501', message = 'La baja lógica no contiene una identidad de auditoría válida';
    end if;

    return new;
  end if;

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

    if new.fecha_documento is distinct from old.fecha_documento
      and not (
        public.is_admin()
        or public.has_permission('documentos', 'cambiar_fecha')
      ) then
      raise exception using errcode = '42501', message = 'No tienes permiso para cambiar la fecha del documento';
    end if;

    if not (
      public.is_admin()
      or public.has_permission('documentos', 'editar')
    ) then
      raise exception using errcode = '42501', message = 'No tienes permiso para editar documentos';
    end if;
  end if;

  return new;
end;
$$;

drop policy if exists documentos_update on public.documentos;
create policy documentos_update
on public.documentos for update to authenticated
using (
  activo
  and (
    public.has_permission('documentos', 'editar')
    or public.has_permission('documentos', 'cambiar_fecha')
    or public.has_permission('documentos', 'eliminar')
  )
)
with check (
  public.has_permission('documentos', 'editar')
  or public.has_permission('documentos', 'cambiar_fecha')
  or public.has_permission('documentos', 'eliminar')
);

create or replace function public.editar_documento_seguro_v2(
  p_documento_id uuid,
  p_fecha_documento date,
  p_categoria_id uuid,
  p_tipo_entidad_id uuid,
  p_entidad_id uuid,
  p_tipo_categoria_id uuid,
  p_estado_id uuid,
  p_titulo text,
  p_descripcion text,
  p_ruta_historica text,
  p_archivador_id uuid,
  p_archivo_path text,
  p_extension text,
  p_monto numeric,
  p_tipo_movimiento_id uuid,
  p_tipo_operacion_id uuid
)
returns public.documentos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_documento public.documentos;
  v_fecha_actual date;
begin
  if not public.is_authenticated_user() then
    raise exception using errcode = '42501', message = 'Usuario no autenticado o inactivo';
  end if;

  if not public.has_permission('documentos', 'editar') then
    raise exception using errcode = '42501', message = 'No tienes permiso para editar documentos';
  end if;

  select fecha_documento into v_fecha_actual
  from public.documentos
  where id = p_documento_id
    and activo;

  if v_fecha_actual is null then
    raise exception using errcode = 'P0002', message = 'Documento no encontrado o inactivo';
  end if;

  if p_fecha_documento is null then
    raise exception using errcode = '22023', message = 'La fecha del documento es obligatoria';
  end if;

  if p_fecha_documento is distinct from v_fecha_actual
    and not public.has_permission('documentos', 'cambiar_fecha') then
    raise exception using errcode = '42501', message = 'No tienes permiso para cambiar la fecha del documento';
  end if;

  update public.documentos
  set fecha_documento = p_fecha_documento,
      categoria_id = p_categoria_id,
      tipo_entidad_id = p_tipo_entidad_id,
      entidad_id = p_entidad_id,
      tipo_categoria_id = p_tipo_categoria_id,
      estado_id = p_estado_id,
      titulo = trim(p_titulo),
      descripcion = nullif(trim(coalesce(p_descripcion, '')), ''),
      ruta_historica = nullif(trim(coalesce(p_ruta_historica, '')), ''),
      archivador_id = p_archivador_id,
      archivo_path = nullif(trim(coalesce(p_archivo_path, '')), ''),
      archivo_url = null,
      extension = lower(nullif(trim(coalesce(p_extension, '')), '')),
      monto = coalesce(p_monto, 0),
      tipo_movimiento_id = p_tipo_movimiento_id,
      tipo_operacion_id = p_tipo_operacion_id
  where id = p_documento_id
    and activo
  returning * into v_documento;

  return v_documento;
end;
$$;

create or replace function public.eliminar_documento_seguro(p_documento_id uuid)
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
    or public.has_permission('documentos', 'eliminar')
  ) then
    raise exception using errcode = '42501', message = 'No tienes permiso para eliminar documentos';
  end if;

  perform set_config('app.sigdaf_soft_delete', 'on', true);

  update public.documentos
  set activo = false,
      eliminado_at = now(),
      eliminado_por = auth.uid()
  where id = p_documento_id
    and activo;

  if not found then
    raise exception using errcode = 'P0002', message = 'Documento no encontrado o ya eliminado';
  end if;
end;
$$;

revoke all on function public.editar_documento_seguro_v2(
  uuid, date, uuid, uuid, uuid, uuid, uuid, text, text, text, uuid, text, text, numeric, uuid, uuid
) from public, anon;
grant execute on function public.editar_documento_seguro_v2(
  uuid, date, uuid, uuid, uuid, uuid, uuid, text, text, text, uuid, text, text, numeric, uuid, uuid
) to authenticated;

revoke all on function public.eliminar_documento_seguro(uuid) from public, anon;
grant execute on function public.eliminar_documento_seguro(uuid) to authenticated;

revoke all on function public.validate_documento() from public, anon, authenticated;

commit;
