import { useCallback } from "react";
import { useAuth } from "../features/auth/auth-context";

export function usePermissions() {
  const { userContext } = useAuth();
  const permissions = new Set(userContext?.permisos ?? []);
  const isAdmin = userContext?.roles.includes("Administrador") ?? false;

  const can = useCallback(
    (module: string, action: string) => isAdmin || permissions.has(`${module}:${action}`),
    [isAdmin, userContext?.permisos],
  );

  return {
    can,
    canView: (module: string) => can(module, "ver"),
    canCreate: (module: string) => can(module, "crear"),
    canEdit: (module: string) => can(module, "editar"),
    canDelete: (module: string) => can(module, "eliminar") || can(module, "desactivar"),
    canExport: (module: string) => can(module, "exportar"),
    isAdmin,
  };
}
