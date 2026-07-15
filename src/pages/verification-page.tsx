import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, FileQuestion, LoaderCircle } from "lucide-react";
import * as Progress from "@radix-ui/react-progress";
import { useNavigate } from "react-router-dom";
import { useDocumentos } from "../hooks/use-documentos";
import { getStatusTone } from "../lib/utils";
import { Alert, Badge, Button, Card, PageHeader, Select } from "../components/ui";
import type { Documento } from "../types";

export function VerificationPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { documentos, count, loading, error } = useDocumentos({ page, pageSize });
  const totalPages = Math.max(Math.ceil(count / pageSize), 1);
  const totals = {
    Verificado: documentos.filter((item) => item.estado?.nombre === "Verificado").length,
    Pendiente: documentos.filter((item) => item.estado?.nombre === "Pendiente").length,
    Observado: documentos.filter((item) => item.estado?.nombre === "Observado").length,
    "No encontrado": documentos.filter((item) => item.estado?.nombre === "No encontrado").length,
  };
  const progress = documentos.length ? Math.round((totals.Verificado / documentos.length) * 100) : 0;
  const stats = [
    { label: "Verificados", value: totals.Verificado, icon: CheckCircle2, tone: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50" },
    { label: "Pendientes", value: totals.Pendiente, icon: ClipboardCheck, tone: "text-amber-600 bg-amber-50 dark:bg-amber-950/50" },
    { label: "Observados", value: totals.Observado, icon: AlertTriangle, tone: "text-orange-600 bg-orange-50 dark:bg-orange-950/50" },
    { label: "No encontrados", value: totals["No encontrado"], icon: FileQuestion, tone: "text-rose-600 bg-rose-50 dark:bg-rose-950/50" },
  ];

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Control documental" title="Verificación físico-digital" description="Seguimiento del estado físico y digital de los documentos." />
      {error && <Alert>{error}</Alert>}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div><p className="text-sm font-semibold">Progreso visible de verificación</p><p className="text-xs text-slate-500">{totals.Verificado} verificados en esta página · {count} documentos en total</p></div>
          <p className="text-3xl font-black text-teal-700">{progress}%</p>
        </div>
        <Progress.Root value={progress} className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100"><Progress.Indicator className="h-full rounded-full bg-teal-600" style={{ width: `${progress}%` }} /></Progress.Root>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(({ label, value, icon: Icon, tone }) => <Card key={label} className="flex items-center gap-4 p-5"><div className={`grid size-12 place-items-center rounded-xl ${tone}`}><Icon className="size-5" /></div><div><p className="text-2xl font-black">{value}</p><p className="text-xs text-slate-500">{label} en esta página</p></div></Card>)}</div>
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-bold">Documentos por verificar</h2><p className="text-xs text-slate-500">Resultados paginados desde el servidor.</p></div>
          <Select value={String(pageSize)} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="w-full sm:w-36">
            {[10, 20, 50].map((size) => <option key={size} value={size}>{size} por página</option>)}
          </Select>
        </div>
        {loading ? <div className="grid min-h-56 place-items-center"><LoaderCircle className="size-7 animate-spin text-teal-600" /></div> : (
          <>
            <div className="responsive-card-list gap-3 p-3 sm:grid-cols-2">
              {documentos.map((documento) => <VerificationMobileCard key={documento.id} documento={documento} onReview={() => navigate(`/documentos/${documento.id}`)} />)}
            </div>
            <div className="table-scroll responsive-table">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900"><tr>{["Documento", "Archivo digital", "Archivador", "Ruta histórica", "Estado", "Acción"].map((value) => <th key={value} className="whitespace-nowrap px-4 py-3">{value}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{documentos.map((documento) => <tr key={documento.id}><td className="px-4 py-3"><strong>{documento.codigo_documento}</strong><p className="max-w-64 truncate text-xs text-slate-500">{documento.titulo}</p></td><td className="px-4 py-3"><Badge tone={documento.archivo_path ? "green" : "red"}>{documento.archivo_path ? "Sí" : "No"}</Badge></td><td className="px-4 py-3">{documento.archivador?.nombre ?? "Sin asignar"}</td><td className="px-4 py-3"><Badge tone={documento.ruta_historica ? "green" : "amber"}>{documento.ruta_historica ? "Registrada" : "Pendiente"}</Badge></td><td className="px-4 py-3"><Badge tone={documento.estado?.nombre === "Verificado" ? "green" : documento.estado?.nombre === "Observado" ? "orange" : "amber"}>{documento.estado?.nombre ?? "Sin estado"}</Badge></td><td className="px-4 py-3"><Button variant="secondary" size="sm" onClick={() => navigate(`/documentos/${documento.id}`)}>Revisar</Button></td></tr>)}</tbody>
              </table>
            </div>
          </>
        )}
        <div className="flex flex-col gap-3 border-t border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <span>Página {page} de {totalPages} · {count} documentos</span>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(value - 1, 1))}>Anterior</Button>
            <Button variant="secondary" disabled={page >= totalPages || loading} onClick={() => setPage((value) => Math.min(value + 1, totalPages))}>Siguiente</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function VerificationMobileCard({ documento, onReview }: { documento: Documento; onReview: () => void }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="break-words text-sm font-black text-teal-700">{documento.codigo_documento}</p><h2 className="mt-1 line-clamp-2 text-sm font-semibold">{documento.titulo}</h2></div>
        <Badge tone={getStatusTone(documento.estado?.nombre)}>{documento.estado?.nombre ?? "Sin estado"}</Badge>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge tone={documento.archivo_path ? "green" : "red"}>{documento.archivo_path ? "Con archivo" : "Sin archivo"}</Badge>
        <Badge tone={documento.ruta_historica ? "green" : "amber"}>{documento.ruta_historica ? "Ruta registrada" : "Ruta pendiente"}</Badge>
        <Badge tone={documento.archivador_id ? "blue" : "amber"}>{documento.archivador?.nombre ?? "Sin archivador"}</Badge>
      </div>
      <Button className="mt-4 w-full" variant="secondary" size="sm" onClick={onReview}>Revisar</Button>
    </article>
  );
}
