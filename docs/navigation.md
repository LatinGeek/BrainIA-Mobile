# Navigation

## Main navigation

The app uses expo-router tabs with a custom glass `Dock` on phones. On widths
≥ 1024 the dock is replaced by a fixed `NavigationRail`.

## Tabs

| Route | Label | Notes |
| --- | --- | --- |
| `index` | Hoy | Ambient drift, review highlight |
| `search` | Explorar | Search + knowledge graph |
| `capture` | Capturar | Centre action in the dock; hidden from the tab list |
| `financials` | Dinero | Resumen / Cuentas / Movimientos |
| `review` | Revisar | Review home; badge shows pending count |

The dock is floating glass, keeps labels, glides a white selection pill, shows a
centre lime capture button, and scales to .86 while scrolling down. It never
covers content because every `Screen` reserves `dock height + inset` at the
bottom.

## Stack routes

- `settings` (modal)
- `transaction/[id]`
- `entity/[id]`
- `insight/[id]`
- `digest/[id]`
- `event/[id]`
- `email/[id]`
- `intelligence/index`, `intelligence/[id]`
- `learning`
- `review-session` (`presentation: 'fullScreenModal'`, hides the dock)

## Detail navigation

- Transaction → origin event, linked insight, portfolio.
- Entity → event evidence, entity graph, organize sheet.
- Insight → supporting references, search, Today.
- Event → email view, linked transaction, reprocess/correct.
- Digest → search, Money.

## Deep links and preview states

Local web previews accept `?ux=loading|empty|error|edge` on the dashboard,
search, Money, review and detail bundles. The review session reads the same
preview fixtures, so `?ux=edge` exercises a real two-card queue.
