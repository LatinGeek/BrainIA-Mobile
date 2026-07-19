# Requirements

## Scope summary

La app movil sera una experiencia de consulta y captura para BrainIA, con enfasis en:

- dashboard de second-brain
- insights
- transacciones financieras y analitica
- busqueda y exploracion
- captura ligera
- herramientas de revision y mantenimiento de datos

## In scope

### Lectura y exploracion

- ver dashboard principal del second-brain
- ver insights destacados
- ver digests por ventana temporal
- ver entidades, relaciones y grafos profundos configurables
- buscar por texto con filtros y resultados canonicalizados
- ver detalle de una entidad, sus relaciones y sus eventos asociados

### Financias

- ver dashboard financiero
- ver resumen mensual
- ver resumen anual
- ver desglose por categoria
- ver desglose por cuenta
- ver lista y detalle de transacciones canonicamente agrupadas
- ver evidencia asociada a cada transaccion

### Captura

- crear notas
- capturar email-like payloads
- capturar notificaciones
- capturar gastos o wallet events
- enviar eventos genericos al backend

### Operacion

- resolver aliases
- ignorar aliases incorrectos
- hacer merges de entidades cuando sea necesario
- relanzar reprocess de eventos

### Plataforma

- iOS
- Android
- tabs inferiores como navegacion principal
- autenticacion tipo SSO o identidad empresarial

## Out of scope for v1

- web app como superficie principal
- chat conversacional como experiencia central
- offline-first completo
- vector search
- embeddings
- graph database en el cliente
- logica de negocio compleja en el movil

## Functional requirements

### FR-1

La app debe autenticar al usuario usando una capa compatible con SSO o identidad empresarial.

### FR-2

La app debe mostrar un dashboard principal del second-brain con insights relevantes.

### FR-3

La app debe mostrar un dashboard financiero con agregaciones por mes, anio, categoria y cuenta.

### FR-4

La app debe permitir busqueda textual con filtros sobre eventos, entidades y relaciones.

### FR-5

La app debe permitir explorar entidades con una profundidad de grafo configurable.

### FR-6

La app debe permitir capturar eventos genericos mediante formularios simples.

### FR-7

La app debe permitir revisar aliases pendientes y resolverlos o ignorarlos.

### FR-8

La app debe permitir merge de entidades y reprocess de eventos cuando el usuario lo solicite.

### FR-9

La app debe mostrar insights y digests como artefactos de lectura primaria.

### FR-10

La app debe mostrar evidencia y contexto en transacciones financieras canonicamente agrupadas.

## Non-functional requirements

### NFR-1

La app debe ser multiplataforma y mantener paridad funcional razonable entre iOS y Android.

### NFR-2

La app debe priorizar tiempos de carga rapidos para pantallas principales.

### NFR-3

La app debe tratar al backend como source of truth.

### NFR-4

La app debe usar cache de lectura y reintentos automaticos, pero no depender de un modo offline completo.

### NFR-5

La app debe minimizar la logica de dominio en el cliente.

### NFR-6

La app debe tener una arquitectura simple, mantenible y extensible.

### NFR-7

La app debe soportar telemetria basica de errores, tiempos de respuesta y estados de sincronizacion.

### NFR-8

Cada iteracion visual o funcional debe pasar por el sistema de iteracion UX antes de generar un APK nuevo.

Esto implica:

- probar la pantalla afectada en runtime
- validar loading, empty y error
- ejecutar `npm run lint`
- ejecutar `npx tsc --noEmit`
- revisar al menos dos tamanos de pantalla

## Product priorities

### P0

- dashboard second-brain
- dashboard financiero
- busqueda
- detalle de entidad
- captura de eventos

### P1

- digests
- aliases
- merges
- reprocess
- grafos profundos

### P2

- refinamientos visuales
- widgets o shortcuts
- notificaciones avanzadas
- mejoras de analitica financiera

## Acceptance criteria

La fase inicial se considera lista cuando:

- el usuario puede iniciar sesion
- el usuario ve un dashboard util sin navegar demasiado
- el usuario puede buscar y abrir una entidad
- el usuario puede capturar un evento
- el usuario puede ver transacciones y sus resumenes
- el usuario puede resolver o ignorar un alias
- el usuario puede disparar un reprocess

Ademas:

- la iteracion UX queda registrada y validada antes de cada APK nuevo
