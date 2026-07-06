begin;

alter table public.entidades
  add column if not exists tipo_documento text,
  add column if not exists numero_documento text;

alter table public.entidades
  drop constraint if exists entidades_tipo_documento_check;

alter table public.entidades
  add constraint entidades_tipo_documento_check
  check (
    tipo_documento is null
    or tipo_documento in ('DNI', 'CE', 'PASAPORTE', 'RUC', 'OTRO')
  );

create unique index if not exists uq_entidades_documento_normalizado
on public.entidades (
  tipo_entidad_id,
  upper(tipo_documento),
  upper(regexp_replace(numero_documento, '[^A-Za-z0-9]', '', 'g'))
)
where tipo_documento is not null
  and numero_documento is not null
  and activo;

create index if not exists idx_entidades_nombre_trgm
on public.entidades using gin (nombre gin_trgm_ops);

create or replace function public.crear_o_obtener_entidad(
  p_tipo_entidad_id uuid,
  p_nombre text,
  p_tipo_documento text default null,
  p_numero_documento text default null
)
returns public.entidades
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entidad public.entidades;
  v_tipo_entidad text;
  v_nombre text := nullif(trim(p_nombre), '');
  v_tipo_documento text := upper(nullif(trim(coalesce(p_tipo_documento, '')), ''));
  v_numero_documento text := upper(nullif(regexp_replace(trim(coalesce(p_numero_documento, '')), '[^A-Za-z0-9]', '', 'g'), ''));
begin
  if not public.is_authenticated_user() then
    raise exception using errcode = '42501', message = 'Usuario no autenticado o inactivo';
  end if;

  if not (
    public.has_permission('documentos', 'crear')
    or public.has_permission('catalogos', 'crear')
  ) then
    raise exception using errcode = '42501', message = 'No tienes permiso para registrar entidades';
  end if;

  if p_tipo_entidad_id is null then
    raise exception using errcode = '22023', message = 'Selecciona el tipo de entidad';
  end if;

  if v_nombre is null or length(v_nombre) < 3 then
    raise exception using errcode = '22023', message = 'El nombre de la entidad debe tener al menos 3 caracteres';
  end if;

  select nombre into v_tipo_entidad
  from public.catalogo_tipo_entidad
  where id = p_tipo_entidad_id
    and activo;

  if v_tipo_entidad is null then
    raise exception using errcode = '23503', message = 'El tipo de entidad no existe o está inactivo';
  end if;

  if v_tipo_documento is not null
    and v_tipo_documento not in ('DNI', 'CE', 'PASAPORTE', 'RUC', 'OTRO') then
    raise exception using errcode = '22023', message = 'Tipo de documento no válido';
  end if;

  if v_tipo_entidad in ('Persona Natural', 'Proveedor', 'Trabajador') then
    if v_tipo_documento is null then
      raise exception using errcode = '22023', message = 'Selecciona el tipo de documento de la entidad';
    end if;
    if v_numero_documento is null or length(v_numero_documento) < 6 then
      raise exception using errcode = '22023', message = 'Ingresa un número de documento válido';
    end if;
  end if;

  if v_tipo_documento is not null and v_numero_documento is null then
    raise exception using errcode = '22023', message = 'Ingresa el número de documento';
  end if;

  if v_tipo_documento = 'DNI' and v_numero_documento !~ '^[0-9]{8}$' then
    raise exception using errcode = '22023', message = 'El DNI debe contener 8 dígitos';
  end if;

  if v_tipo_documento = 'RUC' and v_numero_documento !~ '^[0-9]{11}$' then
    raise exception using errcode = '22023', message = 'El RUC debe contener 11 dígitos';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_tipo_entidad_id::text || ':' || lower(v_nombre), 0)
  );

  if v_tipo_documento is not null then
    select * into v_entidad
    from public.entidades
    where tipo_entidad_id = p_tipo_entidad_id
      and upper(tipo_documento) = v_tipo_documento
      and upper(regexp_replace(numero_documento, '[^A-Za-z0-9]', '', 'g')) = v_numero_documento
      and activo
    limit 1;

    if found then
      return v_entidad;
    end if;
  end if;

  select * into v_entidad
  from public.entidades
  where tipo_entidad_id = p_tipo_entidad_id
    and lower(trim(nombre)) = lower(v_nombre)
    and activo
  limit 1;

  if found then
    if v_entidad.tipo_documento is null and v_tipo_documento is not null then
      update public.entidades
      set tipo_documento = v_tipo_documento,
          numero_documento = v_numero_documento
      where id = v_entidad.id
      returning * into v_entidad;
    end if;
    return v_entidad;
  end if;

  insert into public.entidades(
    tipo_entidad_id,
    nombre,
    tipo_documento,
    numero_documento,
    activo
  )
  values (
    p_tipo_entidad_id,
    v_nombre,
    v_tipo_documento,
    v_numero_documento,
    true
  )
  returning * into v_entidad;

  return v_entidad;
exception
  when unique_violation then
    select * into v_entidad
    from public.entidades
    where tipo_entidad_id = p_tipo_entidad_id
      and (
        (
          v_tipo_documento is not null
          and upper(tipo_documento) = v_tipo_documento
          and upper(regexp_replace(numero_documento, '[^A-Za-z0-9]', '', 'g')) = v_numero_documento
        )
        or lower(trim(nombre)) = lower(v_nombre)
      )
      and activo
    order by created_at
    limit 1;

    if v_entidad.id is null then
      raise;
    end if;
    return v_entidad;
end;
$$;

revoke all on function public.crear_o_obtener_entidad(uuid, text, text, text) from public, anon;
grant execute on function public.crear_o_obtener_entidad(uuid, text, text, text) to authenticated;

commit;
