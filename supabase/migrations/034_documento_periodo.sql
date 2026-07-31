begin;

-- "Periodo" es el mes/año al que se refiere el CONTENIDO del documento
-- (ej. el mes facturado en un recibo), distinto de fecha_documento (la
-- fecha del propio documento). No todos los documentos lo tienen, por eso
-- es nullable e independiente de las columnas generadas anio/mes/dia.
alter table public.documentos
  add column if not exists periodo_mes integer,
  add column if not exists periodo_anio integer;

alter table public.documentos
  drop constraint if exists documentos_periodo_check;
alter table public.documentos
  add constraint documentos_periodo_check check (
    (periodo_mes is null and periodo_anio is null)
    or (
      periodo_mes is not null and periodo_anio is not null
      and periodo_mes between 1 and 12
      and periodo_anio between 2000 and 2100
    )
  );

-- Agregar parametros nuevos con "create or replace" SIN dropear la firma
-- vieja crea una funcion sobrecargada (Postgres permite dos funciones con
-- el mismo nombre y distinta lista de parametros), lo que deja a PostgREST
-- con una llamada ambigua. Se dropean explicitamente ambas firmas previas
-- conocidas de registrar_documento_seguro (la original de
-- 001_sigdaf_complete.sql y la de 026_documento_hash_duplicados.sql, que
-- agrego p_archivo_hash sin dropear la anterior) antes de recrear.
drop function if exists public.registrar_documento_seguro(
  text, uuid, date, uuid, uuid, uuid, uuid, text, text, text,
  uuid, uuid, text, text, numeric, uuid, uuid
);
drop function if exists public.registrar_documento_seguro(
  text, uuid, date, uuid, uuid, uuid, uuid, text, text, text,
  uuid, uuid, text, text, numeric, uuid, uuid, text
);

-- registrar_documento_seguro gana p_periodo_mes/p_periodo_anio, agregados al
-- final para no romper la firma existente (mismo criterio que p_archivo_hash
-- en 026_documento_hash_duplicados.sql).
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
  p_tipo_operacion_id uuid default null,
  p_archivo_hash text default null,
  p_periodo_mes integer default null,
  p_periodo_anio integer default null
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
  v_hash text;
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

  v_hash := nullif(lower(trim(coalesce(p_archivo_hash, ''))), '');
  if v_hash is not null and v_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'archivo_hash inválido';
  end if;

  if (p_periodo_mes is null) is distinct from (p_periodo_anio is null) then
    raise exception using errcode = '22023', message = 'El periodo requiere mes y año, o ninguno de los dos';
  end if;

  if p_periodo_mes is not null and (p_periodo_mes < 1 or p_periodo_mes > 12) then
    raise exception using errcode = '22023', message = 'El mes del periodo es inválido';
  end if;

  v_codigo := 'DOC-' || extract(year from p_fecha_documento)::integer || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.documentos (
    codigo_documento, categoria_id, fecha_documento, tipo_entidad_id,
    entidad_id, tipo_categoria_id, estado_id, titulo, descripcion,
    ruta_historica, estructura_historica_id, archivador_id, archivo_path,
    archivo_url, extension, monto, tipo_movimiento_id, tipo_operacion_id,
    idempotency_key, archivo_hash, periodo_mes, periodo_anio, created_by
  )
  values (
    v_codigo, p_categoria_id, p_fecha_documento, p_tipo_entidad_id,
    p_entidad_id, p_tipo_categoria_id, p_estado_id, trim(p_titulo),
    nullif(trim(coalesce(p_descripcion, '')), ''),
    nullif(trim(coalesce(p_ruta_historica, '')), ''),
    p_estructura_historica_id, p_archivador_id, trim(p_archivo_path),
    null, lower(nullif(trim(coalesce(p_extension, '')), '')),
    coalesce(p_monto, 0), p_tipo_movimiento_id, p_tipo_operacion_id,
    trim(p_idempotency_key), v_hash, p_periodo_mes, p_periodo_anio, auth.uid()
  )
  returning * into v_documento;

  return v_documento;
end;
$$;

-- Mismo motivo que arriba: dropear la firma vieja de editar_documento_seguro_v2
-- (16 parametros, de 005_document_date_and_soft_delete.sql) antes de recrear
-- con 18, para no dejar dos overloads.
drop function if exists public.editar_documento_seguro_v2(
  uuid, date, uuid, uuid, uuid, uuid, uuid, text, text, text, uuid, text, text, numeric, uuid, uuid
);

-- editar_documento_seguro_v2 gana p_periodo_mes/p_periodo_anio, tambien al
-- final por el mismo criterio de compatibilidad posicional.
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
  p_tipo_operacion_id uuid,
  p_periodo_mes integer default null,
  p_periodo_anio integer default null
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

  if (p_periodo_mes is null) is distinct from (p_periodo_anio is null) then
    raise exception using errcode = '22023', message = 'El periodo requiere mes y año, o ninguno de los dos';
  end if;

  if p_periodo_mes is not null and (p_periodo_mes < 1 or p_periodo_mes > 12) then
    raise exception using errcode = '22023', message = 'El mes del periodo es inválido';
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
      tipo_operacion_id = p_tipo_operacion_id,
      periodo_mes = p_periodo_mes,
      periodo_anio = p_periodo_anio
  where id = p_documento_id
    and activo
  returning * into v_documento;

  return v_documento;
end;
$$;

revoke all on function public.registrar_documento_seguro(
  text, uuid, date, uuid, uuid, uuid, uuid, text, text, text,
  uuid, uuid, text, text, numeric, uuid, uuid, text, integer, integer
) from public, anon;
grant execute on function public.registrar_documento_seguro(
  text, uuid, date, uuid, uuid, uuid, uuid, text, text, text,
  uuid, uuid, text, text, numeric, uuid, uuid, text, integer, integer
) to authenticated;

revoke all on function public.editar_documento_seguro_v2(
  uuid, date, uuid, uuid, uuid, uuid, uuid, text, text, text, uuid, text, text, numeric, uuid, uuid, integer, integer
) from public, anon;
grant execute on function public.editar_documento_seguro_v2(
  uuid, date, uuid, uuid, uuid, uuid, uuid, text, text, text, uuid, text, text, numeric, uuid, uuid, integer, integer
) to authenticated;

commit;
