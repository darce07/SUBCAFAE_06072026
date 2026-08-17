import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Download, LoaderCircle, Package, Pencil, QrCode } from "lucide-react";
import { Badge, Button, Card, EmptyState, PageHeader } from "../../components/ui";
import { usePermissions } from "../../hooks/use-permissions";
import { getInventarioFotoPublicUrl, getInventarioItem } from "../../services/inventario.service";
import { estadoInventarioLabel, estadoInventarioTone } from "./inventario-constants";
import type { InventarioItem } from "../../types";

export function InventarioDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const [item, setItem] = useState<InventarioItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState(0);
  const barcodeRef = useRef<HTMLCanvasElement>(null);
  const qrRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    void getInventarioItem(id)
      .then((row) => { if (!cancelled) setItem(row); })
      .catch((error) => toast.error(error instanceof Error ? error.message : "No se pudo cargar el ítem."))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!item) return;
    let cancelled = false;

    void import("jsbarcode")
      .then(({ default: JsBarcode }) => {
        if (cancelled || !barcodeRef.current) return;
        JsBarcode(barcodeRef.current, item.codigo_barras, { format: "CODE128", displayValue: true, height: 60, margin: 8 });
      })
      .catch(() => { if (!cancelled) toast.error("No se pudo generar el código de barras."); });

    void import("qrcode")
      .then((QRCode) => {
        if (cancelled || !qrRef.current) return;
        const publicUrl = `${window.location.origin}/i/${item.qr_token}`;
        return QRCode.toCanvas(qrRef.current, publicUrl, { width: 180, margin: 1 });
      })
      .catch(() => { if (!cancelled) toast.error("No se pudo generar el código QR."); });

    return () => { cancelled = true; };
  }, [item]);

  if (loading) return <div className="grid min-h-96 place-items-center"><LoaderCircle className="size-8 animate-spin text-teal-600" /></div>;
  if (!item) return <EmptyState icon={<Package />} title="Ítem no encontrado" description="El registro solicitado no existe o no está disponible." />;

  const fotos = item.fotos ?? [];

  const downloadCanvas = (canvas: HTMLCanvasElement | null, filename: string) => {
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inventariado interno"
        title={item.nombre}
        description={`Código ${item.codigo_barras}`}
        action={canEdit("inventario") ? (
          <Button onClick={() => navigate(`/inventario/${item.id}/editar`)}>
            <Pencil className="size-4" />Editar
          </Button>
        ) : undefined}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="relative grid h-72 place-items-center overflow-hidden bg-slate-100 dark:bg-slate-800">
              {fotos.length > 0 ? (
                <img src={getInventarioFotoPublicUrl(fotos[activePhoto].storage_path)} alt={item.nombre} className="absolute inset-0 h-full w-full object-contain" />
              ) : (
                <Package className="size-12 text-slate-400" />
              )}
            </div>
            {fotos.length > 1 && (
              <div className="flex gap-2 overflow-x-auto p-3">
                {fotos.map((foto, index) => (
                  <button
                    key={foto.id}
                    onClick={() => setActivePhoto(index)}
                    className={`size-16 shrink-0 overflow-hidden rounded-lg border-2 ${index === activePhoto ? "border-teal-500" : "border-transparent"}`}
                  >
                    <img src={getInventarioFotoPublicUrl(foto.storage_path)} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card className="space-y-4 p-5 sm:p-6">
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">Detalle</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Detail label="Estado" value={<Badge tone={estadoInventarioTone[item.estado]}>{estadoInventarioLabel[item.estado]}</Badge>} />
              <Detail label="Cantidad" value={String(item.cantidad)} />
              <Detail label="Color" value={item.color ?? "—"} />
              <Detail label="Área" value={item.area?.nombre ?? "Sin área"} />
              <Detail label="Registro" value={<Badge tone={item.activo ? "green" : "slate"}>{item.activo ? "Activo" : "Inactivo"}</Badge>} />
            </div>
            {item.descripcion && (
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Descripción</p>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{item.descripcion}</p>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="space-y-3 p-5 text-center">
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">Código de barras</h2>
            <canvas ref={barcodeRef} className="mx-auto max-w-full" />
            <Button variant="secondary" className="w-full" onClick={() => downloadCanvas(barcodeRef.current, `${item.codigo_barras}.png`)}>
              <Download className="size-4" />Descargar
            </Button>
          </Card>
          <Card className="space-y-3 p-5 text-center">
            <div className="flex items-center justify-center gap-2 text-sm font-black uppercase tracking-wide text-slate-500">
              <QrCode className="size-4" />Código QR
            </div>
            <canvas ref={qrRef} className="mx-auto" />
            <p className="text-xs text-slate-400">Enlace público de solo lectura, sin datos sensibles.</p>
            <Button variant="secondary" className="w-full" onClick={() => downloadCanvas(qrRef.current, `${item.codigo_barras}-qr.png`)}>
              <Download className="size-4" />Descargar
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-slate-400">{label}</p>
      <div className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">{value}</div>
    </div>
  );
}
