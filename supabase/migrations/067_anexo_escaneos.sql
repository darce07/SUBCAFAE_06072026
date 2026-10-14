begin;

-- "Escaneado por" tambien para los anexos: una persona escanea el anexo fisico y
-- otra lo digita. Igual que documento_escaneos, se registra aparte (no en
-- documento_anexos) para no tocar las funciones de alta/edicion de anexos ni
-- disparar la auditoria: indicar quien escaneo no cuenta como "editar".

create table if not exists public.anexo_escaneos (
  anexo_id uuid primary key references public.documento_anexos(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  asignado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_anexo_escaneos_usuario on public.anexo_escaneos(usuario_id);

alter table public.anexo_escaneos enable row level security;
revoke all on public.anexo_escaneos from public, anon, authenticated;
grant select on public.anexo_escaneos to authenticated;

drop policy if exists anexo_escaneos_select on public.anexo_escaneos;
create policy anexo_escaneos_select on public.anexo_escaneos
  for select to authenticated
  using (public.has_permission('documentos', 'ver'));

-- Asigna (o quita, con p_usuario = null) quien escaneo uno o varios anexos.
create or replace function public.asignar_escaneado_por_anexos(p_anexo_ids uuid[], p_usuario uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[] := coalesce(p_anexo_ids, array[]::uuid[]);
  v_n integer;
begin
  if not public.is_authenticated_user() then
    raise exception using errcode = '42501', message = 'Usuario no autenticado o inactivo';
  end if;

  if not (
    public.has_permission('anexos', 'crear') or public.has_permission('anexos', 'editar')
    or public.has_permission('documentos', 'crear') or public.has_permission('documentos', 'editar')
  ) then
    raise exception using errcode = '42501', message = 'No tienes permiso para indicar quién escaneó los anexos';
  end if;

  if p_usuario is null then
    delete from public.anexo_escaneos where anexo_id = any(v_ids);
    get diagnostics v_n = row_count;
    return v_n;
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_usuario and p.activo) then
    raise exception using errcode = '22023', message = 'La persona seleccionada no existe o está inactiva';
  end if;

  insert into public.anexo_escaneos (anexo_id, usuario_id, asignado_por)
  select x.id, p_usuario, auth.uid()
  from public.documento_anexos x
  where x.id = any(v_ids) and x.activo
  on conflict (anexo_id) do update
    set usuario_id = excluded.usuario_id, asignado_por = excluded.asignado_por, created_at = now();

  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.asignar_escaneado_por_anexos(uuid[], uuid) from public, anon;
grant execute on function public.asignar_escaneado_por_anexos(uuid[], uuid) to authenticated;

-- Reporte diario: "escaneados" suma tambien los anexos escaneados (por el dia
-- en que se agrego el anexo).
do $do$
declare
  v_def text := pg_get_functiondef('public.obtener_reporte_actividad_diaria(date,date,uuid)'::regprocedure);
  v_ini int := position(E'  ), escaneo as (\n' in v_def);
  v_fin int := position(E'  ), heredada as (\n' in v_def);
  v_bloque text := E'  ), escaneo as (\n'
    || E'    select t.dia, t.usuario_id, sum(t.n)::bigint as escaneados\n'
    || E'    from (\n'
    || E'      select (d.created_at at time zone ''America/Lima'')::date as dia, e.usuario_id, count(*) as n\n'
    || E'      from public.documento_escaneos e\n'
    || E'      join public.documentos d on d.id = e.documento_id and d.activo\n'
    || E'      where (d.created_at at time zone ''America/Lima'')::date between p_desde and p_hasta\n'
    || E'        and (p_usuario is null or e.usuario_id = p_usuario)\n'
    || E'      group by 1, 2\n'
    || E'      union all\n'
    || E'      select (x.created_at at time zone ''America/Lima'')::date, ae.usuario_id, count(*)\n'
    || E'      from public.anexo_escaneos ae\n'
    || E'      join public.documento_anexos x on x.id = ae.anexo_id and x.activo\n'
    || E'      where (x.created_at at time zone ''America/Lima'')::date between p_desde and p_hasta\n'
    || E'        and (p_usuario is null or ae.usuario_id = p_usuario)\n'
    || E'      group by 1, 2\n'
    || E'    ) t\n'
    || E'    group by t.dia, t.usuario_id\n';
begin
  if v_ini = 0 or v_fin = 0 or v_fin < v_ini then
    raise exception 'no se encontraron los marcadores de obtener_reporte_actividad_diaria';
  end if;
  execute substr(v_def, 1, v_ini - 1) || v_bloque || substr(v_def, v_fin);
end
$do$;

-- Detalle de subidas por hora: los anexos escaneados cuentan como "escaneo" de
-- quien los escaneo, a la hora en que se agrego el anexo.
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
      and not exists (
        select 1 from public.auditoria au
        where au.tabla = 'documentos' and au.accion = 'INSERT' and au.registro_id = d.id and au.usuario_id = e.usuario_id
      )
    union all
    select
      ae.usuario_id,
      coalesce(p.nombre_completo, p.email),
      x.created_at,
      'escaneo'::text,
      d.codigo_documento,
      coalesce(x.titulo, 'Anexo')
    from public.anexo_escaneos ae
    join public.documento_anexos x on x.id = ae.anexo_id and x.activo
    left join public.documentos d on d.id = x.documento_id
    left join public.profiles p on p.id = ae.usuario_id
    where (p_usuario is null or ae.usuario_id = p_usuario)
      and (x.created_at at time zone 'America/Lima')::date between p_desde and p_hasta
      and not exists (
        select 1 from public.auditoria au
        where au.tabla = 'documento_anexos' and au.accion = 'INSERT' and au.registro_id = x.id and au.usuario_id = ae.usuario_id
      )
  ) subidas
  order by 3
  limit 5000;
end;
$$;

commit;
