begin;

-- Reporte diario de actividad por usuario (Control interno, solo administradores).
-- Sale de la auditoria de documentos y anexos, con los mismos criterios que
-- obtener_control_interno_usuarios (subido / editado / eliminado), agrupado por
-- dia en hora de Lima. No registra inicios de sesion: "ultima actividad" es la
-- hora de la ultima accion registrada ese dia, no la de desconexion.
-- minutos_activos: suma de los tramos entre acciones consecutivas del mismo
-- dia que distan 30 minutos o menos (una pausa mayor se considera inactividad).

create or replace function public.obtener_reporte_actividad_diaria(
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
  minutos_activos integer
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
  )
  select
    c.dia as fecha,
    c.usuario_id,
    coalesce(p.nombre_completo, p.email) as usuario_nombre,
    p.email as usuario_email,
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
  left join public.profiles p on p.id = c.usuario_id
  group by c.dia, c.usuario_id, p.nombre_completo, p.email
  order by c.dia desc, usuario_nombre;
end;
$$;

revoke all on function public.obtener_reporte_actividad_diaria(date, date, uuid) from public, anon;
grant execute on function public.obtener_reporte_actividad_diaria(date, date, uuid) to authenticated;

commit;
