begin;

-- Repite la limpieza de 048: seguian quedando chats en vivo de usuarios con
-- ticket resuelto (probablemente re-creados despues de 048 al reabrir un
-- chat con "Chat" desde Usuarios, o porque 048 corrio antes de que algunos
-- tickets terminaran de marcarse). Idempotente - si ya no hay nada que
-- borrar, no hace nada.
delete from public.chat_conversaciones c
where exists (
  select 1 from public.soporte_tickets t
  where t.usuario_id = c.usuario_id and t.estado = 'resuelto'
);

commit;
