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

## User Directives
1. **[2026-07-13] Usuario pidió responder todo en español**
   Do instead: mantener español en todas las respuestas de esta sesión/repo salvo indicación contraria.
2. **[2026-07-13] Modo caveman activo por hook de sesión (nivel full)**
   Do instead: mantener estilo terse/caveman salvo advertencias de seguridad o confirmaciones irreversibles, donde se usa lenguaje claro normal.
