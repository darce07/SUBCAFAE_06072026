import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Archive,
  Bell,
  BookOpen,
  Boxes,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  FileClock,
  FilePlus2,
  Files,
  LayoutDashboard,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Trash2,
  UserRoundCog,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useAppStore } from "../../store/use-app-store";
import { useAuth } from "../../features/auth/auth-context";
import { usePermissions } from "../../hooks/use-permissions";
import { Button, Input } from "../ui";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: readonly [string, string];
}

const navGroups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Principal",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Gestión documental",
    items: [
      { label: "Documentos", href: "/documentos", icon: Files, permission: ["documentos", "ver"] },
      { label: "Explorador histórico", href: "/documentos/historico", icon: FileClock, permission: ["documentos", "ver"] },
      { label: "Nuevo documento", href: "/documentos/nuevo", icon: FilePlus2, permission: ["documentos", "crear"] },
      { label: "Verificación", href: "/verificacion", icon: ClipboardCheck, permission: ["documentos", "ver"] },
      { label: "Archivo físico", href: "/archivo-fisico", icon: Archive, permission: ["documentos", "ver"] },
      { label: "Papelera", href: "/documentos/papelera", icon: Trash2, permission: ["documentos", "eliminar"] },
    ],
  },
  {
    label: "Finanzas",
    items: [
      { label: "Ingresos", href: "/finanzas/ingresos", icon: CircleDollarSign, permission: ["finanzas", "ver"] },
      { label: "Egresos", href: "/finanzas/egresos", icon: WalletCards, permission: ["finanzas", "ver"] },
      { label: "Balance", href: "/finanzas/balance", icon: SlidersHorizontal, permission: ["finanzas", "ver"] },
      { label: "Libro contable", href: "/libro-contable", icon: BookOpen, permission: ["finanzas", "ver"] },
    ],
  },
  {
    label: "Administración",
    items: [
      { label: "Auditoría", href: "/auditoria", icon: ShieldCheck, permission: ["auditoria", "ver"] },
      { label: "Catálogos", href: "/catalogos", icon: Boxes, permission: ["catalogos", "ver"] },
      { label: "Usuarios", href: "/usuarios", icon: UserRoundCog, permission: ["usuarios", "ver"] },
      { label: "Roles y permisos", href: "/roles-permisos", icon: ShieldCheck, permission: ["usuarios", "editar"] },
      { label: "Configuración", href: "/configuracion", icon: Settings, permission: ["configuracion", "ver"] },
    ],
  },
];

const pageNames: Record<string, string> = {
  dashboard: "Dashboard",
  documentos: "Documentos",
  historico: "Explorador histórico",
  papelera: "Papelera",
  nuevo: "Nuevo documento",
  editar: "Editar documento",
  verificacion: "Verificación físico-digital",
  "archivo-fisico": "Archivo físico",
  finanzas: "Finanzas",
  ingresos: "Ingresos",
  egresos: "Egresos",
  balance: "Balance",
  "libro-contable": "Libro contable",
  auditoria: "Auditoría",
  catalogos: "Catálogos",
  configuracion: "Configuración",
  "usuarios-permisos": "Usuarios y permisos",
  usuarios: "Usuarios",
  "roles-permisos": "Roles y permisos",
  notificaciones: "Notificaciones",
};

export function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, session, userContext, contextError } = useAuth();
  const { can } = usePermissions();
  const { theme, toggleTheme, sidebarCollapsed, toggleSidebar, fontSize, accent, density } = useAppStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const displayName = userContext?.nombreCompleto || session?.user.email?.split("@")[0] || "Usuario";
  const roleName = userContext?.roles[0] || "Sin rol asignado";
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.fontSize = fontSize;
    document.documentElement.dataset.density = density;
    document.documentElement.style.setProperty("--brand", accent);
  }, [accent, density, fontSize, theme]);

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const crumbs = useMemo(
    () => location.pathname.split("/").filter(Boolean).map((part) => pageNames[part] ?? part),
    [location.pathname],
  );

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (search.trim()) navigate(`/documentos?q=${encodeURIComponent(search.trim())}`);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {mobileOpen && <button aria-label="Cerrar menú" className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-800 bg-slate-950 text-slate-200 transition-all duration-300",
          sidebarCollapsed ? "w-[84px]" : "w-[272px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex h-20 items-center gap-3 border-b border-slate-800 px-5">
          <Link to="/dashboard" className="flex min-w-0 flex-1 items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--brand)] font-black text-white">S</div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <p className="font-serif text-lg font-black tracking-wide text-white">SIGDAF</p>
                <p className="truncate text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">Gestión integral</p>
              </div>
            )}
          </Link>
          <button className="text-slate-400 lg:hidden" onClick={() => setMobileOpen(false)}><X className="size-5" /></button>
        </div>
        <nav className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter((item) => !item.permission || can(item.permission[0], item.permission[1]));
            if (visibleItems.length === 0) return null;
            return (
            <div key={group.label}>
              {!sidebarCollapsed && <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{group.label}</p>}
              <div className="space-y-1">
                {visibleItems.map(({ label, href, icon: Icon }) => (
                  <NavLink
                    key={href}
                    to={href}
                    title={sidebarCollapsed ? label : undefined}
                    className={({ isActive }) =>
                      cn(
                        "group flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition",
                        isActive ? "bg-[var(--brand)] text-white shadow-md shadow-black/30" : "text-slate-400 hover:bg-slate-900 hover:text-white",
                        sidebarCollapsed && "justify-center px-0",
                      )
                    }
                  >
                    <Icon className="size-[18px] shrink-0" />
                    {!sidebarCollapsed && <span className="truncate">{label}</span>}
                  </NavLink>
                ))}
              </div>
            </div>
          );})}
        </nav>
        <div className="border-t border-slate-800 p-3">
          <button
            onClick={toggleSidebar}
            className="hidden h-10 w-full items-center justify-center gap-2 rounded-xl text-sm text-slate-400 transition hover:bg-slate-900 hover:text-white lg:flex"
          >
            {sidebarCollapsed ? <PanelLeftOpen className="size-5" /> : <><PanelLeftClose className="size-5" /><span>Contraer menú</span></>}
          </button>
        </div>
      </aside>

      <div className={cn("min-h-screen min-w-0 transition-all duration-300", sidebarCollapsed ? "lg:pl-[84px]" : "lg:pl-[272px]")}>
        <header className="sticky top-0 z-30 flex h-20 items-center border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85 sm:px-6">
          <button className="mr-3 rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="size-5" /></button>
          <form onSubmit={submitSearch} className="relative hidden w-full max-w-md md:block">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} className="border-transparent bg-slate-100 pl-9 dark:bg-slate-900" placeholder="Buscar documento, descripción o ruta..." />
          </form>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Cambiar tema">
              {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </Button>
            <Link to="/notificaciones" className="relative grid size-10 place-items-center rounded-xl text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
              <Bell className="size-5" />
              <span className="absolute right-2 top-2 size-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-950" />
            </Link>
            <div className="ml-1 flex items-center gap-3 border-l border-slate-200 pl-3 dark:border-slate-800">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold">{displayName}</p>
                <button onClick={() => void signOut()} className="text-xs text-slate-500 hover:text-teal-700">{roleName} · Salir</button>
              </div>
              <div className="grid size-10 place-items-center rounded-xl bg-teal-100 text-sm font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-300">{initials}</div>
            </div>
          </div>
        </header>

        <main className="min-w-0 overflow-x-hidden px-3 py-4 sm:px-6 sm:py-5 lg:px-8">
          {contextError && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{contextError}</div>}
          {!contextError && userContext && userContext.roles.length === 0 && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Tu cuenta está autenticada, pero todavía no tiene un rol asignado. Un administrador debe habilitar tu acceso.</div>}
          <div className="mb-5 flex min-w-0 flex-wrap items-center gap-1 text-xs text-slate-500">
            <Link to="/dashboard" className="hover:text-teal-700">SIGDAF</Link>
            {crumbs.map((crumb, index) => (
              <span key={`${crumb}-${index}`} className="flex items-center gap-1">
                <ChevronRight className="size-3" />
                <span className={index === crumbs.length - 1 ? "font-semibold text-slate-700 dark:text-slate-300" : ""}>{crumb}</span>
              </span>
            ))}
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
