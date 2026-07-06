import { useMemo, useState } from "react";
import { Check, ChevronDown, Plus, RefreshCw, Search, UserRound } from "lucide-react";
import { Badge, Input, Select } from "./ui";
import type { Entidad, EntityDocumentType } from "../types";
import { entityDocumentRules, normalizeEntityDocumentNumber, validateEntityDocument } from "../lib/entity-document";

export interface EntityDraft {
  nombre: string;
  tipoDocumento: EntityDocumentType | "";
  numeroDocumento: string;
}

export function EntityCombobox({
  entities,
  entityTypeId,
  entityTypeName,
  value,
  draft,
  onChange,
  onDraftChange,
  loading = false,
  error,
  onRefresh,
}: {
  entities: Entidad[];
  entityTypeId: string;
  entityTypeName?: string;
  value: string;
  draft: EntityDraft;
  onChange: (id: string) => void;
  onDraftChange: (draft: EntityDraft) => void;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const normalizedSearch = draft.nombre.trim().toLocaleLowerCase("es");
  const filtered = useMemo(
    () => entities
      .filter((entity) => !entityTypeId || entity.tipo_entidad_id === entityTypeId)
      .filter((entity) => !normalizedSearch || [
        entity.nombre,
        entity.tipo_documento ?? "",
        entity.numero_documento ?? "",
      ].some((field) => field.toLocaleLowerCase("es").includes(normalizedSearch)))
      .slice(0, 5),
    [entities, entityTypeId, normalizedSearch],
  );
  const selected = entities.find((entity) => entity.id === value);
  const requiresIdentity = ["persona natural", "proveedor", "trabajador"].includes(entityTypeName?.toLocaleLowerCase("es") ?? "");
  const documentError = validateEntityDocument(draft.tipoDocumento, draft.numeroDocumento, requiresIdentity);
  const selectedRule = draft.tipoDocumento ? entityDocumentRules[draft.tipoDocumento] : null;
  const exactMatch = entities.some((entity) =>
    entity.tipo_entidad_id === entityTypeId
    && entity.nombre.trim().toLocaleLowerCase("es") === normalizedSearch,
  );

  const updateName = (nombre: string) => {
    onChange("");
    onDraftChange({ ...draft, nombre });
    setOpen(true);
  };

  const selectEntity = (entity: Entidad) => {
    onChange(entity.id);
    onDraftChange({
      nombre: entity.nombre,
      tipoDocumento: entity.tipo_documento ?? "",
      numeroDocumento: entity.numero_documento ?? "",
    });
    setOpen(false);
  };

  return <div className="space-y-3">
    <div className="flex gap-2">
      <div className="relative min-w-0 flex-1">
        <Search className="absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={draft.nombre}
          disabled={!entityTypeId}
          onFocus={() => setOpen(true)}
          onChange={(event) => updateName(event.target.value)}
          className="pr-10 pl-9"
          placeholder={entityTypeId ? "Buscar o escribir una entidad nueva..." : "Selecciona primero el tipo de entidad"}
          autoComplete="off"
        />
        <button type="button" disabled={!entityTypeId} onClick={() => setOpen((current) => !current)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronDown className="size-4" /></button>
      </div>
      <button
        type="button"
        disabled={!entityTypeId || loading}
        onClick={() => {
          onRefresh?.();
          setOpen(true);
        }}
        className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600 transition hover:border-teal-300 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
        title="Actualizar entidades"
      >
        <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        <span className="hidden sm:inline">Actualizar</span>
      </button>
    </div>
    <div className="relative">
      {open && entityTypeId && (
        <div className="absolute z-40 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          {loading && <p className="p-3 text-center text-sm text-slate-500">Buscando entidades...</p>}
          {filtered.map((entity) => <button type="button" key={entity.id} onClick={() => selectEntity(entity)} className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950"><UserRound className="size-4" /></div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{entity.nombre}</p><p className="text-xs text-slate-500">{[entity.tipo_documento, entity.numero_documento].filter(Boolean).join(" · ") || "Sin documento registrado"}</p></div>
            {entity.id === value && <Check className="size-4 text-teal-600" />}
          </button>)}
          {!loading && filtered.length === 0 && <p className="p-3 text-center text-sm text-slate-500">No se encontraron coincidencias.</p>}
          {draft.nombre.trim().length >= 3 && !exactMatch && <div className="mt-1 border-t border-slate-100 pt-2 dark:border-slate-800"><button type="button" onClick={() => setOpen(false)} className="flex w-full items-center gap-3 rounded-xl bg-teal-50 p-3 text-left text-teal-800 transition hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-200"><Plus className="size-4" /><div><p className="text-sm font-semibold">Registrar “{draft.nombre.trim()}”</p><p className="text-xs opacity-75">Se guardará en el catálogo al registrar el documento.</p></div></button></div>}
        </div>
      )}
    </div>
    {error && <p className="text-xs text-rose-600">{error}</p>}
    {selected ? <div className="flex flex-wrap items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"><Check className="size-4" /><strong>Entidad seleccionada:</strong> {selected.nombre}{selected.tipo_documento && <Badge tone="green">{selected.tipo_documento} {selected.numero_documento}</Badge>}</div> : draft.nombre.trim().length >= 3 ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">Entidad nueva: se validará y guardará en el catálogo con el tipo seleccionado.</div> : null}
    {!selected && draft.nombre.trim().length >= 3 && (
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className="mb-2 block text-xs font-semibold">Tipo de documento {requiresIdentity ? "*" : ""}</span><Select className="w-full" value={draft.tipoDocumento} onChange={(event) => onDraftChange({ ...draft, tipoDocumento: event.target.value as EntityDocumentType | "", numeroDocumento: normalizeEntityDocumentNumber(event.target.value as EntityDocumentType | "", draft.numeroDocumento) })}><option value="">Sin documento</option><option value="DNI">DNI</option><option value="CE">Carné de extranjería</option><option value="PASAPORTE">Pasaporte</option><option value="RUC">RUC</option><option value="OTRO">Otro</option></Select></label>
        <label><span className="mb-2 block text-xs font-semibold">Número de documento {requiresIdentity ? "*" : ""}</span><Input value={draft.numeroDocumento} onChange={(event) => onDraftChange({ ...draft, numeroDocumento: normalizeEntityDocumentNumber(draft.tipoDocumento, event.target.value) })} inputMode={selectedRule?.inputMode ?? "text"} maxLength={selectedRule?.maxLength ?? 30} placeholder={selectedRule?.placeholder ?? "Número de identificación"} />{documentError && <span className="mt-1 block text-xs text-rose-600">{documentError}</span>}</label>
      </div>
    )}
  </div>;
}
