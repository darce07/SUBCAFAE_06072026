begin;

-- SUBCAFAE pidió poder generar respaldos del sistema (datos + archivos del
-- bucket `documentos`) desde la misma aplicación, restringido a los usuarios
-- que tengan el permiso correspondiente, en vez de depender solo de backups
-- de infraestructura que no todos pueden disparar ni descargar.
--
-- El contenido real del backup (dump de filas + zip de archivos de Storage)
-- se arma en la Edge Function `generar-backup` (supabase/functions/generar-backup),
-- porque una función SQL no puede leer bytes de Storage ni generar un zip.
-- Esta migración solo prepara el terreno: permiso, tabla de historial/estado
-- y bucket de destino. La Edge Function usa la service role para escribir en
-- `backups_generados` y en el bucket `backups`; el frontend solo lee su
-- propio historial (o todo, si es administrador) y descarga vía signed URL.

insert into public.permissions (modulo, accion)
values ('sistema', 'respaldar')
on conflict (modulo, accion) do nothing;

create table if not exists public.backups_generados (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id),
  anio integer not null,
  categoria_id uuid references public.catalogo_categorias(id),
  archivador_id uuid references public.catalogo_archivadores(id),
  estado text not null default 'procesando' check (estado in ('procesando', 'listo', 'error')),
  archivo_path text,
  tamano_bytes bigint,
  total_documentos integer,
  error_mensaje text,
  created_at timestamptz not null default now(),
  completado_at timestamptz
);

create index if not exists backups_generados_usuario_idx on public.backups_generados (usuario_id, created_at desc);

alter table public.backups_generados enable row level security;

-- Solo la Edge Function (service role, que salta RLS) inserta y actualiza
-- estas filas. El cliente autenticado únicamente puede leer.
revoke all on public.backups_generados from authenticated;
grant select on public.backups_generados to authenticated;

drop policy if exists backups_generados_select on public.backups_generados;
create policy backups_generados_select
on public.backups_generados for select to authenticated
using (
  public.has_permission('sistema', 'respaldar')
  and (usuario_id = auth.uid() or public.is_admin())
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'backups',
  'backups',
  false,
  524288000,
  array['application/zip']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- El zip lo sube la Edge Function con service role (que no pasa por estas
-- policies). Estas policies solo habilitan la descarga desde el cliente:
-- el propio autor del backup, o un administrador.
drop policy if exists backups_storage_select on storage.objects;
create policy backups_storage_select
on storage.objects for select to authenticated
using (
  bucket_id = 'backups'
  and public.has_permission('sistema', 'respaldar')
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

commit;
