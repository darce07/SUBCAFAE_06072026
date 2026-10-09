begin;

-- Eliminacion definitiva desde la Papelera. Solo administradores y solo
-- documentos que ya estan en la Papelera (activo = false). El borrado de los
-- archivos del Storage se hace desde la app con la API de Storage (borrar
-- filas de storage.objects por SQL deja el archivo fisico y no libera
-- espacio), por eso son dos pasos:
--   1) preparar_eliminacion_definitiva: valida y devuelve que archivos borrar.
--   2) eliminar_documentos_definitivamente: borra las filas (los anexos, sus
--      versiones y los firmantes se borran en cascada). La auditoria registra
--      cada DELETE con el usuario.

create or replace function public.preparar_eliminacion_definitiva(p_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ids uuid[] := coalesce(p_ids, array[]::uuid[]);
  v_invalidos integer;
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Solo un administrador puede eliminar documentos de forma definitiva';
  end if;

  if cardinality(v_ids) = 0 then
    return '[]'::jsonb;
  end if;

  select count(*) into v_invalidos
  from unnest(v_ids) as t(id)
  where not exists (select 1 from public.documentos d where d.id = t.id and not d.activo);

  if v_invalidos > 0 then
    raise exception using errcode = '22023',
      message = format('%s documento(s) no existen o no están en la Papelera; solo se eliminan de forma definitiva los que ya están en la Papelera', v_invalidos);
  end if;

  with rutas as (
    select d.id as documento_id, d.archivo_path as path
    from public.documentos d where d.id = any(v_ids)
    union
    select a.documento_id, a.archivo_path
    from public.documento_anexos a where a.documento_id = any(v_ids)
    union
    select a.documento_id, v.archivo_path
    from public.documento_anexo_versiones v join public.documento_anexos a on a.id = v.anexo_id
    where a.documento_id = any(v_ids)
  ), propias as (
    -- Un archivo que todavia usa otro registro que NO se elimina no se toca.
    select r.documento_id, r.path
    from rutas r
    where r.path is not null
      and not exists (select 1 from public.documentos o where o.archivo_path = r.path and o.id <> all(v_ids))
      and not exists (select 1 from public.documento_anexos o where o.archivo_path = r.path and o.documento_id <> all(v_ids))
      and not exists (
        select 1 from public.documento_anexo_versiones o join public.documento_anexos oa on oa.id = o.anexo_id
        where o.archivo_path = r.path and oa.documento_id <> all(v_ids)
      )
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', d.id,
    'codigo', d.codigo_documento,
    'paths', coalesce((select jsonb_agg(distinct p.path) from propias p where p.documento_id = d.id), '[]'::jsonb)
  )), '[]'::jsonb)
  into v_result
  from public.documentos d where d.id = any(v_ids);

  return v_result;
end;
$$;

revoke all on function public.preparar_eliminacion_definitiva(uuid[]) from public, anon;
grant execute on function public.preparar_eliminacion_definitiva(uuid[]) to authenticated;

create or replace function public.eliminar_documentos_definitivamente(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_borrados integer;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Solo un administrador puede eliminar documentos de forma definitiva';
  end if;

  delete from public.documentos
  where id = any(coalesce(p_ids, array[]::uuid[]))
    and not activo;

  get diagnostics v_borrados = row_count;
  return v_borrados;
end;
$$;

revoke all on function public.eliminar_documentos_definitivamente(uuid[]) from public, anon;
grant execute on function public.eliminar_documentos_definitivamente(uuid[]) to authenticated;

commit;
