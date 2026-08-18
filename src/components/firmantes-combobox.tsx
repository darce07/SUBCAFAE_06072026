import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Plus, Search, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Input, Select } from "./ui";
import type { CatalogItem, CreatePersonalNaturalCommand, PersonalNatural } from "../types";

export function FirmantesCombobox({
  personas,
  selectedIds,
  onChange,
  onCreate,
  single = false,
  entidades,
  representaEntidadId = null,
  onRepresentaEntidadChange,
  allowDirectEntidad = false,
  entidadSelectedId = null,
  onEntidadSelect,
}: {
  personas: PersonalNatural[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onCreate: (command: CreatePersonalNaturalCommand) => Promise<PersonalNatural>;
  // single=true: selecciona una sola persona (reemplaza en vez de acumular) -
  // para Emisor/Receptor, que son roles de uno solo por documento.
  single?: boolean;
  entidades?: CatalogItem[];
  representaEntidadId?: string | null;
  onRepresentaEntidadChange?: (entidadId: string | null) => void;
  // allowDirectEntidad: además de personas, permite elegir una entidad
  // (institución) directamente como el firmante, sin pasar por una persona
  // que la represente. Solo tiene sentido junto con single=true.
  allowDirectEntidad?: boolean;
  entidadSelectedId?: string | null;
  onEntidadSelect?: (entidadId: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [dni, setDni] = useState("");
  const [ruc, setRuc] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [cargo, setCargo] = useState("");
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const term = query.trim().toLocaleLowerCase("es");
  const selected = useMemo(
    () => selectedIds.map((id) => personas.find((persona) => persona.id === id)).filter((persona): persona is PersonalNatural => Boolean(persona)),
    [personas, selectedIds],
  );
  const filtered = useMemo(
    () => personas
      .filter((persona) => persona.activo && !selectedIds.includes(persona.id))
      .filter((persona) => !term || [persona.nombre, persona.dni ?? "", persona.ruc ?? ""].some((value) => value.toLocaleLowerCase("es").includes(term)))
      .slice(0, 5),
    [personas, selectedIds, term],
  );
  const exactMatch = personas.some((persona) => persona.nombre.trim().toLocaleLowerCase("es") === term);

  const entidadSeleccionada = useMemo(
    () => (allowDirectEntidad ? entidades?.find((item) => item.id === entidadSelectedId) ?? null : null),
    [allowDirectEntidad, entidades, entidadSelectedId],
  );
  const filteredEntidades = useMemo(
    () => (allowDirectEntidad ? (entidades ?? [])
      .filter((item) => item.activo)
      .filter((item) => !term || item.nombre.toLocaleLowerCase("es").includes(term))
      .slice(0, 5) : []),
    [allowDirectEntidad, entidades, term],
  );

  const addPersona = (persona: PersonalNatural) => {
    onChange(single ? [persona.id] : [...selectedIds, persona.id]);
    setQuery("");
    setOpen(false);
  };

  const selectEntidad = (entidad: CatalogItem) => {
    onEntidadSelect?.(entidad.id);
    onChange([]);
    setQuery("");
    setOpen(false);
  };

  const removeEntidad = () => {
    onEntidadSelect?.(null);
  };

  const removePersona = (id: string) => {
    onChange(selectedIds.filter((selectedId) => selectedId !== id));
    onRepresentaEntidadChange?.(null);
  };

  const createNew = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const created = await onCreate({ nombre: query.trim().toLocaleUpperCase("es"), dni: dni.trim() || null, ruc: ruc.trim() || null, fechaNacimiento: fechaNacimiento || null, cargo: cargo.trim() || null });
      onChange(single ? [created.id] : [...selectedIds, created.id]);
      setQuery("");
      setDni("");
      setRuc("");
      setFechaNacimiento("");
      setCargo("");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo registrar el firmante.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={containerRef} className="space-y-3">
      {(selected.length > 0 || entidadSeleccionada) && (
        <div className="flex flex-wrap gap-2">
          {selected.map((persona) => (
            <span key={persona.id} className="inline-flex items-center gap-2 rounded-full bg-teal-50 py-1.5 pl-3 pr-2 text-xs font-semibold text-teal-800 dark:bg-teal-950/40 dark:text-teal-200">
              {persona.nombre}
              <button type="button" aria-label={`Quitar a ${persona.nombre}`} onClick={() => removePersona(persona.id)} className="rounded-full p-0.5 hover:bg-teal-100 dark:hover:bg-teal-900"><X className="size-3" /></button>
            </span>
          ))}
          {entidadSeleccionada && (
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 py-1.5 pl-3 pr-2 text-xs font-semibold text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
              <Building2 className="size-3" />{entidadSeleccionada.nombre}
              <button type="button" aria-label={`Quitar a ${entidadSeleccionada.nombre}`} onClick={removeEntidad} className="rounded-full p-0.5 hover:bg-blue-100 dark:hover:bg-blue-900"><X className="size-3" /></button>
            </span>
          )}
        </div>
      )}
      {single && selected.length > 0 && entidades && (
        <label>
          <span className="mb-1 block text-xs font-semibold text-slate-500">Firmó en representación de (opcional)</span>
          <Select className="w-full" value={representaEntidadId ?? ""} onChange={(event) => onRepresentaEntidadChange?.(event.target.value || null)}>
            <option value="">No aplica</option>
            {entidades.filter((item) => item.activo).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
          </Select>
        </label>
      )}
      {(!single || (selected.length === 0 && !entidadSeleccionada)) && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
            className="pl-9"
            placeholder={allowDirectEntidad ? "Buscar persona o entidad (institución)..." : "Buscar o escribir el nombre de quien firmó..."}
            autoComplete="off"
          />
          {open && (
            <div className="absolute z-20 mt-1 max-h-96 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
              {filteredEntidades.map((entidad) => (
                <button type="button" key={entidad.id} onClick={() => selectEntidad(entidad)} className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800">
                  <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950"><Building2 className="size-4" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{entidad.nombre}</p>
                    <p className="text-xs text-slate-500">Entidad / institución</p>
                  </div>
                </button>
              ))}
              {filtered.map((persona) => (
                <button type="button" key={persona.id} onClick={() => addPersona(persona)} className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800">
                  <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950"><UserRound className="size-4" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{persona.nombre}</p>
                    <p className="text-xs text-slate-500">{[persona.cargo, persona.dni ? `DNI ${persona.dni}` : null, persona.ruc ? `RUC ${persona.ruc}` : null].filter(Boolean).join(" · ") || "Sin documento registrado"}</p>
                  </div>
                </button>
              ))}
              {!filtered.length && !filteredEntidades.length && !term && <p className="p-3 text-center text-xs text-slate-400">Escribí para buscar un firmante registrado.</p>}
              {term.length >= 3 && !exactMatch && (
                <div className="mt-1 space-y-3 border-t border-slate-100 p-3 dark:border-slate-800">
                  <p className="text-xs font-semibold text-teal-800 dark:text-teal-300">Registrar “{query.trim()}” como nuevo firmante</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label><span className="mb-1 block text-xs font-semibold">DNI (opcional)</span><Input value={dni} onChange={(event) => setDni(event.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" maxLength={8} placeholder="12345678" /></label>
                    <label><span className="mb-1 block text-xs font-semibold">RUC (opcional)</span><Input value={ruc} onChange={(event) => setRuc(event.target.value.replace(/\D/g, "").slice(0, 11))} inputMode="numeric" maxLength={11} placeholder="10123456789" /></label>
                    <label className="sm:col-span-2"><span className="mb-1 block text-xs font-semibold">Cargo (opcional)</span><Input value={cargo} onChange={(event) => setCargo(event.target.value)} placeholder="Ej. Gerente, Presidente..." /></label>
                    <label className="sm:col-span-2"><span className="mb-1 block text-xs font-semibold">Fecha de nacimiento (opcional)</span><Input type="date" value={fechaNacimiento} onChange={(event) => setFechaNacimiento(event.target.value)} /></label>
                  </div>
                  <button type="button" disabled={creating} onClick={() => void createNew()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 p-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60">
                    <Plus className="size-4" />{creating ? "Registrando..." : "Registrar y agregar como firmante"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
