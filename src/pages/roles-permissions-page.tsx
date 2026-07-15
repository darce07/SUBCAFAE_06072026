import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, KeyRound, LoaderCircle, Search, ShieldCheck, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Alert, Badge, Card, EmptyState, Input, PageHeader } from "../components/ui";
import { useDebounce } from "../hooks/use-debounce";
import { usePermissions } from "../hooks/use-permissions";
import { getRolePermissions, setRolePermission } from "../services/admin.service";
import type { RolePermissionRow } from "../types";
import { useAuth } from "../features/auth/auth-context";

const moduleLabels: Record<string, string> = {
  documentos: "Documentos",
  catalogos: "Catálogos",
  finanzas: "Finanzas",
  auditoria: "Auditoría",
  storage: "Archivos digitales",
  anexos: "Anexos",
  usuarios: "Usuarios",
  configuracion: "Configuración",
};

export function RolesPermissionsPage() {
  const { canEdit, isAdmin } = usePermissions();
  const { refreshUserContext } = useAuth();
  const [rows, setRows] = useState<RolePermissionRow[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getRolePermissions();
      setRows(data);
      setSelectedRoleId((current) => current ?? data[0]?.role_id ?? null);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la matriz.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const roles = useMemo(() => Array.from(new Map(rows.map((row) => [row.role_id, {
    id: row.role_id,
    nombre: row.role_nombre,
    descripcion: row.role_descripcion,
  }])).values()).filter((role) =>
    `${role.nombre} ${role.descripcion ?? ""}`.toLocaleLowerCase("es").includes(debouncedSearch.toLocaleLowerCase("es")),
  ), [debouncedSearch, rows]);

  const selectedRows = rows.filter((row) => row.role_id === selectedRoleId);
  const modules = Array.from(new Set(selectedRows.map((row) => row.modulo)));
  const selectedRole = roles.find((role) => role.id === selectedRoleId)
    ?? Array.from(new Map(rows.map((row) => [row.role_id, { id: row.role_id, nombre: row.role_nombre, descripcion: row.role_descripcion }])).values()).find((role) => role.id === selectedRoleId);

  const toggle = async (row: RolePermissionRow) => {
    if (savingKey || (!isAdmin && !canEdit("usuarios"))) return;
    const key = `${row.role_id}:${row.permission_id}`;
    setSavingKey(key);
    setRows((current) => current.map((item) => item.role_id === row.role_id && item.permission_id === row.permission_id ? { ...item, asignado: !item.asignado } : item));
    try {
      await setRolePermission(row.role_id, row.permission_id, !row.asignado);
      await refreshUserContext();
      toast.success(`Permiso ${row.asignado ? "retirado" : "asignado"}.`);
    } catch (saveError) {
      setRows((current) => current.map((item) => item.role_id === row.role_id && item.permission_id === row.permission_id ? { ...item, asignado: row.asignado } : item));
      toast.error(saveError instanceof Error ? saveError.message : "No se pudo actualizar el permiso.");
    } finally {
      setSavingKey(null);
    }
  };

  if (!isAdmin && !canEdit("usuarios")) {
    return <Card className="p-8 text-center"><h1 className="text-xl font-bold">Acceso restringido</h1><p className="mt-2 text-sm text-slate-500">No tienes permiso para administrar roles.</p></Card>;
  }

  return <div className="space-y-6">
    <PageHeader eyebrow="Administración" title="Roles y permisos" description="Configura las acciones disponibles para cada rol del sistema." />
    <div className="grid gap-4 sm:grid-cols-3">
      <Stat icon={<ShieldCheck />} label="Roles activos" value={roles.length} />
      <Stat icon={<KeyRound />} label="Permisos definidos" value={new Set(rows.map((row) => row.permission_id)).size} />
      <Stat icon={<CheckCircle2 />} label="Asignaciones activas" value={rows.filter((row) => row.asignado).length} />
    </div>
    {error && <Alert>{error}</Alert>}
    <Card className="grid min-h-[580px] min-w-0 overflow-hidden lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <aside className="border-b border-slate-200 dark:border-slate-800 lg:border-b-0 lg:border-r">
        <div className="relative border-b border-slate-200 p-4 dark:border-slate-800"><Search className="absolute left-7 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Buscar rol..." /></div>
        {loading ? <div className="grid min-h-56 place-items-center"><LoaderCircle className="size-6 animate-spin text-teal-600" /></div> : <div className="p-2">{roles.map((role) => {
          const assigned = rows.filter((row) => row.role_id === role.id && row.asignado).length;
          return <button key={role.id} onClick={() => setSelectedRoleId(role.id)} className={`mb-1 w-full rounded-xl p-3 text-left transition ${selectedRoleId === role.id ? "bg-teal-50 ring-1 ring-teal-200 dark:bg-teal-950/40 dark:ring-teal-800" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}><div className="flex items-center justify-between gap-2"><span className="font-semibold">{role.nombre}</span><Badge tone="blue">{assigned}</Badge></div><p className="mt-1 line-clamp-2 text-xs text-slate-500">{role.descripcion}</p></button>;
        })}</div>}
      </aside>
      <section className="p-5 sm:p-6">
        {!selectedRole ? <EmptyState icon={<UsersRound />} title="Selecciona un rol" description="Elige un rol para administrar sus permisos." /> : <>
          <div className="mb-6"><div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-bold">{selectedRole.nombre}</h2>{selectedRole.nombre === "Administrador" && <Badge tone="violet">Protegido</Badge>}</div><p className="mt-1 text-sm text-slate-500">{selectedRole.descripcion}</p></div>
          <div className="space-y-5">{modules.map((module) => <motion.div key={module} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <h3 className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">{moduleLabels[module] ?? "Otros permisos"}</h3>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{selectedRows.filter((row) => row.modulo === module).map((row) => {
              const key = `${row.role_id}:${row.permission_id}`;
              const disabled = savingKey === key || selectedRole.nombre === "Administrador";
              return <button key={row.permission_id} disabled={disabled} onClick={() => void toggle(row)} className={`flex items-center justify-between rounded-xl border p-3 text-left text-sm transition ${row.asignado ? "border-teal-300 bg-teal-50 text-teal-800 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-200" : "border-slate-200 hover:border-teal-300 dark:border-slate-700"} disabled:cursor-not-allowed disabled:opacity-70`}><span className="font-semibold capitalize">{row.accion}</span>{savingKey === key ? <LoaderCircle className="size-4 animate-spin" /> : <span className={`grid size-5 place-items-center rounded-md border ${row.asignado ? "border-teal-600 bg-teal-600 text-white" : "border-slate-300"}`}>{row.asignado && <CheckCircle2 className="size-3.5" />}</span>}</button>;
            })}</div>
          </motion.div>)}</div>
        </>}
      </section>
    </Card>
  </div>;
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <Card className="flex items-center gap-4 p-5"><div className="rounded-xl bg-teal-50 p-3 text-teal-700 dark:bg-teal-950">{icon}</div><div><p className="text-2xl font-black">{value}</p><p className="text-xs text-slate-500">{label}</p></div></Card>;
}
