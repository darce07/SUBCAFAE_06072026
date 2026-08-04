begin;

-- descartar_chat_soporte: borra una conversacion SIN generar ticket. Se usa
-- para chats huerfanos que el admin nunca cerro explicitamente (con
-- "Cerrar chat y generar ticket") - si nadie lo marco como importante, no
-- vale la pena archivarlo como ticket cuando se detecta huerfano en el
-- proximo login. cerrar_chat_soporte (con ticket) sigue siendo el unico
-- camino para archivar una conversacion.
create or replace function public.descartar_chat_soporte(p_conversacion_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.chat_conversaciones
  where id = p_conversacion_id
    and (admin_id = auth.uid() or usuario_id = auth.uid());
end;
$$;

revoke all on function public.descartar_chat_soporte(uuid) from public, anon;
grant execute on function public.descartar_chat_soporte(uuid) to authenticated;

commit;
