import { useEffect, useState } from "react";
import { LifeBuoy } from "lucide-react";
import { toast } from "sonner";
import { Badge, Card, EmptyState, PageHeader, Select, Skeleton } from "../components/ui";
import { usePermissions } from "../hooks/use-permissions";
import { actualizarSoporteTicket, getSoporteTickets } from "../services/chat.service";
import { formatDateTime } from "../lib/utils";
import type { SoporteTicket } from "../types";

const categoriaLabel: Record<SoporteTicket["categoria"], string> = {
  bug: "Bug / error",
  consulta: "Consulta",
  solicitud: "Solicitud",
  otro: "Otro",
  sin_categorizar: "Sin categorizar",
};

const prioridadTone: Record<SoporteTicket["prioridad"], "green" | "amber" | "red"> = { baja: "green", media: "amber", alta: "red" };
const estadoTone: Record<SoporteTicket["estado"], "blue" | "amber" | "green" | "slate"> = { abierto: "blue", en_progreso: "amber", resuelto: "green", cerrado: "slate" };

export function SoporteTicketsPage() {
  const { isAdmin } = usePermissions();
  const [tickets, setTickets] = useState<SoporteTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setTickets(await getSoporteTickets());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron cargar los tickets.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  if (!isAdmin) {
    return <Card className="p-8 text-center"><h1 className="font-serif text-xl font-bold">Acceso restringido</h1><p className="mt-2 text-sm text-slate-500">Solo un administrador puede ver los tickets de soporte.</p></Card>;
  }

  const update = async (id: string, cambios: Parameters<typeof actualizarSoporteTicket>[1]) => {
    setSavingId(id);
    try {
      const updated = await actualizarSoporteTicket(id, cambios);
      setTickets((current) => current.map((item) => (item.id === id ? updated : item)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el ticket.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Soporte" title="Tickets de soporte" description="Reportes generados al cerrar chats de soporte con usuarios." />
      <Card>
        {loading ? (
          <div className="space-y-3 p-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-16 w-full" />)}</div>
        ) : !tickets.length ? (
          <div className="p-4"><EmptyState icon={<LifeBuoy />} title="Sin tickets" description="Todavía no se cerró ningún chat con ticket de seguimiento." /></div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{ticket.titulo || "(sin título)"}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(ticket.created_at)} · {ticket.transcripcion.length} mensajes</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Badge tone={prioridadTone[ticket.prioridad]}>{ticket.prioridad}</Badge>
                    <Badge tone={estadoTone[ticket.estado]}>{ticket.estado.replace("_", " ")}</Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select className="w-full sm:w-auto" disabled={savingId === ticket.id} value={ticket.categoria} onChange={(event) => void update(ticket.id, { categoria: event.target.value as SoporteTicket["categoria"] })}>
                    {Object.entries(categoriaLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </Select>
                  <Select className="w-full sm:w-auto" disabled={savingId === ticket.id} value={ticket.prioridad} onChange={(event) => void update(ticket.id, { prioridad: event.target.value as SoporteTicket["prioridad"] })}>
                    <option value="baja">Prioridad baja</option>
                    <option value="media">Prioridad media</option>
                    <option value="alta">Prioridad alta</option>
                  </Select>
                  <Select className="w-full sm:w-auto" disabled={savingId === ticket.id} value={ticket.estado} onChange={(event) => void update(ticket.id, { estado: event.target.value as SoporteTicket["estado"] })}>
                    <option value="abierto">Abierto</option>
                    <option value="en_progreso">En progreso</option>
                    <option value="resuelto">Resuelto</option>
                    <option value="cerrado">Cerrado</option>
                  </Select>
                </div>
                <details className="text-xs text-slate-500">
                  <summary className="cursor-pointer font-semibold text-teal-700">Ver transcripción</summary>
                  <div className="mt-2 space-y-1.5 rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
                    {ticket.transcripcion.map((mensaje, index) => (
                      <p key={index}>
                        <span className="font-semibold">{mensaje.autor_id === ticket.admin_id ? "Admin" : "Usuario"}:</span>{" "}
                        {mensaje.contenido || (mensaje.archivo_path ? "[captura adjunta]" : "")}
                      </p>
                    ))}
                  </div>
                </details>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
