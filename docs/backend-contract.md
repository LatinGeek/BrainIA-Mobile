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
- `GET /api/v1/events?limit=&order=&dateField=&from=&to=&source=&category=&status=&cursor=` (paginated summaries; the app uses `limit`, `order=desc` and `dateField=ingestedAt`; see the backend `docs/api.md`)
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

## Review session additions (additive, optional)

The glass review session works without these fields using the fallbacks shown.
Nothing here changes an existing endpoint or the product model.

| Field / endpoint | Purpose | Client fallback without it |
| --- | --- | --- |
| `ReviewItem.confidence: number` | Order the queue, show “93% sure”, gate auto-handle | `0.5`; the value pill is hidden |
| `ReviewItem.impact: { transactions: number; amount: number; currency: string }` | “Tidies 14 transactions”, ordering | Count matching transactions in the cached Money bundle |
| `ReviewItem.suggestions: { value: string; categoryPath?: string[]; score: number }[]` | One-tap answer and alternatives | Use `normalizedValue` and `categoryPath` |
| `ReviewItem.rationale: string` | “Why?” text | Use the existing `reason` |
| `ReviewItem.groupKey: string` | Batch variants | Group by `normalizedValue` |
| `GET /api/v1/review/auto?since=` | “Handled for you” list | Hide the card |
| `POST /api/v1/review/{id}/undo` (24h) | Undo from the summary and the auto list | Undo only inside the 5-second toast window |
| Server-side auto-resolve at confidence ≥ 0.95 for names and duplicate merchants | Remove obvious items from the queue | Off |

Mapping used by the client for answers (all existing endpoints):

- Name / batch accept → `resolveAlias(id, { alias, categoryPath })` per alias.
- Category / label accept → `resolveAlias(id, { alias, categoryPath: [choice] })`.
- Same company → `resolveAlias(..., targetEntityId)` then `mergeEntity(...)`.
- Connection yes/no → `resolveSemanticCandidate(id, { action, createRule })`.
- Different / not transport → `ignoreAlias(id)`.
- Skip → local only.

`settings.reviewSession` was removed in the cleanup phase. The session is the
only review surface and works with the fallbacks above; auto-handle stays off
until the backend fields exist.

