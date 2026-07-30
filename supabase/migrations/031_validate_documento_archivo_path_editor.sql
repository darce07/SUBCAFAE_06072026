begin;

-- Bug real reportado por una usuaria (rol Registrador, sin ser la creadora
-- del documento): al editar un documento ajeno y reemplazar su archivo
-- digital, GUARDAR fallaba con "La ruta del archivo no pertenece al usuario
-- creador" y se perdían TODOS los cambios del formulario (título,
-- descripción, categoría, etc.), no solo el archivo, porque el UPDATE es
-- una sola sentencia atómica.
--
-- Causa: el trigger exigía que archivo_path empezara con el UUID de
-- created_by (quien creó el documento originalmente). Pero cuando alguien
-- distinto al creador reemplaza el archivo durante una edición, el nuevo
-- archivo_path queda prefijado con el UUID de QUIEN LO SUBE AHORA — así lo
-- exige la policy de Storage (documentos_storage_insert exige
-- (storage.foldername(name))[1] = auth.uid()::text), nunca con el del
-- creador original. El check comparaba contra el valor equivocado.
--
-- Fix: aceptar que archivo_path empiece con el UUID del creador original
-- O con el del usuario que está haciendo el UPDATE ahora mismo
-- (auth.uid()) — el único valor que Storage garantiza estructuralmente.
-- Resto del trigger sin cambios (ver 018_document_deletion_columns_lockdown.sql).

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

  if tg_op = 'UPDATE' and not old.activo and new.activo then
    if coalesce(current_setting('app.sigdaf_restore', true), '') <> 'on' then
      raise exception using errcode = '42501', message = 'La restauración debe realizarse mediante la función segura';
    end if;

    if not (
      public.is_admin()
      or public.has_permission('documentos', 'eliminar')
    ) then
      raise exception using errcode = '42501', message = 'No tienes permiso para restaurar documentos';
    end if;

    if new.eliminado_por is not null or new.eliminado_at is not null then
      raise exception using errcode = '42501', message = 'La restauración debe limpiar los campos de eliminación';
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE'
    and (
      new.eliminado_por is distinct from old.eliminado_por
      or new.eliminado_at is distinct from old.eliminado_at
    ) then
    raise exception using errcode = '42501', message = 'Los campos de eliminación solo pueden cambiar mediante las funciones seguras de baja o restauración';
  end if;

  if new.archivo_url is not null then
    raise exception using errcode = '22023', message = 'No se deben guardar URLs firmadas o públicas; use archivo_path';
  end if;

  if new.archivo_path is not null
    and new.archivo_path not like new.created_by::text || '/%'
    and new.archivo_path not like auth.uid()::text || '/%' then
    raise exception using errcode = '22023', message = 'La ruta del archivo no pertenece al usuario creador ni a quien la está subiendo';
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

commit;
