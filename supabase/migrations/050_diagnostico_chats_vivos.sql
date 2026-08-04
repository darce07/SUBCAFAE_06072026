begin;

do $$
declare
  r record;
begin
  raise notice '--- chat_conversaciones actuales ---';
  for r in select id, admin_id, usuario_id, created_at from public.chat_conversaciones order by created_at loop
    raise notice 'conversacion id=% admin_id=% usuario_id=% created_at=%', r.id, r.admin_id, r.usuario_id, r.created_at;
  end loop;

  raise notice '--- soporte_tickets resueltos ---';
  for r in select id, usuario_id, estado, created_at from public.soporte_tickets where estado = 'resuelto' order by created_at loop
    raise notice 'ticket id=% usuario_id=% estado=% created_at=%', r.id, r.usuario_id, r.estado, r.created_at;
  end loop;
end $$;

rollback;
