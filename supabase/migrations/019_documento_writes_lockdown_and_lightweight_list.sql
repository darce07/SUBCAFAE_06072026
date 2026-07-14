begin;

-- 1) Cierra el UPDATE directo sobre documentos: hasta ahora `authenticated`
-- tenía GRANT UPDATE sobre la tabla solo para soportar "marcar observado"
-- desde el cliente. Se mueve esa escritura a una función segura y se
-- revoca el permiso directo: de ahora en más TODAS las escrituras pasan
-- por funciones security definer (registrar/editar/eliminar/restaurar/
-- cambiar_estado), lo que evita que un cliente autenticado con
-- 'documentos:editar' pueda mandar un PATCH arbitrario a la tabla.
create or replace function public.cambiar_estado_documento_seguro(p_documento_id uuid, p_estado_id uuid)
returns public.documentos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_documento public.documentos;
begin
  if not (
    public.is_admin()
    or public.has_permission('documentos', 'editar')
  ) then
    raise exception using errcode = '42501', message = 'No tienes permiso para editar documentos';
  end if;

  if not exists (select 1 from public.catalogo_estado_documento e where e.id = p_estado_id and e.activo) then
    raise exception using errcode = '23503', message = 'El estado no existe o está inactivo';
  end if;

  update public.documentos
  set estado_id = p_estado_id
  where id = p_documento_id
    and activo
  returning * into v_documento;

  if v_documento.id is null then
    raise exception using errcode = 'P0002', message = 'Documento no encontrado o inactivo';
  end if;

  return v_documento;
end;
$$;

revoke all on function public.cambiar_estado_documento_seguro(uuid, uuid) from public, anon;
grant execute on function public.cambiar_estado_documento_seguro(uuid, uuid) to authenticated;

revoke update on public.documentos from authenticated;

-- 2) Lista liviana de documentos para el libro contable: obtener_documentos_movimiento_ligero
-- evita el N+1 de RPCs (obtener_perfiles_basico / obtener_ultima_accion_documentos)
-- que getDocumentos()+enrichDocumentos() disparaba en cada una de las hasta 100
-- páginas que pagina getAllDocumentosMovimiento(). El libro contable solo
-- necesita monto, fecha y tipo de movimiento/operación para calcular el saldo
-- acumulado; no muestra "subido por" ni la última acción.
create or replace function public.obtener_documentos_movimiento_ligero(
  p_categoria_id uuid default null,
  p_estado_id uuid default null,
  p_entidad_id uuid default null,
  p_anio int default null,
  p_tipo_movimiento_nombre text default null,
  p_search text default null
)
returns table (
  id uuid,
  codigo_documento text,
  fecha_documento date,
  titulo text,
  monto numeric,
  tipo_movimiento_nombre text,
  tipo_operacion_nombre text,
  entidad_nombre text,
  categoria_nombre text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    d.id,
    d.codigo_documento,
    d.fecha_documento,
    d.titulo,
    d.monto,
    tm.nombre,
    top.nombre,
    e.nombre,
    c.nombre
  from public.documentos d
  left join public.catalogo_tipo_movimiento tm on tm.id = d.tipo_movimiento_id
  left join public.catalogo_tipo_operacion top on top.id = d.tipo_operacion_id
  left join public.entidades e on e.id = d.entidad_id
  left join public.catalogo_categorias c on c.id = d.categoria_id
  where d.activo
    and public.has_permission('documentos', 'ver')
    and (p_categoria_id is null or d.categoria_id = p_categoria_id)
    and (p_estado_id is null or d.estado_id = p_estado_id)
    and (p_entidad_id is null or d.entidad_id = p_entidad_id)
    and (p_anio is null or d.anio = p_anio)
    and (p_tipo_movimiento_nombre is null or tm.nombre = p_tipo_movimiento_nombre)
    and (
      p_search is null or p_search = ''
      or d.codigo_documento ilike '%' || p_search || '%'
      or d.titulo ilike '%' || p_search || '%'
      or d.descripcion ilike '%' || p_search || '%'
    )
  order by d.fecha_documento asc, d.created_at asc;
$$;

revoke all on function public.obtener_documentos_movimiento_ligero(uuid, uuid, uuid, int, text, text) from public, anon;
grant execute on function public.obtener_documentos_movimiento_ligero(uuid, uuid, uuid, int, text, text) to authenticated;

commit;
