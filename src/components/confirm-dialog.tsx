import * as Dialog from "@radix-ui/react-dialog";
import type { CSSProperties } from "react";
import { Button } from "./ui";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  loading,
  variant = "danger",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  loading?: boolean;
  variant?: "danger" | "primary";
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-4">
          <Dialog.Content
            className="modal-panel rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:p-6"
            style={{ "--modal-width": "28rem" } as CSSProperties}
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <Dialog.Title className="text-lg font-bold">{title}</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-slate-500">{description}</Dialog.Description>
            <div className="mt-6 flex justify-end gap-3">
              <Dialog.Close asChild>
                <Button variant="secondary">{cancelLabel}</Button>
              </Dialog.Close>
              <Button variant={variant} loading={loading} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
