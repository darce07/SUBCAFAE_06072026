import { useEffect, useState } from "react";
import { LoaderCircle, Search, UserRoundCog } from "lucide-react";
import { toast } from "sonner";
import { assignUserRole, getAdminUsers, getRoles } from "../services/admin.service";
import type { AdminUser, CatalogItem } from "../types";
import { Badge, Button, Card, Input, PageHeader, Select } from "../components/ui";
import { useDebounce } from "../hooks/use-debounce";
import { usePermissions } from "../hooks/use-permissions";

export function UsersPermissionsPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const { canEdit, isAdmin } = usePermissions();

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
    return <Card className="p-8 text-center"><h1 className="text-xl font-bold">Acceso restringido</h1><p className="mt-2 text-sm text-slate-500">No tienes permiso para administrar usuarios.</p></Card>;
  }

  const filtered = users.filter((user) => `${user.nombre_completo ?? ""} ${user.email ?? ""}`.toLocaleLowerCase("es").includes(debouncedSearch.toLocaleLowerCase("es")));
  return <div className="space-y-6">
    <PageHeader eyebrow="Control de acceso" title="Usuarios y permisos" description="Administra los roles asignados a las cuentas institucionales." />
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">Las cuentas se habilitan mediante el servicio de identidad institucional. Esta pantalla solo asigna roles y no administra contraseñas.</div>
    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
    <Card>
      <div className="relative border-b border-slate-200 p-3 dark:border-slate-800 sm:p-4"><Search className="absolute left-6 top-1/2 size-4 -translate-y-1/2 text-slate-400 sm:left-7" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="max-w-md pl-9" placeholder="Buscar usuario..." /></div>
      {loading ? <div className="grid min-h-56 place-items-center"><LoaderCircle className="size-7 animate-spin text-teal-600" /></div> : <div className="grid divide-y divide-slate-100 dark:divide-slate-800">{filtered.map((user) => {
        const name = user.nombre_completo || user.email?.split("@")[0] || "Usuario";
        const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
        return <div key={user.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center"><div className="grid size-11 shrink-0 place-items-center rounded-xl bg-teal-100 font-bold text-teal-800">{initials}</div><div className="min-w-0 flex-1"><p className="break-words font-semibold">{name}</p><p className="truncate text-xs text-slate-500">{user.email}</p></div><Select className="w-full sm:w-auto" value={user.role_id ?? ""} disabled={savingId === user.id} onChange={(event) => void assign(user.id, event.target.value)}><option value="">Sin rol asignado</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.nombre}</option>)}</Select><Badge tone={user.role_id ? "green" : "amber"}>{user.role_nombre ?? "Sin acceso"}</Badge><Button className="w-full sm:w-auto" variant="secondary" size="sm" disabled><UserRoundCog className="size-4" />Acceso protegido</Button></div>;
      })}</div>}
    </Card>
  </div>;
}
