import { useMemo, useState } from "react";
import { Plus, Search, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "./ui";
import type { CreatePersonalNaturalCommand, PersonalNatural } from "../types";

export function FirmantesCombobox({
  personas,
  selectedIds,
  onChange,
  onCreate,
}: {
  personas: PersonalNatural[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onCreate: (command: CreatePersonalNaturalCommand) => Promise<PersonalNatural>;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [dni, setDni] = useState("");
  const [ruc, setRuc] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [cargo, setCargo] = useState("");
  const [creating, setCreating] = useState(false);

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

  const addPersona = (persona: PersonalNatural) => {
    onChange([...selectedIds, persona.id]);
    setQuery("");
    setOpen(false);
  };

  const removePersona = (id: string) => onChange(selectedIds.filter((selectedId) => selectedId !== id));

  const createNew = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const created = await onCreate({ nombre: query.trim().toLocaleUpperCase("es"), dni: dni.trim() || null, ruc: ruc.trim() || null, fechaNacimiento: fechaNacimiento || null, cargo: cargo.trim() || null });
      onChange([...selectedIds, created.id]);
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
    <div className="space-y-3">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((persona) => (
            <span key={persona.id} className="inline-flex items-center gap-2 rounded-full bg-teal-50 py-1.5 pl-3 pr-2 text-xs font-semibold text-teal-800 dark:bg-teal-950/40 dark:text-teal-200">
              {persona.nombre}
              <button type="button" aria-label={`Quitar a ${persona.nombre}`} onClick={() => removePersona(persona.id)} className="rounded-full p-0.5 hover:bg-teal-100 dark:hover:bg-teal-900"><X className="size-3" /></button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          className="pl-9"
          placeholder="Buscar o escribir el nombre de quien firmó..."
          autoComplete="off"
        />
      </div>
      {open && (
        <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          {filtered.map((persona) => (
            <button type="button" key={persona.id} onClick={() => addPersona(persona)} className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800">
              <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950"><UserRound className="size-4" /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{persona.nombre}</p>
                <p className="text-xs text-slate-500">{[persona.cargo, persona.dni ? `DNI ${persona.dni}` : null, persona.ruc ? `RUC ${persona.ruc}` : null].filter(Boolean).join(" · ") || "Sin documento registrado"}</p>
              </div>
            </button>
          ))}
          {!filtered.length && !term && <p className="p-3 text-center text-xs text-slate-400">Escribí para buscar un firmante registrado.</p>}
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
  );
}
