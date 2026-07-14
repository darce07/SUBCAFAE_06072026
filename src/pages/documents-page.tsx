import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  type ColumnSizingState,
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Clipboard, Download, Eye, ExternalLink, FilePlus2, LoaderCircle, Pencil, Search, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import type { Documento } from "../types";
import { Badge, Button, Card, Input, PageHeader, Select } from "../components/ui";
import { useDocumentos } from "../hooks/use-documentos";
import { useCatalogos } from "../hooks/use-catalogos";
import { formatCurrency, formatDate, formatDateTime, formatRelativeTime, getStatusTone } from "../lib/utils";
import { deleteDocumento, updateDocumento } from "../services/documentos.service";
import { useDebounce } from "../hooks/use-debounce";
import { downloadDocumentoFile, getSignedUrl } from "../services/storage.service";
import { usePermissions } from "../hooks/use-permissions";
import { useAuth } from "../features/auth/auth-context";
import { ConfirmDialog } from "../components/confirm-dialog";

const columnAutoSizeLimits: Record<string, { min: number; max: number }> = {
  codigo_documento: { min: 150, max: 230 },
  categoria: { min: 150, max: 280 },
  fecha_documento: { min: 120, max: 160 },
  created_at: { min: 160, max: 210 },
  usuario: { min: 160, max: 260 },
  tipo_entidad: { min: 150, max: 250 },
  entidad: { min: 180, max: 520 },
  tipo_categoria: { min: 170, max: 360 },
  estado: { min: 120, max: 170 },
  monto: { min: 120, max: 170 },
  movimiento: { min: 150, max: 240 },
  operacion: { min: 150, max: 300 },
  titulo: { min: 260, max: 700 },
  descripcion: { min: 260, max: 760 },
  archivador: { min: 150, max: 300 },
  ruta_historica: { min: 220, max: 760 },
  archivo_path: { min: 120, max: 170 },
  actions: { min: 260, max: 340 },
};

function actionLabel(tipo: NonNullable<Documento["ultima_accion"]>["tipo"]) {
  return { creado: "Subido", editado: "Editado", eliminado: "Eliminado", recuperado: "Recuperado" }[tipo];
}

function actionTone(tipo: NonNullable<Documento["ultima_accion"]>["tipo"]) {
  return { creado: "blue", editado: "amber", eliminado: "red", recuperado: "green" }[tipo] as "blue" | "amber" | "red" | "green";
}

function clampColumnSize(columnId: string, size: number) {
  const limits = columnAutoSizeLimits[columnId] ?? { min: 120, max: 420 };
  return Math.min(Math.max(size, limits.min), limits.max);
}

function getColumnText(documento: Documento, columnId: string) {
  const values: Record<string, string> = {
    codigo_documento: documento.codigo_documento,
    categoria: documento.categoria?.nombre ?? "Sin categoría",
    fecha_documento: formatDate(documento.fecha_documento),
    created_at: documento.created_at ? formatDateTime(documento.created_at) : "",
    usuario: documento.usuario?.nombre_completo ?? documento.usuario?.email ?? "",
    tipo_entidad: documento.tipo_entidad?.nombre ?? "",
    entidad: documento.entidad?.nombre ?? "",
    tipo_categoria: documento.tipo_categoria?.nombre ?? "",
    estado: documento.estado?.nombre ?? "",
    monto: formatCurrency(Number(documento.monto || 0)),
    movimiento: documento.tipo_movimiento?.nombre ?? "No aplica",
    operacion: documento.tipo_operacion?.nombre ?? "",
    titulo: documento.titulo,
    descripcion: documento.descripcion ?? "",
    archivador: documento.archivador?.nombre ?? "Sin archivador",
    ruta_historica: documento.ruta_historica ?? "Sin ruta",
    archivo_path: documento.archivo_path ? "Disponible" : "Sin archivo",
    actions: "Ver Editar Copiar Archivo Descargar Observar Eliminar",
  };
  return values[columnId] ?? "";
}

export function DocumentsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [globalFilter, setGlobalFilter] = useState(searchParams.get("q") ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [statusId, setStatusId] = useState("");
  const [year, setYear] = useState("");
  const [orderMode, setOrderMode] = useState<"registro_desc" | "registro_asc">("registro_desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Documento | null>(null);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [autoFitColumns, setAutoFitColumns] = useState<Record<string, boolean>>({});
  const debouncedSearch = useDebounce(globalFilter, 400);
  const { documentos, count, loading, error, usingFallback, refresh } = useDocumentos({
    search: debouncedSearch,
    categoriaId: categoryId || undefined,
    estadoId: statusId || undefined,
    anio: year ? Number(year) : undefined,
    orderBy: "created_at",
    orderDirection: orderMode === "registro_asc" ? "asc" : "desc",
    page,
    pageSize,
  });
  const catalogos = useCatalogos();
  const { canCreate, canDelete, canEdit } = usePermissions();
  const { userContext } = useAuth();
  const watermarkUsuario = userContext?.nombreCompleto ?? userContext?.email ?? "usuario del sistema";
  const totalPages = Math.max(Math.ceil(count / pageSize), 1);

  const toggleAutoFitColumn = useCallback((columnId: string, headerText: string, defaultSize: number) => {
    if (autoFitColumns[columnId]) {
      setColumnSizing((current) => {
        const next = { ...current };
        delete next[columnId];
        return next;
      });
      setAutoFitColumns((current) => ({ ...current, [columnId]: false }));
      return;
    }

    const longestValue = documentos.reduce(
      (longest, documento) => {
        const value = getColumnText(documento, columnId);
        return value.length > longest.length ? value : longest;
      },
      headerText,
    );
    const estimatedSize = longestValue.length * 7.5 + 44;
    setColumnSizing((current) => ({ ...current, [columnId]: clampColumnSize(columnId, estimatedSize || defaultSize) }));
    setAutoFitColumns((current) => ({ ...current, [columnId]: true }));
  }, [autoFitColumns, documentos]);

  const openFile = async (path: string | null) => {
    if (!path) return;
    try {
      window.open(await getSignedUrl(path), "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo abrir el archivo.");
    }
  };

  const downloadFile = async (documento: Documento) => {
    if (!documento.archivo_path) return;
    try {
      await downloadDocumentoFile(
        documento.archivo_path,
        `${documento.codigo_documento}.${documento.extension ?? "archivo"}`,
        { codigo: documento.codigo_documento, usuario: watermarkUsuario },
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo descargar el archivo.");
    }
  };

  const markObserved = async (documento: Documento) => {
    const observed = catalogos.estadosDocumento.find((item) => item.nombre.toLocaleLowerCase("es").includes("observ"));
    if (!observed) {
      toast.error("No se encontró el estado Observado.");
      return;
    }
    try {
      await updateDocumento(documento.id, { estado_id: observed.id });
      await refresh();
      toast.success("Documento marcado como observado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el estado.");
    }
  };

  const removeDocument = async (documento: Documento) => {
    if (deletingId) return;
    setDeletingId(documento.id);
    try {
      await deleteDocumento(documento.id);
      await refresh();
      toast.success("Documento eliminado de forma segura.");
    } catch (removeError) {
      toast.error(removeError instanceof Error ? removeError.message : "No se pudo eliminar el documento.");
    } finally {
      setDeletingId(null);
      setPendingDelete(null);
    }
  };

  const columns = useMemo<ColumnDef<Documento>[]>(
    () => [
      {
        accessorKey: "codigo_documento",
        header: "Código",
        size: 150,
        minSize: 130,
        maxSize: 240,
        cell: ({ row }) => <button onClick={() => navigate(`/documentos/${row.original.id}`)} className="font-bold text-teal-700 hover:underline dark:text-teal-400">{row.original.codigo_documento}</button>,
      },
      { id: "categoria", accessorFn: (row) => row.categoria?.nombre ?? "", header: "Categoría", size: 170, minSize: 140, maxSize: 300, cell: ({ row }) => <Badge tone="blue">{row.original.categoria?.nombre ?? "Sin categoría"}</Badge> },
      { accessorKey: "fecha_documento", header: "Fecha", size: 130, minSize: 115, maxSize: 170, cell: ({ getValue }) => <span className="whitespace-nowrap">{formatDate(String(getValue()))}</span> },
      { accessorKey: "created_at", header: "Registrado", size: 170, minSize: 145, maxSize: 220, cell: ({ getValue }) => getValue() ? <span className="whitespace-nowrap">{formatDateTime(String(getValue()))}</span> : "—" },
      {
        id: "usuario",
        accessorFn: (row) => row.usuario?.nombre_completo ?? row.usuario?.email ?? "",
        header: "Subido por",
        size: 190,
        minSize: 160,
        maxSize: 260,
        cell: ({ row }) => {
          const usuario = row.original.usuario;
          const nombre = usuario?.nombre_completo ?? usuario?.email ?? "—";
          const ultimaAccion = row.original.ultima_accion;
          return (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate">{nombre}</span>
                {ultimaAccion && <Badge tone={actionTone(ultimaAccion.tipo)}>{actionLabel(ultimaAccion.tipo)}</Badge>}
              </div>
              {ultimaAccion ? (
                <span className="text-xs text-slate-400" title={formatDateTime(ultimaAccion.fecha)}>
                  {ultimaAccion.actorNombre && ultimaAccion.tipo !== "creado" ? `${ultimaAccion.actorNombre} · ` : ""}
                  {formatRelativeTime(ultimaAccion.fecha)}
                </span>
              ) : row.original.created_at ? (
                <span className="text-xs text-slate-400" title={formatDateTime(row.original.created_at)}>
                  {formatRelativeTime(row.original.created_at)}
                </span>
              ) : null}
            </div>
          );
        },
      },
      { id: "tipo_entidad", accessorFn: (row) => row.tipo_entidad?.nombre ?? "", header: "Tipo entidad", size: 160, minSize: 140, maxSize: 270, cell: ({ row }) => row.original.tipo_entidad?.nombre ?? "—" },
      { id: "entidad", accessorFn: (row) => row.entidad?.nombre ?? "", header: "Entidad", size: 230, minSize: 160, maxSize: 560, cell: ({ row }) => row.original.entidad?.nombre ?? "—" },
      { id: "tipo_categoria", accessorFn: (row) => row.tipo_categoria?.nombre ?? "", header: "Tipo categoría", size: 190, minSize: 150, maxSize: 380, cell: ({ row }) => row.original.tipo_categoria?.nombre ?? "—" },
      { id: "estado", accessorFn: (row) => row.estado?.nombre ?? "", header: "Estado", size: 130, minSize: 115, maxSize: 180, cell: ({ row }) => <Badge tone={getStatusTone(row.original.estado?.nombre)}>{row.original.estado?.nombre ?? "Sin estado"}</Badge> },
      { accessorKey: "monto", header: "Monto", size: 130, minSize: 115, maxSize: 180, cell: ({ getValue }) => <strong>{formatCurrency(Number(getValue()))}</strong> },
      { id: "movimiento", accessorFn: (row) => row.tipo_movimiento?.nombre ?? "", header: "Ingreso / Egreso", size: 170, minSize: 145, maxSize: 260, cell: ({ row }) => <Badge tone={row.original.tipo_movimiento?.nombre === "Ingreso" ? "green" : row.original.tipo_movimiento?.nombre === "Egreso" ? "red" : "slate"}>{row.original.tipo_movimiento?.nombre ?? "No aplica"}</Badge> },
      { id: "operacion", accessorFn: (row) => row.tipo_operacion?.nombre ?? "", header: "Tipo operación", size: 170, minSize: 145, maxSize: 320, cell: ({ row }) => row.original.tipo_operacion?.nombre ?? "—" },
      {
        accessorKey: "titulo",
        header: "Título",
        size: 300,
        minSize: 220,
        maxSize: 760,
        cell: ({ row }) => <div className="min-w-0"><p className="truncate font-semibold text-slate-900 dark:text-white" title={row.original.titulo}>{row.original.titulo}</p><p className="mt-0.5 text-xs uppercase text-slate-500">{row.original.extension ?? "Sin archivo"}</p></div>,
      },
      {
        accessorKey: "descripcion",
        header: "Descripción",
        size: 320,
        minSize: 220,
        maxSize: 780,
        cell: ({ row }) => <span className="block truncate text-slate-500" title={row.original.descripcion ?? ""}>{row.original.descripcion || "Sin descripción"}</span>,
      },
      { id: "archivador", accessorFn: (row) => row.archivador?.nombre ?? "", header: "Archivador", size: 170, minSize: 140, maxSize: 320, cell: ({ row }) => row.original.archivador?.nombre ?? <Badge tone="amber">Sin archivador</Badge> },
      { accessorKey: "ruta_historica", header: "Ruta histórica", size: 260, minSize: 200, maxSize: 780, cell: ({ getValue }) => <span className="block truncate font-mono text-xs text-slate-500" title={String(getValue() ?? "")}>{String(getValue() ?? "Sin ruta")}</span> },
      { accessorKey: "archivo_path", header: "Archivo", size: 130, minSize: 115, maxSize: 180, cell: ({ row }) => row.original.archivo_path ? <Badge tone="green">Disponible</Badge> : <Badge tone="red">Sin archivo</Badge> },
      {
        id: "actions",
        header: "",
        size: 300,
        minSize: 250,
        maxSize: 360,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" title="Ver detalle" onClick={() => navigate(`/documentos/${row.original.id}`)}><Eye className="size-4" /></Button>
            {canEdit("documentos") && <Button variant="ghost" size="icon" title="Editar" onClick={() => navigate(`/documentos/${row.original.id}/editar`)}><Pencil className="size-4" /></Button>}
            <Button variant="ghost" size="icon" title="Copiar ruta histórica" disabled={!row.original.ruta_historica} onClick={() => { void navigator.clipboard.writeText(row.original.ruta_historica ?? ""); toast.success("Ruta copiada."); }}><Clipboard className="size-4" /></Button>
            <Button variant="ghost" size="icon" title="Ver archivo" disabled={!row.original.archivo_path} onClick={() => void openFile(row.original.archivo_path)}><ExternalLink className="size-4" /></Button>
            <Button variant="ghost" size="icon" title="Descargar archivo" disabled={!row.original.archivo_path} onClick={() => void downloadFile(row.original)}><Download className="size-4" /></Button>
            {canEdit("documentos") && <Button variant="ghost" size="icon" title="Marcar observado" onClick={() => void markObserved(row.original)}><TriangleAlert className="size-4" /></Button>}
            {canDelete("documentos") && <Button variant="ghost" size="icon" loading={deletingId === row.original.id} title="Eliminar documento" onClick={() => setPendingDelete(row.original)}><Trash2 className="size-4 text-rose-600" /></Button>}
          </div>
        ),
      },
    ],
    [canDelete, canEdit, catalogos.estadosDocumento, deletingId, navigate],
  );

  const table = useReactTable({
    data: documentos,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: totalPages,
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    onColumnSizingChange: setColumnSizing,
    state: { columnSizing },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gestión documental"
        title="Documentos"
        description="Consulta, filtra y administra la documentación institucional."
        action={canCreate("documentos") ? <Button onClick={() => navigate("/documentos/nuevo")}><FilePlus2 className="size-4" />Nuevo documento</Button> : undefined}
      />
      {usingFallback && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">La conexión institucional no está disponible. Se muestran datos temporales de consulta.</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-200 p-3 dark:border-slate-800 sm:p-4 xl:flex-row xl:items-center">
          <div className="relative w-full flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={globalFilter} onChange={(event) => { setGlobalFilter(event.target.value); setPage(1); }} className="pl-9" placeholder="Buscar código, título o descripción..." />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:flex">
            <Select value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setPage(1); }}><option value="">Todas las categorías</option>{catalogos.categorias.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</Select>
            <Select value={statusId} onChange={(event) => { setStatusId(event.target.value); setPage(1); }}><option value="">Todos los estados</option>{catalogos.estadosDocumento.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</Select>
            <Select value={year} onChange={(event) => { setYear(event.target.value); setPage(1); }}><option value="">Todos los años</option>{[2026, 2025, 2024].map((value) => <option key={value}>{value}</option>)}</Select>
            <Select value={orderMode} onChange={(event) => { setOrderMode(event.target.value as "registro_desc" | "registro_asc"); setPage(1); }}><option value="registro_desc">Registro: recientes primero</option><option value="registro_asc">Registro: antiguos primero</option></Select>
            <Select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value={10}>10 filas</option><option value={20}>20 filas</option><option value={50}>50 filas</option></Select>
          </div>
        </div>
        {loading ? <div className="grid min-h-72 place-items-center"><LoaderCircle className="size-7 animate-spin text-teal-600" /></div> : (
          <>
            <div className="responsive-card-list gap-3 p-3 sm:grid-cols-2">
              {documentos.map((documento) => (
                <DocumentMobileCard
                  key={documento.id}
                  documento={documento}
                  canEdit={canEdit("documentos")}
                  canDelete={canDelete("documentos")}
                  deleting={deletingId === documento.id}
                  onView={() => navigate(`/documentos/${documento.id}`)}
                  onEdit={() => navigate(`/documentos/${documento.id}/editar`)}
                  onOpenFile={() => void openFile(documento.archivo_path)}
                  onMarkObserved={() => void markObserved(documento)}
                  onDelete={() => setPendingDelete(documento)}
                />
              ))}
            </div>
            <div className="table-scroll responsive-table">
            <table className="text-left text-sm" style={{ width: table.getTotalSize(), tableLayout: "fixed" }}>
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-900/70">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const headerLabel = typeof header.column.columnDef.header === "string" ? header.column.columnDef.header : header.column.id;
                      const isResizingColumn = table.getState().columnSizingInfo.isResizingColumn === header.column.id;
                      return (
                        <th
                          key={header.id}
                          className={`relative overflow-hidden whitespace-nowrap px-4 py-3 font-bold ${isResizingColumn ? "border-r-2 border-dashed border-teal-500 bg-teal-50/60 dark:bg-teal-950/30" : ""}`}
                          style={{ width: header.getSize() }}
                        >
                          <span className="block truncate pr-2">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                          {header.column.getCanResize() && (
                            <button
                              type="button"
                              aria-label={`Ajustar ancho de ${headerLabel || "columna"}`}
                              title="Arrastra para cambiar ancho. Doble click para autoajustar o restaurar."
                              onMouseDown={header.getResizeHandler()}
                              onTouchStart={header.getResizeHandler()}
                              onDoubleClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                toggleAutoFitColumn(header.column.id, headerLabel, header.column.columnDef.size ?? header.column.getSize());
                              }}
                              className={`absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize touch-none border-r border-transparent transition hover:border-teal-500 hover:bg-teal-500/10 ${header.column.getIsResizing() ? "border-teal-600 bg-teal-500/20" : ""}`}
                            />
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={`overflow-hidden whitespace-nowrap px-4 py-3.5 ${table.getState().columnSizingInfo.isResizingColumn === cell.column.id ? "border-r-2 border-dashed border-teal-500 bg-teal-50/35 dark:bg-teal-950/20" : ""}`}
                        style={{ width: cell.column.getSize() }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-800 sm:flex-row">
          <span>Página {page} de {totalPages} · {count} documentos</span>
          <div className="flex gap-2"><Button variant="secondary" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Anterior</Button><Button variant="secondary" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>Siguiente</Button></div>
        </div>
      </Card>
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(nextOpen) => { if (!nextOpen) setPendingDelete(null); }}
        title="Eliminar documento"
        description={pendingDelete ? `¿Eliminar el documento ${pendingDelete.codigo_documento}? Se ocultará del sistema, pero conservará su auditoría.` : ""}
        confirmLabel="Eliminar"
        loading={pendingDelete ? deletingId === pendingDelete.id : false}
        onConfirm={() => { if (pendingDelete) void removeDocument(pendingDelete); }}
      />
    </div>
  );
}

function DocumentMobileCard({
  documento,
  canEdit,
  canDelete,
  deleting,
  onView,
  onEdit,
  onOpenFile,
  onMarkObserved,
  onDelete,
}: {
  documento: Documento;
  canEdit: boolean;
  canDelete: boolean;
  deleting: boolean;
  onView: () => void;
  onEdit: () => void;
  onOpenFile: () => void;
  onMarkObserved: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <button onClick={onView} className="min-w-0 text-left">
          <p className="break-words text-sm font-black text-teal-700 dark:text-teal-400">{documento.codigo_documento}</p>
          <h2 className="mt-1 line-clamp-2 text-sm font-semibold text-slate-950 dark:text-white">{documento.titulo}</h2>
        </button>
        <Badge tone={getStatusTone(documento.estado?.nombre)}>{documento.estado?.nombre ?? "Sin estado"}</Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <MiniInfo label="Fecha" value={formatDate(documento.fecha_documento)} />
        <MiniInfo label="Registro" value={documento.created_at ? formatDateTime(documento.created_at) : "Sin fecha"} alignRight />
        <MiniInfo label="Monto" value={formatCurrency(Number(documento.monto || 0))} />
        <MiniInfo label="Categoría" value={documento.categoria?.nombre ?? "Sin categoría"} />
        <MiniInfo label="Entidad" value={documento.entidad?.nombre ?? "Sin entidad"} alignRight />
        <MiniInfo label="Archivador" value={documento.archivador?.nombre ?? "Sin archivador"} />
        <MiniInfo label="Movimiento" value={documento.tipo_movimiento?.nombre ?? "No aplica"} alignRight />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={onView}><Eye className="size-4" />Ver</Button>
        {canEdit && <Button size="sm" variant="secondary" onClick={onEdit}><Pencil className="size-4" />Editar</Button>}
        <Button size="sm" variant="secondary" disabled={!documento.archivo_path} onClick={onOpenFile}><ExternalLink className="size-4" />Archivo</Button>
        {canEdit && <Button size="sm" variant="secondary" onClick={onMarkObserved}><TriangleAlert className="size-4" />Observar</Button>}
        {canDelete && <Button size="sm" variant="danger" loading={deleting} onClick={onDelete}><Trash2 className="size-4" />Eliminar</Button>}
      </div>
    </article>
  );
}

function MiniInfo({ label, value, alignRight = false }: { label: string; value: string; alignRight?: boolean }) {
  return (
    <div className={`min-w-0 ${alignRight ? "text-right" : ""}`}>
      <p className="font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 break-words font-medium text-slate-700 dark:text-slate-200">{value}</p>
    </div>
  );
}
