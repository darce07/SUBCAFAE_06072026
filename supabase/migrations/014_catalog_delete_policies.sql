do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'catalogo_categorias',
    'catalogo_tipo_entidad',
    'entidades',
    'catalogo_tipo_categoria',
    'catalogo_estado_documento',
    'catalogo_archivadores',
    'catalogo_tipo_movimiento',
    'catalogo_tipo_operacion',
    'catalogo_tipo_anexo'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_delete', table_name);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.has_permission(''catalogos'', ''editar''))',
      table_name || '_delete',
      table_name
    );
  end loop;
end $$;

grant delete on
  public.catalogo_categorias,
  public.catalogo_tipo_entidad,
  public.entidades,
  public.catalogo_tipo_categoria,
  public.catalogo_estado_documento,
  public.catalogo_archivadores,
  public.catalogo_tipo_movimiento,
  public.catalogo_tipo_operacion,
  public.catalogo_tipo_anexo
to authenticated;
