begin;

-- Notificar a todos los usuarios activos (excepto quien hizo el cambio)
-- cuando un documento se edita o se elimina. Sigue el mismo patron que
-- notify_documento_observado (002_profiles_and_access_repair.sql), pero en
-- vez de notificar solo al creador, hace fan-out a todos los perfiles
-- activos. event_key incluye updated_at para que cada edicion/eliminacion
-- genere su propia notificacion (no se fusiona con ediciones previas).

create or replace function public.notify_documento_editado_eliminado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_nombre text;
  v_es_eliminacion boolean;
  v_cambio_relevante boolean;
  v_titulo text;
  v_descripcion text;
  v_event_key text;
  v_perfil record;
begin
  v_es_eliminacion := old.activo = true and new.activo = false;
  v_cambio_relevante := (to_jsonb(new) - 'updated_at') is distinct from (to_jsonb(old) - 'updated_at');

  if not v_cambio_relevante then
    return new;
  end if;

  -- La reactivacion (restaurar desde papelera) no se notifica aqui.
  if old.activo = false and new.activo = true then
    return new;
  end if;

  select coalesce(p.nombre_completo, p.email, 'Un usuario') into v_actor_nombre
  from public.profiles p
  where p.id = auth.uid();

  if v_es_eliminacion then
    v_titulo := 'Documento eliminado';
    v_descripcion := coalesce(v_actor_nombre, 'Un usuario') || ' eliminó el documento ' || new.codigo_documento || '.';
    v_event_key := 'documento-eliminado:' || new.id::text || ':' || new.updated_at::text;
  else
    v_titulo := 'Documento editado';
    v_descripcion := coalesce(v_actor_nombre, 'Un usuario') || ' editó el documento ' || new.codigo_documento || '.';
    v_event_key := 'documento-editado:' || new.id::text || ':' || new.updated_at::text;
  end if;

  for v_perfil in
    select p.id
    from public.profiles p
    where p.activo
      and p.id is distinct from auth.uid()
  loop
    insert into public.notificaciones(user_id, titulo, descripcion, tipo, event_key)
    values (v_perfil.id, v_titulo, v_descripcion, 'documental', v_event_key)
    on conflict (user_id, event_key) do update
    set descripcion = excluded.descripcion,
        leida_at = null,
        created_at = now();
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_documento_editado_eliminado_notification on public.documentos;
create trigger trg_documento_editado_eliminado_notification
after update on public.documentos
for each row execute function public.notify_documento_editado_eliminado();

commit;
