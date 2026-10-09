import { useState, type CSSProperties } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { TriangleAlert } from "lucide-react";
import { Button, Input } from "./ui";

const CONFIRM_WORD = "ELIMINAR";

// Confirmación reforzada para un borrado que no se puede deshacer: hay que
// escribir la palabra a mano, así no se confirma por un clic de costumbre.
export function PermanentDeleteDialog({
  open,
  onOpenChange,
  count,
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  loading: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-4">
          <Dialog.Content
            className="modal-panel rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:p-6"
            style={{ "--modal-width": "30rem" } as CSSProperties}
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <DialogBody count={count} loading={loading} onConfirm={onConfirm} />
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Vive dentro del contenido del diálogo: al cerrarse se desmonta y el texto
// escrito se reinicia solo.
function DialogBody({ count, loading, onConfirm }: { count: number; loading: boolean; onConfirm: () => void }) {
  const [typed, setTyped] = useState("");
  const ready = typed.trim().toLocaleUpperCase("es") === CONFIRM_WORD;
  return (
    <>
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-600/10 dark:bg-rose-950/50">
          <TriangleAlert className="size-5" />
        </div>
        <div>
          <Dialog.Title className="text-lg font-bold">Eliminar definitivamente</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-slate-500">
            Vas a eliminar para siempre {count} {count === 1 ? "documento" : "documentos"}.
          </Dialog.Description>
        </div>
      </div>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
        <li>Se borran los registros y sus <strong>archivos del almacenamiento</strong> (también anexos y versiones), y se libera ese espacio.</li>
        <li><strong>No se pueden restaurar</strong>: desaparecen de la Papelera.</li>
        <li>Quedará constancia de la eliminación en Auditoría.</li>
      </ul>
      <label className="mt-4 block">
        <span className="mb-1 block text-xs font-semibold text-slate-500">Para confirmar, escribe {CONFIRM_WORD}</span>
        <Input value={typed} onChange={(event) => setTyped(event.target.value)} placeholder={CONFIRM_WORD} autoComplete="off" disabled={loading} />
      </label>
      <div className="mt-6 flex justify-end gap-3">
        <Dialog.Close asChild><Button variant="secondary" disabled={loading}>Cancelar</Button></Dialog.Close>
        <Button variant="danger" loading={loading} disabled={!ready} onClick={onConfirm}>Eliminar {count} definitivamente</Button>
      </div>
    </>
  );
}
