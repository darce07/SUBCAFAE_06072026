import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { DashboardLayout } from "../components/layout/dashboard-layout";
import { ProtectedRoute } from "./protected-route";

const LoginPage = lazy(() => import("../pages/login-page").then((module) => ({ default: module.LoginPage })));
const DashboardPage = lazy(() => import("../pages/dashboard-page").then((module) => ({ default: module.DashboardPage })));
const DocumentsPage = lazy(() => import("../pages/documents-page").then((module) => ({ default: module.DocumentsPage })));
const NewDocumentPage = lazy(() => import("../pages/new-document-page").then((module) => ({ default: module.NewDocumentPage })));
const DocumentDetailPage = lazy(() => import("../pages/document-detail-page").then((module) => ({ default: module.DocumentDetailPage })));
const EditDocumentPage = lazy(() => import("../pages/edit-document-page").then((module) => ({ default: module.EditDocumentPage })));
const HistoricalPage = lazy(() => import("../pages/historical-page").then((module) => ({ default: module.HistoricalPage })));
const VerificationPage = lazy(() => import("../pages/verification-page").then((module) => ({ default: module.VerificationPage })));
const PhysicalArchivePage = lazy(() => import("../pages/physical-archive-page").then((module) => ({ default: module.PhysicalArchivePage })));
const FinancePage = lazy(() => import("../pages/finance-page").then((module) => ({ default: module.FinancePage })));
const BalancePage = lazy(() => import("../pages/balance-page").then((module) => ({ default: module.BalancePage })));
const AccountingBookPage = lazy(() => import("../pages/accounting-book-page").then((module) => ({ default: module.AccountingBookPage })));
const AuditPage = lazy(() => import("../pages/audit-page").then((module) => ({ default: module.AuditPage })));
const CatalogsPage = lazy(() => import("../pages/catalogs-page").then((module) => ({ default: module.CatalogsPage })));
const UsersPermissionsPage = lazy(() => import("../pages/users-permissions-page").then((module) => ({ default: module.UsersPermissionsPage })));
const RolesPermissionsPage = lazy(() => import("../pages/roles-permissions-page").then((module) => ({ default: module.RolesPermissionsPage })));
const SettingsPage = lazy(() => import("../pages/settings-page").then((module) => ({ default: module.SettingsPage })));
const NotificationsPage = lazy(() => import("../pages/notifications-page").then((module) => ({ default: module.NotificationsPage })));

export function App() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-slate-50 dark:bg-slate-950"><LoaderCircle className="size-8 animate-spin text-teal-600" /></div>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/documentos" element={<DocumentsPage />} />
            <Route path="/documentos/historico" element={<HistoricalPage />} />
            <Route path="/documentos/nuevo" element={<NewDocumentPage />} />
            <Route path="/documentos/:id" element={<DocumentDetailPage />} />
            <Route path="/documentos/:id/editar" element={<EditDocumentPage />} />
            <Route path="/verificacion" element={<VerificationPage />} />
            <Route path="/archivo-fisico" element={<PhysicalArchivePage />} />
            <Route path="/finanzas" element={<Navigate to="/finanzas/ingresos" replace />} />
            <Route path="/finanzas/ingresos" element={<FinancePage kind="Ingreso" />} />
            <Route path="/finanzas/egresos" element={<FinancePage kind="Egreso" />} />
            <Route path="/finanzas/balance" element={<BalancePage />} />
            <Route path="/libro-contable" element={<AccountingBookPage />} />
            <Route path="/auditoria" element={<AuditPage />} />
            <Route path="/catalogos" element={<CatalogsPage />} />
            <Route path="/usuarios" element={<UsersPermissionsPage />} />
            <Route path="/roles-permisos" element={<RolesPermissionsPage />} />
            <Route path="/usuarios-permisos" element={<Navigate to="/roles-permisos" replace />} />
            <Route path="/configuracion" element={<SettingsPage />} />
            <Route path="/notificaciones" element={<NotificationsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
