begin;

alter table public.personal_natural
  add column if not exists cargo text;

create or replace function public.crear_o_obtener_personal_natural(
  p_nombre text,
  p_dni text default null,
  p_ruc text default null,
  p_fecha_nacimiento date default null,
  p_cargo text default null
)
returns public.personal_natural
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_persona public.personal_natural;
  v_nombre text := nullif(trim(p_nombre), '');
  v_dni text := nullif(trim(coalesce(p_dni, '')), '');
  v_ruc text := nullif(trim(coalesce(p_ruc, '')), '');
  v_cargo text := nullif(trim(coalesce(p_cargo, '')), '');
begin
  if not (
    public.has_permission('documentos', 'crear')
    or public.has_permission('catalogos', 'crear')
  ) then
    raise exception using errcode = '42501', message = 'No tienes permiso para registrar firmantes';
  end if;

  if v_nombre is null or length(v_nombre) < 3 then
    raise exception using errcode = '22023', message = 'El nombre del firmante debe tener al menos 3 caracteres';
  end if;

  if v_dni is not null and v_dni !~ '^[0-9]{8}$' then
    raise exception using errcode = '22023', message = 'El DNI debe contener 8 dígitos';
  end if;

  if v_ruc is not null and v_ruc !~ '^[0-9]{11}$' then
    raise exception using errcode = '22023', message = 'El RUC debe contener 11 dígitos';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('personal_natural:' || lower(v_nombre), 0));

  if v_dni is not null then
    select * into v_persona from public.personal_natural where dni = v_dni and activo limit 1;
    if found then
      if v_cargo is not null and v_persona.cargo is null then
        update public.personal_natural set cargo = v_cargo where id = v_persona.id returning * into v_persona;
      end if;
      return v_persona;
    end if;
  end if;

  select * into v_persona
  from public.personal_natural
  where lower(trim(nombre)) = lower(v_nombre) and activo
  limit 1;

  if found then
    if v_cargo is not null and v_persona.cargo is null then
      update public.personal_natural set cargo = v_cargo where id = v_persona.id returning * into v_persona;
    end if;
    return v_persona;
  end if;

  insert into public.personal_natural (nombre, dni, ruc, fecha_nacimiento, cargo)
  values (v_nombre, v_dni, v_ruc, p_fecha_nacimiento, v_cargo)
  returning * into v_persona;

  return v_persona;
exception
  when unique_violation then
    select * into v_persona from public.personal_natural where dni = v_dni and activo limit 1;
    if v_persona.id is null then
      raise;
    end if;
    return v_persona;
end;
$$;

revoke all on function public.crear_o_obtener_personal_natural(text, text, text, date, text) from public, anon;
grant execute on function public.crear_o_obtener_personal_natural(text, text, text, date, text) to authenticated;

-- La firma anterior (sin cargo) queda huerfana; se elimina para no dejar
-- dos overloads confusos con el mismo nombre.
drop function if exists public.crear_o_obtener_personal_natural(text, text, text, date);

commit;
