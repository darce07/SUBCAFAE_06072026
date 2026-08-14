import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Boxes, LoaderCircle, Package, Plus, ScanLine, Search } from "lucide-react";
import { Alert, Badge, Button, Card, EmptyState, Input, PageHeader, Select, Skeleton } from "../../components/ui";
import { InventarioScannerDialog } from "../../components/inventario-scanner-dialog";
import { useInventarioAreas, useInventarioItems } from "../../hooks/use-inventario";
import { usePermissions } from "../../hooks/use-permissions";
import { buscarInventarioItemPorCodigoBarras, getInventarioFotoPublicUrl } from "../../services/inventario.service";
import { estadoInventarioLabel, estadoInventarioTone, ESTADO_INVENTARIO_OPTIONS } from "./inventario-constants";
import type { EstadoInventarioItem } from "../../types";

export function InventarioListPage() {
  const navigate = useNavigate();
  const { canCreate } = usePermissions();
  const { items, loading, error } = useInventarioItems();
  const { areas } = useInventarioAreas();
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<"" | EstadoInventarioItem>("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanning, setScanning] = useState(false);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    return items.filter((item) => {
      const matchesSearch = !term
        || item.nombre.toLocaleLowerCase("es").includes(term)
        || item.codigo_barras.toLocaleLowerCase("es").includes(term);
      const matchesArea = !areaFilter || item.area_id === areaFilter;
      const matchesEstado = !estadoFilter || item.estado === estadoFilter;
      return matchesSearch && matchesArea && matchesEstado;
    });
  }, [areaFilter, estadoFilter, items, search]);

  const onDetected = async (code: string) => {
    if (scanning) return;
    setScanning(true);
    try {
      const item = await buscarInventarioItemPorCodigoBarras(code);
      if (!item) {
        toast.error("No se encontró ningún ítem con ese código de barras.");
        return;
      }
      setScannerOpen(false);
      navigate(`/inventario/${item.id}`);
    } catch (scanError) {
      toast.error(scanError instanceof Error ? scanError.message : "No se pudo buscar el ítem escaneado.");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inventariado interno"
        title="Inventario de bienes"
        description="Mesas, sillas, equipos y otros bienes internos, con código de barras y QR para consulta física."
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button variant="secondary" onClick={() => setScannerOpen(true)}>
              <ScanLine className="size-4" />Escanear código
            </Button>
            {canCreate("inventario") && (
              <Button onClick={() => navigate("/inventario/nuevo")}>
                <Plus className="size-4" />Nuevo ítem
              </Button>
            )}
          </div>
        }
      />
      {error && <Alert>{error}</Alert>}
      <Card className="p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="relative sm:col-span-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Buscar por nombre o código..." />
          </div>
          <Select value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}>
            <option value="">Todas las áreas</option>
            {areas.map((area) => <option key={area.id} value={area.id}>{area.nombre}</option>)}
          </Select>
          <Select value={estadoFilter} onChange={(event) => setEstadoFilter(event.target.value as "" | EstadoInventarioItem)}>
            <option value="">Todos los estados</option>
            {ESTADO_INVENTARIO_OPTIONS.map((estado) => <option key={estado} value={estado}>{estadoInventarioLabel[estado]}</option>)}
          </Select>
        </div>
      </Card>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-52 w-full rounded-2xl" />)}
        </div>
      ) : filteredItems.length === 0 ? (
        <EmptyState icon={<Boxes />} title="Sin ítems de inventario" description="Todavía no se registró ningún bien en el inventario interno." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredItems.map((item) => {
            const thumb = item.fotos?.[0]?.storage_path ? getInventarioFotoPublicUrl(item.fotos[0].storage_path) : null;
            return (
              <Card
                key={item.id}
                className="cursor-pointer overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg"
                onClick={() => navigate(`/inventario/${item.id}`)}
              >
                <div className="grid h-32 place-items-center bg-slate-100 dark:bg-slate-800">
                  {thumb ? (
                    <img src={thumb} alt={item.nombre} className="h-full w-full object-cover" />
                  ) : (
                    <Package className="size-8 text-slate-400" />
                  )}
                </div>
                <div className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate font-semibold">{item.nombre}</p>
                    <Badge tone={estadoInventarioTone[item.estado]}>{estadoInventarioLabel[item.estado]}</Badge>
                  </div>
                  <p className="font-mono text-xs text-slate-500">{item.codigo_barras}</p>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{item.area?.nombre ?? "Sin área"}</span>
                    <span>Cant. {item.cantidad}</span>
                  </div>
                  {!item.activo && <Badge tone="slate">Inactivo</Badge>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <InventarioScannerDialog open={scannerOpen} onOpenChange={setScannerOpen} onDetected={(code) => void onDetected(code)} />
      {scanning && (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/40">
          <LoaderCircle className="size-8 animate-spin text-white" />
        </div>
      )}
    </div>
  );
}
