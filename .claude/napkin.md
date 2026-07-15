# Napkin Runbook

## Curation Rules
- Re-prioritize on every read.
- Keep recurring, high-value notes only.
- Max 10 items per category.
- Each item includes date + "Do instead".

## Execution & Validation (Highest Priority)
1. **[2026-07-13] Validar con `npm run typecheck` y `npm run build` antes de dar cambios por terminados**
   Do instead: correr ambos comandos (README los define como validación oficial del repo) tras cualquier edición en `src/`.

## Shell & Command Reliability
1. **[2026-07-13] `git clone` falla si carpeta destino ya existe y no está vacía**
   Do instead: en PowerShell, `Rename-Item` la carpeta vieja (backup) antes de clonar, o clonar en ruta nueva y mover contenido después.

## Domain Behavior Guardrails
1. **[2026-07-13] Migraciones Supabase son secuenciales y acumulativas (001→014)**
   Do instead: nunca sugerir ejecutar una migración fuera de orden ni saltarse `002_profiles_and_access_repair.sql` si el login funciona pero falta rol activo.
2. **[2026-07-13] Bucket `documentos` en Storage es privado**
   Do instead: nunca usar `service_role` key en variables `VITE_*`; URLs de archivos siempre vía `createSignedUrl()`.

## Orquestación proactiva ("equipo DevOps")
1. **[2026-07-14] Tras cambios no triviales de backend/frontend, orquestar especialistas en paralelo sin que el usuario lo pida cada vez**
   Do instead: para cambios en supabase/migrations o src/services, lanzar en paralelo un agente con enfoque `enterprise-backend-quality-gate`; para cambios de UI en src/pages o src/components, lanzar un agente con enfoque `frontend-architect`/`ui-styling`; consolidar en un solo resumen para el usuario (no reportes sueltos). Aplicar directo los arreglos seguros/reversibles (validaciones faltantes, aria-labels, EmptyState, etc.); dejar anotado lo que requiere decisión del usuario (cambios de esquema, borrado de datos, nuevas dependencias).
2. **[2026-07-14] Auditoría nocturna automática configurada vía cron (ver `schedule` skill)**
   Do instead: no volver a preguntar frecuencia — ya quedó definida como diaria (cada noche) + orquestación reactiva en cada sesión de trabajo.

## User Directives
1. **[2026-07-13] Usuario pidió responder todo en español**
   Do instead: mantener español en todas las respuestas de esta sesión/repo salvo indicación contraria.
2. **[2026-07-13] Modo caveman activo por hook de sesión (nivel full)**
   Do instead: mantener estilo terse/caveman salvo advertencias de seguridad o confirmaciones irreversibles, donde se usa lenguaje claro normal.
