begin;

-- Emisor/Receptor antes solo podian ser una persona natural (con una
-- entidad opcional "en representacion de"). En la practica, muchos
-- documentos tienen como emisor o receptor directamente una institucion
-- (ej. "Interbank", "SUBCAFAE") sin una persona firmante identificada.
-- Se permite que un firmante sea una persona O una entidad directamente.
alter table public.documento_firmantes
  alter column personal_natural_id drop not null,
  add column if not exists entidad_id uuid references public.entidades(id);

alter table public.documento_firmantes
  drop constraint if exists documento_firmantes_persona_o_entidad_check;
alter table public.documento_firmantes
  add constraint documento_firmantes_persona_o_entidad_check
  check (
    (personal_natural_id is not null and entidad_id is null)
    or (personal_natural_id is null and entidad_id is not null)
  );

create index if not exists idx_documento_firmantes_entidad
  on public.documento_firmantes(entidad_id);

create or replace function public.sincronizar_documento_firmantes(
  p_documento_id uuid,
  p_firmantes jsonb
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

  delete from public.documento_firmantes where documento_id = p_documento_id;

  insert into public.documento_firmantes (documento_id, personal_natural_id, entidad_id, rol, representa_entidad_id)
  select
    p_documento_id,
    nullif(item ->> 'personal_natural_id', '')::uuid,
    nullif(item ->> 'entidad_id', '')::uuid,
    coalesce(item ->> 'rol', 'firmante'),
    nullif(item ->> 'representa_entidad_id', '')::uuid
  from jsonb_array_elements(coalesce(p_firmantes, '[]'::jsonb)) as item
  where item ->> 'personal_natural_id' is not null or item ->> 'entidad_id' is not null
  on conflict (documento_id, personal_natural_id) do update
  set entidad_id = excluded.entidad_id,
      rol = excluded.rol,
      representa_entidad_id = excluded.representa_entidad_id;
end;
$$;

revoke all on function public.sincronizar_documento_firmantes(uuid, jsonb) from public, anon;
grant execute on function public.sincronizar_documento_firmantes(uuid, jsonb) to authenticated;

commit;
