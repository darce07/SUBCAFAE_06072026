begin;

-- Grafico "Documentos subidos hoy" en Control interno: desglose por hora
-- (0-23, hora America/Lima) del dia en curso, solo documentos que siguen
-- activos (mismo criterio que obtener_control_interno_usuarios).

create or replace function public.obtener_control_interno_hoy()
returns table (
  hora integer,
  subidos bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    h.hora,
    count(a.registro_id) filter (where coalesce(d.activo, false)) as subidos
  from generate_series(0, 23) as h(hora)
  left join public.auditoria a
    on a.tabla = 'documentos'
    and a.accion = 'INSERT'
    and (a.created_at at time zone 'America/Lima')::date = (now() at time zone 'America/Lima')::date
    and extract(hour from a.created_at at time zone 'America/Lima')::integer = h.hora
  left join public.documentos d on d.id = a.registro_id
  where public.is_admin()
  group by h.hora
  order by h.hora;
$$;

revoke all on function public.obtener_control_interno_hoy() from public, anon;
grant execute on function public.obtener_control_interno_hoy() to authenticated;

commit;
