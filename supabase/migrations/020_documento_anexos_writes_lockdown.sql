begin;

-- Migración 019 cerró el UPDATE directo sobre public.documentos porque un
-- cliente autenticado con 'documentos:editar' podía mandar un PATCH arbitrario
-- a la tabla en vez de pasar por las funciones seguras. La migración 009 dejó
-- el mismo hueco abierto en public.documento_anexos: la tabla tiene
-- `grant insert, update on public.documento_anexos to authenticated` y
-- políticas RLS que lo permiten, así que un cliente puede saltarse
-- registrar_documento_anexo()/actualizar_documento_anexo() y hacer un UPDATE
-- directo. Eso tiene dos consecuencias reales:
--   1) version_actual solo se incrementa dentro del UPDATE de
--      actualizar_documento_anexo(); un UPDATE directo que cambie
--      archivo_path no lo incrementa, generando choques de version_numero en
--      documento_anexo_versiones y un historial de versiones incorrecto.
--   2) el trigger validate_documento_anexo() no valida una transición
--      activo=false -> activo=true (restauración) como sí lo hace
--      validate_documento() para documentos (migración 018): un UPDATE
--      directo podría reactivar un anexo dado de baja sin limpiar
--      eliminado_at/eliminado_por, corrompiendo la trazabilidad de auditoría.
-- Todas las escrituras deben pasar por las funciones security definer
-- (registrar_documento_anexo, actualizar_documento_anexo,
-- eliminar_documento_anexo), que son las únicas que el frontend usa
-- (src/services/anexos.service.ts solo hace SELECT directo sobre la tabla).

revoke insert, update on public.documento_anexos from authenticated;

commit;
