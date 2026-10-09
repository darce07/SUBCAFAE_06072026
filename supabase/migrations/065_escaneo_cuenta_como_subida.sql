begin;

-- Quien escanea mientras otra persona digita tambien trabajo ese documento:
--  1) cuenta como subida suya (a la hora en que se digitalizo) en el detalle
--     de subidas por hora (tipo 'escaneo');
--  2) su hora de inicio del dia es la del primer documento en que colaboro
--     (o su conexion propia, si fue anterior); el fin sigue siendo la ultima
--     conexion de quien digito.

create or replace function public.obtener_subidas_detalle(
  p_desde date,
  p_hasta date,
  p_usuario uuid default null
)
returns table (
  usuario_id uuid,
  usuario_nombre text,
  momento timestamptz,
  tipo text,
  codigo text,
  titulo text
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
  select * from (
    select
      a.usuario_id,
      coalesce(p.nombre_completo, p.email) as usuario_nombre,
      a.created_at as momento,
      'documento'::text as tipo,
      d.codigo_documento as codigo,
      d.titulo as titulo
    from public.auditoria a
    join public.documentos d on d.id = a.registro_id and d.activo
    left join public.profiles p on p.id = a.usuario_id
    where a.tabla = 'documentos' and a.accion = 'INSERT'
      and a.usuario_id is not null
      and (p_usuario is null or a.usuario_id = p_usuario)
      and (a.created_at at time zone 'America/Lima')::date between p_desde and p_hasta
    union all
    select
      a.usuario_id,
      coalesce(p.nombre_completo, p.email),
      a.created_at,
      'anexo'::text,
      d.codigo_documento,
      coalesce(x.titulo, 'Anexo')
    from public.auditoria a
    left join public.documento_anexos x on x.id = a.registro_id
    left join public.documentos d on d.id = x.documento_id
    left join public.profiles p on p.id = a.usuario_id
    where a.tabla = 'documento_anexos' and a.accion = 'INSERT'
      and a.usuario_id is not null
      and (p_usuario is null or a.usuario_id = p_usuario)
      and (a.created_at at time zone 'America/Lima')::date between p_desde and p_hasta
    union all
    select
      e.usuario_id,
      coalesce(p.nombre_completo, p.email),
      d.created_at,
      'escaneo'::text,
      d.codigo_documento,
      d.titulo
    from public.documento_escaneos e
    join public.documentos d on d.id = e.documento_id and d.activo
    left join public.profiles p on p.id = e.usuario_id
    where (p_usuario is null or e.usuario_id = p_usuario)
      and (d.created_at at time zone 'America/Lima')::date between p_desde and p_hasta
      -- si la misma persona escaneo y digito, ya cuenta como subida suya
      and not exists (
        select 1 from public.auditoria au
        where au.tabla = 'documentos' and au.accion = 'INSERT' and au.registro_id = d.id and au.usuario_id = e.usuario_id
      )
  ) subidas
  order by 3
  limit 5000;
end;
$$;

-- Reporte diario: la hora de entrada heredada es la del primer documento en que
-- colaboro escaneando, y el tiempo conectado no supera el tramo entre esa hora
-- y el fin.
do $do$
declare
  v_def text := pg_get_functiondef('public.obtener_reporte_actividad_diaria(date,date,uuid)'::regprocedure);
  v_ini int := position(E'    coalesce(pa.minutos_activos, 0) as minutos_activos,
' in v_def);
  v_fin int := position(E'  from claves k' in v_def);
  v_bloque text := E'    coalesce(pa.minutos_activos, 0) as minutos_activos,
'
    || E'    case when he.primera_conexion is null then pr.primera_conexion else least(he.primera_conexion, coalesce(pr.primera_conexion, he.primera_conexion)) end as primera_conexion,
'
    || E'    case when he.ultima_conexion is null then pr.ultima_conexion else greatest(he.ultima_conexion, coalesce(pr.ultima_conexion, he.ultima_conexion)) end as ultima_conexion,
'
    || E'    case when he.primera_conexion is null then coalesce(pr.minutos_conectado, 0) else greatest(coalesce(pr.minutos_conectado, 0), least(coalesce(he.minutos_conectado, 0), greatest(0, round(extract(epoch from (he.ultima_conexion - he.primera_conexion)) / 60)::integer))) end as minutos_conectado,
'
    || E'    coalesce(es.escaneados, 0) as escaneados,
'
    || E'    (he.primera_conexion is not null) as conexion_heredada,
'
    || E'    he.de as conexion_heredada_de
';
  v_nuevo text;
begin
  if v_ini = 0 or v_fin = 0 then
    raise exception 'no se encontraron los marcadores de obtener_reporte_actividad_diaria';
  end if;
  v_nuevo := substr(v_def, 1, v_ini - 1) || v_bloque || substr(v_def, v_fin);
  v_nuevo := replace(v_nuevo, 'min(ac.primera_conexion) as primera_conexion,', 'min(d.created_at) as primera_conexion,');
  execute v_nuevo;
end
$do$;

commit;
