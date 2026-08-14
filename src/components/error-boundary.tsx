import { Component, type ErrorInfo, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "./ui";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Sin esto, un componente roto en cualquier página (pasó con el ícono
// faltante de notifications-page.tsx: tipo "sistema" sin mapear) deja toda
// la app en blanco, sin ningún mensaje — el usuario no tiene forma de saber
// qué pasó ni de recuperarse sin recargar a ciegas.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Error no controlado:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid min-h-[60vh] place-items-center p-6">
          <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-600/10 dark:bg-rose-950/50">
              <TriangleAlert className="size-6" />
            </div>
            <h1 className="mt-4 text-lg font-bold">Algo salió mal</h1>
            <p className="mt-2 text-sm text-slate-500">
              Esta sección tuvo un error inesperado. Recargar la página suele resolverlo.
            </p>
            {/* Mensaje tecnico visible para poder reportarlo sin necesitar
                F12 - antes solo quedaba en la consola del navegador. */}
            <p className="mt-3 break-words rounded-lg bg-slate-50 p-2 text-left font-mono text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400">
              {this.state.error.message || "Error sin mensaje."}
            </p>
            <Button className="mt-5" onClick={() => window.location.reload()}>Recargar página</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
