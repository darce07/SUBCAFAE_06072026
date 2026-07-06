begin;

create index if not exists idx_auditoria_created_at
on public.auditoria(created_at desc);

create index if not exists idx_auditoria_action_created
on public.auditoria(accion, created_at desc);

create or replace function public.obtener_auditoria_paginada(
  p_busqueda text default null,
  p_accion text default null,
  p_fecha_desde date default null,
  p_fecha_hasta date default null,
  p_pagina integer default 1,
  p_tamano_pagina integer default 10
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pagina integer := greatest(coalesce(p_pagina, 1), 1);
  v_tamano integer := least(greatest(coalesce(p_tamano_pagina, 10), 1), 100);
  v_busqueda text := nullif(trim(coalesce(p_busqueda, '')), '');
  v_total bigint;
  v_data jsonb;
begin
  if not public.is_authenticated_user() then
    raise exception using errcode = '42501', message = 'Usuario no autenticado o inactivo';
  end if;

  if not (
    public.is_admin()
    or public.has_permission('auditoria', 'ver')
  ) then
    raise exception using errcode = '42501', message = 'No tienes permiso para consultar la auditoría';
  end if;

  if p_accion is not null and p_accion not in ('INSERT', 'UPDATE', 'DELETE') then
    raise exception using errcode = '22023', message = 'Estado de auditoría no válido';
  end if;

  if p_fecha_desde is not null and p_fecha_hasta is not null and p_fecha_desde > p_fecha_hasta then
    raise exception using errcode = '22023', message = 'El rango de fechas no es válido';
  end if;

  select count(*)
  into v_total
  from public.auditoria a
  left join public.profiles p on p.id = a.usuario_id
  where (p_accion is null or a.accion = p_accion)
    and (p_fecha_desde is null or a.created_at >= (p_fecha_desde::timestamp at time zone 'America/Lima'))
    and (p_fecha_hasta is null or a.created_at < ((p_fecha_hasta + 1)::timestamp at time zone 'America/Lima'))
    and (
      v_busqueda is null
      or a.tabla ilike '%' || v_busqueda || '%'
      or a.accion ilike '%' || v_busqueda || '%'
      or coalesce(p.nombre_completo, '') ilike '%' || v_busqueda || '%'
      or coalesce(p.email, '') ilike '%' || v_busqueda || '%'
      or coalesce(a.registro_id::text, '') ilike '%' || v_busqueda || '%'
    );

  select coalesce(jsonb_agg(to_jsonb(rows_data) order by rows_data.created_at desc), '[]'::jsonb)
  into v_data
  from (
    select
      a.id,
      a.tabla,
      a.registro_id,
      a.accion,
      a.valor_anterior,
      a.valor_nuevo,
      a.usuario_id,
      coalesce(p.nombre_completo, p.email, case when a.usuario_id is null then 'Proceso del sistema' else 'Usuario sin perfil' end) as usuario_nombre,
      p.email as usuario_email,
      a.created_at
    from public.auditoria a
    left join public.profiles p on p.id = a.usuario_id
    where (p_accion is null or a.accion = p_accion)
      and (p_fecha_desde is null or a.created_at >= (p_fecha_desde::timestamp at time zone 'America/Lima'))
      and (p_fecha_hasta is null or a.created_at < ((p_fecha_hasta + 1)::timestamp at time zone 'America/Lima'))
      and (
        v_busqueda is null
        or a.tabla ilike '%' || v_busqueda || '%'
        or a.accion ilike '%' || v_busqueda || '%'
        or coalesce(p.nombre_completo, '') ilike '%' || v_busqueda || '%'
        or coalesce(p.email, '') ilike '%' || v_busqueda || '%'
        or coalesce(a.registro_id::text, '') ilike '%' || v_busqueda || '%'
      )
    order by a.created_at desc
    limit v_tamano
    offset (v_pagina - 1) * v_tamano
  ) rows_data;

  return jsonb_build_object(
    'data', v_data,
    'count', v_total,
    'page', v_pagina,
    'pageSize', v_tamano
  );
end;
$$;

revoke all on function public.obtener_auditoria_paginada(
  text, text, date, date, integer, integer
) from public, anon;

grant execute on function public.obtener_auditoria_paginada(
  text, text, date, date, integer, integer
) to authenticated;

commit;
