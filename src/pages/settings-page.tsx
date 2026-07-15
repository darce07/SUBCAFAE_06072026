import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { BadgeCheck, KeyRound, Mail, Palette, ShieldCheck, TableProperties, Type, UserRound } from "lucide-react";
import { useAppStore } from "../store/use-app-store";
import { useAuth } from "../features/auth/auth-context";
import { updateMyPassword } from "../services/auth.service";
import { Badge, Button, Card, Input, PageHeader, Select } from "../components/ui";

const passwordSchema = z
  .object({
    password: z.string().min(6, "Mínimo 6 caracteres."),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

type PasswordValues = z.infer<typeof passwordSchema>;

export function SettingsPage() {
  const { theme, setTheme, fontSize, setFontSize, density, setDensity, accent, setAccent } = useAppStore();
  const { userContext } = useAuth();
  const displayName = userContext?.nombreCompleto || userContext?.email?.split("@")[0] || "Usuario";
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U";

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) });

  const onChangePassword = async (values: PasswordValues) => {
    try {
      await updateMyPassword(values.password);
      toast.success("Contraseña actualizada correctamente.");
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar la contraseña.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Preferencias" title="Configuración" description="Administra tu cuenta y personaliza la apariencia, densidad y comportamiento visual de SIGDAF." />
      <div className="grid gap-6 xl:grid-cols-2">
        <SettingCard icon={<UserRound />} title="Perfil" description="Información de tu cuenta institucional">
          <div className="flex items-center gap-4 py-3">
            <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-teal-100 text-lg font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-300">{initials}</div>
            <div className="min-w-0">
              <p className="truncate font-bold">{displayName}</p>
              <p className="flex items-center gap-1.5 truncate text-xs text-slate-500"><Mail className="size-3.5 shrink-0" />{userContext?.email ?? "Sin correo"}</p>
            </div>
          </div>
          <SettingRow label="Rol asignado">
            <div className="flex flex-wrap justify-end gap-1.5">
              {userContext && userContext.roles.length > 0
                ? userContext.roles.map((role) => <Badge key={role} tone="blue">{role}</Badge>)
                : <Badge tone="amber">Sin rol asignado</Badge>}
            </div>
          </SettingRow>
          <SettingRow label="Estado de la cuenta">
            <Badge tone={userContext?.activo ? "green" : "red"} className="gap-1">
              <BadgeCheck className="size-3.5" />{userContext?.activo ? "Activa" : "Inactiva"}
            </Badge>
          </SettingRow>
        </SettingCard>

        <SettingCard icon={<ShieldCheck />} title="Seguridad" description="Cambia tu contraseña de acceso">
          <form onSubmit={handleSubmit(onChangePassword)} className="space-y-3 py-3">
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><KeyRound className="size-3.5" />Nueva contraseña</span>
              <Input type="password" autoComplete="new-password" placeholder="••••••••" {...register("password")} />
              {errors.password && <span className="mt-1 block text-xs text-rose-600">{errors.password.message}</span>}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-500">Confirmar contraseña</span>
              <Input type="password" autoComplete="new-password" placeholder="••••••••" {...register("confirmPassword")} />
              {errors.confirmPassword && <span className="mt-1 block text-xs text-rose-600">{errors.confirmPassword.message}</span>}
            </label>
            <Button type="submit" loading={isSubmitting} className="w-full">Actualizar contraseña</Button>
          </form>
        </SettingCard>

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
                <button key={color} type="button" aria-label={`Color principal ${color}`} aria-pressed={accent === color} title={color} className={`size-8 rounded-full ring-offset-2 ${accent === color ? "ring-2 ring-slate-500" : ""}`} style={{ backgroundColor: color }} onClick={() => setAccent(color)} />
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

function SettingCard({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children: ReactNode }) {
  return <Card className="p-5"><div className="mb-4 flex items-center gap-3"><div className="rounded-xl bg-teal-50 p-2.5 text-teal-700 dark:bg-teal-950">{icon}</div><div><h2 className="font-bold">{title}</h2><p className="text-xs text-slate-500">{description}</p></div></div><div className="divide-y divide-slate-100 dark:divide-slate-800">{children}</div></Card>;
}
function SettingRow({ label, children }: { label: string; children: ReactNode }) { return <div className="flex items-center justify-between gap-4 py-3"><span className="text-sm font-medium">{label}</span>{children}</div>; }
