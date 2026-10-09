begin;

-- Modulo Sindicatos: no tiene tablas propias. Un sindicato es toda entidad
-- cuyo tipo de entidad es 'Sindicato' (catalogo existente), y su balance sale
-- de los documentos activos que la tienen como Entidad. Asi un sindicato nuevo
-- aparece solo al registrarlo como entidad de ese tipo.
-- Egreso = gasto, Ingreso = ingreso (misma regla que el balance general).

create or replace function public.obtener_balance_sindicatos(
  p_anio integer default null,
  p_mes integer default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.has_permission('finanzas', 'ver') then
    raise exception using errcode = '42501', message = 'No tienes permiso para consultar el balance de sindicatos';
  end if;

  if p_mes is not null and (p_mes < 1 or p_mes > 12) then
    raise exception using errcode = '22023', message = 'El mes seleccionado no es válido';
  end if;

  if p_anio is not null and (p_anio < 1900 or p_anio > 2200) then
    raise exception using errcode = '22023', message = 'El año seleccionado no es válido';
  end if;

  select jsonb_build_object(
    'sindicatos', coalesce(jsonb_agg(row_data order by (row_data ->> 'nombre')), '[]'::jsonb),
    'aniosDisponibles', (
      select coalesce(jsonb_agg(years.anio order by years.anio desc), '[]'::jsonb)
      from (
        select distinct d.anio
        from public.documentos d
        join public.entidades e on e.id = d.entidad_id and e.activo
        join public.catalogo_tipo_entidad te on te.id = e.tipo_entidad_id and te.nombre = 'Sindicato'
        where d.activo and d.anio is not null
      ) years
    )
  )
  into v_result
  from (
    select jsonb_build_object(
      'id', e.id,
      'nombre', e.nombre,
      'totalDocumentos', count(d.id)::integer,
      'totalIngresos', coalesce(sum(d.monto) filter (where tm.nombre = 'Ingreso'), 0),
      'totalEgresos', coalesce(sum(d.monto) filter (where tm.nombre = 'Egreso'), 0),
      'balance',
        coalesce(sum(d.monto) filter (where tm.nombre = 'Ingreso'), 0) -
        coalesce(sum(d.monto) filter (where tm.nombre = 'Egreso'), 0),
      'ultimaFecha', max(d.fecha_documento)
    ) as row_data
    from public.entidades e
    join public.catalogo_tipo_entidad te on te.id = e.tipo_entidad_id and te.nombre = 'Sindicato'
    left join public.documentos d
      on d.entidad_id = e.id
     and d.activo
     and (p_anio is null or d.anio = p_anio)
     and (p_mes is null or d.mes = p_mes)
    left join public.catalogo_tipo_movimiento tm on tm.id = d.tipo_movimiento_id
    where e.activo
    group by e.id, e.nombre
  ) sindicatos;

  return v_result;
end;
$$;

revoke all on function public.obtener_balance_sindicatos(integer, integer) from public, anon;
grant execute on function public.obtener_balance_sindicatos(integer, integer) to authenticated;

create or replace function public.obtener_balance_sindicato(
  p_entidad_id uuid,
  p_anio integer default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_entidad public.entidades;
  v_result jsonb;
begin
  if not public.has_permission('finanzas', 'ver') then
    raise exception using errcode = '42501', message = 'No tienes permiso para consultar el balance de sindicatos';
  end if;

  if p_anio is not null and (p_anio < 1900 or p_anio > 2200) then
    raise exception using errcode = '22023', message = 'El año seleccionado no es válido';
  end if;

  select e.* into v_entidad
  from public.entidades e
  join public.catalogo_tipo_entidad te on te.id = e.tipo_entidad_id and te.nombre = 'Sindicato'
  where e.id = p_entidad_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'El sindicato no existe';
  end if;

  with docs as materialized (
    select d.id, d.mes, d.monto, tm.nombre as movimiento
    from public.documentos d
    left join public.catalogo_tipo_movimiento tm on tm.id = d.tipo_movimiento_id
    where d.activo
      and d.entidad_id = p_entidad_id
      and (p_anio is null or d.anio = p_anio)
  )
  select jsonb_build_object(
    'sindicato', jsonb_build_object('id', v_entidad.id, 'nombre', v_entidad.nombre, 'activo', v_entidad.activo),
    'totalDocumentos', (select count(*)::integer from docs),
    'totalIngresos', coalesce((select sum(monto) from docs where movimiento = 'Ingreso'), 0),
    'totalEgresos', coalesce((select sum(monto) from docs where movimiento = 'Egreso'), 0),
    'balance',
      coalesce((select sum(monto) from docs where movimiento = 'Ingreso'), 0) -
      coalesce((select sum(monto) from docs where movimiento = 'Egreso'), 0),
    'balanceMensual', (
      select jsonb_agg(
        jsonb_build_object(
          'month', months.nombre,
          'ingresos', coalesce(totals.ingresos, 0),
          'egresos', coalesce(totals.egresos, 0),
          'balance', coalesce(totals.ingresos, 0) - coalesce(totals.egresos, 0)
        )
        order by months.numero
      )
      from (
        values
          (1, 'Ene'), (2, 'Feb'), (3, 'Mar'), (4, 'Abr'),
          (5, 'May'), (6, 'Jun'), (7, 'Jul'), (8, 'Ago'),
          (9, 'Sep'), (10, 'Oct'), (11, 'Nov'), (12, 'Dic')
      ) months(numero, nombre)
      left join (
        select
          mes,
          coalesce(sum(monto) filter (where movimiento = 'Ingreso'), 0) as ingresos,
          coalesce(sum(monto) filter (where movimiento = 'Egreso'), 0) as egresos
        from docs
        group by mes
      ) totals on totals.mes = months.numero
    ),
    'aniosDisponibles', (
      select coalesce(jsonb_agg(years.anio order by years.anio desc), '[]'::jsonb)
      from (
        select distinct d.anio
        from public.documentos d
        where d.activo and d.entidad_id = p_entidad_id and d.anio is not null
      ) years
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.obtener_balance_sindicato(uuid, integer) from public, anon;
grant execute on function public.obtener_balance_sindicato(uuid, integer) to authenticated;

commit;
