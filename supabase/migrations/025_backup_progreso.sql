begin;

-- La barra de "Procesando" no tenía forma de mostrar % real: la Edge
-- Function solo escribía el resultado final. Se agregan dos columnas que la
-- function actualiza durante el proceso (después de saber cuántos archivos
-- hay, y después de cada lote de descargas) para que el polling del
-- frontend pueda calcular un porcentaje real en vez de una barra genérica.

alter table public.backups_generados add column if not exists total_archivos integer;
alter table public.backups_generados add column if not exists archivos_procesados integer not null default 0;

commit;
