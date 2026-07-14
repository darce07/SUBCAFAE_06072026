import { useMemo, useState } from "react";
import { Boxes, Pencil, Plus, Power, RotateCcw, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Input, PageHeader, Select, Badge } from "../components/ui";
import { useCatalogos } from "../hooks/use-catalogos";
import { ConfirmDialog } from "../components/confirm-dialog";
import type { CatalogItem, CatalogTable, CatalogosData, Entidad, EntityDocumentType } from "../types";
import { usePermissions } from "../hooks/use-permissions";

const definitions: Array<{
  table: CatalogTable;
  key: keyof CatalogosData;
  name: string;
  description: string;
  color: string;
}> = [
  { table: "catalogo_categorias", key: "categorias", name: "Categorías", description: "Clasificación principal de documentos", color: "bg-teal-500" },
  { table: "catalogo_tipo_entidad", key: "tiposEntidad", name: "Tipos de entidad", description: "Persona natural, jurídica o pública", color: "bg-blue-500" },
  { table: "entidades", key: "entidades", name: "Entidades", description: "Contrapartes vinculadas a documentos", color: "bg-violet-500" },
  { table: "catalogo_tipo_categoria", key: "tiposCategoria", name: "Tipos de categoría", description: "Agrupación administrativa y financiera", color: "bg-amber-500" },
  { table: "catalogo_estado_documento", key: "estadosDocumento", name: "Estados", description: "Ciclo de vida documental", color: "bg-emerald-500" },
  { table: "catalogo_archivadores", key: "archivadores", name: "Archivadores", description: "Ubicaciones para la custodia física", color: "bg-orange-500" },
  { table: "catalogo_tipo_movimiento", key: "tiposMovimiento", name: "Tipos de movimiento", description: "Ingreso, egreso o no aplica", color: "bg-rose-500" },
  { table: "catalogo_tipo_operacion", key: "tiposOperacion", name: "Tipos de operación", description: "Detalle económico de movimientos", color: "bg-slate-500" },
  { table: "catalogo_tipo_anexo", key: "tiposAnexo", name: "Tipos de anexo", description: "Clasificación de documentos complementarios", color: "bg-cyan-500" },
];

type StatusFilter = "todos" | "activos" | "inactivos";
type DescriptionFilter = "todos" | "con_descripcion" | "sin_descripcion";

export function CatalogsPage() {
  const catalogos = useCatalogos();
  const { canCreate, canEdit } = usePermissions();
  const [selectedTable, setSelectedTable] = useState<CatalogTable>("catalogo_categorias");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [descriptionFilter, setDescriptionFilter] = useState<DescriptionFilter>("todos");
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [entityDocumentFilter, setEntityDocumentFilter] = useState<"" | EntityDocumentType>("");
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [entityTypeId, setEntityTypeId] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<CatalogItem | null>(null);
  const selectedDefinition = definitions.find((item) => item.table === selectedTable)!;
  const selectedItems = catalogos[selectedDefinition.key] as CatalogItem[];
  const activeFilterCount = [
    statusFilter !== "todos",
    descriptionFilter !== "todos",
    selectedTable === "entidades" && Boolean(entityTypeFilter),
    selectedTable === "entidades" && Boolean(entityDocumentFilter),
  ].filter(Boolean).length;
  const filteredItems = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    return selectedItems.filter((item) => {
      const entity = selectedTable === "entidades" ? item as Entidad : null;
      const entityTypeName = entity ? catalogos.tiposEntidad.find((type) => type.id === entity.tipo_entidad_id)?.nombre ?? "" : "";
      const searchable = [
        item.nombre,
        item.descripcion ?? "",
        entity?.tipo_documento ?? "",
        entity?.numero_documento ?? "",
        entityTypeName,
      ].join(" ").toLocaleLowerCase("es");
      const matchesSearch = !term || searchable.includes(term);
      const matchesStatus =
        statusFilter === "todos"
        || (statusFilter === "activos" && item.activo)
        || (statusFilter === "inactivos" && !item.activo);
      const hasDescription = Boolean(item.descripcion?.trim());
      const matchesDescription =
        descriptionFilter === "todos"
        || (descriptionFilter === "con_descripcion" && hasDescription)
        || (descriptionFilter === "sin_descripcion" && !hasDescription);
      const matchesEntityType = selectedTable !== "entidades" || !entityTypeFilter || entity?.tipo_entidad_id === entityTypeFilter;
      const matchesEntityDocument = selectedTable !== "entidades" || !entityDocumentFilter || entity?.tipo_documento === entityDocumentFilter;
      return matchesSearch && matchesStatus && matchesDescription && matchesEntityType && matchesEntityDocument;
    });
  }, [catalogos.tiposEntidad, descriptionFilter, entityDocumentFilter, entityTypeFilter, search, selectedItems, selectedTable, statusFilter]);

  const resetFilters = () => {
    setStatusFilter("todos");
    setDescriptionFilter("todos");
    setEntityTypeFilter("");
    setEntityDocumentFilter("");
  };

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setEntityTypeId("");
    setShowForm(true);
  };

  const openEdit = (item: CatalogItem) => {
    setEditing(item);
    setName(item.nombre);
    setDescription(item.descripcion ?? "");
    setEntityTypeId("tipo_entidad_id" in item ? String(item.tipo_entidad_id ?? "") : "");
    setShowForm(true);
  };

  const submit = async () => {
    if (saving) return;
    if (!name.trim()) {
      toast.error("El nombre es obligatorio.");
      return;
    }
    try {
      setSaving(true);
      const values = {
        nombre: name.trim(),
        descripcion: description.trim() || null,
        ...(selectedTable === "entidades" ? { tipo_entidad_id: entityTypeId || null } : {}),
      };
      if (editing) await catalogos.update(selectedTable, editing.id, values);
      else await catalogos.create(selectedTable, values);
      toast.success(editing ? "Valor actualizado." : "Valor creado.");
      setShowForm(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el catálogo.");
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (item: CatalogItem) => {
    if (deletingId) return;
    try {
      setDeletingId(item.id);
      await catalogos.remove(selectedTable, item);
      toast.success("Valor eliminado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar el valor.");
    } finally {
      setDeletingId(null);
      setPendingRemove(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administración"
        title="Catálogos"
        description="Administra los valores utilizados para clasificar y organizar la información."
        action={canCreate("catalogos") ? <Button onClick={openCreate}><Plus className="size-4" />Nuevo valor</Button> : undefined}
      />
      {catalogos.usingFallback && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">La conexión institucional no está disponible. Los cambios se mantienen solo durante esta sesión.</div>}
      {catalogos.error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{catalogos.error}</div>}
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        <div className="space-y-2">
          {definitions.map((definition) => {
            const values = catalogos[definition.key] as CatalogItem[];
            return <button key={definition.table} onClick={() => { setSelectedTable(definition.table); setSearch(""); resetFilters(); }} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${selectedTable === definition.table ? "border-teal-500 bg-teal-50 dark:bg-teal-950/40" : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"}`}><div className={`grid size-9 place-items-center rounded-lg text-white ${definition.color}`}><Boxes className="size-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{definition.name}</p><p className="text-xs text-slate-500">{values.length} valores</p></div></button>;
          })}
        </div>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 p-5 dark:border-slate-800">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div><h2 className="text-lg font-bold">{selectedDefinition.name}</h2><p className="text-sm text-slate-500">{filteredItems.length} de {selectedItems.length} valores</p></div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <div className="relative w-full sm:w-72"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Buscar nombre o descripción..." /></div>
                <Button variant="secondary" onClick={() => setShowFilters((value) => !value)}>
                  <SlidersHorizontal className="size-4" />
                  Filtros{activeFilterCount ? ` (${activeFilterCount})` : ""}
                </Button>
              </div>
            </div>
            {showFilters && (
              <div className="mt-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-2 lg:grid-cols-4">
                <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
                  <option value="todos">Estado: todos</option>
                  <option value="activos">Estado: activos</option>
                  <option value="inactivos">Estado: inactivos</option>
                </Select>
                <Select value={descriptionFilter} onChange={(event) => setDescriptionFilter(event.target.value as DescriptionFilter)}>
                  <option value="todos">Descripción: todas</option>
                  <option value="con_descripcion">Con descripción</option>
                  <option value="sin_descripcion">Sin descripción</option>
                </Select>
                {selectedTable === "entidades" && (
                  <>
                    <Select value={entityTypeFilter} onChange={(event) => setEntityTypeFilter(event.target.value)}>
                      <option value="">Tipo entidad: todos</option>
                      {catalogos.tiposEntidad.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                    </Select>
                    <Select value={entityDocumentFilter} onChange={(event) => setEntityDocumentFilter(event.target.value as "" | EntityDocumentType)}>
                      <option value="">Documento: todos</option>
                      <option value="DNI">DNI</option>
                      <option value="CE">CE</option>
                      <option value="PASAPORTE">Pasaporte</option>
                      <option value="RUC">RUC</option>
                      <option value="OTRO">Otro</option>
                    </Select>
                  </>
                )}
                <Button variant="secondary" onClick={resetFilters} disabled={!activeFilterCount}>
                  <RotateCcw className="size-4" />Limpiar
                </Button>
              </div>
            )}
          </div>
          <div className="responsive-card-list gap-3 p-3 sm:grid-cols-2">
            {filteredItems.map((item) => {
              const entity = selectedTable === "entidades" ? item as Entidad : null;
              const identity = entity
                ? [entity.tipo_documento, entity.numero_documento].filter(Boolean).join(" · ")
                : "";
              return (
                <div key={item.id} className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 ${!item.activo ? "opacity-70" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-base font-bold text-slate-900 dark:text-white">{item.nombre}</p>
                      <p className="mt-1 break-words text-sm text-slate-500">{identity || item.descripcion || "Sin descripción"}</p>
                    </div>
                    <Badge tone={item.activo ? "green" : "slate"}>{item.activo ? "Activo" : "Inactivo"}</Badge>
                  </div>
                  {canEdit("catalogos") && (
                    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <Button variant="secondary" onClick={() => openEdit(item)}>
                        <Pencil className="size-4" />Editar
                      </Button>
                      <Button variant="secondary" onClick={() => void catalogos.toggleActive(selectedTable, item)}>
                        <Power className={`size-4 ${item.activo ? "text-rose-600" : "text-emerald-600"}`} />
                        {item.activo ? "Desactivar" : "Activar"}
                      </Button>
                      <Button variant="danger" loading={deletingId === item.id} onClick={() => setPendingRemove(item)}>
                        <Trash2 className="size-4" />Eliminar
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
            {!filteredItems.length && (
              <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm text-slate-500 dark:border-slate-800">
                No se encontraron valores para la búsqueda actual.
              </div>
            )}
          </div>
          <div className="table-scroll responsive-table">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900"><tr><th className="px-5 py-3">Nombre</th><th className="px-5 py-3">Descripción</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3 text-right">Acciones</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredItems.map((item) => {
                  const entity = selectedTable === "entidades" ? item as Entidad : null;
                  const identity = entity
                    ? [entity.tipo_documento, entity.numero_documento].filter(Boolean).join(" · ")
                    : "";
                  return <tr key={item.id} className={!item.activo ? "opacity-60" : ""}><td className="px-5 py-4 font-semibold">{item.nombre}</td><td className="max-w-md px-5 py-4 text-slate-500">{identity || item.descripcion || "Sin descripción"}</td><td className="px-5 py-4"><Badge tone={item.activo ? "green" : "slate"}>{item.activo ? "Activo" : "Inactivo"}</Badge></td><td className="px-5 py-4"><div className="flex justify-end gap-1">{canEdit("catalogos") && <><Button variant="ghost" size="icon" title="Editar" onClick={() => openEdit(item)}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" title={item.activo ? "Desactivar" : "Activar"} onClick={() => void catalogos.toggleActive(selectedTable, item)}><Power className={`size-4 ${item.activo ? "text-rose-600" : "text-emerald-600"}`} /></Button><Button variant="ghost" size="icon" loading={deletingId === item.id} title="Eliminar" onClick={() => void removeItem(item)}><Trash2 className="size-4 text-rose-600" /></Button></>}</div></td></tr>;
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-slate-950/55 p-3 sm:p-4">
          <Card className="modal-panel p-5 sm:p-6" style={{ "--modal-width": "32rem" } as React.CSSProperties}>
            <div className="mb-5 flex items-start justify-between"><div><h2 className="text-lg font-bold">{editing ? "Editar valor" : "Nuevo valor"}</h2><p className="text-sm text-slate-500">{selectedDefinition.name}</p></div><button onClick={() => setShowForm(false)}><X className="size-5 text-slate-400" /></button></div>
            <div className="space-y-4">
              <label><span className="mb-2 block text-sm font-semibold">Nombre *</span><Input value={name} onChange={(event) => setName(event.target.value)} autoFocus /></label>
              <label><span className="mb-2 block text-sm font-semibold">Descripción</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-950" /></label>
              {selectedTable === "entidades" && <label><span className="mb-2 block text-sm font-semibold">Tipo de entidad</span><Select className="w-full" value={entityTypeId} onChange={(event) => setEntityTypeId(event.target.value)}><option value="">Sin tipo</option>{catalogos.tiposEntidad.filter((item) => item.activo).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</Select></label>}
            </div>
            <div className="mt-6 flex justify-end gap-2"><Button variant="secondary" disabled={saving} onClick={() => setShowForm(false)}>Cancelar</Button><Button loading={saving} onClick={() => void submit()}>Guardar</Button></div>
          </Card>
        </div>
      )}
      <ConfirmDialog
        open={pendingRemove !== null}
        onOpenChange={(nextOpen) => { if (!nextOpen) setPendingRemove(null); }}
        title="Eliminar valor de catálogo"
        description={pendingRemove ? `¿Eliminar "${pendingRemove.nombre}"? Esta acción no se puede deshacer.` : ""}
        confirmLabel="Eliminar"
        loading={pendingRemove ? deletingId === pendingRemove.id : false}
        onConfirm={() => { if (pendingRemove) void removeItem(pendingRemove); }}
      />
    </div>
  );
}
