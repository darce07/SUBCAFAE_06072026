import { useEffect } from "react";

const SCROLL_STEP = 120;
const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function isEditingElsewhere() {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return false;
  return EDITABLE_TAGS.has(active.tagName) || active.isContentEditable;
}

// Las tablas (.table-scroll, compartida por las 8 tablas del sistema) no
// tenían forma de moverse horizontalmente para usuarios de mouse sin
// trackpad — solo un scrollbar delgado al fondo. Alcanza con tener el
// cursor encima (sin necesidad de hacer clic) para que ← → hagan scroll
// horizontal suave. Si el foco real está en un campo editable en otra
// parte de la pantalla, se ignora — no queremos robarle las flechas al
// cursor de texto solo porque el mouse quedó sobre una tabla de fondo.
// Un solo listener global evita repetir la lógica en cada una de las 8 páginas.
export function useTableScrollKeyboard() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (isEditingElsewhere()) return;
      const hovered = document.querySelector<HTMLElement>(".table-scroll:hover");
      const container = hovered ?? (document.activeElement instanceof HTMLElement ? document.activeElement.closest<HTMLElement>(".table-scroll") : null);
      if (!container || container.scrollWidth <= container.clientWidth) return;
      event.preventDefault();
      container.scrollBy({ left: event.key === "ArrowRight" ? SCROLL_STEP : -SCROLL_STEP, behavior: "smooth" });
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}
