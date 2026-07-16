begin;

-- La Edge Function generar-backup necesita avisarle al usuario cuando su
-- respaldo termina (listo o con error) usando el centro de notificaciones
-- que ya existe (public.notificaciones, creada en 002). El check constraint
-- de `tipo` solo aceptaba 'documental' | 'financiero' | 'auditoria' |
-- 'seguridad'; se agrega 'sistema' para este caso de uso.

alter table public.notificaciones drop constraint if exists notificaciones_tipo_check;
alter table public.notificaciones add constraint notificaciones_tipo_check
  check (tipo in ('documental', 'financiero', 'auditoria', 'seguridad', 'sistema'));

commit;
