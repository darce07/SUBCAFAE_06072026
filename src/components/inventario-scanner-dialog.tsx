import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { CSSProperties } from "react";
import { LoaderCircle, ScanLine, X } from "lucide-react";
import { Alert } from "./ui";

const SCANNER_ELEMENT_ID = "inventario-barcode-scanner-region";

export function InventarioScannerDialog({
  open,
  onOpenChange,
  onDetected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (code: string) => void;
}) {
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStarting(true);
    setError(null);

    void import("html5-qrcode")
      .then(async ({ Html5Qrcode }) => {
        if (cancelled) return;
        const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
        scannerRef.current = scanner;
        try {
          await scanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 260, height: 160 } },
            (decodedText) => {
              onDetected(decodedText);
            },
            () => {},
          );
          if (!cancelled) setStarting(false);
        } catch {
          if (!cancelled) {
            setError("No se pudo acceder a la cámara. Verifica los permisos del navegador.");
            setStarting(false);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("No se pudo cargar el lector de códigos.");
          setStarting(false);
        }
      });

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        scanner.stop().then(() => scanner.clear()).catch(() => {});
      }
    };
  }, [open, onDetected]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-4">
          <Dialog.Content
            className="modal-panel rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:p-6"
            style={{ "--modal-width": "28rem" } as CSSProperties}
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <ScanLine className="size-5 text-teal-700" />
                <Dialog.Title className="text-lg font-bold">Escanear código de barras</Dialog.Title>
              </div>
              <Dialog.Close aria-label="Cerrar"><X className="size-5 text-slate-400" /></Dialog.Close>
            </div>
            <Dialog.Description className="mb-3 text-sm text-slate-500">
              Apunta la cámara al código de barras pegado en el ítem.
            </Dialog.Description>
            {error && <Alert className="mb-3">{error}</Alert>}
            {/* html5-qrcode necesita que este contenedor tenga tamaño real
                (no display:none) desde antes de start() - si arranca oculto,
                la cámara se activa pero el video nunca se ve. El spinner va
                superpuesto encima en vez de ocultar el contenedor. */}
            <div className="relative min-h-56 overflow-hidden rounded-xl bg-slate-950">
              <div id={SCANNER_ELEMENT_ID} className="w-full" />
              {starting && !error && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                  <LoaderCircle className="size-6 animate-spin" />
                </div>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
