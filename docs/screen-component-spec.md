# Screen Component Spec

## Purpose

Each screen is a composition of the 24 glass components. Screens own data
loading and navigation; components own material, motion and accessibility.

## Shared frame

Every route uses `Screen`:

- `title`, `overline`, `subtitle` are the large header.
- A compact glass bar fades in after 64pt of scroll.
- `actions` sits in the header; `back` adds the back control.
- `bar` is the thumb-zone action slot (Capture's Save).
- Bottom padding always equals dock height + safe-area inset.
- `Section` groups content and supports `collapsible`.

## Today — `app/(tabs)/index.tsx`

- Net hero (`GlassSurface strong` + `Amount hero`), income/expense line.
- Four quick actions: expense, income, note, search.
- `SignalCarousel`; the first card starts the review session.
- Finance stat grid, recent activity (`Row` presets), context card.
- No duplicate “Needs review” panel: the carousel and dock badge carry review.
- Ambient drift is enabled only here.

## Money — `app/(tabs)/financials.tsx`

Three views:

1. **Resumen**: expense `MixCard` first (category/merchant toggle), net hero
   with cycle/year switch, accounts strip, `TrendChart`, signals, recent
   activity, pending.
2. **Cuentas**: portfolio `MixCard` first (account colours, net centre), then
   expandable account rows and create-account.
3. **Movimientos**: cycle navigator, sort/filter sheet, selectable rows for
   consolidation, manual entry, pending list.

One currency switch sits beside the FX stamp. Sheets keep the existing
account, adjustment, entry, execution, consolidation and filter flows.

## Capture — `app/(tabs)/capture.tsx`

- `SegmentedControl` replaces the two large mode tiles.
- Note mode: `Field multiline`, voice hold-to-record, Save in `Screen.bar`.
- Money mode: expense/income/transfer switch, large `Field amount`, account
  rows, optional context section, Save in `Screen.bar`.
- All logic lives in `CaptureForm`; the screen supplies the pinned bar through
  an imperative handle.

## Discover — `app/(tabs)/search.tsx`

Frosted `Field search`, prompt chips, `Graph` focus in place with breadcrumbs,
grouped results. Selecting a node opens its entity/event route.

## Review home — `app/(tabs)/review.tsx`

Progress ring, effort copy (“2 quick decisions · about 20 seconds”), impact,
topic tiles, this-week stats, queue preview, and the “Handled for you” card
(hidden until the backend exposes the auto-review list).

## Review session — `app/review-session.tsx`

Full-screen modal, no dock. `DecisionCard` for name, batch, category, same,
relation and label. Pan to accept/skip, buttons for every gesture, keyboard
shortcuts, 5-second undo toast, resumable state under `review.session.v1`.

## Detail routes

- Transaction: 2×2 facts grid in the hero, origin card, context editor,
  explanation, evidence `Timeline`.
- Entity: identity card, aliases, preview `Graph`, evidence `Timeline`,
  relation rows, organize sheet.
- Insight: `SignalCard block`, why it matters, takeaways, evidence `Timeline`,
  feedback, optional technical details.
- Digest: `SignalCard block` with metrics, highlights, next step.
- Event / Email: interpretation card, correction panel, original content.

## Settings — `app/settings.tsx`

Grouped `Row`s with `IconTile`: General, Money, Notifications, Android capture,
Advanced (collapsed). Connection, v2 credential, diagnostics and reset stay
available but folded away.
