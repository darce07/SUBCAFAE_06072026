begin;

-- "Escaneado por": en la digitalizacion de documentos fisicos, una persona
-- escanea y otra digita el mismo documento. Se registra aparte (no en
-- documentos) para no tocar las funciones de alta/edicion ni disparar la
-- auditoria de documentos: asignar quien escaneo no cuenta como "editar".

create table if not exists public.documento_escaneos (
  documento_id uuid primary key references public.documentos(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  asignado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_documento_escaneos_usuario on public.documento_escaneos(usuario_id);

alter table public.documento_escaneos enable row level security;
revoke all on public.documento_escaneos from public, anon, authenticated;
grant select on public.documento_escaneos to authenticated;

drop policy if exists documento_escaneos_select on public.documento_escaneos;
create policy documento_escaneos_select on public.documento_escaneos
  for select to authenticated
  using (public.has_permission('documentos', 'ver'));

-- Lista minima (id y nombre) de personas activas para elegir quien escaneo.
create or replace function public.listar_usuarios_apoyo()
returns table (id uuid, nombre text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, coalesce(nullif(trim(p.nombre_completo), ''), p.email) as nombre
  from public.profiles p
  where public.is_authenticated_user() and p.activo
  order by 2;
$$;

revoke all on function public.listar_usuarios_apoyo() from public, anon;
grant execute on function public.listar_usuarios_apoyo() to authenticated;

-- Asigna (o quita, con p_usuario = null) quien escaneo uno o varios documentos.
create or replace function public.asignar_escaneado_por(p_documento_ids uuid[], p_usuario uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[] := coalesce(p_documento_ids, array[]::uuid[]);
  v_n integer;
begin
  if not public.is_authenticated_user() then
    raise exception using errcode = '42501', message = 'Usuario no autenticado o inactivo';
  end if;

  if not (public.has_permission('documentos', 'crear') or public.has_permission('documentos', 'editar')) then
    raise exception using errcode = '42501', message = 'No tienes permiso para indicar quién escaneó los documentos';
  end if;

  if p_usuario is null then
    delete from public.documento_escaneos where documento_id = any(v_ids);
    get diagnostics v_n = row_count;
    return v_n;
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_usuario and p.activo) then
    raise exception using errcode = '22023', message = 'La persona seleccionada no existe o está inactiva';
  end if;

  insert into public.documento_escaneos (documento_id, usuario_id, asignado_por)
  select d.id, p_usuario, auth.uid()
  from public.documentos d
  where d.id = any(v_ids) and d.activo
  on conflict (documento_id) do update
    set usuario_id = excluded.usuario_id, asignado_por = excluded.asignado_por, created_at = now();

  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.asignar_escaneado_por(uuid[], uuid) from public, anon;
grant execute on function public.asignar_escaneado_por(uuid[], uuid) to authenticated;

-- Reporte diario: suma "escaneados" (documentos activos, por el dia en que se
-- digitalizaron) y muestra tambien a quien solo escaneo ese dia.
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
  escaneados bigint
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
    pr.primera_conexion,
    pr.ultima_conexion,
    coalesce(pr.minutos_conectado, 0) as minutos_conectado,
    coalesce(es.escaneados, 0) as escaneados
  from claves k
  left join por_accion pa on pa.dia = k.dia and pa.usuario_id = k.usuario_id
  left join presencia pr on pr.dia = k.dia and pr.usuario_id = k.usuario_id
  left join escaneo es on es.dia = k.dia and es.usuario_id = k.usuario_id
  left join public.profiles p on p.id = k.usuario_id
  order by 1 desc, 3;
end;
$$;

revoke all on function public.obtener_reporte_actividad_diaria(date, date, uuid) from public, anon;
grant execute on function public.obtener_reporte_actividad_diaria(date, date, uuid) to authenticated;

commit;
