import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { CSSProperties } from "react";
import { MapPin, Plus, Power, X } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Input } from "./ui";
import type { InventarioArea } from "../types";

export function InventarioAreasDialog({
  open,
  onOpenChange,
  areas,
  onCreate,
  onToggleActive,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  areas: InventarioArea[];
  onCreate: (nombre: string) => Promise<InventarioArea>;
  onToggleActive: (area: InventarioArea) => Promise<void>;
}) {
  const [nombre, setNombre] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const submit = async () => {
    if (!nombre.trim()) {
      toast.error("El nombre del área es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      await onCreate(nombre.trim());
      toast.success("Área creada.");
      setNombre("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear el área.");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (area: InventarioArea) => {
    setTogglingId(area.id);
    try {
      await onToggleActive(area);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el área.");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[110] grid place-items-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-4">
          <Dialog.Content
            className="modal-panel rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:p-6"
            style={{ "--modal-width": "26rem" } as CSSProperties}
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="size-5 text-teal-700" />
                <Dialog.Title className="text-lg font-bold">Áreas de inventario</Dialog.Title>
              </div>
              <Dialog.Close aria-label="Cerrar"><X className="size-5 text-slate-400" /></Dialog.Close>
            </div>
            <Dialog.Description className="mb-3 text-sm text-slate-500">
              Administra las áreas disponibles sin salir del formulario.
            </Dialog.Description>
            <div className="flex gap-2">
              <Input
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                placeholder="Nombre del área (ej. Almacén 1)"
                onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void submit(); } }}
              />
              <Button onClick={() => void submit()} loading={saving}><Plus className="size-4" />Agregar</Button>
            </div>
            <div className="mt-4 max-h-64 space-y-1 overflow-y-auto">
              {areas.length === 0 && <p className="py-4 text-center text-sm text-slate-400">Sin áreas registradas.</p>}
              {areas.map((area) => (
                <div key={area.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-2.5 dark:border-slate-800">
                  <span className="min-w-0 truncate text-sm font-medium">{area.nombre}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={area.activo ? "green" : "slate"}>{area.activo ? "Activa" : "Inactiva"}</Badge>
                    <Button variant="ghost" size="icon" loading={togglingId === area.id} title={area.activo ? "Desactivar" : "Activar"} onClick={() => void toggle(area)}>
                      <Power className={`size-4 ${area.activo ? "text-rose-600" : "text-emerald-600"}`} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
