begin;

create index if not exists idx_documentos_active_period
on public.documentos(anio, mes)
where activo;

create or replace function public.obtener_dashboard_resumen_filtrado(
  p_anio integer default null,
  p_mes integer default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.has_permission('documentos', 'ver') then
    raise exception using errcode = '42501', message = 'No tienes permiso para consultar el panel de control';
  end if;

  if p_mes is not null and (p_mes < 1 or p_mes > 12) then
    raise exception using errcode = '22023', message = 'El mes seleccionado no es válido';
  end if;

  if p_anio is not null and (p_anio < 1900 or p_anio > 2200) then
    raise exception using errcode = '22023', message = 'El año seleccionado no es válido';
  end if;

  with filtered_documents as materialized (
    select d.*
    from public.documentos d
    where d.activo
      and (p_anio is null or d.anio = p_anio)
      and (p_mes is null or d.mes = p_mes)
  )
  select jsonb_build_object(
    'totalDocumentos', count(*)::integer,
    'totalIngresos', coalesce(sum(d.monto) filter (where tm.nombre = 'Ingreso'), 0),
    'totalEgresos', coalesce(sum(d.monto) filter (where tm.nombre = 'Egreso'), 0),
    'balanceGeneral',
      coalesce(sum(d.monto) filter (where tm.nombre = 'Ingreso'), 0) -
      coalesce(sum(d.monto) filter (where tm.nombre = 'Egreso'), 0),
    'sinArchivo', count(*) filter (where d.archivo_path is null)::integer,
    'sinArchivador', count(*) filter (where d.archivador_id is null)::integer,
    'sinRutaHistorica', count(*) filter (where d.ruta_historica is null)::integer,
    'porCategoria', (
      select coalesce(
        jsonb_agg(jsonb_build_object('name', grouped.nombre, 'value', grouped.total) order by grouped.total desc),
        '[]'::jsonb
      )
      from (
        select c.nombre, count(*)::integer total
        from filtered_documents dc
        join public.catalogo_categorias c on c.id = dc.categoria_id
        group by c.nombre
      ) grouped
    ),
    'porEstado', (
      select coalesce(
        jsonb_agg(jsonb_build_object('name', grouped.nombre, 'value', grouped.total) order by grouped.total desc),
        '[]'::jsonb
      )
      from (
        select e.nombre, count(*)::integer total
        from filtered_documents de
        join public.catalogo_estado_documento e on e.id = de.estado_id
        group by e.nombre
      ) grouped
    ),
    'balanceMensual', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'month', months.nombre,
            'ingresos', coalesce(totals.ingresos, 0),
            'egresos', coalesce(totals.egresos, 0),
            'balance', coalesce(totals.ingresos, 0) - coalesce(totals.egresos, 0)
          )
          order by months.numero
        ),
        '[]'::jsonb
      )
      from (
        values
          (1, 'Ene'), (2, 'Feb'), (3, 'Mar'), (4, 'Abr'),
          (5, 'May'), (6, 'Jun'), (7, 'Jul'), (8, 'Ago'),
          (9, 'Sep'), (10, 'Oct'), (11, 'Nov'), (12, 'Dic')
      ) months(numero, nombre)
      left join (
        select
          dm.mes,
          coalesce(sum(dm.monto) filter (where movement.nombre = 'Ingreso'), 0) ingresos,
          coalesce(sum(dm.monto) filter (where movement.nombre = 'Egreso'), 0) egresos
        from filtered_documents dm
        left join public.catalogo_tipo_movimiento movement on movement.id = dm.tipo_movimiento_id
        group by dm.mes
      ) totals on totals.mes = months.numero
      where p_mes is null or months.numero = p_mes
    ),
    'aniosDisponibles', (
      select coalesce(jsonb_agg(years.anio order by years.anio desc), '[]'::jsonb)
      from (
        select distinct d_year.anio
        from public.documentos d_year
        where d_year.activo
          and d_year.anio is not null
      ) years
    )
  )
  into v_result
  from filtered_documents d
  left join public.catalogo_tipo_movimiento tm on tm.id = d.tipo_movimiento_id;

  return v_result;
end;
$$;

revoke all on function public.obtener_dashboard_resumen_filtrado(integer, integer) from public, anon;
grant execute on function public.obtener_dashboard_resumen_filtrado(integer, integer) to authenticated;

commit;
