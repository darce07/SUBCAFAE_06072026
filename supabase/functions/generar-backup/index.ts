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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BackupRequest {
  anio: number;
  categoriaId?: string | null;
  archivadorId?: string | null;
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

  try {
    let query = adminClient
      .from("documentos")
      .select("id,codigo_documento,titulo,descripcion,categoria_id,archivador_id,entidad_id,estado_id,fecha_documento,monto,archivo_path,created_at")
      .eq("activo", true)
      .eq("anio", anio);
    if (categoriaId) query = query.eq("categoria_id", categoriaId);
    if (archivadorId) query = query.eq("archivador_id", archivadorId);

    const { data: documentos, error: documentosError } = await query;
    if (documentosError) throw new Error(documentosError.message);

    const zip = new JSZip();
    zip.file("datos/documentos.json", JSON.stringify(documentos ?? [], null, 2));

    const archivoPaths = Array.from(new Set((documentos ?? []).map((doc) => doc.archivo_path).filter((path): path is string => Boolean(path))));
    for (const path of archivoPaths) {
      const { data: fileBlob, error: downloadError } = await adminClient.storage.from("documentos").download(path);
      if (downloadError || !fileBlob) continue;
      zip.file(`archivos/${path}`, await fileBlob.arrayBuffer());
    }

    const zipBuffer = await zip.generateAsync({ type: "uint8array" });
    const zipPath = `${usuarioId}/${anio}/${backupId}.zip`;
    const { error: uploadError } = await adminClient.storage
      .from("backups")
      .upload(zipPath, zipBuffer, { contentType: "application/zip", upsert: false });
    if (uploadError) throw new Error(uploadError.message);

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

    return jsonResponse({ id: backupId, estado: "listo" });
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

    return jsonResponse({ error: "No se pudo generar el respaldo." }, 500);
  }
});
