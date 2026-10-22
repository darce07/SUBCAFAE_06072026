# -*- coding: utf-8 -*-
"""Genera el manual de usuario de SIGDAF (public/manual-usuario-sigdaf.pdf).

Uso (desde la raíz del proyecto):
    python scripts/manual-usuario/generar_manual.py

Requiere: pip install reportlab
El contenido está en la lista CONTENIDO de abajo: para actualizar el manual se edita ese texto
(o se agrega una sección) y se vuelve a ejecutar el script. Cada vez que cambie algo que el
usuario final ve o usa, conviene revisar este archivo.
"""
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    BaseDocTemplate, Flowable, Frame, PageBreak, PageTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether,
)
from reportlab.platypus.tableofcontents import TableOfContents

VERSION = "Versión 2.1 · Octubre 2026"
SALIDA = Path(__file__).resolve().parents[2] / "public" / "manual-usuario-sigdaf.pdf"
TEAL = colors.HexColor("#0f766e")
TEAL_CLARO = colors.HexColor("#ccfbf1")
GRIS = colors.HexColor("#475569")
GRIS_CLARO = colors.HexColor("#f1f5f9")
NARANJA = colors.HexColor("#c2410c")

ESTILOS = {
    "titulo": ParagraphStyle("titulo", fontName="Helvetica-Bold", fontSize=34, leading=40, textColor=TEAL, alignment=TA_LEFT),
    "subtitulo": ParagraphStyle("subtitulo", fontName="Helvetica", fontSize=15, leading=20, textColor=GRIS),
    "h1": ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=16, leading=20, textColor=TEAL, spaceBefore=16, spaceAfter=7, keepWithNext=1),
    "h2": ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=11.5, leading=15, textColor=colors.HexColor("#0f172a"), spaceBefore=10, spaceAfter=4, keepWithNext=1),
    "p": ParagraphStyle("p", fontName="Helvetica", fontSize=10, leading=14.2, textColor=colors.HexColor("#1e293b"), spaceAfter=6),
    "item": ParagraphStyle("item", fontName="Helvetica", fontSize=10, leading=14, textColor=colors.HexColor("#1e293b")),
    "nota": ParagraphStyle("nota", fontName="Helvetica", fontSize=9.6, leading=13.5, textColor=colors.HexColor("#134e4a")),
    "alerta": ParagraphStyle("alerta", fontName="Helvetica", fontSize=9.6, leading=13.5, textColor=colors.HexColor("#7c2d12")),
    "toc1": ParagraphStyle("toc1", fontName="Helvetica", fontSize=10.5, leading=17, textColor=colors.HexColor("#0f172a")),
    "contenido": ParagraphStyle("contenido", fontName="Helvetica-Bold", fontSize=20, leading=26, textColor=TEAL, spaceAfter=10),
    "pie": ParagraphStyle("pie", fontName="Helvetica-Oblique", fontSize=9, leading=12, textColor=GRIS),
}


class Encabezado(Paragraph):
    """Título de sección (nivel 1): avisa al índice para registrar su página."""


def bullets(items):
    filas = [[Paragraph("•", ESTILOS["item"]), Paragraph(texto, ESTILOS["item"])] for texto in items]
    tabla = Table(filas, colWidths=[0.55 * cm, None])
    tabla.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 2), ("TOPPADDING", (0, 0), (-1, -1), 1.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5)]))
    return [tabla, Spacer(1, 6)]


def pasos(items):
    filas = []
    for numero, texto in enumerate(items, start=1):
        circulo = Table([[Paragraph(f"<font color='white'><b>{numero}</b></font>", ParagraphStyle("n", alignment=1, fontName="Helvetica-Bold", fontSize=9, leading=11))]], colWidths=[0.55 * cm], rowHeights=[0.55 * cm])
        circulo.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), TEAL), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
        filas.append([circulo, Paragraph(texto, ESTILOS["item"])])
    tabla = Table(filas, colWidths=[0.9 * cm, None])
    tabla.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 2.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5), ("LEFTPADDING", (0, 0), (-1, -1), 2)]))
    return [tabla, Spacer(1, 6)]


def recuadro(texto, tipo="nota"):
    fondo, borde = (TEAL_CLARO, TEAL) if tipo == "nota" else (colors.HexColor("#ffedd5"), NARANJA)
    tabla = Table([[Paragraph(texto, ESTILOS[tipo])]], colWidths=[None])
    tabla.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), fondo), ("LINEBEFORE", (0, 0), (0, -1), 3, borde), ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    return [tabla, Spacer(1, 8)]


def tabla_simple(cabecera, filas, anchos):
    datos = [[Paragraph(f"<b>{c}</b>", ParagraphStyle("th", fontName="Helvetica-Bold", fontSize=9, leading=11, textColor=colors.white)) for c in cabecera]]
    for fila in filas:
        datos.append([Paragraph(c, ParagraphStyle("td", fontName="Helvetica", fontSize=9, leading=12)) for c in fila])
    tabla = Table(datos, colWidths=anchos, repeatRows=1)
    tabla.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), TEAL), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GRIS_CLARO]), ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
    return [tabla, Spacer(1, 8)]


# ---------------------------------------------------------------------------------------------
# CONTENIDO. Tipos: h1 (sección), h2 (subtítulo), p (párrafo), b (viñetas), s (pasos),
# nota, alerta, tabla (cabecera, filas, anchos).
# ---------------------------------------------------------------------------------------------
CONTENIDO = [
    ("h1", "1. Introducción"),
    ("p", "SIGDAF es la plataforma institucional para gestionar documentos, archivo físico y finanzas de la UGEL 06 desde un solo lugar. Este manual explica, en lenguaje simple, cómo usar cada módulo del sistema — no requiere conocimientos técnicos."),
    ("p", "Está organizado por módulo (tal como aparecen en el menú lateral de la aplicación), así que puede leerse completo o consultarse por secciones según lo que necesite hacer."),
    ("nota", "<b>Novedades de esta versión (octubre 2026):</b> módulo Sindicatos con su gráfico mensual; ventana de vista previa de documentos; filtro por Entidad; tipo de registro Documentario o Financiero al crear un documento; campo &laquo;Escaneado por&raquo; en documentos y anexos; selección múltiple y eliminación definitiva en la Papelera; columna Páginas en Archivo físico; Reporte diario en Control interno con horas de actividad, conexión y descargas en PDF e imagen."),

    ("h1", "2. Acceso al sistema"),
    ("h2", "Iniciar sesión"),
    ("p", "Para entrar al sistema, ingrese su correo institucional y su contraseña en la pantalla de acceso."),
    ("s", ["Abra SIGDAF en su navegador.", "Escriba su correo institucional en el campo <b>Correo institucional</b>.", "Escriba su contraseña en el campo <b>Contraseña</b>. Puede pulsar el ícono del ojo para mostrarla y confirmar que la escribió bien.", "Pulse <b>Ingresar al sistema</b>."]),
    ("p", "Si escribe su contraseña con la tecla Bloq Mayús activada, el sistema se lo advierte antes de que intente ingresar, para evitar errores de mayúsculas/minúsculas."),
    ("p", "Las cuentas de usuario no se crean desde esta pantalla: las habilita el área encargada de identidad institucional. Si no tiene cuenta o su contraseña no funciona, contacte al administrador del sistema."),
    ("h2", "Cierre de sesión por inactividad"),
    ("p", "Por seguridad, si no usa el sistema durante 30 minutos seguidos, la sesión se cierra automáticamente. Un minuto antes, el sistema le avisa con un mensaje para que pueda seguir trabajando sin perder la sesión."),

    ("h1", "3. Roles y permisos"),
    ("p", "Cada usuario tiene asignado un rol (por ejemplo, Administrador u otros roles definidos por la institución), y cada rol tiene permisos específicos sobre cada módulo: ver, crear, editar, eliminar o exportar información."),
    ("p", "Si un botón o una sección no aparece para usted, generalmente es porque su rol no tiene el permiso correspondiente — no es un error del sistema. El rol Administrador tiene acceso completo a todos los módulos, incluyendo los de uso exclusivo administrativo (Control interno, Usuarios, Roles y permisos, Respaldos)."),

    ("h1", "4. Panel de control (Dashboard)"),
    ("p", "Es la primera pantalla al ingresar. Muestra un resumen general: total de documentos, ingresos, egresos, balance general, y alertas de documentos sin archivo digital, sin archivador asignado o sin ruta histórica registrada."),
    ("p", "Incluye gráficos de balance mensual, documentos por estado y documentos por categoría. Puede filtrar todo el panel por mes y/o año usando los selectores de la parte superior, y volver a la vista general con el botón <b>Restablecer</b>."),

    ("h1", "5. Documentos"),
    ("p", "Es el listado principal de toda la documentación institucional. Desde aquí se busca, filtra, crea, edita y elimina documentos."),
    ("h2", "Buscar y filtrar"),
    ("b", ["El buscador encuentra documentos por código, título o descripción.", "Los filtros permiten acotar por <b>categoría</b>, <b>estado</b>, <b>usuario que lo subió</b>, <b>entidad</b> (por ejemplo, un banco o un sindicato) y <b>año</b>. Se pueden combinar entre sí y la lista vuelve a la página 1 al cambiar uno.", "El selector de orden muestra primero los registrados más recientemente o los más antiguos.", "Puede elegir cuántas filas ver por página (5, 10, 20 o 50)."]),
    ("h2", "Elegir qué columnas ver"),
    ("p", "El botón <b>Columnas</b> abre una lista de casillas para mostrar u ocultar columnas de la tabla (categoría, fecha, estado, monto, entidad, etc.). Por defecto se muestran las columnas más usadas: Registrado, Subido por, Título y Archivo, además de Código y Acciones, que siempre están visibles."),
    ("p", "Esta preferencia se guarda automáticamente en el equipo/navegador que está usando. Si usa otro equipo, verá las columnas por defecto hasta que las personalice ahí también."),
    ("h2", "Acciones sobre cada documento"),
    ("b", [
        "<b>Ver (ícono del ojo):</b> abre una <b>ventana de vista previa</b> sobre la misma lista, sin cambiar de página. A un lado se lee el archivo (PDF, imagen, Word o texto) y al otro están sus datos: estado, monto, fecha, categoría, entidad, archivador, quién lo subió y descripción. Al cerrarla con la X, la tecla Esc o haciendo clic fuera, vuelve exactamente a donde estaba, con sus filtros.",
        "Desde la vista previa también puede <b>Abrir archivo</b>, <b>Descargar</b>, ver en <b>Pantalla completa</b> (en una pestaña nueva, útil para comparar el archivo con los datos), ir al <b>Detalle completo</b> o <b>Editar datos</b> (si tiene permiso).",
        "<b>Código del documento</b> (en azul): lleva a la página de detalle completo, con anexos e historial.",
        "<b>Editar:</b> modifica los datos del documento (requiere permiso).",
        "<b>Copiar ruta histórica:</b> copia al portapapeles la ubicación de referencia del documento.",
        "<b>Ver archivo y Descargar:</b> abren o descargan el archivo digital adjunto.",
        "<b>Marcar observado:</b> cambia el estado del documento a &laquo;Observado&raquo; cuando algo requiere revisión.",
        "<b>Eliminar:</b> quita el documento del listado principal (no se borra para siempre, puede recuperarse desde la Papelera, sección 6).",
    ]),
    ("p", "Al descargar un archivo, el sistema agrega automáticamente una marca de agua con su nombre y la fecha/hora de descarga (en documentos PDF e imágenes). Esto permite rastrear quién descargó cada copia; el archivo original en el sistema no se modifica."),
    ("h2", "Subir un documento nuevo"),
    ("p", "Con el botón <b>Nuevo documento</b> (visible solo si tiene permiso de creación) se abre el formulario. Lo primero es elegir el <b>tipo de registro</b>:"),
    ("tabla", ["Tipo", "Qué se registra", "Ejemplos"], [
        ["<b>Documentario</b>", "Solo la clasificación del documento y su archivo.", "Oficios, actas, cartas, resoluciones, certificados."],
        ["<b>Financiero</b>", "Además: emisor y receptor, naturaleza (Ingreso o Egreso), monto, tipo de operación y periodo opcional.", "Facturas, boletas, vouchers, recibos, pagos."],
    ], [3.2 * cm, 7.6 * cm, 5.6 * cm]),
    ("p", "Luego se completan los datos (categoría, fecha, entidad, estado, título, descripción, archivador) y se adjunta el archivo digital."),
    ("b", [
        "<b>Escaneado por (opcional):</b> si otra persona escaneó el documento físico y usted lo está digitando, indíquelo. Así el Reporte diario de Control interno le da crédito a esa persona por su trabajo de escaneo.",
        "Formatos permitidos: PDF, Word, Excel, imágenes (JPG, PNG, WEBP) y texto plano.",
        "Tamaño máximo por archivo: 20 MB.",
        "El sistema verifica que el archivo sea realmente del tipo que dice ser (por ejemplo, rechaza un archivo peligroso disfrazado con extensión de imagen), como medida de seguridad.",
        "Si el archivo ya existe en el sistema (mismo contenido), el sistema puede advertir sobre una posible duplicación antes de guardar.",
    ]),
    ("h2", "Editar un documento"),
    ("p", "El botón <b>Editar</b> abre el mismo formulario con los datos ya cargados, organizado en las mismas secciones que Nuevo documento. Cada cambio queda registrado en Auditoría. Puede reemplazar el archivo digital (el anterior conserva su trazabilidad) y corregir el campo <b>Escaneado por</b>. Desde la vista previa, <b>Editar datos</b> abre esta pantalla en una pestaña nueva."),
    ("h2", "Anexos y documentos complementarios"),
    ("p", "Además del archivo principal, un documento puede tener varios anexos (archivos de respaldo adicionales). Cada anexo tiene su propio título, <b>categoría</b>, descripción y, opcionalmente, <b>Escaneado por</b>. Las categorías disponibles para un anexo son las mismas del catálogo Categorías, de modo que no hay que mantener dos listas."),
    ("p", "Los anexos se agregan al crear el documento o después, desde Editar. En la lista de anexos se pueden ver, descargar, editar (incluido quién lo escaneó) o eliminar, según los permisos del usuario; bajo el nombre del archivo aparece &laquo;Escaneado por &hellip;&raquo; cuando se indicó."),

    ("h1", "6. Papelera"),
    ("p", "Muestra los documentos que fueron eliminados. Cada fila indica quién lo eliminó y hace cuánto tiempo."),
    ("h2", "Restaurar"),
    ("p", "Si tiene permiso de eliminación, puede pulsar <b>Restaurar</b> (con confirmación) para que el documento vuelva al listado principal. Para varios a la vez, marque las casillas de las filas (o pulse <b>Seleccionar los N</b> para elegir todos los resultados) y pulse <b>Restaurar seleccionados</b>. Eliminar un documento no lo borra en forma definitiva."),
    ("h2", "Eliminar definitivamente (solo Administradores)"),
    ("p", "El Administrador puede borrar para siempre los documentos seleccionados con <b>Eliminar definitivamente</b>. Por ser irreversible, el sistema pide escribir la palabra <b>ELIMINAR</b> para confirmar."),
    ("alerta", "<b>Atención:</b> la eliminación definitiva borra el registro y sus archivos (también anexos y versiones) y libera ese espacio. No se puede deshacer: los documentos ya no aparecerán en la Papelera ni podrán restaurarse."),

    ("h1", "7. Verificación físico-digital"),
    ("p", "Permite hacer seguimiento de qué documentos tienen su copia digital y su ubicación física correctamente registradas."),
    ("p", "Muestra una barra de progreso con el porcentaje verificado y tarjetas de conteo: Verificados, Pendientes, Observados y No encontrados. El botón <b>Revisar</b> en cada fila abre el detalle del documento para corregir lo que falte."),

    ("h1", "8. Archivo físico"),
    ("p", "Organiza la ubicación física real de los documentos (&laquo;archivadores&raquo;). Muestra tarjetas resumen (archivadores activos, documentos asignados, pendientes de ubicación) y una cuadrícula con cada archivador y cuántos documentos tiene."),
    ("p", "Al hacer clic en un archivador se listan sus documentos, con búsqueda y selector de columnas, y se pueden ordenar por fecha. Este módulo es de consulta de ubicación: no sirve para subir archivos digitales (eso se hace desde Documentos)."),
    ("b", [
        "<b>Columna Páginas:</b> muestra cuántas páginas tiene el archivo principal de cada documento (útil para saber el volumen de cada archivador). Se calcula para PDF y algunas imágenes; en Word o Excel queda sin dato.",
        "<b>Calcular páginas (Administradores):</b> calcula las páginas de los documentos antiguos que aún no la tienen. Al terminar, el sistema indica cuántos se calcularon, cuántos no aplican por su formato y cuántos fallaron.",
        "<b>Enviar a Papelera:</b> con permiso, puede marcar varios documentos del archivador y enviarlos juntos a la Papelera.",
    ]),

    ("h1", "9. Libro contable"),
    ("p", "Muestra automáticamente, en formato contable (Debe / Haber / Saldo), todos los documentos que tienen un movimiento económico registrado (Ingreso o Egreso), ordenados cronológicamente con el saldo acumulado."),
    ("p", "Incluye búsqueda, filtro por categoría y año, selector de columnas visibles, y botones para exportar la vista actual a Excel o PDF."),

    ("h1", "10. Ingresos, Egresos y Balance"),
    ("p", "El módulo de Finanzas separa los documentos según su tipo de movimiento: Ingresos y Egresos, cada uno en su propia pantalla con el mismo tipo de herramientas (búsqueda, filtros, columnas, paginación) y el total general del monto correspondiente."),
    ("p", "La pantalla de Balance muestra la comparación entre ingresos y egresos del periodo consultado."),
    ("h2", "Ver qué documentos componen el total"),
    ("p", "En el Panel de control, las tarjetas <b>Total ingresos</b> y <b>Total egresos</b> se pueden pulsar: llevan a la lista de Ingresos o Egresos con el mismo mes y año del panel. La lista abre con los documentos de <b>mayor a menor monto</b> (también puede ordenarse de menor a mayor o por los más recientes) y muestra el título, cuándo se subió, la fecha del documento, el monto, la categoría y el archivador. El filtro de Mes se suma a los de categoría, estado y año."),
    ("p", "Al hacer clic en el <b>título</b> de un documento se abre, a la derecha, un <b>panel</b> con el monto registrado en grande y el archivo, para comprobar si el monto es correcto. El panel no bloquea la lista: se puede hacer clic en otro título y el panel cambia, así se revisan varios documentos seguidos. Los botones del panel son:"),
    ("b", [
        "<b>Abrir, Descargar, Pantalla completa y Detalle:</b> como en Documentos.",
        "<b>Pasar a documentario (ícono del billete tachado):</b> para un registro que no debería contar como dinero. El monto pasa a S/ 0.00 y el documento deja de sumar como ingreso o egreso (desaparece de la lista y de los totales). Pide confirmación y el monto anterior queda en Auditoría. Volver a financiero se hace desde Editar documento, indicando de nuevo naturaleza, monto y operación.",
        "<b>Eliminar (tacho de basura):</b> envía el documento a la Papelera, de donde se puede restaurar; mientras esté allí su monto no suma. Pide confirmación.",
        "<b>Editar el monto (lápiz junto al monto):</b> permite corregir el monto en el mismo panel. Se escribe el monto nuevo y se pulsa Guardar (o Enter; Esc cancela). La lista y el total de arriba se actualizan, y el monto anterior queda en Auditoría. El monto debe ser mayor que cero: si el registro no es dinero, se pasa a documentario.",
        "<b>Editar todos los datos:</b> abre la edición completa del documento en una pestaña nueva, sin perder el lugar en la lista.",
    ]),

    ("h1", "11. Sindicatos"),
    ("p", "Este módulo (dentro de Finanzas) muestra lo que SUBCAFAE entrega a cada sindicato (gasto) y lo que recibe de él, calculado a partir de los documentos registrados. No hay nada que crear aquí: un sindicato aparece solo cuando se registra como <b>entidad de tipo Sindicato</b>, y su gasto es la suma de los documentos con esa entidad y naturaleza <b>Egreso</b>."),
    ("h2", "Pantalla principal"),
    ("b", [
        "Cuatro tarjetas con el total: número de sindicatos, ingresos, gastado (egresos) y saldo. Se pueden filtrar por <b>mes</b> y <b>año</b>; <b>Limpiar</b> quita el filtro.",
        "<b>Gráfico mensual:</b> en cada mes del año hay una pila naranja con lo dado a cada sindicato (cada sindicato es un tramo de un tono de naranja) y, al lado, una barra azul con el ingreso del mes. Al pasar el mouse sobre un mes aparece el detalle: lo dado a cada sindicato, el total, los ingresos y egresos del mes y el <b>saldo del mes</b> (ingresos menos todos los egresos, igual que el Balance general). El selector <b>Año del gráfico</b> cambia el año; si el año elegido no tiene gasto en sindicatos, el gráfico lo avisa.",
        "<b>Gráfico por sindicato:</b> compara ingresos y gastos de cada sindicato en el periodo seleccionado.",
        "Una tarjeta por sindicato con su número de documentos, ingresos, gastado, saldo y fecha del último documento. Al hacer clic se abre su detalle.",
    ]),
    ("h2", "Detalle de un sindicato"),
    ("p", "Muestra sus tarjetas de balance, un gráfico por mes y la tabla de <b>documentos del sindicato</b>, con filtro por año. Al hacer clic en un documento se abre la ventana de vista previa (sección 5) para leerlo sin salir del sindicato."),
    ("nota", "<b>Importante:</b> el balance de un sindicato solo suma documentos con naturaleza <b>Ingreso</b> o <b>Egreso</b> y un monto mayor a cero. Si un documento aparece con monto S/ 0.00 o con naturaleza &laquo;No aplica&raquo;, no suma al balance: revise esos datos desde Editar documento. El mes que se usa es el de la fecha del documento."),

    ("h1", "12. Auditoría"),
    ("p", "Es la bitácora de cambios del sistema: quién creó, actualizó o eliminó cada registro y cuándo. Útil para rastrear el historial de cualquier documento o dato."),
    ("p", "Se puede buscar, filtrar por tipo de acción (Creación, Actualización, Eliminación) y por rango de fechas. Cada fila resume qué campos cambiaron y quién hizo el cambio."),

    ("h1", "13. Control interno (solo Administradores)"),
    ("p", "Este módulo es de uso exclusivo para el rol Administrador. Si su usuario no tiene ese rol, el sistema mostrará &laquo;Acceso restringido&raquo; al intentar entrar. Tiene dos pestañas."),
    ("h2", "Resumen por periodo"),
    ("p", "Muestra la actividad de cada usuario del sistema (documentos subidos, editados y eliminados) en un mes y año, con un ranking de quiénes más subieron documentos y un gráfico comparativo. Sirve para supervisar el uso general del sistema."),
    ("h2", "Reporte diario"),
    ("p", "Muestra cuánto trabajó cada persona, día por día, y a qué hora. Se elige el rango con los atajos <b>Hoy</b>, <b>Ayer</b>, <b>Últimos 7 días</b> o <b>Este mes</b> (o con las fechas Desde y Hasta) y, si se quiere, una <b>persona</b>. Todas las horas son de Lima."),
    ("b", [
        "<b>Tarjetas:</b> personas activas, documentos subidos, editados y eliminados en el rango.",
        "<b>Actividad por persona y día:</b> una fila por persona y día con <b>Entró</b>, <b>Última conexión</b>, <b>Tiempo conectado</b>, <b>Subidos</b>, <b>Editados</b>, <b>Eliminados</b>, <b>Anexos</b>, <b>Escaneados</b> y <b>Total</b>. El Total suma lo que la persona produjo: subidos, anexos y escaneados. Editar y eliminar no suman, porque son acciones sobre algo que ya se contó (subir y luego corregir sería contar dos veces).",
        "<b>Escaneados:</b> documentos y anexos que la persona escaneó mientras otra los digitaba (campo &laquo;Escaneado por&raquo;). Suman a quien escaneó aunque no haya entrado al sistema.",
        "Las columnas <b>Entró</b>, <b>Última conexión</b> y <b>Tiempo conectado</b> salen del registro de conexión: el sistema anota cada pocos minutos que la persona lo tiene abierto y activo (pestaña visible y con uso en los últimos minutos), aunque solo consulte. Solo existe desde que se activó este registro; los días anteriores muestran &laquo;&mdash;&raquo;. Se guarda únicamente fecha y hora, nunca el contenido.",
        "<b>Quien colabora escaneando</b> toma las mismas horas de quien digitó esos documentos (se marca con un asterisco <b>*</b>): su hora de entrada es la del primer documento en que colaboró y su fin es la última conexión de quien digitó. Así se reconoce su trabajo aunque no haya ingresado al sistema.",
    ]),
    ("h2", "¿A qué hora subieron documentos?"),
    ("p", "Debajo del reporte hay un bloque que ayuda a ver si el trabajo se hace dentro del horario laboral (8:00 am a 5:00 pm). <b>Solo cuenta lo que se subió</b>: documentos subidos que siguen activos, anexos agregados y documentos escaneados. Editar, eliminar o guardar sin cambios no cuenta, porque no demuestra trabajo nuevo."),
    ("b", [
        "<b>Tarjetas del equipo:</b> la hora en que más se subió, y cuántas subidas fueron dentro y fuera del horario.",
        "<b>Gráfico de barras por hora</b> (en formato 8 am, 12 pm, 5 pm): verde dentro del horario y naranja fuera, con el número de subidas sobre cada barra.",
        "<b>Tabla por persona:</b> subidas (dentro y fuera de horario), primera y última subida, hora en que más subió, tiempo conectado, hora de entrada y última conexión. Aparece también quien se conectó pero no subió nada.",
        "<b>Lista de subidas fuera de horario:</b> fecha, hora exacta, persona, tipo (Documento, Anexo o Escaneo) y documento.",
    ]),
    ("alerta", "<b>Cómo interpretarlo:</b> una subida fuera de horario es un dato para revisar, no una prueba por sí sola. Puede haber trabajo autorizado fuera de hora, trabajo remoto o tareas pendientes. El reporte tampoco distingue fines de semana ni feriados: solo mira la hora del día."),
    ("h2", "Descargar el reporte"),
    ("b", [
        "<b>Descargar PDF</b> (botón de la parte superior, estando en Reporte diario): un PDF completo con la página de resumen (gráfico por hora y tabla por persona), la lista de subidas fuera de horario y el detalle diario.",
        "<b>Descargar imagen (WhatsApp):</b> en el bloque de horas, genera una imagen con el gráfico y la tabla por persona, lista para enviar por WhatsApp.",
        "<b>Excel (CSV)</b> y <b>PDF</b> de la tabla &laquo;Actividad por persona y día&raquo;.",
    ]),

    ("h1", "14. Inventariado interno"),
    ("p", "Registra mesas, sillas, equipos y otros bienes internos, cada uno con su código de barras y su código QR para consultarlo físicamente. Desde la lista se puede crear un bien nuevo, ver su detalle y editarlo; escanear el QR de un bien lleva a su ficha de consulta."),

    ("h1", "15. Catálogos"),
    ("p", "Administra los datos base que usan los demás módulos: categorías, tipos de entidad, entidades, tipos de categoría, estados, archivadores, tipos de movimiento, tipos de operación y tipos de anexo."),
    ("p", "Se elige el catálogo a administrar desde una lista, y desde ahí se puede buscar, filtrar por estado (activo/inactivo) y, con el permiso adecuado, crear o editar cada elemento. Los tipos de anexo se mantienen solos: reflejan las categorías, así que al crear o renombrar una categoría también cambia en los anexos."),

    ("h1", "16. Usuarios y Roles y permisos (Administración)"),
    ("p", "Ambas pantallas son de uso exclusivo para Administradores o usuarios con permiso de edición de usuarios."),
    ("h2", "Usuarios"),
    ("p", "Lista las cuentas institucionales y permite asignar o cambiar el rol de cada persona. No crea cuentas nuevas ni administra contraseñas — eso lo gestiona el servicio de identidad institucional por fuera de SIGDAF."),
    ("h2", "Roles y permisos"),
    ("p", "Permite elegir un rol y activar o desactivar, módulo por módulo, cada permiso (ver, crear, editar, eliminar, exportar). El rol Administrador aparece protegido: siempre tiene todos los permisos activos y no puede modificarse desde aquí."),

    ("h1", "17. Respaldos y Tickets de soporte"),
    ("b", [
        "<b>Respaldos:</b> genera y descarga respaldos de documentos y archivos por periodo. Solo es visible para usuarios con permiso de respaldo.",
        "<b>Tickets de soporte:</b> guarda la transcripción de cada chat de soporte cerrado, con el usuario y el administrador involucrados.",
    ]),

    ("h1", "18. Notificaciones"),
    ("p", "La campana de la parte superior y el Centro de alertas muestran avisos reales asociados a su usuario. Con el botón <b>Marcar todo como leído</b> se limpian de una vez."),

    ("h1", "19. Configuración personal"),
    ("p", "Es la pantalla de preferencias propias de cada usuario (no administrativa). Muestra su perfil (nombre, correo, rol, estado de la cuenta) y permite:"),
    ("b", ["Cambiar su propia contraseña.", "Elegir modo claro u oscuro.", "Elegir un color principal para la interfaz (5 opciones).", "Ajustar el tamaño de letra (pequeño, normal o grande).", "Ajustar qué tan compactas se ven las tablas (compacta, normal o cómoda).", "Descargar este manual de usuario, desde la tarjeta <b>Ayuda</b>."]),
    ("p", "Las preferencias visuales se guardan en el equipo/navegador que está usando, igual que la selección de columnas — no viajan con su cuenta a otro equipo."),

    ("h1", "20. Seguridad de la información"),
    ("p", "Algunos puntos de seguridad que conviene conocer al usar el sistema:"),
    ("b", [
        "Los enlaces para ver o descargar un archivo son temporales (expiran en minutos): el sistema nunca deja un archivo accesible públicamente de forma permanente.",
        "Toda descarga de un documento queda marcada con el nombre de quien la hizo y la fecha/hora.",
        "El sistema valida el contenido real de cada archivo subido, no solo su nombre o extensión.",
        "Eliminar un documento no lo destruye: queda recuperable en la Papelera. Solo un Administrador puede eliminarlo definitivamente, y debe confirmarlo escribiendo una palabra.",
        "La sesión se cierra sola tras 30 minutos de inactividad, protegiendo el acceso si se olvida cerrar sesión en un equipo compartido.",
        "Por control interno, el sistema registra la hora en que cada persona está conectada y su tiempo activo. No guarda lo que ve ni lo que escribe, y cada persona recibe un aviso la primera vez que entra desde un equipo.",
    ]),

    ("h1", "21. Preguntas frecuentes y soporte"),
    ("h2", "No veo un módulo o un botón que otro compañero sí ve"),
    ("p", "Revise con el administrador si su rol tiene el permiso correspondiente (sección 3)."),
    ("h2", "Eliminé un documento por error"),
    ("p", "Vaya a Papelera y use Restaurar sobre ese documento (sección 6)."),
    ("h2", "El sistema me cerró la sesión solo"),
    ("p", "Es el cierre automático por inactividad (30 minutos). Vuelva a iniciar sesión con normalidad."),
    ("h2", "No puedo subir un archivo"),
    ("p", "Verifique que el archivo sea de un tipo permitido (PDF, Word, Excel, imagen o texto) y que pese menos de 20 MB (sección 5)."),
    ("h2", "Escaneé documentos pero no aparezco en el Reporte diario"),
    ("p", "La persona que digita el documento debe indicar su nombre en el campo <b>Escaneado por</b> (al crear o al editar el documento o el anexo). Mientras no se indique, el trabajo de escaneo no se puede atribuir."),
    ("h2", "Un sindicato no muestra el gasto que esperaba"),
    ("p", "Revise que los documentos tengan como entidad ese sindicato, naturaleza Egreso y un monto mayor a cero, y que su fecha esté en el año que está mirando (sección 11)."),
    ("h2", "Contacto"),
    ("p", "Ante cualquier duda no cubierta en este manual, o problemas de acceso/cuenta, contacte al administrador del sistema o al área de soporte técnico institucional de la UGEL 06."),
]


class Documento(BaseDocTemplate):
    def __init__(self, ruta):
        super().__init__(str(ruta), pagesize=A4, leftMargin=2.2 * cm, rightMargin=2.2 * cm, topMargin=2.6 * cm, bottomMargin=2.0 * cm,
                         title="SIGDAF — Manual de usuario", author="UGEL 06", subject="Manual de usuario de SIGDAF")
        marco = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id="marco")
        self.addPageTemplates([PageTemplate(id="portada", frames=[marco], onPage=self._portada, autoNextPageTemplate="cuerpo"),
                               PageTemplate(id="cuerpo", frames=[marco], onPage=self._cuerpo)])

    def afterFlowable(self, flowable):
        if isinstance(flowable, Encabezado):
            texto = flowable.getPlainText()
            self.notify("TOCEntry", (0, texto, self.page - 1))

    @staticmethod
    def _portada(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(TEAL)
        canvas.rect(0, A4[1] - 1.4 * cm, A4[0], 1.4 * cm, stroke=0, fill=1)
        canvas.setFillColor(TEAL_CLARO)
        canvas.rect(0, 0, A4[0], 2.2 * cm, stroke=0, fill=1)
        canvas.restoreState()

    @staticmethod
    def _cuerpo(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica-Bold", 8.5)
        canvas.setFillColor(TEAL)
        canvas.drawString(2.2 * cm, A4[1] - 1.3 * cm, "SIGDAF · Manual de Usuario")
        canvas.setFont("Helvetica", 8.5)
        canvas.setFillColor(GRIS)
        canvas.drawRightString(A4[0] - 2.2 * cm, A4[1] - 1.3 * cm, "UGEL 06")
        canvas.setStrokeColor(colors.HexColor("#cbd5e1"))
        canvas.line(2.2 * cm, A4[1] - 1.5 * cm, A4[0] - 2.2 * cm, A4[1] - 1.5 * cm)
        canvas.drawString(2.2 * cm, 1.2 * cm, "Documento interno de uso institucional")
        canvas.drawRightString(A4[0] - 2.2 * cm, 1.2 * cm, f"Página {doc.page - 1}")
        canvas.restoreState()


def construir():
    historia = [
        Spacer(1, 5.5 * cm),
        Paragraph("MANUAL DE USUARIO", ParagraphStyle("pre", fontName="Helvetica-Bold", fontSize=12, leading=16, textColor=GRIS, spaceAfter=6)),
        Paragraph("SIGDAF", ESTILOS["titulo"]),
        Spacer(1, 8),
        Paragraph("Sistema Integral de Gestión Documental, Archivo y Finanzas", ESTILOS["subtitulo"]),
        Spacer(1, 4),
        Paragraph("UGEL 06 — Unidad de Gestión Educativa Local", ESTILOS["subtitulo"]),
        Spacer(1, 1.2 * cm),
        Paragraph(VERSION, ParagraphStyle("ver", fontName="Helvetica-Bold", fontSize=11, leading=15, textColor=TEAL)),
        Spacer(1, 4),
        Paragraph("Documento de uso interno — dirigido al personal responsable del sistema", ESTILOS["pie"]),
        PageBreak(),
        Paragraph("Contenido", ESTILOS["contenido"]),
    ]
    indice = TableOfContents()
    indice.levelStyles = [ESTILOS["toc1"]]
    indice.dotsMinLevel = 0
    historia += [indice, PageBreak()]

    for tipo, valor, *resto in CONTENIDO:
        if tipo == "h1":
            historia.append(Encabezado(valor, ESTILOS["h1"]))
        elif tipo == "h2":
            historia.append(Paragraph(valor, ESTILOS["h2"]))
        elif tipo == "p":
            historia.append(Paragraph(valor, ESTILOS["p"]))
        elif tipo == "b":
            historia += bullets(valor)
        elif tipo == "s":
            historia += pasos(valor)
        elif tipo in ("nota", "alerta"):
            historia += recuadro(valor, tipo)
        elif tipo == "tabla":
            historia += tabla_simple(valor, resto[0], resto[1])
    return historia


if __name__ == "__main__":
    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    doc = Documento(SALIDA)
    doc.multiBuild(construir())
    print(f"Manual generado: {SALIDA}")
