begin;

-- Registro de conexion real: una fila por persona y dia (hora de Lima) con la
-- primera y la ultima vez que el sistema estuvo abierto y activo, y los
-- segundos de actividad. Solo guarda fechas y horas, nunca contenido.
-- Nadie accede a la tabla directamente: se escribe con registrar_latido_actividad
-- (cada persona solo registra su propia actividad) y se lee desde el reporte de
-- Control interno, que es solo para administradores.

create table if not exists public.actividad_conexion (
  usuario_id uuid not null references auth.users(id) on delete cascade,
  dia date not null,
  primera_conexion timestamptz not null,
  ultima_conexion timestamptz not null,
  segundos_activos integer not null default 0,
  primary key (usuario_id, dia)
);

alter table public.actividad_conexion enable row level security;
revoke all on public.actividad_conexion from public, anon, authenticated;

-- El cliente llama a esta funcion cada pocos minutos mientras la persona tiene
-- el sistema visible y con actividad reciente. Un hueco de hasta 6 minutos entre
-- latidos cuenta como tiempo continuo; uno mayor se considera inactividad.
create or replace function public.registrar_latido_actividad()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_authenticated_user() then
    return;
  end if;

  insert into public.actividad_conexion as c (usuario_id, dia, primera_conexion, ultima_conexion, segundos_activos)
  values (v_uid, (now() at time zone 'America/Lima')::date, now(), now(), 0)
  on conflict (usuario_id, dia) do update
  set segundos_activos = c.segundos_activos
        + case when now() - c.ultima_conexion <= interval '6 minutes'
               then extract(epoch from now() - c.ultima_conexion)::integer else 0 end,
      ultima_conexion = now();
end;
$$;

revoke all on function public.registrar_latido_actividad() from public, anon;
grant execute on function public.registrar_latido_actividad() to authenticated;

-- El reporte diario suma la conexion real. Aparece tambien quien se conecto pero
-- no hizo ninguna accion registrada (acciones = 0).
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
  minutos_conectado integer
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
  )
  select
    coalesce(pa.dia, pr.dia) as fecha,
    coalesce(pa.usuario_id, pr.usuario_id) as usuario_id,
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
    pr.primera_conexion,
    pr.ultima_conexion,
    coalesce(pr.minutos_conectado, 0) as minutos_conectado
  from por_accion pa
  full join presencia pr on pr.dia = pa.dia and pr.usuario_id = pa.usuario_id
  left join public.profiles p on p.id = coalesce(pa.usuario_id, pr.usuario_id)
  order by 1 desc, 3;
end;
$$;

revoke all on function public.obtener_reporte_actividad_diaria(date, date, uuid) from public, anon;
grant execute on function public.obtener_reporte_actividad_diaria(date, date, uuid) to authenticated;

commit;
