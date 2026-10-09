begin;

-- Detalle de lo que cada persona SUBIO, con la hora exacta, para el mapa de
-- calor y la lista de subidas fuera de horario de Control interno (solo
-- administradores). Cuenta documentos subidos (que siguen activos) y anexos
-- agregados. NO cuenta ediciones: editar o guardar sin cambios puede aparentar
-- trabajo sin que se haya subido nada.

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
  ) subidas
  order by 3
  limit 5000;
end;
$$;

revoke all on function public.obtener_subidas_detalle(date, date, uuid) from public, anon;
grant execute on function public.obtener_subidas_detalle(date, date, uuid) to authenticated;

drop function if exists public.obtener_actividad_por_hora(date, date, uuid);

commit;
