import { useState } from "react";
import { RotateCcw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Card, EmptyState, Input, PageHeader } from "../components/ui";
import { ConfirmDialog } from "../components/confirm-dialog";
import { useDocumentos } from "../hooks/use-documentos";
import { useDebounce } from "../hooks/use-debounce";
import { usePermissions } from "../hooks/use-permissions";
import { formatDateTime, formatRelativeTime } from "../lib/utils";
import { restaurarDocumento } from "../services/documentos.service";
import type { Documento } from "../types";

export function TrashPage() {
  const { canDelete } = usePermissions();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [pendingRestore, setPendingRestore] = useState<Documento | null>(null);
  const debouncedSearch = useDebounce(search, 400);
  const pageSize = 20;
  const { documentos, count, loading, error, refresh } = useDocumentos({
    search: debouncedSearch,
    soloEliminados: true,
    orderBy: "eliminado_at",
    orderDirection: "desc",
    page,
    pageSize,
  });
  const totalPages = Math.max(Math.ceil(count / pageSize), 1);

  const restore = async (documento: Documento) => {
    if (restoringId) return;
    setRestoringId(documento.id);
    try {
      await restaurarDocumento(documento.id);
      await refresh();
      toast.success(`Documento ${documento.codigo_documento} restaurado.`);
    } catch (restoreError) {
      toast.error(restoreError instanceof Error ? restoreError.message : "No se pudo restaurar el documento.");
    } finally {
      setRestoringId(null);
      setPendingRestore(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gestión documental"
        title="Papelera"
        description="Documentos eliminados. Pueden recuperarse en caso de error o para revisión."
      />
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
      <Card>
        <div className="border-b border-slate-200 p-3 dark:border-slate-800 sm:p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              className="pl-9"
              placeholder="Buscar código, título o descripción..."
            />
          </div>
        </div>
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : documentos.length === 0 ? (
          <EmptyState icon={<Trash2 />} title="La papelera está vacía" description="No hay documentos eliminados que coincidan con la búsqueda." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Título</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Eliminado por</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {documentos.map((documento) => {
                  const eliminadoPor = documento.eliminado_por_usuario;
                  return (
                    <tr key={documento.id}>
                      <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200">{documento.codigo_documento}</td>
                      <td className="max-w-[280px] truncate px-4 py-3" title={documento.titulo}>{documento.titulo}</td>
                      <td className="px-4 py-3"><Badge tone="slate">{documento.categoria?.nombre ?? "Sin categoría"}</Badge></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span>{eliminadoPor?.nombre_completo ?? eliminadoPor?.email ?? "—"}</span>
                          {documento.eliminado_at && (
                            <span className="text-xs text-slate-400" title={formatDateTime(documento.eliminado_at)}>
                              {formatRelativeTime(documento.eliminado_at)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canDelete("documentos") && (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={restoringId === documento.id}
                            onClick={() => setPendingRestore(documento)}
                          >
                            <RotateCcw className="size-4" />
                            Restaurar
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-800 sm:flex-row">
          <span>Página {page} de {totalPages} · {count} documentos eliminados</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Anterior</Button>
            <Button size="sm" variant="secondary" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>Siguiente</Button>
          </div>
        </div>
      </Card>
      <ConfirmDialog
        open={Boolean(pendingRestore)}
        onOpenChange={(open) => !open && setPendingRestore(null)}
        title="Restaurar documento"
        description={pendingRestore ? `¿Restaurar el documento ${pendingRestore.codigo_documento}? Volverá a aparecer en la tabla principal de documentos.` : ""}
        confirmLabel="Restaurar"
        variant="primary"
        loading={Boolean(restoringId)}
        onConfirm={() => pendingRestore && void restore(pendingRestore)}
      />
    </div>
  );
}
