begin;

-- Shim de compatibilidad: 045_documento_firmantes_rol.sql borro la firma
-- vieja de sincronizar_documento_firmantes(uuid, uuid[]), pero esa
-- migracion vive en una rama/PR (#24) todavia sin mergear a main - el
-- frontend en produccion sigue llamando a la firma vieja y quedo roto
-- ("Could not find the function... p_personal_natural_ids"). Se recrea
-- como wrapper delegando a la nueva firma (jsonb), todos como rol
-- 'firmante', hasta que el PR se mergee y el frontend nuevo se despliegue.
-- TODO: borrar este shim una vez que #24 este en produccion.
create or replace function public.sincronizar_documento_firmantes(
  p_documento_id uuid,
  p_personal_natural_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sincronizar_documento_firmantes(
    p_documento_id,
    (
      select coalesce(jsonb_agg(jsonb_build_object('personal_natural_id', id, 'rol', 'firmante')), '[]'::jsonb)
      from unnest(coalesce(p_personal_natural_ids, array[]::uuid[])) as id
    )
  );
end;
$$;

revoke all on function public.sincronizar_documento_firmantes(uuid, uuid[]) from public, anon;
grant execute on function public.sincronizar_documento_firmantes(uuid, uuid[]) to authenticated;

commit;
