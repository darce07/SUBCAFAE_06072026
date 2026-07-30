begin;

-- Segundo bug real de la misma sesión de soporte (misma usuaria, Lizbeth
-- Arias): tras el fix de archivo_path (031), GUARDAR seguía fallando, ahora
-- con "La entidad no corresponde al tipo de entidad seleccionado" — visible
-- gracias al fix de mensajes de error (src/lib/supabase-error.ts) que dejó
-- de esconder la causa real detrás de un genérico.
--
-- Causa: el trigger compara documentos.tipo_entidad_id (guardado en la fila)
-- contra entidades.tipo_entidad_id (el tipo real de la entidad AHORA) en
-- cada UPDATE, sin importar qué se esté editando. Si en algún momento se
-- desincronizaron — la entidad cambió de tipo después de crear el
-- documento, o quedó guardada distinto desde el inicio — cualquier edición
-- futura de ese documento queda bloqueada para siempre, aunque el usuario
-- no toque ni la entidad ni su tipo.
--
-- Fix: solo exigir que coincidan cuando el UPDATE realmente cambia
-- entidad_id o tipo_entidad_id (o es un INSERT nuevo). Mismo patrón que
-- v_only_fecha_changed más abajo: no relitigar datos históricos que el
-- usuario actual no está tocando. La verificación de que la entidad exista
-- y esté activa se mantiene siempre.

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

    if new.tipo_entidad_id is not null
      and v_entidad_tipo is distinct from new.tipo_entidad_id
      and (
        tg_op = 'INSERT'
        or new.entidad_id is distinct from old.entidad_id
        or new.tipo_entidad_id is distinct from old.tipo_entidad_id
      ) then
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
