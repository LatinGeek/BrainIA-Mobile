# Detail-screen audit fixes

Implemented the remaining findings inside the five assigned screens, preserving their existing changes. No APK build, device/adb access, commit, stash, reset, clean, or shared-source edits were performed.

## Findings fixed

- **Audit A — E4, E6–E16:** evidence now distinguishes loading/error/empty states; timeline and relation lists use thin glass surfaces; empty relation headings are hidden; related search includes the entity title; merge requires two taps with a warning; matching is gated to an open sheet and two characters with loading/error/no-results feedback and no stale-query list; selected rows are explicit; alias/merge have separate pending indicators; success closes the sheet with a toast and errors use a danger live region; the hero shows the entity type and only nonempty summary; timeline kind fallbacks are localized; sheet tasks have a divider.
- **Audit A — M1–M9:** completed remaining Spanish copy and kind labels; source is correctly labeled “Recibido por”; date is a caption without an extra row divider; related search is a short secondary CTA with the subject query; unavailable mail offers activity/back actions; body is cleaned and selectable with body typography; spacing uses tokens; redundant section wrapper and temporary loading title are removed.
- **Audit A — V1, V3, V6, V7, V11, V12, V15:** completed remaining labels, kind/facet localization and model provenance; grouped metadata with consistent icon-free alignment and received date after source; missing interpretation uses review tone with a nearby retry; reprocessing reports via typed toast options rather than string-prefix tone detection; screen copy uses neutral tuteo; original body/facets are selectable; removed temporary loading title.
- **Audit B — D4–D10:** aligned labels with the requested copy; contextual loading title; reduced repeated title/window metadata; recommended action uses IconTile + full Text; metrics appear once with prominent tabular values; spacing uses tokens.
- **Audit B — I2, I3, I5–I10:** caught feedback failures with a toast; only the pending choice spins; completed translations and removed duplicate generated metadata; localized reference kinds; contextual loading title; token spacing; confirmation enters with a theme-duration FadeIn.
- **Local portions of A/X3, A/X5 and B/X3:** friendly Spanish load errors in all five screens; bare Row lists are grouped in thin GlassSurface padding="none" with no final divider, including sheet matches and technical details. Relation prose remains readable with unlimited lines.

## Already complete; preserved

- A/E1–E3, A/X4, B/D1–D3, B/I1 and B/I4 were already addressed in the starting files (some copy findings were only partially complete and their remaining strings were finished above).
- Row titleLines/descriptionLines, Screen back affordance, Chip maxWidth, BottomSheet improvements and other shared fixes were not redone.

## Partial findings, deviations and shared follow-ups

- **E5 skipped:** making Graph preview nodes tappable requires an onOpenNode prop and changes inside shared `components/data/Graph.tsx`, outside ownership.
- **V2 addressed locally with a limitation:** common taxonomy segments, including `food.groceries`, are translated with a local map; unknown/custom segments retain the audit's title-case fallback. The current `formatCategoryLabel` only cleans display text and returns an English uncategorized fallback; `listFinancialCategories` supplies strings rather than a taxonomy key-to-label map, so neither resolves taxonomy keys. A canonical server taxonomy-label source remains desirable.
- **V4 partial:** moved CorrectionPanel after interpretation metadata/context, with a token-duration FadeIn and Reduce Motion-aware LinearTransition wrapper. Its internal capabilities request can still return null before later mounting children; fading that late-mounted root requires editing shared `CorrectionPanel.tsx` and is left to its owner.
- **V5 local states fixed:** transaction lookup now distinguishes loading, error/retry, linked action and absent-link caption. `EventSummary` exposes no transactionId and the client has no getTransactionForEvent method, so lookup still scans the latest 100; older links need a shared API/domain change.
- **V8–V10, V13–V14 skipped:** owned by shared CorrectionPanel; no edits there. The audit's V11 voseo recommendation conflicts with the explicit task instruction, so neutral tuteo takes precedence.
- Shared-component portions of A/X1–X3, X5–X11 and B/X2, X4–X6 were outside ownership. D6's SignalCard meta truncation is shared; this screen removes its meta as requested.
- D8 uses the audit's option to remove hero metrics, retaining the full metrics list once. M2 uses “Recibido por” because EventSummary has no sender/from field. No new dependencies were introduced.

## Files changed

- `app/entity/[id].tsx`
- `app/email/[id].tsx`
- `app/event/[id].tsx`
- `app/digest/[id].tsx`
- `app/insight/[id].tsx`
- `docs/reports/fixes-detail-screens.md`

## Verification

- `npx tsc --noEmit`: passed, exit 0, no diagnostics on the final implementation.
- `npm run lint -- --no-cache 'app/entity/[id].tsx' 'app/email/[id].tsx' 'app/event/[id].tsx' 'app/digest/[id].tsx' 'app/insight/[id].tsx'`: passed, exit 0, no warnings/errors.
- `git diff --check` for the five screens: passed after normalizing UTF-8 source to LF.
- Reviewed hook order, pending-action guards, state gating, list boundaries, touch-target component reuse and token usage using the React best-practices checklist. No visual/device verification was performed under the task constraints.
