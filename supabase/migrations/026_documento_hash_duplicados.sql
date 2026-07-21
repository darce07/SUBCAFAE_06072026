begin;

-- El formulario "Nuevo documento" no detectaba si el mismo archivo ya había
-- sido registrado (ej. usuario recarga la página, recupera un borrador y
-- vuelve a adjuntar/guardar el mismo PDF). Se agrega un hash SHA-256 del
-- archivo, calculado en el cliente, para poder avisar de posibles
-- duplicados antes de guardar.

alter table public.documentos add column if not exists archivo_hash text
  check (archivo_hash is null or archivo_hash ~ '^[0-9a-f]{64}$');

create index if not exists documentos_archivo_hash_idx
  on public.documentos (archivo_hash)
  where archivo_hash is not null and activo and eliminado_at is null;

create or replace function public.buscar_documentos_por_hash(p_archivo_hash text)
returns table (
  id uuid,
  codigo_documento text,
  titulo text,
  fecha_documento date,
  created_at timestamptz,
  creador_nombre text
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.codigo_documento, d.titulo, d.fecha_documento, d.created_at,
    p.nombre_completo
  from public.documentos d
  left join public.profiles p on p.id = d.created_by
  where public.has_permission('documentos', 'ver')
    and d.activo
    and d.eliminado_at is null
    and d.archivo_hash = lower(trim(p_archivo_hash))
  order by d.created_at desc
  limit 5;
$$;

revoke all on function public.buscar_documentos_por_hash(text) from public;
grant execute on function public.buscar_documentos_por_hash(text) to authenticated;

-- registrar_documento_seguro gana el parámetro opcional p_archivo_hash;
-- se agrega al final para no romper la firma existente (RPC posicional).
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
  p_archivo_hash text default null
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

  v_codigo := 'DOC-' || extract(year from p_fecha_documento)::integer || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.documentos (
    codigo_documento, categoria_id, fecha_documento, tipo_entidad_id,
    entidad_id, tipo_categoria_id, estado_id, titulo, descripcion,
    ruta_historica, estructura_historica_id, archivador_id, archivo_path,
    archivo_url, extension, monto, tipo_movimiento_id, tipo_operacion_id,
    idempotency_key, archivo_hash, created_by
  )
  values (
    v_codigo, p_categoria_id, p_fecha_documento, p_tipo_entidad_id,
    p_entidad_id, p_tipo_categoria_id, p_estado_id, trim(p_titulo),
    nullif(trim(coalesce(p_descripcion, '')), ''),
    nullif(trim(coalesce(p_ruta_historica, '')), ''),
    p_estructura_historica_id, p_archivador_id, trim(p_archivo_path),
    null, lower(nullif(trim(coalesce(p_extension, '')), '')),
    coalesce(p_monto, 0), p_tipo_movimiento_id, p_tipo_operacion_id,
    trim(p_idempotency_key), v_hash, auth.uid()
  )
  returning * into v_documento;

  return v_documento;
end;
$$;

commit;
