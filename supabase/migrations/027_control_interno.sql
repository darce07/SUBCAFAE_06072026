begin;

-- Modulo "Control interno": panel exclusivo para Administrador que muestra,
-- por usuario, cuantos documentos subio/edito/elimino en un periodo, para
-- fines de supervision interna. Se reutiliza la tabla auditoria (ya poblada
-- por audit_trigger sobre documentos) en vez de agregar columnas nuevas.
-- La clasificacion INSERT/editado/eliminado replica la logica ya usada en
-- obtener_ultima_accion_documentos (017_document_restore_and_action_trail.sql).
-- El filtro de periodo es sobre la fecha del evento de auditoria
-- (a.created_at), no sobre la fecha del documento.

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
    count(*) filter (where c.tipo = 'subido') as subidos,
    count(*) filter (where c.tipo = 'editado') as editados,
    count(*) filter (where c.tipo = 'eliminado') as eliminados
  from clasificado c
  left join public.profiles p on p.id = c.usuario_id
  where c.tipo is not null
  group by c.usuario_id, p.nombre_completo, p.email
  order by subidos desc, editados desc;
$$;

create or replace function public.obtener_control_interno_anios()
returns integer[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    array_agg(distinct extract(year from a.created_at)::integer order by extract(year from a.created_at)::integer desc),
    array[]::integer[]
  )
  from public.auditoria a
  where public.is_admin()
    and a.tabla = 'documentos';
$$;

revoke all on function public.obtener_control_interno_usuarios(integer, integer) from public;
grant execute on function public.obtener_control_interno_usuarios(integer, integer) to authenticated;

revoke all on function public.obtener_control_interno_anios() from public;
grant execute on function public.obtener_control_interno_anios() to authenticated;

create index if not exists idx_auditoria_usuario_documentos
  on public.auditoria (usuario_id, created_at)
  where tabla = 'documentos';

commit;
