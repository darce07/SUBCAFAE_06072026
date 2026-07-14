import { Palette, TableProperties, Type } from "lucide-react";
import { useAppStore } from "../store/use-app-store";
import { Card, PageHeader, Select } from "../components/ui";

export function SettingsPage() {
  const { theme, setTheme, fontSize, setFontSize, density, setDensity, accent, setAccent } = useAppStore();
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Preferencias" title="Configuración" description="Personaliza la apariencia, densidad y comportamiento visual de SIGDAF. Los cambios se aplican y guardan de inmediato." />
      <div className="grid gap-6 xl:grid-cols-2">
        <SettingCard icon={<Palette />} title="Apariencia" description="Tema y color principal del sistema">
          <SettingRow label="Modo de color">
            <Select value={theme} onChange={(event) => setTheme(event.target.value as "light" | "dark")}>
              <option value="light">Claro</option>
              <option value="dark">Oscuro</option>
            </Select>
          </SettingRow>
          <SettingRow label="Color principal">
            <div className="flex gap-2">
              {["#0f766e", "#1d4ed8", "#6d28d9", "#be123c", "#334155"].map((color) => (
                <button key={color} className={`size-8 rounded-full ring-offset-2 ${accent === color ? "ring-2 ring-slate-500" : ""}`} style={{ backgroundColor: color }} onClick={() => setAccent(color)} />
              ))}
            </div>
          </SettingRow>
        </SettingCard>
        <SettingCard icon={<Type />} title="Lectura" description="Escala tipográfica para mayor comodidad">
          <SettingRow label="Tamaño de letra">
            <Select value={fontSize} onChange={(event) => setFontSize(event.target.value as typeof fontSize)}>
              <option value="small">Pequeño</option>
              <option value="normal">Normal</option>
              <option value="large">Grande</option>
            </Select>
          </SettingRow>
        </SettingCard>
        <SettingCard icon={<TableProperties />} title="Tablas" description="Densidad de información en listados">
          <SettingRow label="Densidad">
            <Select value={density} onChange={(event) => setDensity(event.target.value as typeof density)}>
              <option value="compact">Compacta</option>
              <option value="normal">Normal</option>
              <option value="comfortable">Cómoda</option>
            </Select>
          </SettingRow>
        </SettingCard>
      </div>
    </div>
  );
}

function SettingCard({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return <Card className="p-5"><div className="mb-4 flex items-center gap-3"><div className="rounded-xl bg-teal-50 p-2.5 text-teal-700 dark:bg-teal-950">{icon}</div><div><h2 className="font-bold">{title}</h2><p className="text-xs text-slate-500">{description}</p></div></div><div className="divide-y divide-slate-100 dark:divide-slate-800">{children}</div></Card>;
}
function SettingRow({ label, children }: { label: string; children: React.ReactNode }) { return <div className="flex items-center justify-between gap-4 py-3"><span className="text-sm font-medium">{label}</span>{children}</div>; }
