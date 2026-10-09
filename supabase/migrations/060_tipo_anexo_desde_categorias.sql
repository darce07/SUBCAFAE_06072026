begin;

-- El anexo se clasifica con la misma lista que el documento principal
-- (Categorias: Oficios, Facturas, Actas...). Para no tocar la tabla de anexos,
-- sus funciones ni las validaciones, cada categoria se refleja como un tipo de
-- anexo con el mismo nombre y se mantiene sincronizada. Los tipos antiguos
-- (Sustento, Evidencia, ...) se conservan para los anexos que ya los usan.

insert into public.catalogo_tipo_anexo (nombre, descripcion, activo)
select c.nombre, 'Categoría', c.activo
from public.catalogo_categorias c
on conflict (nombre) do update set activo = excluded.activo;

create or replace function public.sincronizar_tipo_anexo_con_categoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Renombrar una categoria renombra tambien su tipo de anexo (si no hay otro con ese nombre).
  if tg_op = 'UPDATE' and lower(old.nombre) <> lower(new.nombre) then
    update public.catalogo_tipo_anexo
    set nombre = new.nombre, activo = new.activo
    where lower(nombre) = lower(old.nombre)
      and not exists (select 1 from public.catalogo_tipo_anexo x where lower(x.nombre) = lower(new.nombre));
  end if;

  insert into public.catalogo_tipo_anexo (nombre, descripcion, activo)
  values (new.nombre, 'Categoría', new.activo)
  on conflict (nombre) do update set activo = excluded.activo;

  return new;
end;
$$;

drop trigger if exists trg_categorias_sync_tipo_anexo on public.catalogo_categorias;
create trigger trg_categorias_sync_tipo_anexo
after insert or update of nombre, activo on public.catalogo_categorias
for each row execute function public.sincronizar_tipo_anexo_con_categoria();

commit;
