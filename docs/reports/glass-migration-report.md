# Glass migration report

## Status

Phases 0–8 are implemented on branch `glass/full-migration`.

| Phase | Status | Evidence |
| --- | --- | --- |
| 0 Groundwork | Done | `expo-blur`, `react-native-gesture-handler`, `@expo-google-fonts/poppins`; Poppins 600 + Inter 500 + JetBrains Mono 500; gesture root; review route |
| 1 Tokens | Done | `lib/themes.ts` glass/motion/ambient, lime accent, radii 10–28, tabular numerals |
| 2 Material | Done | `GlassSurface`, `AmbientBackground`, `Pressable`, reduce-transparency/motion hooks |
| 3 Controls and data primitives | Done | Button, SegmentedControl, Chip, Tag, ConfidenceMeter, Field, Row, IconTile, StatTile, Amount |
| 4 Frame and navigation | Done | `Screen` collapsing header, `Section`, custom `Dock`, `Toast`, `BottomSheet` |
| 5 Data display | Done | SignalCard, Timeline, TrendChart, MixCard, Graph, StateView |
| 6 Screens | Done | Today, Money (3 views), Capture, Discover, Transaction, detail routes, Settings |
| 7 Review session | Done | Review home + full-screen session, undo, persistence, keyboard/gesture/a11y, smoke rewrite |
| 8 Cleanup | Done | 24-component barrel, old modules deleted, docs updated, review flag removed |

## Gates

Run on 2026-10-19:

```text
npm run lint                 green
npx tsc --noEmit             green
npm run agent:harness -- --full
  HOME_OK SEARCH_OK SETTINGS_OK FINANCIALS_OK ENTITY_OK INSIGHT_OK DIGEST_OK
  TRANSACTION_OK SEARCH_INPUT_OK FINANCE_PERIODS_OK REVIEW_LANES_OK
  TRUST_EVIDENCE_OK REVIEW_SESSION_OK EMPTY_MONEY_OK EMPTY_REVIEW_OK
  LOADING_REVIEW_OK EDGE_MONEY_OK ERROR_TODAY_OK LOADING_TODAY_OK
  LOADING_MONEY_OK UX_SMOKE_OK INTELLIGENCE_UI_OK AGENT_HARNESS_OK
```

Additional runtime checks: no console errors and no horizontal overflow at
320, 430 and 768pt on Today, Money, Capture, Review and Discover.

Screenshots: `output/audit/glass/` (data-less states) and
`output/audit/glass-edge/` (preview data, compact and standard widths).

## Component count

`components/index.ts` exports exactly 24 top-level components:

1 Screen, 2 Section, 3 GlassSurface, 4 Pressable, 5 Button, 6 SegmentedControl,
7 Chip, 8 Tag, 9 ConfidenceMeter, 10 Field, 11 Row, 12 IconTile, 13 StatTile,
14 Amount, 15 SignalCard, 16 Timeline, 17 TrendChart, 18 MixCard, 19 Graph,
20 DecisionCard, 21 CaptureForm, 22 StateView, 23 BottomSheet, 24 Dock.

Deprecated re-exports remaining: **0**.

## Backend fields still missing

`ReviewItem.confidence`, `ReviewItem.impact`, `ReviewItem.suggestions`,
`ReviewItem.rationale`, `ReviewItem.groupKey`, `GET /review/auto`,
`POST /review/{id}/undo`, and server-side auto-resolve at ≥ 0.95.

The review session uses the documented fallbacks. Auto-handle is **off**.
`settings.reviewSession` was removed during cleanup; the session is the only
review surface.

## Known limitations

- Native iOS/Android verification (real blur, Reduce Transparency, frame rate on
  a mid-range Android device) was not possible in this environment. Web
  Playwright gates and static checks are green.
- `GraphForceCanvas` keeps its own canvas palette (a visualization exception);
  its background now follows the ambient theme.
- Some migrated labels remain English where the glass prototype used English.
  The pre-existing Spanish copy is preserved in the flows covered by smoke tests.
- No PR was opened; the branch is local and unpushed.

## Native follow-up (device)

- expo-blur 55+ requires a `BlurTargetView` on Android; the earlier
  `experimentalBlurMethod` without `blurTarget` fell back to a plain translucent
  view. Screens now expose separate ambient (cards) and content (chrome) targets,
  so cards blur the backdrop without blurring themselves. Verified on the
  connected Android device: the compact header and settings card show real
  frosted blur.
- `formatCurrency` now rejects empty or malformed currency codes instead of
  letting Hermes throw `Malformed currency code` during render.
- Enabling blur on cards increases the number of live BlurViews on long lists.
  Nested surfaces are still skipped; watch performance on lower-end Android
  devices if lists grow.


