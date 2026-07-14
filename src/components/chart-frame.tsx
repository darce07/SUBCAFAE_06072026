import { useEffect, useRef, useState, type ReactNode } from "react";

export function ChartFrame({
  height,
  className = "",
  children,
}: {
  height: number;
  className?: string;
  children: (size: { width: number; height: number }) => ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setSize({
        width: Math.max(1, Math.floor(rect.width)),
        height: Math.max(1, Math.floor(rect.height || height)),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    window.addEventListener("resize", updateSize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, [height]);

  return (
    <div ref={containerRef} className={`min-w-0 ${className}`} style={{ height, minHeight: height }}>
      {size.width > 1 && size.height > 1 ? children(size) : null}
    </div>
  );
}
