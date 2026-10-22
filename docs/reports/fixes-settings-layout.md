# Ajustes, Aprendizaje y layout — correcciones

Task `task_df07cdb10361`, dispatch `ctx_bdd1e714c61e`. Trabajo limitado a los ocho archivos asignados y este informe; se preservaron los cambios previos. No se compiló APK, no se usó teléfono/adb y no se creó ningún commit.

## Hallazgos corregidos

- **S-M1–S-M4:** grupos de General, Dinero, Notificaciones y Avanzado sobre GlassSurface; controles alineados con el inset de las filas; radios con nombre accesible; expansión con entrada, salida y layout animados; cuatro bloques avanzados con encabezados accesibles. Las filas de Ajustes anulan localmente el radio para mantener rectos sus divisores, sin editar Row.
- **S-M5:** selección de aplicaciones optimista con rollback y switches desactivados durante el guardado. Se usa el soporte `disabled` que agregó el coordinador a Row.
- **S-M6:** avisos de resultado y errores en mantenimiento, comprobación de notificaciones y envío de diagnóstico; spinners por operación. La actualización manual de diagnóstico y salud usa `reload`, que sí permite esperar el resultado, en lugar de esperar el callback síncrono `refresh`.
- **S-M7–S-M9:** acciones de ciclo y credenciales en el footer fijo; foco del token al vencimiento y envío desde el teclado mediante `Field.inputRef`, agregado por el coordinador; cierre bloqueado al guardar; limpieza del borrador al cerrar; validación de día que permite vaciar el campo sin error prematuro y desactiva Guardar si es inválido.
- **S-L1–S-L5:** regreso visible en Ajustes; scrim Pressable sin escala ni nodos de texto; títulos de hojas como encabezados; cierre animado manteniendo el Modal hasta terminar; errores de conexión/notificaciones en español sin mensajes técnicos crudos. Se conservaron el grabber y el gesto de cierre existentes.
- **L-H1, L-H2:** scrim seguro y traducción de Correcciones; fallos de la API traducidos a mensajes locales.
- **L-M2–L-M5:** skeleton inicial, refresco visible solo cuando está habilitado, error con reintento, sin encabezados huérfanos, selección accesible con check y ancho limitado, spinners por acción y transiciones de vista previa/deshacer.
- **L-L1–L-L3:** singular/plural correcto; vista previa vacía sustituida por mensaje; toast de historial con Deshacer durante ocho segundos, más acción secundaria persistente en la pantalla.
- **R-M1, R-M2, R-M4:** host de toast dentro de cada BottomSheet y supresión del host raíz mientras una hoja está montada; IDs secuenciales para animar/reanunciar cada aviso; cierre accesible; duración según longitud y temporizador suspendido mientras hay lector de pantalla.
- **R-M3 (parcial):** gutter de 20dp compuesto con tokens; posición basada en dock y ruta, sin levantar innecesariamente los avisos de pantallas de stack. Se expone `useToastInset(offset)` para sumar una barra fija medida.
- **R-L1–R-L3:** opciones de duración/gesto restringidas a iOS, con comentario sobre Android; arranque en español con fondo ambiental y fuentes del sistema; rutas learning/modal explícitas y Ajustes como push con regreso visible.
- **N-M1, N-M2, N-L1:** pantalla no encontrada con Screen, StateView, acción de tamaño adecuado y metadatos en español.
- **M-M1:** `/modal` redirige a `/settings`, conservando enlaces anteriores sin duplicar la pantalla.
- **H-L1–H-L3:** idioma web español, fondo/color de tema `#091315` y marca Brain IA.
- **Audit A, X7 y X9:** altura limitada al espacio real que deja el teclado, wrappers con maxHeight y flexShrink, y cierre animado antes de desmontar el Modal.

## Pendientes y desviaciones

- **R-M3, barra fija:** falta que Screen publique dock + altura medida de su barra mediante `useToastInset`. Screen está fuera del alcance asignado y el coordinador confirmó que no lo modificaría para este punto; el posible solapamiento de avisos con esa barra sigue pendiente.
- **L-M1:** ya estaba resuelto en Screen antes de este despacho; no se reimplementó. También se conservaron el ErrorBoundary español independiente de proveedores, los drafts, confirmaciones, tag de conexión, props de Row, footer y gestos existentes indicados en el contrato.
- **L-M4:** se usan opciones locales GlassPressable con rol checkbox y check en lugar de ampliar la API compartida de Chip, que no acepta ese rol. Evita la X ambigua y mantiene objetivos de 44dp sin editar controles compartidos.
- **S-L4 / X9:** se usa progreso con `withTiming` y callback de finalización para controlar scrim y placa y desmontar el Modal, en lugar de depender de `exiting` dentro del Modal nativo. Conserva el ciclo de salida completo y usa solo opacidad con reducción de movimiento.
- **R-M4:** cierre explícito de 44dp en lugar de envolver la placa entera en un botón; mantiene separadas la acción del aviso y su cierre accesible.
- **Audit A, E13/V7:** llamadas de feedback en entity/event pertenecen a otros trabajadores; aquí se arregló la infraestructura compartida de toast, sin editar esas pantallas.

## Archivos cambiados

`app/settings.tsx`, `app/learning.tsx`, `app/_layout.tsx`, `app/+not-found.tsx`, `app/modal.tsx`, `app/+html.tsx`, `components/layout/Toast.tsx`, `components/layout/BottomSheet.tsx`; este informe. UTF-8 sin BOM, finales de línea LF.

## Verificación

- `npx tsc --noEmit`: **PASS**, ejecución final sin errores.
- `npm run lint -- app/settings.tsx app/learning.tsx app/_layout.tsx app/+not-found.tsx app/modal.tsx app/+html.tsx components/layout/Toast.tsx components/layout/BottomSheet.tsx`: **PASS**, sin errores ni advertencias en la ejecución final.
- `git diff --check` en los ocho archivos: **PASS**.
- Revisión de código de hooks, accesibilidad, objetivos táctiles y reducción de movimiento. No hay validación visual en dispositivo: quedan por confirmar físicamente la altura con teclado, las transiciones de Modal y TalkBack.
