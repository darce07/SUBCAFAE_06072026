# SIGDAF

Frontend del Sistema Integral de Gestión Documental, Archivo Físico y Finanzas.

## Requisitos

- Node.js 22 o superior.
- Proyecto Supabase para autenticación real.

## Inicio

```bash
npm install
copy .env.example .env
npm run dev
```

Configura en `.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Sin estas variables, el frontend habilita un modo demostración local usando las credenciales precargadas en el login.

## Integración Supabase

La migración completa está en:

```text
supabase/migrations/001_sigdaf_complete.sql
```

Ejecuta ese archivo completo en Supabase SQL Editor sobre un proyecto nuevo. No ejecutes antes los dos borradores SQL anteriores.

Orden recomendado:

1. Crea manualmente `pillaca98@gmail.com` en Supabase Authentication.
2. Ejecuta `supabase/migrations/001_sigdaf_complete.sql`.
3. Ejecuta `supabase/migrations/002_profiles_and_access_repair.sql`.
4. Ejecuta `supabase/migrations/003_document_management_and_permissions.sql`.
5. Ejecuta `supabase/migrations/004_entity_identity_and_quick_create.sql`.
6. Ejecuta `supabase/migrations/005_document_date_and_soft_delete.sql`.
7. Ejecuta `supabase/migrations/006_document_delete_permission_repair.sql`.
8. Ejecuta `supabase/migrations/007_document_soft_delete_trigger_repair.sql`.
9. Configura `.env` con URL y clave anon.
10. Cierra sesión, vuelve a ingresar y ejecuta `npm run build`.

La migración crea tablas, catálogos iniciales, roles, permisos, RLS, auditoría, índices, bucket privado, políticas Storage, RPC idempotente y resumen optimizado del dashboard.

La migración `003` agrega edición documental segura, historial visual, administración de permisos por rol e índices optimizados para búsqueda y filtros. No elimina ni reemplaza tablas existentes.

La migración `004` agrega identificación de entidades y la función segura `crear_o_obtener_entidad()`, usada por el formulario de documentos para buscar, reutilizar o registrar entidades sin duplicarlas.

La migración `005` agrega cambio de fecha controlado por permiso y eliminación lógica auditable. Ambos permisos se asignan únicamente al rol Administrador por defecto y pueden habilitarse para otros roles desde la matriz.

La migración `006` repara instalaciones que todavía tenían el permiso histórico `documentos:desactivar`, migrándolo al permiso vigente `documentos:eliminar`.

La migración `007` corrige la validación de la baja lógica para que solo la RPC autorizada pueda eliminar, sin rechazar cambios automáticos realizados por triggers.

### Usuario autenticado sin permisos

Si el login funciona pero aparece `No tienes permisos`, la cuenta existe en Auth pero no tiene un rol activo en `public.user_roles`. Ejecuta `002_profiles_and_access_repair.sql`; este parche:

- crea y sincroniza `public.profiles`;
- asigna el rol Administrador a `pillaca98@gmail.com`;
- expone el contexto real del usuario mediante `obtener_mi_contexto()`;
- conecta administración de usuarios, notificaciones y perfil;
- mantiene a los usuarios nuevos sin privilegios hasta que un administrador les asigne un rol.

Después verifica en SQL Editor:

```sql
select
  u.email,
  p.nombre_completo,
  r.nombre as rol,
  ur.activo
from auth.users u
left join public.profiles p on p.id = u.id
left join public.user_roles ur on ur.user_id = u.id
left join public.roles r on r.id = ur.role_id
where lower(u.email) = lower('pillaca98@gmail.com');
```

Servicios principales:

- `src/services/documentos.service.ts`: RPC idempotente, consultas paginadas, actualización y desactivación.
- `src/services/catalogos.service.ts`: consultas y actualización lógica de catálogos.
- `src/services/storage.service.ts`: carga privada idempotente, retiro controlado y URLs firmadas.
- `src/services/auth.service.ts`: sesión, login y cierre de sesión con Supabase Auth.

Los documentos se guardan en Storage con esta estructura:

```text
{usuario_id}/{categoria}/{anio}/{mes}/{dia}/{idempotency_key}-{nombre_archivo}
```

El bucket `documentos` es privado. El frontend guarda solamente `archivo_path`; las URLs se generan temporalmente con `createSignedUrl()`. Nunca uses una clave `service_role` en variables `VITE_*`.

## Validación

```bash
npm run typecheck
npm run build
```

## Alcance

- Autenticación de inicio de sesión con Supabase Auth.
- Rutas protegidas y layout institucional responsive.
- Gestión documental, explorador histórico y archivo físico.
- Verificación físico-digital.
- Ingresos, egresos, balance y libro contable.
- Auditoría, catálogos, usuarios y permisos.
- Centro de notificaciones y preferencias visuales.
- Datos mock centralizados mientras no exista backend funcional.
