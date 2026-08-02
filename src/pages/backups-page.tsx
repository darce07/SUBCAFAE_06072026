import { useMemo, useState } from "react";
import { DatabaseBackup, Download, LoaderCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Select, Skeleton } from "../components/ui";
import { ConfirmDialog } from "../components/confirm-dialog";
import { useBackups } from "../hooks/use-backups";
import { useCatalogos } from "../hooks/use-catalogos";
import { usePermissions } from "../hooks/use-permissions";
import { getBackupDownloadUrl } from "../services/backups.service";
import { formatDateTime } from "../lib/utils";
import type { Backup } from "../types";

const estadoTone: Record<Backup["estado"], "green" | "amber" | "red"> = {
  listo: "green",
  procesando: "amber",
  error: "red",
};

const estadoLabel: Record<Backup["estado"], string> = {
  listo: "Listo",
  procesando: "Procesando",
  error: "Error",
};

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export function BackupsPage() {
  const { can } = usePermissions();
  const canBackup = can("sistema", "respaldar");
  const { backups, loading, generating, error, generate, remove } = useBackups();
  const catalogos = useCatalogos({ includeEntidades: false });
  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 15 }, (_, index) => current - index);
  }, []);
  const [anio, setAnio] = useState(years[0]);
  const [categoriaId, setCategoriaId] = useState("");
  const [archivadorId, setArchivadorId] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Backup | null>(null);
  const [clearingErrors, setClearingErrors] = useState(false);
  const errorBackups = backups.filter((backup) => backup.estado === "error");

  if (!canBackup) {
    return <Card className="p-8 text-center"><h1 className="font-serif text-xl font-bold">Acceso restringido</h1><p className="mt-2 text-sm text-slate-500">No tienes permiso para generar o consultar respaldos.</p></Card>;
  }

  const onGenerate = async () => {
    try {
      await generate({ anio, categoriaId: categoriaId || null, archivadorId: archivadorId || null });
      toast.success("Respaldo generado correctamente.");
    } catch (generateError) {
      toast.error(generateError instanceof Error ? generateError.message : "No se pudo generar el respaldo.");
    }
  };

  const onDownload = async (backup: Backup) => {
    if (!backup.archivo_path) return;
    setDownloadingId(backup.id);
    try {
      const url = await getBackupDownloadUrl(backup.archivo_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (downloadError) {
      toast.error(downloadError instanceof Error ? downloadError.message : "No se pudo descargar el respaldo.");
    } finally {
      setDownloadingId(null);
    }
  };

  const onDelete = async (backup: Backup) => {
    setDeletingId(backup.id);
    try {
      await remove(backup.id);
      toast.success("Respaldo eliminado del historial.");
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar el respaldo.");
    } finally {
      setDeletingId(null);
      setPendingDelete(null);
    }
  };

  const onClearErrors = async () => {
    setClearingErrors(true);
    try {
      for (const backup of errorBackups) await remove(backup.id);
      toast.success("Respaldos con error eliminados.");
    } catch (clearError) {
      toast.error(clearError instanceof Error ? clearError.message : "No se pudieron eliminar todos los respaldos con error.");
    } finally {
      setClearingErrors(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sistema"
        title="Respaldos"
        description="Genera y descarga respaldos de documentos y archivos por período. Solo visible para usuarios con permiso de respaldo."
      />
      {error && <Alert>{error}</Alert>}
      <Card className="p-4 sm:p-6">
        <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">Nuevo respaldo</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3 xl:flex xl:items-center">
          <Select value={anio} onChange={(event) => setAnio(Number(event.target.value))}>
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </Select>
          <Select value={categoriaId} onChange={(event) => setCategoriaId(event.target.value)}>
            <option value="">Todas las categorías</option>
            {catalogos.categorias.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
          </Select>
          <Select value={archivadorId} onChange={(event) => setArchivadorId(event.target.value)}>
            <option value="">Todos los archivadores</option>
            {catalogos.archivadores.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
          </Select>
          <Button onClick={() => void onGenerate()} loading={generating} className="shrink-0">
            <DatabaseBackup className="size-4" />Generar respaldo
          </Button>
        </div>
        <p className="mt-2 text-xs text-slate-500">Sin categoría ni archivador seleccionados, el respaldo incluye todos los documentos del año elegido.</p>
      </Card>
      <Card>
        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
          <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">Historial</h2>
          {errorBackups.length > 0 && (
            <Button size="sm" variant="secondary" onClick={() => void onClearErrors()} loading={clearingErrors}>
              <Trash2 className="size-4" />Limpiar errores ({errorBackups.length})
            </Button>
          )}
        </div>
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-14 w-full" />)}
          </div>
        ) : backups.length === 0 ? (
          <EmptyState icon={<DatabaseBackup />} title="Sin respaldos" description="Todavía no se generó ningún respaldo." />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {backups.map((backup) => (
              <div key={backup.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Año {backup.anio}</span>
                    <Badge tone={estadoTone[backup.estado]}>{estadoLabel[backup.estado]}</Badge>
                    {backup.estado === "procesando" && <LoaderCircle className="size-3.5 animate-spin text-amber-500" />}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDateTime(backup.created_at)} · {backup.total_documentos ?? 0} documentos · {formatBytes(backup.tamano_bytes)}
                  </p>
                  {backup.estado === "procesando" && (() => {
                    const porcentaje = backup.total_archivos ? Math.min(100, Math.round((backup.archivos_procesados / backup.total_archivos) * 100)) : null;
                    return (
                      <div className="mt-2 flex max-w-xs items-center gap-2">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div
                            className={`h-full rounded-full bg-amber-400 ${porcentaje === null ? "w-1/3 animate-pulse" : "transition-all"}`}
                            style={porcentaje === null ? undefined : { width: `${porcentaje}%` }}
                          />
                        </div>
                        <span className="shrink-0 text-xs font-semibold text-amber-600">
                          {porcentaje === null ? "…" : `${porcentaje}%`}
                        </span>
                      </div>
                    );
                  })()}
                  {backup.estado === "error" && backup.error_mensaje && (
                    <p className="mt-1 text-xs text-rose-600">{backup.error_mensaje}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  {backup.estado === "listo" && backup.archivo_path && (
                    <Button size="sm" variant="secondary" onClick={() => void onDownload(backup)} loading={downloadingId === backup.id}>
                      {downloadingId === backup.id ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}Descargar
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" title="Eliminar del historial" onClick={() => setPendingDelete(backup)} loading={deletingId === backup.id}>
                    <Trash2 className="size-4 text-rose-600" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(nextOpen) => { if (!nextOpen) setPendingDelete(null); }}
        title="Eliminar respaldo"
        description={pendingDelete ? `¿Eliminar el respaldo del año ${pendingDelete.anio} del historial? Esta acción no se puede deshacer.` : ""}
        confirmLabel="Eliminar"
        loading={pendingDelete ? deletingId === pendingDelete.id : false}
        onConfirm={() => { if (pendingDelete) void onDelete(pendingDelete); }}
      />
    </div>
  );
}
