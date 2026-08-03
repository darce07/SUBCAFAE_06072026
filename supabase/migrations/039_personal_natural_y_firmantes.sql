begin;

-- Catalogo de personas naturales (firmantes de documentos): nombre completo,
-- DNI, RUC y fecha de nacimiento. Sigue la misma forma {nombre, descripcion,
-- activo} que el resto de catalogos para reusar la pantalla de Catalogos y
-- su CRUD generico (catalogos.service.ts / use-catalogos.ts).
create table public.personal_natural (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) >= 3),
  dni text,
  ruc text,
  fecha_nacimiento date,
  descripcion text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personal_natural_dni_check check (dni is null or dni ~ '^[0-9]{8}$'),
  constraint personal_natural_ruc_check check (ruc is null or ruc ~ '^[0-9]{11}$')
);

create unique index uq_personal_natural_dni
  on public.personal_natural (dni)
  where dni is not null and activo;

create index idx_personal_natural_nombre_trgm
  on public.personal_natural using gin (nombre gin_trgm_ops);

drop trigger if exists trg_personal_natural_updated_at on public.personal_natural;
create trigger trg_personal_natural_updated_at
before update on public.personal_natural
for each row execute function public.set_updated_at();

alter table public.personal_natural enable row level security;
revoke all on public.personal_natural from public, anon;
grant select, insert, update, delete on public.personal_natural to authenticated;

create policy personal_natural_select on public.personal_natural
  for select to authenticated
  using (public.has_permission('catalogos', 'ver'));

create policy personal_natural_insert on public.personal_natural
  for insert to authenticated
  with check (public.has_permission('catalogos', 'crear'));

create policy personal_natural_update on public.personal_natural
  for update to authenticated
  using (public.has_permission('catalogos', 'editar'))
  with check (public.has_permission('catalogos', 'editar'));

create policy personal_natural_delete on public.personal_natural
  for delete to authenticated
  using (public.has_permission('catalogos', 'editar'));

-- crear_o_obtener_personal_natural: analogo a crear_o_obtener_entidad, para
-- registrar un firmante nuevo desde el formulario de "Nuevo documento" sin
-- necesitar el permiso de catalogos (solo el de documentos:crear).
create or replace function public.crear_o_obtener_personal_natural(
  p_nombre text,
  p_dni text default null,
  p_ruc text default null,
  p_fecha_nacimiento date default null
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
      return v_persona;
    end if;
  end if;

  select * into v_persona
  from public.personal_natural
  where lower(trim(nombre)) = lower(v_nombre) and activo
  limit 1;

  if found then
    return v_persona;
  end if;

  insert into public.personal_natural (nombre, dni, ruc, fecha_nacimiento)
  values (v_nombre, v_dni, v_ruc, p_fecha_nacimiento)
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

revoke all on function public.crear_o_obtener_personal_natural(text, text, text, date) from public, anon;
grant execute on function public.crear_o_obtener_personal_natural(text, text, text, date) to authenticated;

-- Firmantes de un documento: relacion N:N, un documento puede tener varios
-- firmantes y una persona puede firmar varios documentos.
create table public.documento_firmantes (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.documentos(id) on delete cascade,
  personal_natural_id uuid not null references public.personal_natural(id),
  created_at timestamptz not null default now(),
  unique (documento_id, personal_natural_id)
);

create index idx_documento_firmantes_documento on public.documento_firmantes(documento_id);
create index idx_documento_firmantes_persona on public.documento_firmantes(personal_natural_id);

alter table public.documento_firmantes enable row level security;
revoke all on public.documento_firmantes from public, anon;
grant select, insert, delete on public.documento_firmantes to authenticated;

create policy documento_firmantes_select on public.documento_firmantes
  for select to authenticated
  using (public.has_permission('documentos', 'ver'));

create policy documento_firmantes_insert on public.documento_firmantes
  for insert to authenticated
  with check (
    public.has_permission('documentos', 'crear')
    or public.has_permission('documentos', 'editar')
  );

create policy documento_firmantes_delete on public.documento_firmantes
  for delete to authenticated
  using (
    public.has_permission('documentos', 'editar')
    or public.has_permission('documentos', 'eliminar')
  );

-- sincronizar_documento_firmantes: reemplaza el set completo de firmantes de
-- un documento (borra los que ya no estan, inserta los nuevos). Se llama una
-- vez al guardar el formulario, en vez de manejar altas/bajas sueltas.
create or replace function public.sincronizar_documento_firmantes(
  p_documento_id uuid,
  p_personal_natural_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (
    public.has_permission('documentos', 'crear')
    or public.has_permission('documentos', 'editar')
  ) then
    raise exception using errcode = '42501', message = 'No tienes permiso para editar los firmantes del documento';
  end if;

  delete from public.documento_firmantes
  where documento_id = p_documento_id
    and (p_personal_natural_ids is null or not (personal_natural_id = any(p_personal_natural_ids)));

  insert into public.documento_firmantes (documento_id, personal_natural_id)
  select p_documento_id, id
  from unnest(coalesce(p_personal_natural_ids, array[]::uuid[])) as id
  on conflict (documento_id, personal_natural_id) do nothing;
end;
$$;

revoke all on function public.sincronizar_documento_firmantes(uuid, uuid[]) from public, anon;
grant execute on function public.sincronizar_documento_firmantes(uuid, uuid[]) to authenticated;

commit;
