# Backend Contract

## Backend source

La app consume el backend BrainIA existente en `D:/Coding/BrainIA`.

## Base contract

- API versionada bajo `/api/v1`
- backend como source of truth
- el cliente preserva pero no interpreta la semantica de negocio

## Key endpoints for the app

### Core read flows

- `GET /api/v1/search`
- `GET /api/v1/entities`
- `GET /api/v1/entities/resolve`
- `GET /api/v1/entities/:id/graph`
- `GET /api/v1/relations`
- `GET /api/v1/insights`
- `GET /api/v1/insights/history`
- `GET /api/v1/digests`
- `GET /api/v1/digests/history`
- `GET /api/v1/financial/transactions`
- `GET /api/v1/financial/transactions/:id`

### Write flows

- `POST /api/v1/events`
- `POST /api/v1/capture/note`
- `POST /api/v1/capture/email`
- `POST /api/v1/capture/notification`
- `POST /api/v1/capture/wallet`
- `POST /api/v1/capture/batch`
- `POST /api/v1/entities/:id/merge`
- `POST /api/v1/review/aliases/:id/resolve`
- `POST /api/v1/review/aliases/:id/ignore`
- `POST /api/v1/events/:id/reprocess`

## Authentication expectation

La app debe enviar una capa de autenticacion compatible con el backend cuando este activa.

El backend ya contempla:

- `x-brainia-api-key`
- `x-brainia-client-id`

## Client responsibilities

- manejar sesiones
- persistir credenciales de forma segura
- reintentar requests fallidos cuando corresponda
- mostrar errores de red y autenticacion con claridad

## Data consumption rules

- preferir entidades canonicas
- usar digests para resumen temporal
- usar insights para explicaciones compactas
- usar graph para expansion de contexto
- usar transactions para el frente financiero

## UI assumptions

La app no debe depender de formas internas del backend como tablas o joins.

Solo debe depender de:

- contratos HTTP
- esquemas de respuesta
- semantica funcional de cada endpoint

## Implementation note

Si el producto termina requiriendo SSO real con un proveedor externo, esta capa de autenticacion deberia actuar como adaptador y no como una dependencia acoplada a una sola tecnologia.
