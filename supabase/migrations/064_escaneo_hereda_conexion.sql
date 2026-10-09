begin;

-- Quien solo escanea (colabora en el escaneo) y no entra al sistema ese dia
-- hereda las horas de conexion de quien digito esos mismos documentos: trabajo
-- junto con esa persona, asi que se consideran las mismas horas de entrada y
-- fin: se toma el rango mas amplio entre su conexion propia (si la tuvo) y la
-- de quien digito, y se marca (conexion_heredada / conexion_heredada_de) para
-- que el reporte lo aclare.

drop function if exists public.obtener_reporte_actividad_diaria(date, date, uuid);

create function public.obtener_reporte_actividad_diaria(
  p_desde date,
  p_hasta date,
  p_usuario uuid default null
)
returns table (
  fecha date,
  usuario_id uuid,
  usuario_nombre text,
  usuario_email text,
  subidos bigint,
  editados bigint,
  eliminados bigint,
  anexos bigint,
  acciones bigint,
  primera_accion timestamptz,
  ultima_accion timestamptz,
  minutos_activos integer,
  primera_conexion timestamptz,
  ultima_conexion timestamptz,
  minutos_conectado integer,
  escaneados bigint,
  conexion_heredada boolean,
  conexion_heredada_de text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    return;
  end if;

  if p_desde is null or p_hasta is null or p_hasta < p_desde then
    raise exception using errcode = '22023', message = 'El rango de fechas no es válido';
  end if;

  if p_hasta - p_desde > 366 then
    raise exception using errcode = '22023', message = 'El rango no puede superar un año';
  end if;

  return query
  with base as (
    select
      (a.created_at at time zone 'America/Lima')::date as dia,
      a.usuario_id,
      a.registro_id,
      a.created_at,
      case
        when a.tabla = 'documento_anexos' then 'anexo'
        when a.accion = 'INSERT' then 'subido'
        when a.accion = 'UPDATE'
          and (a.valor_anterior ->> 'activo') = 'true'
          and (a.valor_nuevo ->> 'activo') = 'false'
          then 'eliminado'
        when a.accion = 'UPDATE' then 'editado'
        else null
      end as tipo
    from public.auditoria a
    where a.tabla in ('documentos', 'documento_anexos')
      and a.usuario_id is not null
      and (p_usuario is null or a.usuario_id = p_usuario)
      and (a.created_at at time zone 'America/Lima')::date between p_desde and p_hasta
  ), con_tramo as (
    select
      b.*,
      b.created_at - lag(b.created_at) over (partition by b.usuario_id, b.dia order by b.created_at) as tramo
    from base b
    where b.tipo is not null
  ), por_accion as (
    select
      c.dia,
      c.usuario_id,
      count(*) filter (where c.tipo = 'subido' and coalesce(d.activo, false)) as subidos,
      count(*) filter (where c.tipo = 'editado') as editados,
      count(*) filter (where c.tipo = 'eliminado') as eliminados,
      count(*) filter (where c.tipo = 'anexo') as anexos,
      count(*) as acciones,
      min(c.created_at) as primera_accion,
      max(c.created_at) as ultima_accion,
      coalesce(round(sum(extract(epoch from c.tramo) / 60) filter (where c.tramo <= interval '30 minutes')), 0)::integer as minutos_activos
    from con_tramo c
    left join public.documentos d on d.id = c.registro_id and c.tipo = 'subido'
    group by c.dia, c.usuario_id
  ), presencia as (
    select ac.dia, ac.usuario_id, ac.primera_conexion, ac.ultima_conexion, round(ac.segundos_activos / 60.0)::integer as minutos_conectado
    from public.actividad_conexion ac
    where ac.dia between p_desde and p_hasta
      and (p_usuario is null or ac.usuario_id = p_usuario)
  ), escaneo as (
    select (d.created_at at time zone 'America/Lima')::date as dia, e.usuario_id, count(*) as escaneados
    from public.documento_escaneos e
    join public.documentos d on d.id = e.documento_id and d.activo
    where (d.created_at at time zone 'America/Lima')::date between p_desde and p_hasta
      and (p_usuario is null or e.usuario_id = p_usuario)
    group by 1, 2
  ), heredada as (
    -- Conexion de quien digito los documentos que otra persona escaneo ese dia.
    select
      (d.created_at at time zone 'America/Lima')::date as dia,
      e.usuario_id as escaner_id,
      min(ac.primera_conexion) as primera_conexion,
      max(ac.ultima_conexion) as ultima_conexion,
      max(round(ac.segundos_activos / 60.0)::integer) as minutos_conectado,
      string_agg(distinct coalesce(pd.nombre_completo, pd.email), ', ') as de
    from public.documento_escaneos e
    join public.documentos d on d.id = e.documento_id and d.activo
    join public.auditoria au on au.tabla = 'documentos' and au.accion = 'INSERT' and au.registro_id = d.id
      and au.usuario_id is not null and au.usuario_id <> e.usuario_id
    join public.actividad_conexion ac on ac.usuario_id = au.usuario_id and ac.dia = (d.created_at at time zone 'America/Lima')::date
    left join public.profiles pd on pd.id = au.usuario_id
    where (d.created_at at time zone 'America/Lima')::date between p_desde and p_hasta
      and (p_usuario is null or e.usuario_id = p_usuario)
    group by 1, 2
  ), claves as (
    select pa.dia, pa.usuario_id from por_accion pa
    union
    select pr.dia, pr.usuario_id from presencia pr
    union
    select es.dia, es.usuario_id from escaneo es
  )
  select
    k.dia as fecha,
    k.usuario_id,
    coalesce(p.nombre_completo, p.email) as usuario_nombre,
    p.email as usuario_email,
    coalesce(pa.subidos, 0) as subidos,
    coalesce(pa.editados, 0) as editados,
    coalesce(pa.eliminados, 0) as eliminados,
    coalesce(pa.anexos, 0) as anexos,
    coalesce(pa.acciones, 0) as acciones,
    pa.primera_accion,
    pa.ultima_accion,
    coalesce(pa.minutos_activos, 0) as minutos_activos,
    case when he.primera_conexion is null then pr.primera_conexion else least(he.primera_conexion, coalesce(pr.primera_conexion, he.primera_conexion)) end as primera_conexion,
    case when he.ultima_conexion is null then pr.ultima_conexion else greatest(he.ultima_conexion, coalesce(pr.ultima_conexion, he.ultima_conexion)) end as ultima_conexion,
    case when he.primera_conexion is null then coalesce(pr.minutos_conectado, 0) else greatest(coalesce(pr.minutos_conectado, 0), coalesce(he.minutos_conectado, 0)) end as minutos_conectado,
    coalesce(es.escaneados, 0) as escaneados,
    (he.primera_conexion is not null) as conexion_heredada,
    he.de as conexion_heredada_de
  from claves k
  left join por_accion pa on pa.dia = k.dia and pa.usuario_id = k.usuario_id
  left join presencia pr on pr.dia = k.dia and pr.usuario_id = k.usuario_id
  left join escaneo es on es.dia = k.dia and es.usuario_id = k.usuario_id
  left join heredada he on he.dia = k.dia and he.escaner_id = k.usuario_id
  left join public.profiles p on p.id = k.usuario_id
  order by 1 desc, 3;
end;
$$;

revoke all on function public.obtener_reporte_actividad_diaria(date, date, uuid) from public, anon;
grant execute on function public.obtener_reporte_actividad_diaria(date, date, uuid) to authenticated;

commit;
