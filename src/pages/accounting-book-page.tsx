import { Download, FileSpreadsheet, LoaderCircle, Search } from "lucide-react";
import { useState } from "react";
import { useDocumentos } from "../hooks/use-documentos";
import { useDebounce } from "../hooks/use-debounce";
import { formatCurrency, formatDate } from "../lib/utils";
import { Badge, Button, Card, Input, PageHeader } from "../components/ui";
import type { Documento } from "../types";

export function AccountingBookPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const { documentos, loading, error } = useDocumentos({ search: debouncedSearch, page: 1, pageSize: 100 });
  const movements = documentos.filter((item) => item.tipo_movimiento?.nombre === "Ingreso" || item.tipo_movimiento?.nombre === "Egreso");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Contabilidad"
        title="Libro contable digital"
        description="Vista contable derivada de documentos con movimiento económico."
        action={<div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto"><Button variant="secondary" disabled><FileSpreadsheet className="size-4" />Excel</Button><Button variant="secondary" disabled><Download className="size-4" />PDF</Button></div>}
      />
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
      <Card>
        <div className="border-b border-slate-200 p-3 dark:border-slate-800 sm:p-4">
          <div className="relative max-w-lg">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Buscar documento o descripción..." />
          </div>
        </div>
        {loading ? <div className="grid min-h-56 place-items-center"><LoaderCircle className="size-7 animate-spin text-teal-600" /></div> : <AccountingRows movements={movements} />}
      </Card>
    </div>
  );
}

function AccountingRows({ movements }: { movements: Documento[] }) {
  let mobileBalance = 0;
  let tableBalance = 0;
  return (
    <>
      <div className="responsive-card-list gap-3 p-3 sm:grid-cols-2">
        {movements.map((movement, index) => {
          const income = movement.tipo_movimiento?.nombre === "Ingreso";
          mobileBalance += income ? movement.monto : -movement.monto;
          return (
            <article key={movement.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-400">ASI-{String(index + 1).padStart(4, "0")}</p>
                  <h2 className="mt-1 line-clamp-2 text-sm font-semibold text-slate-950 dark:text-white">{movement.titulo}</h2>
                  <p className="mt-1 break-words text-xs text-slate-500">{movement.codigo_documento}</p>
                </div>
                <Badge tone={movement.estado?.nombre === "Verificado" ? "green" : "amber"}>{movement.estado?.nombre ?? "Pendiente"}</Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <span className="text-slate-500">{formatDate(movement.fecha_documento)}</span>
                <strong className="text-right text-slate-900 dark:text-white">{formatCurrency(mobileBalance)}</strong>
                <span className={income ? "text-emerald-600" : "text-slate-400"}>Debe: {income ? formatCurrency(movement.monto) : "—"}</span>
                <span className={!income ? "text-rose-600" : "text-slate-400"}>Haber: {!income ? formatCurrency(movement.monto) : "—"}</span>
              </div>
            </article>
          );
        })}
      </div>
      <div className="table-scroll responsive-table">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
            <tr>{["Asiento", "Fecha", "Detalle", "Documento", "Debe", "Haber", "Saldo", "Estado"].map((item) => <th key={item} className="whitespace-nowrap px-4 py-3">{item}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {movements.map((movement, index) => {
              const income = movement.tipo_movimiento?.nombre === "Ingreso";
              tableBalance += income ? movement.monto : -movement.monto;
              return (
                <tr key={movement.id}>
                  <td className="px-4 py-3 font-bold">ASI-{String(index + 1).padStart(4, "0")}</td>
                  <td className="whitespace-nowrap px-4 py-3">{formatDate(movement.fecha_documento)}</td>
                  <td className="min-w-60 px-4 py-3"><strong>{movement.titulo}</strong><p className="text-xs text-slate-500">{movement.categoria?.nombre} · {movement.entidad?.nombre ?? "Sin entidad"}</p></td>
                  <td className="px-4 py-3">{movement.codigo_documento}</td>
                  <td className="px-4 py-3 text-emerald-600">{income ? formatCurrency(movement.monto) : "—"}</td>
                  <td className="px-4 py-3 text-rose-600">{!income ? formatCurrency(movement.monto) : "—"}</td>
                  <td className="px-4 py-3 font-bold">{formatCurrency(tableBalance)}</td>
                  <td className="px-4 py-3"><Badge tone={movement.estado?.nombre === "Verificado" ? "green" : "amber"}>{movement.estado?.nombre ?? "Pendiente"}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
