begin;

-- Grafico mensual del modulo Sindicatos: por cada mes del año, lo que se gasto
-- en cada sindicato (egresos de documentos con esa entidad) y los ingresos y
-- egresos generales del mes (misma regla que el balance general: documentos
-- activos, naturaleza Ingreso o Egreso). Un sindicato nuevo aparece solo.

create or replace function public.obtener_balance_sindicatos_mensual(p_anio integer)
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

  if p_anio is null or p_anio < 1900 or p_anio > 2200 then
    raise exception using errcode = '22023', message = 'El año seleccionado no es válido';
  end if;

  with docs as materialized (
    select d.mes, d.entidad_id, d.monto, tm.nombre as movimiento
    from public.documentos d
    join public.catalogo_tipo_movimiento tm on tm.id = d.tipo_movimiento_id and tm.nombre in ('Ingreso', 'Egreso')
    where d.activo and d.anio = p_anio and d.mes is not null
  ), sind as (
    select e.id, e.nombre
    from public.entidades e
    join public.catalogo_tipo_entidad te on te.id = e.tipo_entidad_id and te.nombre = 'Sindicato'
    where e.activo
  )
  select jsonb_build_object(
    'anio', p_anio,
    'meses', jsonb_agg(
      jsonb_build_object(
        'mes', n.mes,
        'ingresos', coalesce((select sum(dc.monto) from docs dc where dc.mes = n.mes and dc.movimiento = 'Ingreso'), 0),
        'egresos', coalesce((select sum(dc.monto) from docs dc where dc.mes = n.mes and dc.movimiento = 'Egreso'), 0),
        'sindicatos', (
          select coalesce(jsonb_agg(
            jsonb_build_object(
              'id', s.id,
              'nombre', s.nombre,
              'egresos', coalesce((select sum(dc.monto) from docs dc where dc.mes = n.mes and dc.entidad_id = s.id and dc.movimiento = 'Egreso'), 0)
            ) order by s.nombre
          ), '[]'::jsonb)
          from sind s
        )
      ) order by n.mes
    )
  )
  into v_result
  from generate_series(1, 12) as n(mes);

  return v_result;
end;
$$;

revoke all on function public.obtener_balance_sindicatos_mensual(integer) from public, anon;
grant execute on function public.obtener_balance_sindicatos_mensual(integer) to authenticated;

commit;
