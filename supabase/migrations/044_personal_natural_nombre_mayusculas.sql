begin;

-- Estandariza el nombre de personal_natural en mayusculas, sin importar la
-- via de entrada (catalogo directo o el RPC crear_o_obtener_personal_natural).
create or replace function public.normalizar_nombre_personal_natural()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.nombre = upper(trim(new.nombre));
  return new;
end;
$$;

drop trigger if exists trg_personal_natural_nombre_mayusculas on public.personal_natural;
create trigger trg_personal_natural_nombre_mayusculas
before insert or update of nombre on public.personal_natural
for each row execute function public.normalizar_nombre_personal_natural();

update public.personal_natural
set nombre = upper(trim(nombre))
where nombre <> upper(trim(nombre));

commit;
