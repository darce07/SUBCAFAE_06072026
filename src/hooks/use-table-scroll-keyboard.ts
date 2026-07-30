import { useEffect } from "react";

const SCROLL_STEP = 120;

// Las tablas (.table-scroll, compartida por las 8 tablas del sistema) no
// tenían forma de moverse horizontalmente para usuarios de mouse sin
// trackpad — solo un scrollbar delgado al fondo. Con esto, con foco sobre
// la tabla (clic o Tab), las flechas ← → hacen scroll horizontal suave.
// Un solo listener global evita repetir la lógica en cada una de las 8 páginas.
export function useTableScrollKeyboard() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const target = document.activeElement;
      if (!(target instanceof HTMLElement)) return;
      const container = target.closest(".table-scroll");
      if (!container || container.scrollWidth <= container.clientWidth) return;
      event.preventDefault();
      container.scrollBy({ left: event.key === "ArrowRight" ? SCROLL_STEP : -SCROLL_STEP, behavior: "smooth" });
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}
