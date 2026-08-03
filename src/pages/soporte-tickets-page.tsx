import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { CSSProperties } from "react";
import { CheckCircle2, MessageSquareText, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Skeleton } from "../components/ui";
import { usePermissions } from "../hooks/use-permissions";
import { actualizarEstadoTicket, getChatImageUrl, getTicketsSoporte } from "../services/chat.service";
import type { SoporteTicketAdmin } from "../types";
import { formatDateTime } from "../lib/utils";

const estadoTone: Record<SoporteTicketAdmin["estado"], "green" | "amber"> = {
  abierto: "amber",
  resuelto: "green",
};

const estadoLabel: Record<SoporteTicketAdmin["estado"], string> = {
  abierto: "Abierto",
  resuelto: "Resuelto",
};

export function SoporteTicketsPage() {
  const { isAdmin } = usePermissions();
  const [tickets, setTickets] = useState<SoporteTicketAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<SoporteTicketAdmin | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    void getTicketsSoporte()
      .then(setTickets)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los tickets."))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  const toggleEstado = async (ticket: SoporteTicketAdmin) => {
    if (updatingId) return;
    const nuevoEstado = ticket.estado === "abierto" ? "resuelto" : "abierto";
    setUpdatingId(ticket.id);
    try {
      await actualizarEstadoTicket(ticket.id, nuevoEstado);
      setTickets((current) => current.map((item) => item.id === ticket.id ? { ...item, estado: nuevoEstado } : item));
      setViewing((current) => current && current.id === ticket.id ? { ...current, estado: nuevoEstado } : current);
      toast.success(nuevoEstado === "resuelto" ? "Ticket marcado como resuelto." : "Ticket reabierto.");
    } catch (updateError) {
      toast.error(updateError instanceof Error ? updateError.message : "No se pudo actualizar el ticket.");
    } finally {
      setUpdatingId(null);
    }
  };

  if (!isAdmin) {
    return <Card className="p-8 text-center"><h1 className="font-serif text-xl font-bold">Acceso restringido</h1><p className="mt-2 text-sm text-slate-500">Solo un administrador puede ver los tickets de soporte.</p></Card>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Soporte"
        title="Tickets de soporte"
        description="Transcripción de cada chat de soporte cerrado, con usuario y administrador involucrados."
      />
      {error && <Alert>{error}</Alert>}
      <Card>
        {loading ? (
          <div className="space-y-4 p-4">
            {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-16 w-full" />)}
          </div>
        ) : tickets.length === 0 ? (
          <EmptyState icon={<MessageSquareText />} title="Sin tickets" description="Todavía no se cerró ningún chat de soporte." />
        ) : (
          <div className="grid divide-y divide-slate-100 dark:divide-slate-800">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                role="button"
                tabIndex={0}
                onClick={() => setViewing(ticket)}
                onKeyDown={(event) => { if (event.key === "Enter") setViewing(ticket); }}
                className="flex cursor-pointer flex-col gap-2 p-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-900 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{ticket.usuario_nombre || ticket.usuario_email || "Usuario"}</span>
                    <Badge tone={estadoTone[ticket.estado]}>{estadoLabel[ticket.estado]}</Badge>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    Atendido por {ticket.admin_nombre || ticket.admin_email || "administrador"} · {ticket.transcripcion.length} mensaje{ticket.transcripcion.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-slate-400">{formatDateTime(ticket.created_at)}</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={updatingId === ticket.id}
                    onClick={(event) => { event.stopPropagation(); void toggleEstado(ticket); }}
                  >
                    {ticket.estado === "abierto" ? <><CheckCircle2 className="size-4" />Marcar resuelto</> : <><RotateCcw className="size-4" />Reabrir</>}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Dialog.Root open={viewing !== null} onOpenChange={(nextOpen) => { if (!nextOpen) setViewing(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-4">
            <Dialog.Content
              className="modal-panel flex max-h-[85vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
              style={{ "--modal-width": "32rem" } as CSSProperties}
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Dialog.Title className="truncate font-bold">{viewing?.usuario_nombre || viewing?.usuario_email || "Ticket de soporte"}</Dialog.Title>
                    {viewing && <Badge tone={estadoTone[viewing.estado]}>{estadoLabel[viewing.estado]}</Badge>}
                  </div>
                  <Dialog.Description className="text-xs text-slate-500">{viewing ? formatDateTime(viewing.created_at) : ""}</Dialog.Description>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {viewing && (
                    <Button variant="secondary" size="sm" loading={updatingId === viewing.id} onClick={() => void toggleEstado(viewing)}>
                      {viewing.estado === "abierto" ? <><CheckCircle2 className="size-4" />Marcar resuelto</> : <><RotateCcw className="size-4" />Reabrir</>}
                    </Button>
                  )}
                  <Dialog.Close aria-label="Cerrar" className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="size-4" /></Dialog.Close>
                </div>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {viewing?.transcripcion.map((mensaje, index) => (
                  <TicketMensaje key={index} mensaje={mensaje} mine={mensaje.autor_id === viewing.admin_id} />
                ))}
                {viewing && !viewing.transcripcion.length && <p className="py-8 text-center text-xs text-slate-400">Este chat se cerró sin mensajes.</p>}
              </div>
            </Dialog.Content>
          </Dialog.Overlay>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function TicketMensaje({ mensaje, mine }: { mensaje: SoporteTicketAdmin["transcripcion"][number]; mine: boolean }) {
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    if (mensaje.archivo_path) void getChatImageUrl(mensaje.archivo_path).then(setImageUrl).catch(() => {});
  }, [mensaje.archivo_path]);

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"}`}>
        {mensaje.contenido && <p className="whitespace-pre-wrap break-words">{mensaje.contenido}</p>}
        {mensaje.archivo_path && (imageUrl ? <img src={imageUrl} alt="Captura adjunta" className="mt-1 max-h-56 rounded-lg" /> : <p className="text-xs italic opacity-70">Cargando captura...</p>)}
        <p className={`mt-1 text-[10px] ${mine ? "text-teal-100" : "text-slate-400"}`}>{formatDateTime(mensaje.created_at)}</p>
      </div>
    </div>
  );
}
