# Technical Backlog

Este backlog define la siguiente iteracion del producto y separa claramente:

- `P0`: lo que debe quedar estable y entendible para poder avanzar
- `P1`: lo que mejora mucho la experiencia pero no bloquea el uso base
- `P2`: lo que prepara la evolucion futura sin afectar el MVP inmediato

La regla operativa es:

1. cerrar `P0`
2. cerrar `P1`
3. cerrar `P2`
4. validar la iteracion UX antes de generar un nuevo APK

## P0. Bloqueadores de producto

### P0.1 Rendering de datos y texto

Problema:
- se estan mostrando claves tecnicas, texto crudo y contenido sin formato
- algunos insights y respuestas del backend llegan como contenido no listo para lectura

Objetivo:
- convertir todo el contenido tecnico en lenguaje humano
- garantizar que cada pantalla muestre una jerarquia visual clara

Tareas:
- mapear claves tecnicas a labels amables y estables
- renderizar Markdown o cualquier texto enriquecido en insights y digests
- normalizar moneda, fechas, porcentajes, cantidades y contadores
- reemplazar valores vacios con estados claros como `Sin datos` o `No disponible`
- evitar overflow, line breaks rotos y cards con texto apretado
- revisar que el dashboard no exponga nombres de campos internos

Hecho significa:
- no hay claves internas visibles al usuario
- no hay Markdown sin renderizar
- toda cifra importante tiene formato consistente
- las cards se leen sin esfuerzo en un telefono compacto

Pantallas afectadas:
- Dashboard
- Search
- Insight detail
- Digest detail
- Financials
- Entity detail
- Transaction detail

### P0.2 Estados de datos robustos

Problema:
- loading, empty, partial data y error no siempre estan bien separados
- algunos fallos terminan pareciendo contenido valido

Objetivo:
- que la app siempre explique con claridad que esta pasando

Tareas:
- unificar skeletons y loading states
- separar empty state de error state
- mostrar mensajes utiles cuando no existe una entidad o no hay coincidencia
- evitar mostrar `Not Found` como contenido principal
- degradar al modo demo cuando el backend falle o no haya datos suficientes
- mantener consistencia entre vistas de lista y detalle

Hecho significa:
- cada pantalla tiene loading, empty y error definidos
- el usuario entiende si falta data, falta red o falta coincidencia
- el fallback nunca parece un bug

Pantallas afectadas:
- todas las pantallas de lectura y detalle

### P0.3 Estabilidad del dashboard

Problema:
- la home es la primera impresion y hoy todavia se siente demasiado tecnica

Objetivo:
- convertir el dashboard en un resumen ejecutivo confiable y orientado a accion

Tareas:
- revisar la jerarquia visual del home
- reemplazar placeholders agresivos por componentes de resumen reales
- hacer que el bloque financiero explique contexto y no solo numeros
- ordenar la pantalla por prioridad de lectura
- mostrar primero lo relevante, despues lo exploratorio
- asegurar consistencia entre KPIs, insights, finanzas y actividad reciente

Hecho significa:
- el home se siente como producto terminado
- la pantalla responde a "que paso", "que importa" y "que hago ahora"

Pantalla afectada:
- Dashboard

### P0.4 Navegacion base sin friccion

Problema:
- navegar deberia ser obvio y hoy todavia puede generar dudas entre tabs y detalles

Objetivo:
- que el usuario siempre entienda donde esta y como volver

Tareas:
- validar nombre, orden e iconos de tabs
- asegurar back behavior consistente
- revisar safe areas, headers y scroll
- eliminar rutas que parezcan secundarias sin razon clara
- confirmar que los deep links funcionen bien entre home, search, detail y review

Hecho significa:
- la navegacion no rompe el contexto
- el usuario puede saltar entre secciones sin perderse

### P0.5 Pipeline minimo de calidad antes de generar APK

Problema:
- no se debe iterar a ciegas ni publicar builds sin chequeos minimos

Objetivo:
- introducir una puerta de calidad antes de cualquier APK nuevo

Tareas:
- correr `npm run lint`
- correr `npx tsc --noEmit`
- abrir la app localmente
- revisar consola y logs
- validar al menos una vez en dispositivo o emulador

Hecho significa:
- no se genera un APK nuevo sin haber pasado el smoke test minimo

## P1. Mejora fuerte de UX

### P1.1 Dashboard mas accionable

Objetivo:
- pasar de dashboard informativo a dashboard utilizable

Tareas:
- reforzar insights como elemento principal de lectura
- agregar una seccion de siguiente accion
- dar mas peso a `Search`, `Capture`, `Money` y `Review`
- mostrar actividad reciente con contexto
- reducir ruido de elementos puramente tecnicos

Hecho significa:
- el usuario sabe rapidamente donde mirar y que hacer

### P1.2 Financials mas claros

Objetivo:
- hacer que finanzas sea una vista de analitica real, no solo una lista

Tareas:
- separar vista mensual, anual, por categoria y por cuenta
- mejorar la narrativa visual del resumen financiero
- clarificar transacciones agrupadas y evidencia asociada
- hacer que el grafico se entienda sin explicacion externa
- revisar labels, jerarquia y estados vacios del modulo financiero

Hecho significa:
- el usuario puede responder rapidamente "donde se fue el dinero"

Pantallas afectadas:
- Financials
- Transaction detail

### P1.3 Search mas util

Objetivo:
- convertir search en una superficie de exploracion fuerte y clara

Tareas:
- mejorar filtros y chips
- ordenar resultados por relevancia y tipo
- explicar por que un resultado aparece
- reducir ruido visual en listas largas
- mejorar el acceso a entidades, eventos y relaciones

Hecho significa:
- buscar algo ya cargado en BrainIA es rapido y entendible

Pantalla afectada:
- Search

### P1.4 Entity detail y graph

Objetivo:
- explicar bien que es una entidad, como se resuelve y con que se relaciona

Tareas:
- mejorar header y summary de entidad
- mostrar mejor aliases, canonical root y relaciones
- controlar profundidad maxima del grafo
- evitar que el grafo se vuelva inmanejable visualmente
- reforzar la diferencia entre entidad canonica y nodo relacionado

Hecho significa:
- el detalle de entidad se puede entender sin salir de la app

Pantallas afectadas:
- Entity detail
- Graph views

### P1.5 Review y operaciones

Objetivo:
- hacer operaciones de mantenimiento mas seguras y comprensibles

Tareas:
- hacer explicito que acciones son destructivas
- reforzar confirmaciones
- separar mejor alias review, merge y reprocess
- mostrar el estado antes y despues de cada accion

Hecho significa:
- el usuario puede corregir datos sin miedo a romperlos

Pantalla afectada:
- Review

### P1.6 Estilo editorial minimal

Objetivo:
- refinar la experiencia visual sin cambiar la base del sistema de temas

Tareas:
- mejorar tipografia, espaciado y radios
- hacer mas consistente el contraste
- reducir densidad visual en cards pequenas
- pulir sombras y fondos
- revisar que el lenguaje editorial se vea intencional y no generico

Hecho significa:
- la UI se percibe mas madura, mas calmada y mas premium

### P1.7 Accesibilidad y responsive

Objetivo:
- asegurar que la app se lea y toque bien en distintos telefonos

Tareas:
- revisar tamanos tactiles
- mejorar contraste real
- evitar truncados criticos
- validar telefono compacto y telefono grande
- verificar que el contenido no dependa de pantallas anchas

Hecho significa:
- el layout funciona bien en dispositivos pequenos y grandes

## P2. Extensiones y refinamiento futuro

### P2.1 Tema intercambiable por tokens

Objetivo:
- mantener el sistema de temas preparado para evolucionar sin rehacer pantallas

Tareas:
- mantener `Intelligence Console` como default mientras la direccion Bibiz siga activa
- dejar listas `Intelligence Console` y `Warm Knowledge` como variantes completas
- asegurar consumo de tokens semanticos en lugar de colores hardcodeados
- verificar que la estructura de componentes no dependa del tema visual actual

Hecho significa:
- el tema se puede cambiar sin reescribir la app

### P2.2 Observabilidad y analitica de uso

Objetivo:
- entender mejor como se comporta la app en uso real

Tareas:
- agregar trazas de fetch y parseo
- registrar errores de red y autenticacion
- medir pantallas lentas
- registrar puntos de friccion del flujo principal

Hecho significa:
- se puede diagnosticar mejor que esta fallando y donde

### P2.3 Cache y experiencia offline parcial

Objetivo:
- mejorar continuidad de lectura sin prometer offline completo

Tareas:
- cachear ultimas respuestas utiles
- mostrar contenido stale con aviso
- revalidar en segundo plano

Hecho significa:
- la app se siente mas rapida y resiliente sin cambiar el contrato del backend

### P2.4 Notificaciones y digests

Objetivo:
- traer la informacion relevante al usuario en lugar de obligarlo a entrar siempre

Tareas:
- notificaciones de resumen
- notificaciones de captura
- notificaciones de review pendiente

Hecho significa:
- el usuario recibe informacion util sin ruido innecesario

### P2.5 Personalizacion avanzada

Objetivo:
- adaptar la app a distintos perfiles de uso

Tareas:
- atajos por tipo de usuario
- orden configurable de secciones
- presets de vista para finanzas o knowledge-first

Hecho significa:
- la app puede ajustarse a distintas formas de trabajar sin perder coherencia

## Milestones recomendados

### Milestone A

Entregar:
- `P0.1` rendering y texto
- `P0.2` estados de datos robustos
- `P0.3` dashboard estable
- `P0.4` navegacion base
- `P0.5` pipeline minimo de calidad

Resultado esperado:
- la app se ve y se entiende bien
- la app no se rompe por datos incompletos
- la iteracion ya es segura

### Milestone B

Entregar:
- `P1.1` dashboard mas accionable
- `P1.2` financials mas claros
- `P1.3` search mas util
- `P1.4` entity detail y graph

Resultado esperado:
- la app tiene mejor valor de producto y mejor lectura

### Milestone C

Entregar:
- `P1.5` review y operaciones
- `P1.6` estilo editorial minimal
- `P1.7` accesibilidad y responsive
- `P2.1` tema por tokens
- `P2.2` observabilidad
- `P2.3` cache
- `P2.4` notificaciones
- `P2.5` personalizacion

Resultado esperado:
- la app queda lista para evolucionar sin rehacer la base

## Dependencia obligatoria

El backlog no se considera listo para iterar si no se cumple el sistema de iteracion UX.

Ese sistema vive en:
- [UX Iteration System](docs/ux-iteration-system.md)
