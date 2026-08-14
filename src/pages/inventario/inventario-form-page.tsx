import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Camera, ImagePlus, LoaderCircle, MapPin, Save, X } from "lucide-react";
import { Alert, Button, Card, EmptyState, Input, PageHeader, Select } from "../../components/ui";
import { Field } from "../../components/form-field";
import { InventarioAreasDialog } from "../../components/inventario-areas-dialog";
import { useInventarioAreas } from "../../hooks/use-inventario";
import { usePermissions } from "../../hooks/use-permissions";
import {
  getInventarioFotoPublicUrl,
  getInventarioItem,
  removeInventarioFoto,
  uploadInventarioFoto,
} from "../../services/inventario.service";
import { useInventarioItems } from "../../hooks/use-inventario";
import { estadoInventarioLabel, ESTADO_INVENTARIO_OPTIONS } from "./inventario-constants";
import type { EstadoInventarioItem, InventarioFoto, InventarioItem } from "../../types";

export function InventarioFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { canCreate, canEdit } = usePermissions();
  const { areas, create: createArea, toggleActive: toggleAreaActive } = useInventarioAreas();
  const { create, update } = useInventarioItems();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(isEdit);
  const [item, setItem] = useState<InventarioItem | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [color, setColor] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [estado, setEstado] = useState<EstadoInventarioItem>("nuevo");
  const [areaId, setAreaId] = useState("");
  const [activo, setActivo] = useState(true);
  const [fotos, setFotos] = useState<InventarioFoto[]>([]);
  // Antes de guardar el item todavia no hay item_id para el storage path, asi
  // que las fotos elegidas quedan en memoria (con su preview) y se suben
  // recien despues de crear el registro - igual que los anexos de documentos.
  const [pendingFiles, setPendingFiles] = useState<{ file: File; previewUrl: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [areasDialogOpen, setAreasDialogOpen] = useState(false);

  const allowed = isEdit ? canEdit("inventario") : canCreate("inventario");

  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setLoading(true);
    void getInventarioItem(id)
      .then((row) => {
        if (cancelled || !row) return;
        setItem(row);
        setNombre(row.nombre);
        setDescripcion(row.descripcion ?? "");
        setColor(row.color ?? "");
        setCantidad(row.cantidad);
        setEstado(row.estado);
        setAreaId(row.area_id ?? "");
        setActivo(row.activo);
        setFotos(row.fotos ?? []);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "No se pudo cargar el ítem."))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, isEdit]);

  if (!allowed) {
    return <Card className="p-8 text-center"><h1 className="font-serif text-xl font-bold">Acceso restringido</h1><p className="mt-2 text-sm text-slate-500">No tienes permiso para {isEdit ? "editar" : "crear"} ítems de inventario.</p></Card>;
  }

  if (loading) return <div className="grid min-h-96 place-items-center"><LoaderCircle className="size-8 animate-spin text-teal-600" /></div>;
  if (isEdit && !item) return <EmptyState icon={<MapPin />} title="Ítem no encontrado" description="El registro solicitado no existe o no está disponible." />;

  const onFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (isEdit && id) {
      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          const foto = await uploadInventarioFoto(id, file);
          setFotos((current) => [...current, foto]);
        }
        toast.success("Fotos subidas correctamente.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo subir alguna de las fotos.");
      } finally {
        setUploading(false);
      }
    } else {
      setPendingFiles((current) => [
        ...current,
        ...Array.from(files).map((file) => ({ file, previewUrl: URL.createObjectURL(file) })),
      ]);
    }
    if (galleryInputRef.current) galleryInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const onRemovePendingFile = (index: number) => {
    setPendingFiles((current) => {
      URL.revokeObjectURL(current[index].previewUrl);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  useEffect(() => () => {
    pendingFiles.forEach((pending) => URL.revokeObjectURL(pending.previewUrl));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRemoveFoto = async (foto: InventarioFoto) => {
    try {
      await removeInventarioFoto(foto);
      setFotos((current) => current.filter((item) => item.id !== foto.id));
      toast.success("Foto eliminada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar la foto.");
    }
  };

  const submit = async () => {
    if (!nombre.trim() || nombre.trim().length < 2) {
      toast.error("El nombre del ítem es obligatorio (mínimo 2 caracteres).");
      return;
    }
    if (cantidad <= 0) {
      toast.error("La cantidad debe ser mayor a cero.");
      return;
    }
    setSaving(true);
    try {
      const input = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        color: color.trim() || null,
        cantidad,
        estado,
        areaId: areaId || null,
      };
      if (isEdit && id) {
        await update(id, { ...input, activo });
        toast.success("Ítem actualizado.");
        navigate(`/inventario/${id}`);
      } else {
        const created = await create(input);
        if (pendingFiles.length) {
          setUploading(true);
          try {
            for (const pending of pendingFiles) {
              await uploadInventarioFoto(created.id, pending.file);
              URL.revokeObjectURL(pending.previewUrl);
            }
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "El ítem se guardó, pero alguna foto no se pudo subir.");
          } finally {
            setUploading(false);
          }
        }
        toast.success("Ítem creado.");
        navigate(`/inventario/${created.id}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el ítem de inventario.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inventariado interno"
        title={isEdit ? "Editar ítem" : "Nuevo ítem"}
        description="Registra los datos del bien; el código de barras y el QR se generan automáticamente al guardar."
      />
      <Card className="space-y-5 p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre *" className="sm:col-span-2">
            <Input value={nombre} onChange={(event) => setNombre(event.target.value)} placeholder="Ej. Silla giratoria" autoFocus />
          </Field>
          <Field label="Descripción" className="sm:col-span-2">
            <textarea
              value={descripcion}
              onChange={(event) => setDescripcion(event.target.value)}
              className="min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-950"
              placeholder="Detalles adicionales del bien"
            />
          </Field>
          <Field label="Color">
            <Input value={color} onChange={(event) => setColor(event.target.value)} placeholder="Ej. Negro" />
          </Field>
          <Field label="Cantidad *">
            <Input type="number" min={1} value={cantidad} onChange={(event) => setCantidad(Math.max(1, Number(event.target.value) || 1))} />
          </Field>
          <Field label="Estado *">
            <Select value={estado} onChange={(event) => setEstado(event.target.value as EstadoInventarioItem)}>
              {ESTADO_INVENTARIO_OPTIONS.map((value) => <option key={value} value={value}>{estadoInventarioLabel[value]}</option>)}
            </Select>
          </Field>
          <Field label="Área">
            <div className="flex gap-2">
              <Select className="flex-1" value={areaId} onChange={(event) => setAreaId(event.target.value)}>
                <option value="">Sin área</option>
                {areas.filter((area) => area.activo || area.id === areaId).map((area) => <option key={area.id} value={area.id}>{area.nombre}</option>)}
              </Select>
              <Button type="button" variant="secondary" onClick={() => setAreasDialogOpen(true)} title="Administrar áreas">
                <MapPin className="size-4" />
              </Button>
            </div>
          </Field>
          {isEdit && (
            <Field label="Estado del registro">
              <Select value={activo ? "activo" : "inactivo"} onChange={(event) => setActivo(event.target.value === "activo")}>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </Select>
            </Field>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Fotos</p>
          {!isEdit && pendingFiles.length === 0 && <Alert variant="info" className="mb-3">Las fotos que elijas acá se suben al guardar el ítem.</Alert>}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {fotos.map((foto) => (
              <div key={foto.id} className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                <img src={getInventarioFotoPublicUrl(foto.storage_path)} alt="Foto del ítem" className="h-full w-full object-cover" />
                <button
                  type="button"
                  aria-label="Eliminar foto"
                  onClick={() => void onRemoveFoto(foto)}
                  className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-slate-950/70 text-white opacity-0 transition group-hover:opacity-100"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
            {pendingFiles.map((pending, index) => (
              <div key={pending.previewUrl} className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                <img src={pending.previewUrl} alt="Foto pendiente de guardar" className="h-full w-full object-cover" />
                <button
                  type="button"
                  aria-label="Quitar foto"
                  onClick={() => onRemovePendingFile(index)}
                  className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-slate-950/70 text-white opacity-0 transition group-hover:opacity-100"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={uploading}
              title="Tomar foto"
              className="grid aspect-square place-items-center rounded-xl border border-dashed border-slate-300 text-slate-400 transition hover:border-teal-400 hover:text-teal-600 disabled:opacity-50 dark:border-slate-700"
            >
              {uploading ? <LoaderCircle className="size-5 animate-spin" /> : <Camera className="size-5" />}
            </button>
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              disabled={uploading}
              title="Elegir de galería"
              className="grid aspect-square place-items-center rounded-xl border border-dashed border-slate-300 text-slate-400 transition hover:border-teal-400 hover:text-teal-600 disabled:opacity-50 dark:border-slate-700"
            >
              {uploading ? <LoaderCircle className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
            </button>
          </div>
          <input ref={cameraInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={(event) => void onFilesSelected(event.target.files)} />
          <input ref={galleryInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(event) => void onFilesSelected(event.target.files)} />
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button variant="secondary" onClick={() => navigate(-1)}>Cancelar</Button>
          <Button loading={saving} onClick={() => void submit()}><Save className="size-4" />Guardar</Button>
        </div>
      </Card>

      <InventarioAreasDialog
        open={areasDialogOpen}
        onOpenChange={setAreasDialogOpen}
        areas={areas}
        onCreate={createArea}
        onToggleActive={toggleAreaActive}
      />
    </div>
  );
}
