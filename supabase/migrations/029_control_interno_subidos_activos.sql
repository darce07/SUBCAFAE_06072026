begin;

-- "Documentos subidos" en Control interno contaba TODO evento INSERT en
-- auditoria, incluyendo documentos que luego fueron eliminados (por
-- cualquier usuario). Eso generaba conteos que no coincidian con lo que se
-- ve al filtrar Documentos por "Subido por" (que solo muestra activos).
-- Ahora "subidos" solo cuenta documentos que el usuario creo Y que siguen
-- activos hoy. "editados"/"eliminados" se mantienen como conteo historico
-- de auditoria (no depende de si el documento sigue activo).

create or replace function public.obtener_control_interno_usuarios(
  p_anio integer default null,
  p_mes integer default null
)
returns table (
  usuario_id uuid,
  usuario_nombre text,
  usuario_email text,
  subidos bigint,
  editados bigint,
  eliminados bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with clasificado as (
    select
      a.usuario_id,
      a.registro_id,
      case
        when a.accion = 'INSERT' then 'subido'
        when a.accion = 'UPDATE'
          and (a.valor_anterior ->> 'activo') = 'true'
          and (a.valor_nuevo ->> 'activo') = 'false'
          then 'eliminado'
        when a.accion = 'UPDATE' then 'editado'
        else null
      end as tipo
    from public.auditoria a
    where public.is_admin()
      and a.tabla = 'documentos'
      and a.usuario_id is not null
      and (p_anio is null or extract(year from a.created_at)::integer = p_anio)
      and (p_mes is null or extract(month from a.created_at)::integer = p_mes)
  )
  select
    c.usuario_id,
    coalesce(p.nombre_completo, p.email) as usuario_nombre,
    p.email as usuario_email,
    count(*) filter (where c.tipo = 'subido' and coalesce(d.activo, false)) as subidos,
    count(*) filter (where c.tipo = 'editado') as editados,
    count(*) filter (where c.tipo = 'eliminado') as eliminados
  from clasificado c
  left join public.documentos d on d.id = c.registro_id
  left join public.profiles p on p.id = c.usuario_id
  where c.tipo is not null
  group by c.usuario_id, p.nombre_completo, p.email
  order by subidos desc, editados desc;
$$;

commit;
