import { useEffect, useState } from "react";
import { Bell, CheckCheck, FileWarning, LoaderCircle, ReceiptText, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { getNotifications, markAllNotificationsRead } from "../services/workspace.service";
import type { AppNotification } from "../types";
import { Alert, Badge, Button, Card, EmptyState, PageHeader } from "../components/ui";

const icons = { documental: FileWarning, financiero: ReceiptText, auditoria: ShieldAlert, seguridad: ShieldAlert };

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setLoading(true);
    try { setNotifications(await getNotifications()); setError(null); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las notificaciones."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const markAll = async () => {
    try { await markAllNotificationsRead(); await load(); toast.success("Notificaciones marcadas como leídas."); }
    catch (markError) { toast.error(markError instanceof Error ? markError.message : "No se pudieron actualizar."); }
  };
  return <div className="space-y-6">
    <PageHeader eyebrow="Centro de alertas" title="Notificaciones" description="Alertas reales asociadas a tu usuario." action={<Button variant="secondary" disabled={!notifications.some((item) => !item.leida_at)} onClick={() => void markAll()}><CheckCheck className="size-4" />Marcar todo como leído</Button>} />
    {error && <Alert>{error}</Alert>}
    <Card>{loading ? <div className="grid min-h-56 place-items-center"><LoaderCircle className="size-7 animate-spin text-teal-600" /></div> : notifications.length === 0 ? <EmptyState icon={<Bell />} title="Sin notificaciones" description="Las alertas generadas por el sistema aparecerán aquí." /> : <div className="divide-y divide-slate-100 dark:divide-slate-800">{notifications.map((notification) => { const Icon = icons[notification.tipo]; return <div key={notification.id} className={`flex gap-4 p-5 ${!notification.leida_at ? "bg-teal-50/40" : ""}`}><div className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-teal-700 shadow-sm"><Icon className="size-5" /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 className="font-semibold">{notification.titulo}</h2>{!notification.leida_at && <Badge tone="blue">Nueva</Badge>}</div><p className="mt-1 text-sm text-slate-500">{notification.descripcion}</p><p className="mt-2 text-xs text-slate-400">{new Date(notification.created_at).toLocaleString("es-PE")}</p></div></div>; })}</div>}</Card>
  </div>;
}
