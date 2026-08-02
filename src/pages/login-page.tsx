import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Archive, Eye, EyeOff, FileCheck2, Landmark, LockKeyhole, Mail, ShieldCheck, TriangleAlert } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "../features/auth/auth-context";
import { isSupabaseConfigured } from "../lib/supabase";
import { Alert, Button, Input } from "../components/ui";

const today = new Date().toLocaleDateString("es-PE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

const EMAIL_DOMAINS = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "icloud.com"];

function getEmailSuggestions(value: string): string[] {
  const atIndex = value.indexOf("@");
  if (atIndex === -1) {
    if (!value) return [];
    return EMAIL_DOMAINS.map((domain) => `${value}@${domain}`);
  }
  const user = value.slice(0, atIndex);
  if (!user) return [];
  const domainPart = value.slice(atIndex + 1);
  if (domainPart.includes(".")) return [];
  return EMAIL_DOMAINS.filter((domain) => domain.startsWith(domainPart)).map((domain) => `${user}@${domain}`);
}

const loginSchema = z.object({
  email: z.email("Ingresa un correo válido."),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [showEmailSuggestions, setShowEmailSuggestions] = useState(false);
  const { signIn, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: isSupabaseConfigured ? "" : "admin@sigdaf.pe", password: isSupabaseConfigured ? "" : "demo123" },
  });
  const emailValue = watch("email") ?? "";
  const emailSuggestions = getEmailSuggestions(emailValue);
  const { onChange: onEmailChangeRegister, ...emailRegister } = register("email");

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const onSubmit = async (values: LoginValues) => {
    try {
      await signIn(values.email, values.password);
      toast.success("Sesión iniciada correctamente");
      const destination = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/dashboard";
      navigate(destination, { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo iniciar sesión.");
    }
  };

  return (
    <div className="grid min-h-screen bg-slate-950 lg:grid-cols-[1.15fr_0.85fr]">
      <section
        className="relative hidden flex-col justify-between overflow-hidden bg-slate-950 p-12 lg:flex"
        style={{ backgroundImage: "radial-gradient(circle, rgba(148,163,184,0.14) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-500/60 to-transparent" />
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="mb-10 flex items-center gap-4">
            <div className="grid size-14 place-items-center rounded-xl border border-teal-500/30 bg-teal-600 text-2xl font-black text-white shadow-lg shadow-teal-950/40">S</div>
            <div>
              <p className="font-serif text-2xl font-black tracking-wide text-white">SIGDAF</p>
              <p className="text-xs uppercase tracking-[0.18em] text-teal-400">UGEL 06 · Plataforma institucional</p>
            </div>
          </div>
          <h1 className="max-w-2xl font-serif text-4xl font-black leading-tight tracking-tight text-white">
            Documentos, archivo y finanzas en una sola visión.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-400">
            Control integral, trazabilidad verificable y decisiones financieras respaldadas por información confiable.
          </p>
        </motion.div>
        <div>
          <div className="grid grid-cols-2 gap-3 border-t border-slate-800 pt-8">
            {[
              { icon: FileCheck2, label: "Gestión documental" },
              { icon: Archive, label: "Archivo físico" },
              { icon: Landmark, label: "Gestión financiera" },
              { icon: ShieldCheck, label: "Auditoría y permisos" },
            ].map(({ icon: Icon, label }, index) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.15 + index * 0.08 }}
                className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-4 backdrop-blur-sm transition hover:border-teal-800"
              >
                <Icon className="size-5 shrink-0 text-teal-400" />
                <p className="text-sm font-semibold text-slate-200">{label}</p>
              </motion.div>
            ))}
          </div>
          <p className="mt-6 text-xs capitalize tracking-wide text-slate-600">{today}</p>
        </div>
      </section>

      <section className="flex items-center justify-center bg-white px-5 py-10 dark:bg-slate-900 sm:px-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-teal-700 text-xl font-black text-white">S</div>
            <p className="text-2xl font-black">SIGDAF</p>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">Acceso seguro</p>
          <h2 className="mt-2 font-serif text-3xl font-black tracking-tight text-slate-950 dark:text-white">Bienvenido nuevamente</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Ingresa con las credenciales asignadas por el administrador del sistema.</p>

          {!isSupabaseConfigured && (
            <Alert variant="warning" className="mt-6 text-xs">
              Modo demostración activo. Configura la conexión institucional para habilitar el acceso de usuarios.
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Correo institucional</span>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="email"
                  autoComplete="email"
                  className="h-12 pl-10"
                  placeholder="nombre@institucion.pe"
                  {...emailRegister}
                  onChange={(event) => { void onEmailChangeRegister(event); setShowEmailSuggestions(true); }}
                  onFocus={() => setShowEmailSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowEmailSuggestions(false), 120)}
                />
                {showEmailSuggestions && emailSuggestions.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    {emailSuggestions.map((suggestion) => (
                      <li key={suggestion}>
                        <button
                          type="button"
                          className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-teal-50 dark:text-slate-200 dark:hover:bg-slate-800"
                          onMouseDown={(event) => { event.preventDefault(); setValue("email", suggestion, { shouldValidate: true }); setShowEmailSuggestions(false); }}
                        >
                          {suggestion}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {errors.email && <span className="mt-1 block text-xs text-rose-600">{errors.email.message}</span>}
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Contraseña</span>
              <div className="relative">
                <LockKeyhole className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="h-12 px-10"
                  placeholder="••••••••"
                  {...register("password")}
                  onKeyUp={(event) => setCapsLockOn(event.getModifierState("CapsLock"))}
                />
                <button type="button" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute right-3 top-1/2 -translate-y-1/2 overflow-hidden text-slate-400" onClick={() => setShowPassword((value) => !value)}>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={showPassword ? "hide" : "show"}
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7 }}
                      transition={{ duration: 0.15 }}
                      className="block"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </motion.span>
                  </AnimatePresence>
                </button>
              </div>
              {capsLockOn && (
                <span className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <TriangleAlert className="size-3.5" />Bloq Mayús está activado.
                </span>
              )}
              {errors.password && <span className="mt-1 block text-xs text-rose-600">{errors.password.message}</span>}
            </label>
            <Button type="submit" loading={isSubmitting} className="h-12 w-full">Ingresar al sistema</Button>
          </form>
          <p className="mt-8 text-center text-xs text-slate-400">Acceso exclusivo para usuarios autorizados · SIGDAF 2026</p>
        </motion.div>
      </section>
    </div>
  );
}
