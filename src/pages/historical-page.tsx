import { memo, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  LoaderCircle,
  Pencil,
  Search,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Alert, Badge, Button, Card, EmptyState, Input, PageHeader, Select } from "../components/ui";
import { useCatalogos } from "../hooks/use-catalogos";
import { useDebounce } from "../hooks/use-debounce";
import { useDocumentos } from "../hooks/use-documentos";
import { usePermissions } from "../hooks/use-permissions";
import { useAuth } from "../features/auth/auth-context";
import { formatCurrency, formatDate } from "../lib/utils";
import { downloadDocumentoFile, getSignedUrl } from "../services/storage.service";
import type { Documento } from "../types";

interface TreeNode {
  key: string;
  name: string;
  children: TreeNode[];
  document?: Documento;
}

const OPEN_FOLDERS_KEY = "sigdaf:historical-open-folders";

export function HistoricalPage() {
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const { userContext } = useAuth();
  const watermarkUsuario = userContext?.nombreCompleto ?? userContext?.email ?? "usuario del sistema";
  const catalogos = useCatalogos();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [year, setYear] = useState("");
  const [entityId, setEntityId] = useState("");
  const [statusId, setStatusId] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Documento | null>(null);
  const [openFolders, setOpenFolders] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(OPEN_FOLDERS_KEY) ?? "[]") as string[]);
    } catch {
      return new Set();
    }
  });
  const debouncedSearch = useDebounce(search, 400);
  const pageSize = 100;
  const { documentos, count, loading, error } = useDocumentos({
    search: debouncedSearch,
    categoriaId: categoryId || undefined,
    estadoId: statusId || undefined,
    entidadId: entityId || undefined,
    anio: year ? Number(year) : undefined,
    hasHistoricalPath: true,
    page,
    pageSize,
  });
  const tree = useMemo(() => buildTree(documentos.filter((item) => item.ruta_historica)), [documentos]);
  const totalPages = Math.max(Math.ceil(count / pageSize), 1);
  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 15 }, (_, index) => current - index);
  }, []);

  useEffect(() => {
    localStorage.setItem(OPEN_FOLDERS_KEY, JSON.stringify([...openFolders]));
  }, [openFolders]);

  const toggleFolder = (key: string) => {
    setOpenFolders((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openFile = async (documento: Documento) => {
    if (!documento.archivo_path) return;
    try {
      window.open(await getSignedUrl(documento.archivo_path), "_blank", "noopener,noreferrer");
    } catch (openError) {
      toast.error(openError instanceof Error ? openError.message : "No se pudo abrir el archivo.");
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
    } catch (downloadError) {
      toast.error(downloadError instanceof Error ? downloadError.message : "No se pudo descargar el archivo.");
    }
  };

  return <div className="space-y-6">
    <PageHeader eyebrow="Gestión documental" title="Explorador histórico" description="Navega por la organización histórica de los documentos registrados." />
    {error && <Alert>{error}</Alert>}
    <Card>
      <div className="grid min-w-0 gap-3 border-b border-slate-200 p-3 dark:border-slate-800 sm:p-4 lg:grid-cols-[minmax(0,1fr)_repeat(4,minmax(0,150px))]">
        <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="pl-9" placeholder="Buscar ruta, código o título..." /></div>
        <Select value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setPage(1); }}><option value="">Todas las categorías</option>{catalogos.categorias.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</Select>
        <Select value={year} onChange={(event) => { setYear(event.target.value); setPage(1); }}><option value="">Todos los años</option>{years.map((value) => <option key={value} value={value}>{value}</option>)}</Select>
        <Select value={entityId} onChange={(event) => { setEntityId(event.target.value); setPage(1); }}><option value="">Todas las entidades</option>{catalogos.entidades.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</Select>
        <Select value={statusId} onChange={(event) => { setStatusId(event.target.value); setPage(1); }}><option value="">Todos los estados</option>{catalogos.estadosDocumento.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</Select>
      </div>
      <div className="grid min-h-[620px] min-w-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className="min-w-0 border-b border-slate-200 p-4 dark:border-slate-800 lg:border-b-0 lg:border-r">
          {loading ? <TreeSkeleton /> : tree.length === 0 ? <EmptyState icon={<FolderOpen />} title="Sin rutas históricas" description="No existen documentos organizados para los filtros actuales." /> : <div className="space-y-1">{tree.map((node) => <TreeItem key={node.key} node={node} depth={0} openFolders={openFolders} onToggle={toggleFolder} onSelect={setSelected} selectedId={selected?.id} />)}</div>}
        </div>
        <aside className="relative bg-slate-50/70 p-5 dark:bg-slate-950/40">
          {selected ? <motion.div key={selected.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}>
            <button onClick={() => setSelected(null)} className="absolute right-4 top-4 rounded-lg p-2 hover:bg-slate-200 dark:hover:bg-slate-800"><X className="size-4" /></button>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Detalle documental</p>
            <div className="mt-5 grid size-16 place-items-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-950"><DocumentIcon extension={selected.extension} className="size-8" /></div>
            <h2 className="mt-4 pr-8 text-lg font-bold">{selected.titulo}</h2>
            <p className="mt-1 text-xs text-slate-500">{selected.codigo_documento}</p>
            <div className="mt-5 grid gap-4">
              <Info label="Categoría" value={selected.categoria?.nombre} />
              <Info label="Entidad" value={selected.entidad?.nombre} />
              <Info label="Estado" value={selected.estado?.nombre} />
              <Info label="Archivador" value={selected.archivador?.nombre} />
              <Info label="Fecha" value={formatDate(selected.fecha_documento)} />
              <Info label="Monto" value={formatCurrency(Number(selected.monto || 0))} />
              <Info label="Ruta histórica" value={selected.ruta_historica} mono />
            </div>
            <div className="mt-6 grid gap-2">
              <Button disabled={!selected.archivo_path} onClick={() => void openFile(selected)}><ExternalLink className="size-4" />Abrir documento</Button>
              <Button variant="secondary" disabled={!selected.archivo_path} onClick={() => void downloadFile(selected)}><Download className="size-4" />Descargar</Button>
              {canEdit("documentos") && <Button variant="secondary" onClick={() => navigate(`/documentos/${selected.id}/editar`)}><Pencil className="size-4" />Editar metadatos</Button>}
            </div>
          </motion.div> : <EmptyState icon={<FileText />} title="Selecciona un archivo" description="El panel mostrará sus metadatos y acciones disponibles." />}
        </aside>
      </div>
      <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-800 sm:flex-row">
        <span>Página {page} de {totalPages} · {count} documentos encontrados</span>
        <div className="flex gap-2"><Button size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Anterior</Button><Button size="sm" variant="secondary" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>Siguiente</Button></div>
      </div>
    </Card>
  </div>;
}

const TreeItem = memo(function TreeItem({
  node,
  depth,
  openFolders,
  onToggle,
  onSelect,
  selectedId,
}: {
  node: TreeNode;
  depth: number;
  openFolders: Set<string>;
  onToggle: (key: string) => void;
  onSelect: (documento: Documento) => void;
  selectedId?: string;
}) {
  const isFolder = !node.document;
  const isOpen = openFolders.has(node.key);
  if (!isFolder) {
    return <button onClick={() => onSelect(node.document!)} className={`flex w-full items-center gap-2 rounded-xl py-2 pr-3 text-left text-sm transition hover:bg-slate-100 dark:hover:bg-slate-800 ${selectedId === node.document!.id ? "bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-200" : ""}`} style={{ paddingLeft: `${depth * 20 + 12}px` }}><span className="w-4" /><DocumentIcon extension={node.document!.extension} className="size-4 shrink-0" /><span className="truncate">{node.name}</span><Badge tone="slate" className="ml-auto">{node.document!.extension?.toUpperCase() || "FILE"}</Badge></button>;
  }
  return <div><button onClick={() => onToggle(node.key)} className="flex w-full items-center gap-2 rounded-xl py-2 pr-3 text-left text-sm font-semibold transition hover:bg-slate-100 dark:hover:bg-slate-800" style={{ paddingLeft: `${depth * 20 + 12}px` }}>{isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}{isOpen ? <FolderOpen className="size-5 text-amber-500" /> : <Folder className="size-5 text-amber-500" />}<span className="truncate">{node.name}</span><span className="ml-auto text-xs text-slate-400">{node.children.length}</span></button>{isOpen && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>{node.children.map((child) => <TreeItem key={child.key} node={child} depth={depth + 1} openFolders={openFolders} onToggle={onToggle} onSelect={onSelect} selectedId={selectedId} />)}</motion.div>}</div>;
});

function buildTree(documents: Documento[]): TreeNode[] {
  interface BuilderNode {
    key: string;
    name: string;
    children: Map<string, BuilderNode>;
    document?: Documento;
  }
  const root = new Map<string, BuilderNode>();
  for (const documento of documents) {
    const segments = normalizeDocumentPath(documento);
    let current = root;
    let accumulated = "";
    segments.forEach((segment, index) => {
      accumulated = accumulated ? `${accumulated}/${segment}` : segment;
      const isFile = index === segments.length - 1;
      const mapKey = isFile ? `${segment}::${documento.id}` : segment;
      let node = current.get(mapKey);
      if (!node) {
        node = { key: isFile ? `file:${documento.id}` : `folder:${accumulated}`, name: segment, children: new Map(), document: isFile ? documento : undefined };
        current.set(mapKey, node);
      }
      if (!isFile) current = node.children;
    });
  }
  const convert = (nodes: Map<string, BuilderNode>): TreeNode[] => Array.from(nodes.values())
    .map((node) => ({ key: node.key, name: node.name, document: node.document, children: convert(node.children) }))
    .sort((left, right) => Number(Boolean(left.document)) - Number(Boolean(right.document)) || left.name.localeCompare(right.name, "es"));
  return convert(root);
}

function normalizeDocumentPath(documento: Documento) {
  const segments = (documento.ruta_historica ?? "").split(/[\\/]+/).map((part) => part.trim()).filter(Boolean);
  const extension = documento.extension?.replace(/^\./, "") || "file";
  const expectedFile = `${documento.titulo}.${extension}`;
  const last = segments.at(-1) ?? "";
  if (!last.includes(".")) segments.push(expectedFile);
  return segments;
}

function DocumentIcon({ extension, className }: { extension?: string | null; className?: string }) {
  const value = extension?.toLocaleLowerCase("es") ?? "";
  if (["png", "jpg", "jpeg", "webp"].includes(value)) return <FileImage className={className} />;
  if (["xls", "xlsx", "csv"].includes(value)) return <FileSpreadsheet className={className} />;
  if (["pdf", "doc", "docx", "txt"].includes(value)) return <FileText className={className} />;
  return <File className={className} />;
}

function Info({ label, value, mono = false }: { label: string; value?: string | null; mono?: boolean }) {
  return <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-1 break-words text-sm ${mono ? "font-mono text-xs" : "font-medium"}`}>{value || "—"}</p></div>;
}

function TreeSkeleton() {
  return <div className="space-y-3">{Array.from({ length: 9 }, (_, index) => <div key={index} className="h-9 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" style={{ width: `${85 - (index % 3) * 10}%` }} />)}<LoaderCircle className="mx-auto mt-6 size-6 animate-spin text-teal-600" /></div>;
}
