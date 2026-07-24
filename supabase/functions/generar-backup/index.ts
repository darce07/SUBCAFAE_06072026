// Genera un backup filtrado (datos + archivos del bucket `documentos`) y lo
// deja como .zip en el bucket privado `backups`. Corre con service role
// porque necesita leer bytes de Storage, algo que una función SQL no puede
// hacer; por eso la verificación de permiso del usuario se hace a mano aquí
// contra `public.has_permission`, usando el JWT que llega en Authorization.
//
// Ver supabase/migrations/021_backup_sistema.sql para el permiso
// `sistema:respaldar`, la tabla `backups_generados` y el bucket `backups`.

import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3";

// El JWT ya autentica cada request, pero "*" deja que cualquier sitio
// dispare la function desde el navegador de un usuario logueado (CSRF-like
// via fetch con credenciales). Restringir el origen es defensa en
// profundidad barata. SITE_URL se configura como secret de la función; si
// falta, cae al dominio de producción conocido en vez de abrir a todos.
const allowedOrigin = Deno.env.get("SITE_URL") ?? "https://subcafae-06072026.vercel.app";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BackupRequest {
  anio: number;
  categoriaId?: string | null;
  archivadorId?: string | null;
}

interface DocumentoConRuta {
  titulo: string;
  extension: string | null;
  ruta_historica: string | null;
  archivo_path: string | null;
}

// Replica src/pages/historical-page.tsx normalizeDocumentPath(): la ruta
// histórica separada por '/' o '\' define las carpetas, y si el último
// segmento no tiene extensión se agrega "titulo.extension" como archivo.
function rutaHistoricaAZip(documento: DocumentoConRuta) {
  const segments = (documento.ruta_historica ?? "").split(/[\\/]+/).map((part) => part.trim()).filter(Boolean);
  const extension = (documento.extension ?? "").replace(/^\./, "") || "archivo";
  const nombreArchivo = `${documento.titulo}.${extension}`;
  const last = segments.at(-1) ?? "";
  if (!last.includes(".")) segments.push(nombreArchivo);
  return segments.length > 0 ? segments.join("/") : nombreArchivo;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Método no permitido." }, 405);

  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "Falta autenticación." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Cliente "como el usuario": solo sirve para confirmar identidad y permiso
  // vía RLS/RPC, nunca para leer datos de otros usuarios.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return jsonResponse({ error: "Sesión inválida." }, 401);
  const usuarioId = userData.user.id;

  const { data: tienePermiso, error: permisoError } = await userClient.rpc("has_permission", {
    p_modulo: "sistema",
    p_accion: "respaldar",
  });
  if (permisoError || !tienePermiso) return jsonResponse({ error: "No tienes permiso para generar respaldos." }, 403);

  let body: BackupRequest;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Cuerpo de solicitud inválido." }, 400);
  }
  const anio = Number(body.anio);
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
    return jsonResponse({ error: "Año inválido." }, 400);
  }
  const categoriaId = body.categoriaId || null;
  const archivadorId = body.archivadorId || null;

  // Cliente con service role: única forma de leer bytes de Storage de todos
  // los usuarios y de escribir en `backups_generados` (RLS solo permite
  // lectura al cliente autenticado, ver migración 021).
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: backupRow, error: insertError } = await adminClient
    .from("backups_generados")
    .insert({ usuario_id: usuarioId, anio, categoria_id: categoriaId, archivador_id: archivadorId, estado: "procesando" })
    .select("id")
    .single();
  if (insertError || !backupRow) return jsonResponse({ error: "No se pudo registrar el respaldo." }, 500);

  const backupId = backupRow.id as string;

  // El armado del zip puede tardar más de lo que un navegador deja abierta
  // una conexión (se vio en producción: el cliente cortó a los ~75s y la
  // ejecución murió a medio camino con reason "EarlyDrop", dejando la fila
  // en 'procesando' para siempre). Por eso el trabajo pesado corre en
  // segundo plano con waitUntil: la respuesta HTTP sale de inmediato con la
  // fila ya creada, y el polling del frontend detecta el cambio a
  // 'listo'/'error' sin depender de que el cliente siga conectado.
  const construirBackup = async () => {
    console.log(`[backup ${backupId}] consultando documentos anio=${anio} categoria=${categoriaId} archivador=${archivadorId}`);
    let query = adminClient
      .from("documentos")
      .select("id,codigo_documento,titulo,descripcion,categoria_id,archivador_id,entidad_id,estado_id,fecha_documento,monto,archivo_path,extension,ruta_historica,created_at")
      .eq("activo", true)
      .eq("anio", anio);
    if (categoriaId) query = query.eq("categoria_id", categoriaId);
    if (archivadorId) query = query.eq("archivador_id", archivadorId);

    const { data: documentos, error: documentosError } = await query;
    if (documentosError) throw new Error(documentosError.message);
    console.log(`[backup ${backupId}] documentos encontrados: ${documentos?.length ?? 0}`);

    const zip = new JSZip();
    zip.file("datos/documentos.json", JSON.stringify(documentos ?? [], null, 2));

    // Un mismo archivo puede repetirse entre documentos; se descarga una
    // sola vez pero se coloca en el zip bajo la ruta histórica de cada
    // documento que lo referencia, igual que el explorador histórico del
    // frontend (src/pages/historical-page.tsx: ruta_historica separada por
    // '/' o '\', con el nombre de archivo como último segmento).
    const porArchivo = new Map<string, string[]>();
    for (const doc of documentos ?? []) {
      if (!doc.archivo_path) continue;
      const zipPath = rutaHistoricaAZip(doc);
      const existentes = porArchivo.get(doc.archivo_path) ?? [];
      existentes.push(zipPath);
      porArchivo.set(doc.archivo_path, existentes);
    }
    const archivoPaths = Array.from(porArchivo.keys());
    console.log(`[backup ${backupId}] archivos a descargar: ${archivoPaths.length}`);
    await adminClient.from("backups_generados").update({ total_archivos: archivoPaths.length }).eq("id", backupId);

    // Descargar de a uno tardaba minutos con cientos de archivos (cada
    // download es un round-trip HTTP a Storage). Con lotes de 10 en
    // paralelo se reduce el tiempo total sin saturar la instancia.
    const CONCURRENCIA = 10;
    let descargados = 0;
    for (let inicio = 0; inicio < archivoPaths.length; inicio += CONCURRENCIA) {
      const lote = archivoPaths.slice(inicio, inicio + CONCURRENCIA);
      const resultados = await Promise.all(lote.map(async (path) => {
        const { data: fileBlob, error: downloadError } = await adminClient.storage.from("documentos").download(path);
        if (downloadError || !fileBlob) {
          console.log(`[backup ${backupId}] archivo omitido (${path}): ${downloadError?.message ?? "sin datos"}`);
          return null;
        }
        return { path, buffer: await fileBlob.arrayBuffer() };
      }));
      for (const resultado of resultados) {
        if (!resultado) continue;
        for (const zipPath of porArchivo.get(resultado.path) ?? []) {
          zip.file(`archivos/${zipPath}`, resultado.buffer);
        }
      }
      descargados += lote.length;
      console.log(`[backup ${backupId}] descargados ${descargados}/${archivoPaths.length}`);
      await adminClient.from("backups_generados").update({ archivos_procesados: descargados }).eq("id", backupId);
    }

    console.log(`[backup ${backupId}] generando zip`);
    const zipBuffer = await zip.generateAsync({ type: "uint8array" });
    const zipPath = `${usuarioId}/${anio}/${backupId}.zip`;
    console.log(`[backup ${backupId}] subiendo zip (${zipBuffer.byteLength} bytes) a ${zipPath}`);
    const { error: uploadError } = await adminClient.storage
      .from("backups")
      .upload(zipPath, zipBuffer, { contentType: "application/zip", upsert: false });
    if (uploadError) throw new Error(uploadError.message);

    console.log(`[backup ${backupId}] actualizando fila a estado=listo`);
    await adminClient
      .from("backups_generados")
      .update({
        estado: "listo",
        archivo_path: zipPath,
        tamano_bytes: zipBuffer.byteLength,
        total_documentos: documentos?.length ?? 0,
        completado_at: new Date().toISOString(),
      })
      .eq("id", backupId);

    await adminClient.from("notificaciones").insert({
      user_id: usuarioId,
      titulo: "Respaldo generado",
      descripcion: `El respaldo del año ${anio} está listo para descargar (${documentos?.length ?? 0} documentos).`,
      tipo: "sistema",
      event_key: `backup_${backupId}`,
    });
    console.log(`[backup ${backupId}] terminado ok`);
  };

  // Timeout duro: si algo se cuelga (red, storage, lo que sea), esto
  // garantiza que la fila nunca quede en 'procesando' para siempre. Antes
  // de esto un cuelgue silencioso dejaba la fila huérfana sin forma de
  // reintentar (pasó en producción, ver commits previos).
  const conTimeout = <T,>(promise: Promise<T>, ms: number) =>
    Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Tiempo de espera agotado (${ms / 1000}s).`)), ms)),
    ]);

  const procesarEnSegundoPlano = async () => {
    try {
      await conTimeout(construirBackup(), 240_000);
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : "Error desconocido.";
      await adminClient
        .from("backups_generados")
        .update({ estado: "error", error_mensaje: mensaje, completado_at: new Date().toISOString() })
        .eq("id", backupId);

      await adminClient.from("notificaciones").insert({
        user_id: usuarioId,
        titulo: "Respaldo con error",
        descripcion: `El respaldo del año ${anio} no se pudo generar: ${mensaje}`,
        tipo: "sistema",
        event_key: `backup_${backupId}`,
      });
    }
  };

  // @ts-expect-error EdgeRuntime es un global inyectado por el runtime de Supabase, no por Deno estándar.
  EdgeRuntime.waitUntil(procesarEnSegundoPlano());

  return jsonResponse({ id: backupId, estado: "procesando" });
});
