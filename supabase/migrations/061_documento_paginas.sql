begin;

-- Cantidad de paginas del archivo principal de cada documento. Se guarda aparte
-- (no en documentos) para no tocar las funciones de alta y edicion ni disparar
-- su auditoria. Lo calcula la app al subir el archivo (PDF por sus paginas,
-- imagen = 1) y una herramienta de Archivo fisico para los ya subidos.

create table if not exists public.documento_paginas (
  documento_id uuid primary key references public.documentos(id) on delete cascade,
  paginas integer not null check (paginas between 1 and 20000),
  updated_at timestamptz not null default now()
);

alter table public.documento_paginas enable row level security;
revoke all on public.documento_paginas from public, anon, authenticated;
grant select on public.documento_paginas to authenticated;

drop policy if exists documento_paginas_select on public.documento_paginas;
create policy documento_paginas_select on public.documento_paginas
  for select to authenticated
  using (public.has_permission('documentos', 'ver'));

create or replace function public.registrar_paginas_documento(p_documento_id uuid, p_paginas integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_authenticated_user() then
    raise exception using errcode = '42501', message = 'Usuario no autenticado o inactivo';
  end if;

  if not (public.has_permission('documentos', 'crear') or public.has_permission('documentos', 'editar')) then
    raise exception using errcode = '42501', message = 'No tienes permiso para registrar las páginas del documento';
  end if;

  if p_paginas is null or p_paginas < 1 or p_paginas > 20000 then
    raise exception using errcode = '22023', message = 'La cantidad de páginas no es válida';
  end if;

  if not exists (select 1 from public.documentos d where d.id = p_documento_id and d.activo) then
    raise exception using errcode = 'P0002', message = 'El documento no existe o está en la Papelera';
  end if;

  insert into public.documento_paginas (documento_id, paginas)
  values (p_documento_id, p_paginas)
  on conflict (documento_id) do update set paginas = excluded.paginas, updated_at = now();
end;
$$;

revoke all on function public.registrar_paginas_documento(uuid, integer) from public, anon;
grant execute on function public.registrar_paginas_documento(uuid, integer) to authenticated;

commit;
