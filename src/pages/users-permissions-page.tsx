import { useEffect, useState } from "react";
import { MessageCircle, Search, ShieldOff, UserRoundCog } from "lucide-react";
import { toast } from "sonner";
import { assignUserRole, bloquearUsuario, getAdminUsers, getRoles } from "../services/admin.service";
import type { AdminUser, CatalogItem } from "../types";
import { Alert, Badge, Button, Card, EmptyState, Input, PageHeader, Select, Skeleton } from "../components/ui";
import { useDebounce } from "../hooks/use-debounce";
import { usePermissions } from "../hooks/use-permissions";
import { useAuth } from "../features/auth/auth-context";
import { useChat } from "../features/chat/chat-context";
import { PresenceDot } from "../features/presence/presence-context";

export function UsersPermissionsPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [blockingId, setBlockingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const { canEdit, isAdmin } = usePermissions();
  const { userContext } = useAuth();
  const { openChat } = useChat();

  const load = async () => {
    setLoading(true);
    try {
      const [userRows, roleRows] = await Promise.all([getAdminUsers(), getRoles()]);
      setUsers(userRows);
      setRoles(roleRows);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const toggleBlock = async (user: AdminUser) => {
    if (blockingId) return;
    const bloquear = user.activo;
    if (!window.confirm(bloquear
      ? `¿Bloquear el acceso de ${user.nombre_completo || user.email}? No podrá iniciar sesión ni usar el chat.`
      : `¿Restaurar el acceso de ${user.nombre_completo || user.email}?`)) return;
    setBlockingId(user.id);
    try {
      await bloquearUsuario(user.id, bloquear);
      await load();
      toast.success(bloquear ? "Acceso bloqueado." : "Acceso restaurado.");
    } catch (blockError) {
      toast.error(blockError instanceof Error ? blockError.message : "No se pudo actualizar el acceso.");
    } finally {
      setBlockingId(null);
    }
  };

  const assign = async (userId: string, roleId: string) => {
    if (!roleId || savingId) return;
    setSavingId(userId);
    try {
      await assignUserRole(userId, roleId);
      await load();
      toast.success("Rol actualizado.");
    } catch (assignError) {
      toast.error(assignError instanceof Error ? assignError.message : "No se pudo asignar el rol.");
    } finally {
      setSavingId(null);
    }
  };

  if (!isAdmin && !canEdit("usuarios")) {
    return <Card className="p-8 text-center"><h1 className="font-serif text-xl font-bold">Acceso restringido</h1><p className="mt-2 text-sm text-slate-500">No tienes permiso para administrar usuarios.</p></Card>;
  }

  const filtered = users.filter((user) => `${user.nombre_completo ?? ""} ${user.email ?? ""}`.toLocaleLowerCase("es").includes(debouncedSearch.toLocaleLowerCase("es")));
  return <div className="space-y-6">
    <PageHeader eyebrow="Control de acceso" title="Usuarios y permisos" description="Administra los roles asignados a las cuentas institucionales." />
    <Alert variant="info">Las cuentas se habilitan mediante el servicio de identidad institucional. Esta pantalla solo asigna roles y no administra contraseñas.</Alert>
    {error && <Alert>{error}</Alert>}
    <Card>
      <div className="relative border-b border-slate-200 p-3 dark:border-slate-800 sm:p-4"><Search className="absolute left-6 top-1/2 size-4 -translate-y-1/2 text-slate-400 sm:left-7" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="max-w-md pl-9" placeholder="Buscar usuario..." /></div>
      {loading ? (
        <div className="space-y-4 p-4">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="flex items-center gap-4">
              <Skeleton className="size-11 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-9 w-36 rounded-xl" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? <EmptyState icon={<UserRoundCog />} title="Sin usuarios" description={debouncedSearch ? "No se encontraron usuarios para la búsqueda actual." : "Aún no hay cuentas registradas."} /> : <div className="grid divide-y divide-slate-100 dark:divide-slate-800">{filtered.map((user) => {
        const name = user.nombre_completo || user.email?.split("@")[0] || "Usuario";
        const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
        return <div key={user.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center"><div className="relative shrink-0"><div className="grid size-11 place-items-center rounded-xl bg-teal-100 font-bold text-teal-800">{initials}</div><span className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-white dark:ring-slate-900"><PresenceDot userId={user.id} /></span></div><div className="min-w-0 flex-1"><p className="break-words font-semibold">{name}</p><p className="truncate text-xs text-slate-500">{user.email}</p></div><Select className="w-full sm:w-auto" value={user.role_id ?? ""} disabled={savingId === user.id} onChange={(event) => void assign(user.id, event.target.value)}><option value="">Sin rol asignado</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.nombre}</option>)}</Select><Badge tone={user.role_id ? "green" : "amber"}>{user.role_nombre ?? "Sin acceso"}</Badge>{isAdmin && user.id !== userContext?.id && <Button className="w-full sm:w-auto" variant="secondary" size="sm" onClick={() => void openChat(user.id).catch((chatError) => toast.error(chatError instanceof Error ? chatError.message : "No se pudo abrir el chat."))}><MessageCircle className="size-4" />Chat</Button>}{isAdmin && user.id !== userContext?.id && <Button className="w-full sm:w-auto" variant={user.activo ? "danger" : "secondary"} size="sm" loading={blockingId === user.id} onClick={() => void toggleBlock(user)}><ShieldOff className="size-4" />{user.activo ? "Bloquear acceso" : "Restaurar acceso"}</Button>}</div>;
      })}</div>}
    </Card>
  </div>;
}
