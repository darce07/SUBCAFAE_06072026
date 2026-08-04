// El chat de soporte es temporal por diseno: si el admin no lo cierra
// explicitamente con "Cerrar chat y generar ticket", no debe sobrevivir a un
// logout - se descarta sin generar ticket la proxima vez que alguien inicia
// sesion (no vale la pena archivar una conversacion que nadie considero
// importante). Este flag distingue "sigo en la misma sesion logueada" (F5,
// remount) de "esto es un login nuevo" (recien logueado): sobrevive a un F5
// pero se borra explicitamente en cada signOut.
export const CHAT_SESSION_FLAG = "sigdaf:chat-browser-session";
