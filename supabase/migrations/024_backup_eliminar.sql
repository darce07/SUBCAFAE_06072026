begin;

-- La migración 021 dejó `backups_generados` de solo lectura para el
-- cliente (revoke all + grant select), porque solo la Edge Function con
-- service role debía escribir ahí. Ahora se necesita que el propio usuario
-- (o un admin) pueda borrar entradas del historial, sobre todo las que
-- quedaron en 'error' de las pruebas. Se sigue el mismo patrón que el resto
-- del sistema: una función security definer valida permiso/dueño y hace el
-- borrado, en vez de abrir un DELETE directo sobre la tabla.

create or replace function public.eliminar_backup_seguro(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_archivo_path text;
  v_usuario_id uuid;
begin
  select archivo_path, usuario_id into v_archivo_path, v_usuario_id
  from public.backups_generados
  where id = p_id;

  if not found then
    raise exception 'El respaldo no existe.';
  end if;

  if not (
    public.has_permission('sistema', 'respaldar')
    and (v_usuario_id = auth.uid() or public.is_admin())
  ) then
    raise exception 'No tienes permiso para eliminar este respaldo.';
  end if;

  delete from public.backups_generados where id = p_id;

  return v_archivo_path;
end;
$$;

revoke all on function public.eliminar_backup_seguro(uuid) from public;
grant execute on function public.eliminar_backup_seguro(uuid) to authenticated;

-- Permite borrar el .zip real del bucket una vez que el RPC anterior ya
-- confirmó permiso/dueño y borró la fila de historial. Mismo patrón que
-- documentos_storage_delete (001_sigdaf_complete.sql).
drop policy if exists backups_storage_delete on storage.objects;
create policy backups_storage_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'backups'
  and public.has_permission('sistema', 'respaldar')
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

commit;
