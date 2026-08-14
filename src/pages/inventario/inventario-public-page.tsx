import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import type { CSSProperties } from "react";
import { ChevronLeft, ChevronRight, LoaderCircle, Package, ShieldCheck, X } from "lucide-react";
import { getInventarioFotoPublicUrl, getInventarioItemPublico } from "../../services/inventario.service";
import { estadoInventarioLabel } from "./inventario-constants";
import type { InventarioItemPublico } from "../../types";

// Página completamente pública (sin sesión, sin layout autenticado). Se
// accede escaneando el QR físico pegado en el bien. Nunca importa
// DashboardLayout ni ningún hook que asuma sesión activa.
export function InventarioPublicPage() {
  const { qrToken } = useParams();
  const [item, setItem] = useState<InventarioItemPublico | null | undefined>(undefined);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

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

  const fotos = item?.fotos ?? [];

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 dark:bg-slate-950">
      <div className="mx-auto w-full max-w-md">
        <p className="mb-4 flex items-center justify-center gap-1.5 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          <ShieldCheck className="size-3.5 shrink-0" />
          <span>SIGDAF · Consulta pública</span>
        </p>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900">
          {item === undefined ? (
            <div className="grid h-72 place-items-center">
              <LoaderCircle className="size-8 animate-spin text-teal-600" />
            </div>
          ) : item === null ? (
            <div className="flex h-72 flex-col items-center justify-center gap-2 p-6 text-center">
              <Package className="size-8 text-slate-300" />
              <p className="font-semibold text-slate-700 dark:text-slate-200">Ítem no encontrado</p>
              <p className="text-sm text-slate-400">Este código QR no corresponde a ningún bien registrado, o ya no está activo.</p>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => fotos.length && setLightboxIndex(0)}
                disabled={!fotos.length}
                className="block aspect-square w-full shrink-0 bg-slate-100 disabled:cursor-default dark:bg-slate-800"
              >
                {fotos.length > 0 ? (
                  <img src={getInventarioFotoPublicUrl(fotos[0])} alt={item.nombre} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center"><Package className="size-10 text-slate-400" /></div>
                )}
              </button>

              <div className="min-w-0 space-y-4 p-5">
                <h1 className="break-words text-xl font-bold leading-snug text-slate-900 dark:text-white">{item.nombre}</h1>
                {item.descripcion && <p className="break-words text-sm leading-relaxed text-slate-600 dark:text-slate-300">{item.descripcion}</p>}

                <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-950/60">
                  <PublicField label="Estado" value={estadoInventarioLabel[item.estado]} />
                  <PublicField label="Cantidad" value={String(item.cantidad)} />
                  <PublicField label="Área" value={item.area_nombre ?? "Sin área"} />
                  <PublicField label="Color" value={item.color ?? "—"} />
                </div>

                {fotos.length > 1 && (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Más fotos</p>
                    <div className="grid grid-cols-4 gap-2">
                      {fotos.slice(1).map((path, index) => (
                        <button
                          key={path}
                          type="button"
                          onClick={() => setLightboxIndex(index + 1)}
                          className="aspect-square overflow-hidden rounded-lg ring-1 ring-slate-200 transition hover:opacity-80 dark:ring-slate-700"
                        >
                          <img src={getInventarioFotoPublicUrl(path)} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">Vista de solo lectura. No requiere iniciar sesión.</p>
      </div>

      <Dialog.Root open={lightboxIndex !== null} onOpenChange={(open) => { if (!open) setLightboxIndex(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 p-3">
            <Dialog.Content
              className="relative flex max-h-[90vh] w-full items-center justify-center outline-none"
              style={{ "--modal-width": "min(92vw, 640px)" } as CSSProperties}
              onOpenAutoFocus={(event) => event.preventDefault()}
            >
              <Dialog.Title className="sr-only">Foto del ítem</Dialog.Title>
              <Dialog.Close aria-label="Cerrar" className="absolute right-0 top-0 z-10 rounded-full bg-slate-950/70 p-2 text-white">
                <X className="size-5" />
              </Dialog.Close>
              {lightboxIndex !== null && fotos.length > 1 && (
                <button
                  type="button"
                  aria-label="Foto anterior"
                  onClick={() => setLightboxIndex((current) => current === null ? null : (current - 1 + fotos.length) % fotos.length)}
                  className="absolute left-1 top-1/2 z-10 -translate-y-1/2 rounded-full bg-slate-950/70 p-2 text-white"
                >
                  <ChevronLeft className="size-5" />
                </button>
              )}
              {lightboxIndex !== null && (
                <img
                  src={getInventarioFotoPublicUrl(fotos[lightboxIndex])}
                  alt=""
                  className="max-h-[85vh] w-full rounded-lg object-contain"
                />
              )}
              {lightboxIndex !== null && fotos.length > 1 && (
                <button
                  type="button"
                  aria-label="Foto siguiente"
                  onClick={() => setLightboxIndex((current) => current === null ? null : (current + 1) % fotos.length)}
                  className="absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-full bg-slate-950/70 p-2 text-white"
                >
                  <ChevronRight className="size-5" />
                </button>
              )}
            </Dialog.Content>
          </Dialog.Overlay>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function PublicField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="break-words font-medium text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}
