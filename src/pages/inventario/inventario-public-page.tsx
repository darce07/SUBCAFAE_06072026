import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { LoaderCircle, Package, ShieldCheck } from "lucide-react";
import { getInventarioFotoPublicUrl, getInventarioItemPublico } from "../../services/inventario.service";
import { estadoInventarioLabel } from "./inventario-constants";
import type { InventarioItemPublico } from "../../types";

// Página completamente pública (sin sesión, sin layout autenticado). Se
// accede escaneando el QR físico pegado en el bien. Nunca importa
// DashboardLayout ni ningún hook que asuma sesión activa.
export function InventarioPublicPage() {
  const { qrToken } = useParams();
  const [item, setItem] = useState<InventarioItemPublico | null | undefined>(undefined);

  useEffect(() => {
    if (!qrToken) {
      setItem(null);
      return;
    }
    let cancelled = false;
    void getInventarioItemPublico(qrToken)
      .then((row) => { if (!cancelled) setItem(row); })
      .catch(() => { if (!cancelled) setItem(null); });
    return () => { cancelled = true; };
  }, [qrToken]);

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <p className="mb-4 flex items-center justify-center gap-1.5 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
          <ShieldCheck className="size-3.5" />SIGDAF · Consulta pública
        </p>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
          {item === undefined ? (
            <div className="grid h-72 place-items-center">
              <LoaderCircle className="size-8 animate-spin text-teal-600" />
            </div>
          ) : item === null ? (
            <div className="flex h-72 flex-col items-center justify-center gap-2 p-6 text-center">
              <Package className="size-8 text-slate-300" />
              <p className="font-semibold text-slate-700">Ítem no encontrado</p>
              <p className="text-sm text-slate-400">Este código QR no corresponde a ningún bien registrado, o ya no está activo.</p>
            </div>
          ) : (
            <>
              <div className="grid h-56 place-items-center bg-slate-100">
                {item.fotos.length > 0 ? (
                  <img src={getInventarioFotoPublicUrl(item.fotos[0])} alt={item.nombre} className="h-full w-full object-cover" />
                ) : (
                  <Package className="size-10 text-slate-400" />
                )}
              </div>
              <div className="space-y-3 p-5">
                <h1 className="text-lg font-bold text-slate-900">{item.nombre}</h1>
                {item.descripcion && <p className="text-sm text-slate-500">{item.descripcion}</p>}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <PublicField label="Estado" value={estadoInventarioLabel[item.estado]} />
                  <PublicField label="Cantidad" value={String(item.cantidad)} />
                  <PublicField label="Área" value={item.area_nombre ?? "Sin área"} />
                  <PublicField label="Color" value={item.color ?? "—"} />
                </div>
                {item.fotos.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pt-1">
                    {item.fotos.slice(1).map((path) => (
                      <img key={path} src={getInventarioFotoPublicUrl(path)} alt="" className="size-16 shrink-0 rounded-lg object-cover" />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">Vista de solo lectura. No requiere iniciar sesión.</p>
      </div>
    </div>
  );
}

function PublicField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase text-slate-400">{label}</p>
      <p className="font-medium text-slate-800">{value}</p>
    </div>
  );
}
