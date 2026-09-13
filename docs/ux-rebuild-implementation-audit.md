# UX Rebuild Implementation Audit

Current status: redesigned mobile implementation complete; native-device validation remains a release check.

## 2026 Trust-Ledger Redesign

The current implementation applies the two artifact specifications as a single dark-only system:

- flat ledger rows replace nested transaction and evidence cards;
- indigo is reserved for interaction, while cyan identifies generated interpretation;
- `ProvenanceMark`, `ConfidenceTier`, `GeneratedTextBlock`, and `EvidenceTrail` make machine output visibly different from captured facts and user decisions;
- unsupported citations, source spans, and conflict pairs are omitted instead of inferred;
- Insight evidence trails render only backend-returned supporting entities and relations;
- Money keeps original transaction currencies, prefixes mixed-currency aggregates with `≈`, and shows `40.0000 UYU/USD · fixed app reference` whenever conversion is present;
- review approval now distinguishes **Apply once** from **Create rule**;
- Settings no longer exposes appearance modes because the product now has one dark visual system.

This audit maps `docs/ux-rebuild-proposal.md` to current implementation evidence. It exists so completion is based on inspected state rather than intent.

## Evidence That Currently Passes

- Primary tabs match the proposed information architecture:
  - Today: `app/(tabs)/index.tsx`
  - Search: `app/(tabs)/search.tsx`
  - Capture: `app/(tabs)/capture.tsx`
  - Money: `app/(tabs)/financials.tsx`
  - Review: `app/(tabs)/review.tsx`
- Default primary screens avoid old policy/source/debug cards.
- Search supports top match plus grouped result sections for items, insights, transactions, activity, and connections.
- Capture defaults to a two-step path: enter text, submit.
- Money behaves as a finance sub-app with overview, trends, categories, accounts, transactions, insights, and month/year context.
- Transaction detail starts with merchant, amount, category, account, explanation, evidence timeline, and related actions.
- Entity detail starts with what the item is, connections, activity, and hidden technical detail.
- Insight and digest detail screens read like user-facing artifacts.
- Review exposes names, categories, merges, reprocess, and resolved lanes with action preview copy.
- Settings is non-technical by default and keeps connection/API/cache/diagnostics under Advanced.
- Component folders required by the proposal exist under `components/`.
- The component split is now physical, not just barrel files:
  - `components/primitives/index.tsx`
  - `components/layout/index.tsx`
  - `components/states/index.tsx`
  - `components/cards/index.tsx`
  - `components/charts/index.tsx`
  - `components/forms/index.tsx`
  - `components/finance/index.tsx`
  - `components/knowledge/index.tsx`
  - `components/review/index.tsx`
- The legacy `components/brainia.tsx` monolith has been removed.
- Automated evidence:
  - `npm run lint`
  - `npx tsc --noEmit`
  - `npm run smoke:web`
  - Playwright browser console check for key routes
- Local web preview states are available through `?ux=empty`, `?ux=error`, `?ux=edge`, and `?ux=loading`.
- Expanded smoke evidence covers empty Money, empty Review, edge Money, Today error recovery, Today loading, and Money loading.
- Visual screenshots exist under `output/playwright/` for compact empty/error/edge/loading states and a larger Money edge viewport.

## Remaining Gaps Before Marking Complete

- Native-device validation is not yet complete. Web Playwright checks cover layout and route behavior, but compact Android/iOS runtime behavior, keyboard behavior, and native safe-area behavior still need device/emulator evidence.
- Empty/error/edge/loading state coverage is now proven on web for key Money, Review, and Today flows.
- Accessibility evidence is partial. Shared controls now have stronger roles/labels/states, but a screen-reader order pass on native platforms is not yet proven.
- Chart readability is validated on web for current demo data plus an edge preview with long labels, zero value, negative value, and large values.
## Current Completion Judgment

The rebuild is substantially implemented for the main user-facing experience, the component-system split is physically represented in the codebase, and broad web data-state evidence now exists. Completion is not yet proven against the full proposal because native device/emulator validation and native screen-reader order remain unavailable in this shell.
