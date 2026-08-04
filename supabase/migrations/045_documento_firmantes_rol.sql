begin;

-- Antes documento_firmantes era una lista plana sin distinguir el rol
-- (emisor/remitente, receptor, o firmante/participante regular). Se agrega
-- rol + un enlace opcional a la entidad en cuyo nombre firmo (persona que
-- firma en representacion de una institucion distinta a SUBCAFAE).
alter table public.documento_firmantes
  add column if not exists rol text not null default 'firmante',
  add column if not exists representa_entidad_id uuid references public.entidades(id);

alter table public.documento_firmantes
  drop constraint if exists documento_firmantes_rol_check;
alter table public.documento_firmantes
  add constraint documento_firmantes_rol_check
  check (rol in ('emisor', 'receptor', 'firmante'));

-- Maximo un emisor y un receptor por documento; firmantes regulares no
-- tienen tope (participantes de una lista, testigos, etc).
create unique index if not exists uq_documento_firmantes_emisor
  on public.documento_firmantes (documento_id)
  where rol = 'emisor';

create unique index if not exists uq_documento_firmantes_receptor
  on public.documento_firmantes (documento_id)
  where rol = 'receptor';

-- sincronizar_documento_firmantes ahora recibe un jsonb con rol y
-- representa_entidad_id por firmante, en vez de solo una lista de ids
-- (todos terminaban como rol 'firmante' antes). Reemplaza el set completo.
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

  insert into public.documento_firmantes (documento_id, personal_natural_id, rol, representa_entidad_id)
  select
    p_documento_id,
    (item ->> 'personal_natural_id')::uuid,
    coalesce(item ->> 'rol', 'firmante'),
    nullif(item ->> 'representa_entidad_id', '')::uuid
  from jsonb_array_elements(coalesce(p_firmantes, '[]'::jsonb)) as item
  where item ->> 'personal_natural_id' is not null
  on conflict (documento_id, personal_natural_id) do update
  set rol = excluded.rol,
      representa_entidad_id = excluded.representa_entidad_id;
end;
$$;

revoke all on function public.sincronizar_documento_firmantes(uuid, jsonb) from public, anon;
grant execute on function public.sincronizar_documento_firmantes(uuid, jsonb) to authenticated;

drop function if exists public.sincronizar_documento_firmantes(uuid, uuid[]);

commit;
