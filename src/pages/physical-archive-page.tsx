import { Archive, FileQuestion, FolderArchive, LoaderCircle, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useCatalogos } from "../hooks/use-catalogos";
import { useDebounce } from "../hooks/use-debounce";
import { useArchivoFisicoDocumentos, useArchivoFisicoResumen } from "../hooks/use-archivo-fisico-documentos";
import { Badge, Button, Card, Input, PageHeader, Select } from "../components/ui";
import { formatDate } from "../lib/utils";
import type { Documento } from "../types";

export function PhysicalArchivePage() {
  const [search, setSearch] = useState("");
  const [selectedArchiveId, setSelectedArchiveId] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const debouncedSearch = useDebounce(search);
  const catalogos = useCatalogos();
  const activeArchives = useMemo(() => catalogos.archivadores.filter((item) => item.activo), [catalogos.archivadores]);
  const selectedArchive = activeArchives.find((item) => item.id === selectedArchiveId) ?? null;
  const { resumen, loading: loadingResumen, error: resumenError } = useArchivoFisicoResumen(debouncedSearch);
  const { documentos, count, loading, error } = useArchivoFisicoDocumentos({
    search: debouncedSearch,
    archivadorId: selectedArchiveId || undefined,
    page,
    pageSize,
  });
  const totalPages = Math.max(Math.ceil(count / pageSize), 1);
  const visibleArchives = activeArchives.filter((archive) => {
    const term = debouncedSearch.toLocaleLowerCase("es");
    return !term
      || archive.nombre.toLocaleLowerCase("es").includes(term)
      || (archive.descripcion ?? "").toLocaleLowerCase("es").includes(term);
  });

  const selectArchive = (archiveId: string) => {
    setSelectedArchiveId(archiveId);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Custodia documental"
        title="Archivo físico"
        description="Consulta ubicaciones físicas y los documentos asignados a cada archivador."
      />
      {(catalogos.error || resumenError || error) && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {catalogos.error || resumenError || error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <Archive className="mb-3 size-5 text-teal-600" />
          <p className="text-2xl font-black">{activeArchives.length}</p>
          <p className="text-xs text-slate-500">Archivadores activos</p>
        </Card>
        <Card className="p-5">
          <FolderArchive className="mb-3 size-5 text-blue-600" />
          <p className="text-2xl font-black">{loadingResumen ? "..." : resumen.asignados}</p>
          <p className="text-xs text-slate-500">Documentos asignados</p>
        </Card>
        <Card className="p-5">
          <FileQuestion className="mb-3 size-5 text-amber-600" />
          <p className="text-2xl font-black">{loadingResumen ? "..." : resumen.sinArchivador}</p>
          <p className="text-xs text-slate-500">Pendientes de ubicación</p>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xl">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="pl-9"
              placeholder="Buscar documento, archivador o ruta..."
            />
          </div>
          <Button variant="secondary" onClick={() => { setSearch(""); setSelectedArchiveId(""); setPage(1); }}>
            Restablecer filtros
          </Button>
        </div>
      </Card>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {visibleArchives.map((archive) => {
          const associated = resumen.porArchivador[archive.id] ?? 0;
          const isSelected = selectedArchiveId === archive.id;
          return (
            <button
              type="button"
              key={archive.id}
              onClick={() => selectArchive(archive.id)}
              className={`overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900 ${
                isSelected ? "border-teal-500 ring-2 ring-teal-500/20" : "border-slate-200 dark:border-slate-800"
              }`}
            >
              <div className="h-2 bg-gradient-to-r from-teal-600 to-cyan-400" />
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid size-12 place-items-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <Archive className="size-6" />
                  </div>
                  <Badge tone={isSelected ? "blue" : "green"}>{isSelected ? "Seleccionado" : "Activo"}</Badge>
                </div>
                <h2 className="mt-4 break-words font-bold">{archive.nombre}</h2>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{archive.descripcion || "Sin descripción"}</p>
                <div className="mt-5 rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
                  <p className="text-lg font-black">{associated}</p>
                  <p className="text-xs text-slate-500">Documentos asignados</p>
                </div>
              </div>
            </button>
          );
        })}
        {!visibleArchives.length && (
          <Card className="p-5 text-sm text-slate-500">No se encontraron archivadores para la búsqueda actual.</Card>
        )}
      </section>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 p-5 dark:border-slate-800">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold">
                {selectedArchive ? `Documentos en ${selectedArchive.nombre}` : "Selecciona un archivador"}
              </h2>
              <p className="text-sm text-slate-500">
                {selectedArchive
                  ? "Listado de documentos ubicados en el archivador seleccionado."
                  : "Elige un archivador para consultar su contenido físico."}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select
                value={String(pageSize)}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
                className="w-full sm:w-28"
              >
                {[10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}
              </Select>
            </div>
          </div>
        </div>

        {!selectedArchive ? (
          <div className="p-5 text-sm text-slate-500">Selecciona un archivador para ver los documentos contenidos.</div>
        ) : loading ? (
          <div className="grid min-h-56 place-items-center">
            <LoaderCircle className="size-7 animate-spin text-teal-600" />
          </div>
        ) : (
          <>
            <ArchiveDocumentList documentos={documentos} />
            {!documentos.length && (
              <div className="p-5 text-sm text-slate-500">No hay documentos para los filtros seleccionados.</div>
            )}
            <div className="flex flex-col gap-3 border-t border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <span>Página {page} de {totalPages} · {count} documentos</span>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => Math.max(value - 1, 1))}>Anterior</Button>
                <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(value + 1, totalPages))}>Siguiente</Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function ArchiveDocumentList({ documentos }: { documentos: Documento[] }) {
  return (
    <>
      <div className="responsive-card-list gap-3 p-3 sm:grid-cols-2">
        {documentos.map((documento) => <ArchiveDocumentCard key={documento.id} documento={documento} />)}
      </div>
      <div className="table-scroll responsive-table">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="px-5 py-3">Código</th>
              <th className="px-5 py-3">Fecha</th>
              <th className="px-5 py-3">Categoría</th>
              <th className="px-5 py-3">Entidad</th>
              <th className="px-5 py-3">Título</th>
              <th className="px-5 py-3">Estado</th>
              <th className="px-5 py-3">Ruta física</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {documentos.map((documento) => (
              <tr key={documento.id}>
                <td className="px-5 py-4 font-semibold text-teal-700">{documento.codigo_documento}</td>
                <td className="px-5 py-4">{formatDate(documento.fecha_documento)}</td>
                <td className="px-5 py-4">{documento.categoria?.nombre ?? "Sin categoría"}</td>
                <td className="px-5 py-4">{documento.entidad?.nombre ?? "—"}</td>
                <td className="max-w-md px-5 py-4">{documento.titulo}</td>
                <td className="px-5 py-4"><Badge tone={documento.estado?.nombre === "Observado" ? "amber" : "green"}>{documento.estado?.nombre ?? "Pendiente"}</Badge></td>
                <td className="px-5 py-4 text-slate-500">{documento.ruta_historica || "Sin ruta registrada"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ArchiveDocumentCard({ documento }: { documento: Documento }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words font-bold text-teal-700">{documento.codigo_documento}</p>
          <p className="mt-1 break-words text-sm font-semibold text-slate-900 dark:text-white">{documento.titulo}</p>
        </div>
        <Badge tone={documento.estado?.nombre === "Observado" ? "amber" : "green"}>{documento.estado?.nombre ?? "Pendiente"}</Badge>
      </div>
      <div className="mt-4 grid gap-3 text-sm text-slate-600 dark:text-slate-300">
        <ArchiveInfo label="Fecha" value={formatDate(documento.fecha_documento)} />
        <ArchiveInfo label="Categoría" value={documento.categoria?.nombre ?? "Sin categoría"} />
        <ArchiveInfo label="Entidad" value={documento.entidad?.nombre ?? "—"} />
        <ArchiveInfo label="Ruta física" value={documento.ruta_historica || "Sin ruta registrada"} />
      </div>
    </div>
  );
}

function ArchiveInfo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="break-words">{value}</p>
    </div>
  );
}
