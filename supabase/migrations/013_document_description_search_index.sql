create extension if not exists pg_trgm;

create index if not exists idx_documentos_descripcion_trgm
on public.documentos using gin (descripcion gin_trgm_ops);
