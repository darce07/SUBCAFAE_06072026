begin;

create extension if not exists pg_trgm;

create index if not exists idx_documentos_active_date
on public.documentos(fecha_documento desc)
where activo;

create index if not exists idx_documentos_active_filters
on public.documentos(categoria_id, estado_id, anio, entidad_id)
where activo;

create index if not exists idx_documentos_titulo_trgm
on public.documentos using gin (titulo gin_trgm_ops);

create index if not exists idx_documentos_codigo_trgm
on public.documentos using gin (codigo_documento gin_trgm_ops);

create index if not exists idx_documentos_ruta_trgm
on public.documentos using gin (ruta_historica gin_trgm_ops);

create index if not exists idx_auditoria_documento
on public.auditoria(registro_id, created_at desc)
where tabla = 'documentos';

create or replace function public.editar_documento_seguro(
  p_documento_id uuid,
  p_categoria_id uuid,
  p_tipo_entidad_id uuid,
  p_entidad_id uuid,
  p_tipo_categoria_id uuid,
  p_estado_id uuid,
  p_titulo text,
  p_descripcion text,
  p_ruta_historica text,
  p_archivador_id uuid,
  p_archivo_path text,
  p_extension text,
  p_monto numeric,
  p_tipo_movimiento_id uuid,
  p_tipo_operacion_id uuid
)
returns public.documentos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_documento public.documentos;
begin
  if not public.is_authenticated_user() then
    raise exception using errcode = '42501', message = 'Usuario no autenticado o inactivo';
  end if;

  if not public.has_permission('documentos', 'editar') then
    raise exception using errcode = '42501', message = 'No tienes permiso para editar documentos';
  end if;

  if p_documento_id is null then
    raise exception using errcode = '22023', message = 'El documento es obligatorio';
  end if;

  if p_titulo is null or length(trim(p_titulo)) < 3 then
    raise exception using errcode = '22023', message = 'El título debe tener al menos 3 caracteres';
  end if;

  if coalesce(p_monto, 0) < 0 then
    raise exception using errcode = '22023', message = 'El monto no puede ser negativo';
  end if;

  update public.documentos
  set categoria_id = p_categoria_id,
      tipo_entidad_id = p_tipo_entidad_id,
      entidad_id = p_entidad_id,
      tipo_categoria_id = p_tipo_categoria_id,
      estado_id = p_estado_id,
      titulo = trim(p_titulo),
      descripcion = nullif(trim(coalesce(p_descripcion, '')), ''),
      ruta_historica = nullif(trim(coalesce(p_ruta_historica, '')), ''),
      archivador_id = p_archivador_id,
      archivo_path = nullif(trim(coalesce(p_archivo_path, '')), ''),
      archivo_url = null,
      extension = lower(nullif(trim(coalesce(p_extension, '')), '')),
      monto = coalesce(p_monto, 0),
      tipo_movimiento_id = p_tipo_movimiento_id,
      tipo_operacion_id = p_tipo_operacion_id
  where id = p_documento_id
    and activo
  returning * into v_documento;

  if v_documento.id is null then
    raise exception using errcode = 'P0002', message = 'Documento no encontrado o inactivo';
  end if;

  return v_documento;
end;
$$;

create or replace function public.obtener_historial_documento(p_documento_id uuid)
returns table (
  id bigint,
  accion text,
  usuario_id uuid,
  usuario_nombre text,
  usuario_email text,
  valor_anterior jsonb,
  valor_nuevo jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.id,
    a.accion,
    a.usuario_id,
    coalesce(p.nombre_completo, p.email, 'Usuario del sistema'),
    p.email,
    a.valor_anterior,
    a.valor_nuevo,
    a.created_at
  from public.auditoria a
  left join public.profiles p on p.id = a.usuario_id
  where a.tabla = 'documentos'
    and a.registro_id = p_documento_id
    and public.has_permission('documentos', 'ver')
  order by a.created_at desc;
$$;

create or replace function public.listar_roles_permisos()
returns table (
  role_id uuid,
  role_nombre text,
  role_descripcion text,
  permission_id uuid,
  modulo text,
  accion text,
  asignado boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    r.nombre,
    r.descripcion,
    p.id,
    p.modulo,
    p.accion,
    exists (
      select 1
      from public.role_permissions rp
      where rp.role_id = r.id
        and rp.permission_id = p.id
    )
  from public.roles r
  cross join public.permissions p
  where r.activo
    and (
      public.is_admin()
      or public.has_permission('usuarios', 'editar')
    )
  order by r.nombre, p.modulo, p.accion;
$$;

create or replace function public.actualizar_permiso_rol(
  p_role_id uuid,
  p_permission_id uuid,
  p_asignado boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role_name text;
begin
  if not public.is_authenticated_user() then
    raise exception using errcode = '42501', message = 'Usuario no autenticado o inactivo';
  end if;

  if not (
    public.is_admin()
    or public.has_permission('usuarios', 'editar')
  ) then
    raise exception using errcode = '42501', message = 'No tienes permiso para administrar roles';
  end if;

  select nombre into v_role_name
  from public.roles
  where id = p_role_id
    and activo;

  if v_role_name is null then
    raise exception using errcode = '23503', message = 'El rol no existe o está inactivo';
  end if;

  if not exists (
    select 1 from public.permissions where id = p_permission_id
  ) then
    raise exception using errcode = '23503', message = 'El permiso no existe';
  end if;

  if v_role_name = 'Administrador' and not p_asignado then
    raise exception using errcode = '42501', message = 'Los permisos del rol Administrador no pueden retirarse';
  end if;

  if p_asignado then
    insert into public.role_permissions(role_id, permission_id)
    values (p_role_id, p_permission_id)
    on conflict (role_id, permission_id) do nothing;
  else
    delete from public.role_permissions
    where role_id = p_role_id
      and permission_id = p_permission_id;
  end if;
end;
$$;

revoke all on function public.editar_documento_seguro(
  uuid, uuid, uuid, uuid, uuid, uuid, text, text, text, uuid, text, text, numeric, uuid, uuid
) from public, anon;
grant execute on function public.editar_documento_seguro(
  uuid, uuid, uuid, uuid, uuid, uuid, text, text, text, uuid, text, text, numeric, uuid, uuid
) to authenticated;

revoke all on function public.obtener_historial_documento(uuid) from public, anon;
grant execute on function public.obtener_historial_documento(uuid) to authenticated;

revoke all on function public.listar_roles_permisos() from public, anon;
grant execute on function public.listar_roles_permisos() to authenticated;

revoke all on function public.actualizar_permiso_rol(uuid, uuid, boolean) from public, anon;
grant execute on function public.actualizar_permiso_rol(uuid, uuid, boolean) to authenticated;

commit;
