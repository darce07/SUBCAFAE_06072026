begin;

-- Repara un permiso muerto: un rol con SOLO `documentos:cambiar_fecha` (sin
-- `documentos:editar`) pasa la política RLS de UPDATE, pero el trigger
-- validate_documento() exigía incondicionalmente `editar` para cualquier
-- UPDATE que no fuera la baja lógica (activo -> false). En la práctica ese
-- rol nunca podía guardar nada, ni siquiera un cambio de fecha aislado.
-- Este fix hace que el requisito de `editar` se salte únicamente cuando el
-- ÚNICO campo modificado es fecha_documento y el usuario ya pasó la
-- validación específica de `cambiar_fecha` unas líneas arriba.
create or replace function public.validate_documento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_movimiento text;
  v_entidad_tipo uuid;
  v_only_fecha_changed boolean;
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

    v_only_fecha_changed :=
      new.fecha_documento is distinct from old.fecha_documento
      and new.categoria_id is not distinct from old.categoria_id
      and new.estado_id is not distinct from old.estado_id
      and new.entidad_id is not distinct from old.entidad_id
      and new.tipo_entidad_id is not distinct from old.tipo_entidad_id
      and new.tipo_categoria_id is not distinct from old.tipo_categoria_id
      and new.titulo is not distinct from old.titulo
      and new.descripcion is not distinct from old.descripcion
      and new.ruta_historica is not distinct from old.ruta_historica
      and new.archivador_id is not distinct from old.archivador_id
      and new.archivo_path is not distinct from old.archivo_path
      and new.extension is not distinct from old.extension
      and new.monto is not distinct from old.monto
      and new.tipo_movimiento_id is not distinct from old.tipo_movimiento_id
      and new.tipo_operacion_id is not distinct from old.tipo_operacion_id;

    if not (
      public.is_admin()
      or public.has_permission('documentos', 'editar')
      or (v_only_fecha_changed and public.has_permission('documentos', 'cambiar_fecha'))
    ) then
      raise exception using errcode = '42501', message = 'No tienes permiso para editar documentos';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_documento() from public, anon, authenticated;

-- Repara la falta de índices trigram para la búsqueda libre de
-- obtener_auditoria_paginada() (migración 011), que hace ILIKE '%term%'
-- sobre auditoria.tabla y profiles.nombre_completo/email sin ningún índice
-- que lo soporte — a diferencia de documentos, que ya tiene GIN trigram en
-- sus columnas de búsqueda desde las migraciones 001/003/004/013.
create extension if not exists pg_trgm;

create index if not exists idx_auditoria_tabla_trgm
on public.auditoria using gin (tabla gin_trgm_ops);

create index if not exists idx_profiles_nombre_completo_trgm
on public.profiles using gin (nombre_completo gin_trgm_ops);

create index if not exists idx_profiles_email_trgm
on public.profiles using gin (email gin_trgm_ops);

commit;
