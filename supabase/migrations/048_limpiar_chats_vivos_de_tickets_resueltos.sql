begin;

-- Limpieza puntual: los tickets ya marcados 'resuelto' antes de
-- 047_resolver_ticket_cierra_chat_vivo.sql dejaron chats en vivo huerfanos
-- (la burbuja flotante los seguia mostrando aunque el ticket ya dijera
-- resuelto). De aca en adelante 047 evita que vuelva a pasar.
delete from public.chat_conversaciones c
where exists (
  select 1 from public.soporte_tickets t
  where t.usuario_id = c.usuario_id and t.estado = 'resuelto'
);

commit;
