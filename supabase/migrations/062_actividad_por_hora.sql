begin;

-- Actividad por hora del dia (hora de Lima) para el mapa de calor de Control
-- interno, solo administradores. Cuenta lo que la persona produjo: documentos
-- subidos (que siguen activos), editados y anexos. No cuenta eliminados.
-- Sale de la auditoria: lee la hora de cada accion registrada.

create or replace function public.obtener_actividad_por_hora(
  p_desde date,
  p_hasta date,
  p_usuario uuid default null
)
returns table (
  usuario_id uuid,
  usuario_nombre text,
  hora integer,
  subidos bigint,
  editados bigint,
  anexos bigint
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
  select
    a.usuario_id,
    coalesce(p.nombre_completo, p.email) as usuario_nombre,
    extract(hour from (a.created_at at time zone 'America/Lima'))::integer as hora,
    count(*) filter (where a.tabla = 'documentos' and a.accion = 'INSERT' and coalesce(d.activo, false)) as subidos,
    count(*) filter (
      where a.tabla = 'documentos' and a.accion = 'UPDATE'
        and not ((a.valor_anterior ->> 'activo') = 'true' and (a.valor_nuevo ->> 'activo') = 'false')
    ) as editados,
    count(*) filter (where a.tabla = 'documento_anexos') as anexos
  from public.auditoria a
  left join public.documentos d on d.id = a.registro_id and a.tabla = 'documentos' and a.accion = 'INSERT'
  left join public.profiles p on p.id = a.usuario_id
  where a.tabla in ('documentos', 'documento_anexos')
    and a.usuario_id is not null
    and (p_usuario is null or a.usuario_id = p_usuario)
    and (a.created_at at time zone 'America/Lima')::date between p_desde and p_hasta
  group by a.usuario_id, coalesce(p.nombre_completo, p.email), 3
  order by 2, 3;
end;
$$;

revoke all on function public.obtener_actividad_por_hora(date, date, uuid) from public, anon;
grant execute on function public.obtener_actividad_por_hora(date, date, uuid) to authenticated;

commit;
