# Glass Frontend Integration Plan

## Purpose

This plan turns the glass UI prototype into the production BrainIA-Mobile frontend.

- **Design source of truth:** [`docs/prototypes/glass-ui-prototype.html`](prototypes/glass-ui-prototype.html). Open it in a browser; every screen, component and the review session are interactive.
- **What the prototype defines:** the glass material and tokens, a motion system, a 24-component system that replaces 81 exports, nine layout adjustments, and the new review session.
- **What this plan defines:** the order of work, the file-level changes, new dependencies, the backend contract additions the review session needs, the test changes, and how to land it without breaking the app at any point.

## Scope

In scope:

- Theme tokens, glass material, ambient background and motion system.
- Consolidating `components/` into the 24 components in prototype section 05.
- All five tabs and the detail routes, with the layout changes from prototype section 03.
- The review session from prototype section 04, including undo, batching and resumable progress.
- Tests, harness and documentation updates.

Out of scope:

- Changes to the product model, routes' data loading, or existing API endpoints (new review fields are additive).
- Spanish/English copy unification. Copy stays as it is today, except in the review flow.
- Light theme. BrainIA stays dark-only.

## Current state (verified in the repo)

| Area | Today | Source |
| --- | --- | --- |
| Stack | Expo 57, React Native 0.86, React 19.2, expo-router 57, Reanimated 4.5 + worklets 0.10, react-native-svg 15.15, expo-haptics, expo-secure-store | `package.json` |
| Missing for the redesign | `expo-blur`, `react-native-gesture-handler`, Poppins font | `package.json`, `app/_layout.tsx` (loads Inter 400/600/700 and JetBrains Mono 600 only) |
| Theme | One theme, `intelligence-console`, indigo accent, radii 4–10 | `lib/themes.ts` |
| Components | 81 exported components; 22 are aliases; 32 are never imported by a screen; 13 private or screen-local copies (e.g. `CompactFinanceSwitch`, `MoneyTile`, `AccountListItem`, `SemanticCandidateCard`, `VoiceRecordButton`, two `MiniBarChart`s) | `components/*/index.tsx`, `app/(tabs)/*.tsx` |
| Tabs | expo-router `Tabs` with a custom `TabIcon` | `app/(tabs)/_layout.tsx` |
| Review | A form per item (friendly name, canonical label, category sheet, equivalents, roles) and a confirm dialog before every save or ignore | `app/(tabs)/review.tsx` (`confirm()` with `Alert.alert` / `globalThis.confirm`) |
| Review API | `listReviews`, `listSemanticCandidates`, `resolveAlias`, `ignoreAlias`, `mergeEntity`, `resolveSemanticCandidate` | `lib/api.ts` |
| Review data | `ReviewItem` has `alias`, `normalizedValue`, `categoryPath`, `reason`, `status`, but no confidence, impact or suggestions | `lib/domain.ts` |
| Quality gates | `npm run lint`, `npx tsc --noEmit`, `npm run agent:harness` (Playwright smoke scripts, including `review-agent-smoke.mjs`, which drives the current “Friendly name” form) | `AGENTS.md`, `docs/agent-harness.md`, `scripts/` |

## Principles for the migration

1. **Ship in vertical slices.** Each phase is one PR that keeps the app working and passes the harness.
2. **Old names keep working until the last phase.** New components land first; old exports become thin deprecated re-exports, so screens migrate one at a time.
3. **Tokens before pixels.** No screen hardcodes a glass value; everything reads `theme.glass`, `theme.motion` and `theme.ambient`.
4. **Accessibility paths ship with the feature,** not after it: Reduce Transparency, Reduce Motion, font scale and screen-reader actions are part of each phase's exit criteria.
5. **One feature flag only:** `settings.reviewSession` gates the new review until the backend fields in [Backend contract additions](#backend-contract-additions) exist. Visual changes are not flagged.

## Dependencies

Install with `npx expo install` so versions match SDK 57:

```sh
npx expo install expo-blur react-native-gesture-handler @expo-google-fonts/poppins
```

- `expo-blur`: `BlurView` for glass. Web renders as `backdrop-filter`.
- `react-native-gesture-handler`: pan gesture for review cards. Wrap the root in `GestureHandlerRootView` in `app/_layout.tsx`.
- `@expo-google-fonts/poppins`: `Poppins_600SemiBold` for titles. Also add `Inter_500Medium` and `JetBrainsMono_500Medium` from the existing packages.

No new chart or animation library is needed; Reanimated and react-native-svg cover everything in the prototype.

## Phases

Estimates are rough single-developer days and assume the prototype is the spec.

| # | Phase | PR outcome | Estimate |
| --- | --- | --- | --- |
| 0 | Groundwork | Dependencies, fonts, gesture root, flag, screenshot baseline | 0.5–1 d |
| 1 | Tokens | `glass`, `motion`, `ambient`, retuned colors, numerals and radii in `lib/themes.ts` | 1–2 d |
| 2 | Material | `GlassSurface`, `AmbientBackground`, `Pressable`, accessibility hooks | 2–3 d |
| 3 | Controls and data primitives | Button, SegmentedControl, Chip, Tag, Field, Row, IconTile, StatTile, Amount | 4–5 d |
| 4 | Screen frame and navigation | `Screen` with collapsing header, custom dock, action bar, toast | 3–4 d |
| 5 | Data display | SignalCard, Timeline, TrendChart, MixCard, Graph, StateView | 3–4 d |
| 6 | Screens | Today, Money, Capture, Discover, details, Settings with the layout changes | 6–8 d |
| 7 | Review session | New review flow, commit queue, persistence, smoke test rewrite | 6–8 d (+ backend) |
| 8 | Cleanup | Delete aliases and local copies, update docs | 1–2 d |

Total: roughly 27–37 developer days, plus backend work for phase 7.

### Phase 0: Groundwork

- Add the three dependencies and the extra font weights in `app/_layout.tsx`.
- Wrap the app in `GestureHandlerRootView`.
- Add `reviewSession: boolean` (default `false`) to `AppSettings` in `lib/app-state.tsx`.
- Capture a baseline with `scripts/ux-shots.mjs` at compact and standard widths, for before/after comparison in later PRs.

Exit: app runs on iOS, Android and web; harness green.

### Phase 1: Tokens (`lib/themes.ts`)

Extend `ThemeTokens` additively, as listed in prototype section 07:

```ts
glass: {
  blur: { thin: 12, regular: 22, strong: 36 },
  fill: { thin: [...], regular: [...], strong: [...] },
  edge: ['rgba(255,255,255,0.32)', 'rgba(255,255,255,0.05)'],
  inner: 'rgba(255,255,255,0.06)',
  chromeBase: 0.74,
  selected: 'rgba(246,249,248,0.95)', onSelected: '#0B1113',
  solid: { thin: '#142124', regular: '#1A2B2F', strong: '#22363B' },
},
motion: {
  duration: { press: 140, quick: 240, enter: 420, count: 800 }, stagger: 45,
  spring: { thumb: { damping: 16, stiffness: 220, mass: 0.9 }, press: { damping: 18, stiffness: 320 } },
  easing: { out: [0.2, 0.8, 0.2, 1], in: [0.4, 0, 1, 1], soft: [0.25, 1.1, 0.4, 1] },
},
ambient: { base: '#091315', orbs: ['#1F6E78', '#24465A', '#B9E85A'], ring: '#5BB3BE' },
```

- Retune `colors` (accent `#C4F54A`, `onAccent`, model, pending, user, chart palette), `status`, and `radius` (10/14/20/28) to the prototype values.
- Add `typography.numeral` on Inter 700 with tabular figures (Poppins has no tabular digits, so counting numbers would jitter).
- The existing `motion` block is replaced by the richer one above; keep the old keys as aliases until phase 8.
- Update `docs/theme-system.md` and the token list in `docs/bibiz-reference-brief.md`.

Exit: app still renders (colors change everywhere at once, by design); `tsc` green; screenshot diff reviewed.

### Phase 2: Material

New files under `components/primitives/`:

- `GlassSurface` with `level` (`thin | regular | strong`), `tone` (`neutral | finance | review | model | danger`), `chrome`, optional `title`/`subtitle`/`action`. Renders `BlurView` + fill gradient (react-native-svg `LinearGradient`) + the specular edge.
- `AmbientBackground`: SVG radial gradients and two masked rings, rendered once per screen behind the scroll view.
- `Pressable`: replaces `AnimatedPressable`. Spring scale 0.94 for compact controls and 0.98 for rows and cards, plus optional haptic.
- Hooks in `lib/hooks.ts`: `useReduceTransparency()` and `useReduceMotion()`, wrapping `AccessibilityInfo` and its change events.

Rules: real blur only for `strong`/`chrome` on Android (`experimentalBlurMethod="dimezisBlurView"`); translucent fill elsewhere. No nested `BlurView`. At most about 6 live blurs per screen. With Reduce Transparency on, every level uses `glass.solid`.

`Surface`, `Panel`, `CommandPanel` and `ChartCard` become wrappers over `GlassSurface`.

Exit: glass visible on all three platforms; Reduce Transparency verified on iOS and Android; no frame drops on a mid-range Android device in Money.

### Phase 3: Controls and data primitives

| New component | Replaces | Notes |
| --- | --- | --- |
| `Button` (+ `iconOnly`, `ButtonGroup`) | `Button`, `ActionButton`, `IconButton`, `ActionRow` | 48 pt (40 pt `sm`), `hitSlop` on small icon buttons |
| `SegmentedControl` (`md | mini`, `scrollable`) | `SegmentedControl`, `CompactFinanceSwitch`, `CompactCurrencySwitch`, `CompactPeriodSwitch` | Sliding thumb: `onLayout` per item, `withSpring(motion.spring.thumb)` |
| `Chip` + `ChipGroup` (`single | multi`, `searchable`, `creatable`) | `FilterChip`, `FilterButton`, `EntityPill`, `CategoryPicker`, `EntityTagPicker` | Selected = opaque white pill |
| `Tag` (`status | provenance | stamp`, `live`) | `StatusBadge`, `ProvenanceMark`, `FxStamp` | Always hue + dot/icon + word |
| `ConfidenceMeter` | `ConfidenceTier` | Unchanged role |
| `Field` (`default | search | amount`) | `Input`, `SearchField` | Search variant has its own frosted backing |
| `Row` (`accessory: chevron | switch | expand | none`) | `ListRow`, `ToggleRow`, `TransactionRow`, `RelationPathRow`, `GraphRelationRow`, `ReviewQueueItem`, `AccountListItem` | Domain rows become small presets over `Row` |
| `IconTile` | `AccountIcon` and ad-hoc leading tiles | `sm | md | lg`, optional tone |
| `StatTile` + `StatGrid` | `MetricCard`, `MoneyMetric`, `SummaryGrid`, `ReviewSummary`, `TodayFinanceSnapshot`, `MoneyTile` | Values animate with `Amount` |
| `Amount` | `MoneyAmount` and screen numerals | Counts to new values (`withTiming(motion.duration.count)`) |

Each replaced export becomes `export const X = NewComponent` (or a thin adapter) marked `@deprecated`.

Exit: component catalog screens (or Storybook-style route behind `__DEV__`) match prototype section 05; VoiceOver/TalkBack labels and states present.

### Phase 4: Screen frame and navigation

- `Screen` (replaces `AppScreen`/`AppShell`/`TopBar`/`ScreenHeader`): ambient background, safe areas, large title that collapses into a compact glass bar after 64 pt (`useAnimatedScrollHandler`), optional `bar` slot for thumb-zone actions.
- `Section` (replaces `Section`, `SectionHeader`, `SectionTitle`, `DetailBlock`, `DisclosureSection`) with `collapsible`.
- Dock: custom `tabBar` for the `Tabs` in `app/(tabs)/_layout.tsx` — floating glass, labels kept, centre capture button, gliding selection pill, review badge, scale-down while scrolling down (shared value fed by `Screen`).
- `Toast` provider in `app/_layout.tsx` with an optional action (needed by review undo), `accessibilityLiveRegion="polite"`.
- `BottomSheet`: same API; spring in, staggered children, sink out.

Exit: tab switching, push/back transitions and scroll behaviour match prototype section 06; content never hides behind the dock (bottom padding = dock height + inset).

### Phase 5: Data display

- `SignalCard` (`brief | card | block`) replaces `InsightCard`, `InsightArticleCard`, `DigestCard`, `DigestSummaryCard`, `GeneratedTextBlock`, `DailyBrief` (as `SignalCarousel`) and `EntitySummary`.
- `Timeline` replaces `EvidenceRow`, `TransactionEvidenceTimeline`, `EvidenceTrail`, `EventTimeline`.
- `TrendChart` (`line | bars | spark`) replaces `MonthlyCashFlowBar`, `MonthlyCashFlowLine`, `TrendChart` alias and both `MiniBarChart`s. Selection animates in place via `useAnimatedProps`; the chart only draws in when a view opens.
- `MixCard` rebuilds `SpendingRadial` (and its private `DistributionRing`, `AnimatedRadialSlice`): round-capped arcs from 12 o'clock with even gaps, tick ring, centre lens that resets, legend rows on fixed columns. Supports account colours and a signed net centre for the Accounts view.
- `Graph` (`explore | preview`) wraps `GraphExplorer`, `GraphForceCanvas`, `GraphPreview`; focus changes animate without re-layout.
- `StateView` (`empty | error | success | loading`) replaces `EmptyState`, `ErrorState`, `LoadingSkeleton`, `LoadingState`, `ActionPreview`, `CaptureSuccess`.

Exit: charts announce their values; Reduce Motion skips draw-in; legend columns align at font scale 1.3.

### Phase 6: Screens

One PR per row; each applies the layout change named in prototype section 03.

| Screen | File | Changes |
| --- | --- | --- |
| Today | `app/(tabs)/index.tsx` | Net hero, quick actions (expense, income, note, search), `SignalCarousel` whose first card starts the review session, recent activity. Remove the duplicate “Needs review” panel. |
| Money | `app/(tabs)/financials.tsx` | Five views become three: Overview (expense mix first, then net, account strip, cash flow, signals), Accounts (portfolio mix first, then the list), Activity. One currency switch beside the FX stamp. Category/merchant toggle on the mix card. Extract `AccountListItem` into `Row` usage. |
| Capture | `app/(tabs)/capture.tsx` | Segmented mode switch instead of tiles, large amount field, Save in `Screen.bar`. Move `VoiceRecordButton` into `CaptureForm`. |
| Discover | `app/(tabs)/search.tsx` | Sticky search field, graph focus in place, grouped results. |
| Transaction | `app/transaction/[id].tsx` | 2×2 facts grid in the hero replaces the summary list. |
| Entity, Insight, Digest, Event, Email | `app/entity/[id].tsx` etc. | Identity card, `SignalCard` block, `Timeline`. |
| Settings | `app/settings.tsx` | Grouped rows with icon tiles; advanced tools collapsed; add the review auto-handle switch once phase 7 lands. |

Exit per screen: AGENTS.md runtime QA — compact and large widths, loading/empty/error states, long content, keyboard, safe areas, dock overlap, font scale 1.3.

### Phase 7: Review session

This phase is behind `settings.reviewSession` until the backend fields ship; the current review screen stays reachable meanwhile.

**Routes**

- `app/(tabs)/review.tsx` becomes the review home: progress ring, effort (“6 quick decisions · about 50 seconds”), impact, topic tiles, “Handled for you”, this week.
- New `app/review-session.tsx` presented with `presentation: 'fullScreenModal'` (hides the dock), plus `app/review-summary.tsx` or a summary state inside the session.

**Components**

- `ReviewSession` (queue, progress segments, card stack, skip, exit).
- `DecisionCard` with `kind = name | batch | category | same | relation | label`; each kind provides its body and answers.
- Pan gesture: `Gesture.Pan()` + Reanimated; x follows the finger, rotate = x / 18, stamps fade over 90 pt; commit past 30% of width or 800 pt/s, otherwise spring back. Haptics: `selectionAsync` at the threshold, `impactAsync(Light)` on accept.
- `accessibilityActions` on the top card: Accept, Skip, Why. Keyboard on web: → / Enter, ←, 1–3, Z, Esc.

**State** (persisted with `writeStoredValue` from `lib/storage.ts`, key `review.session.v1`):

```ts
type ReviewSessionState = {
  order: string[];                // decision ids, impact-ordered
  index: number;
  answers: { id: string; choice: 'accept' | 'skip' | 'different' | 'no'; value?: string; rule?: boolean; at: number }[];
  skipped: string[];
  pending: PendingCommit[];       // not yet sent to the API
  startedAt: number;
};
```

**Building the queue (client side)**

- Sources: `listReviews('pending')` and `listSemanticCandidates()`.
- Kind mapping: alias with a suggestion → `name`; several aliases with the same `normalizedValue` → one `batch`; alias without category → `category`; entity-match suggestions from `findEntityMatches` → `same`; semantic candidates → `relation`; label suggestions → `label`.
- Impact: count matching transactions from the cached Money bundle until the backend provides it.
- Order: impact × confidence (confidence defaults to 0.5 when absent).

**Answer → API mapping** (all existing endpoints):

| Answer | Call |
| --- | --- |
| Name / batch accept | `resolveAlias(id, { alias: chosenName, categoryPath })` for each alias in the batch |
| Category / label accept | `resolveAlias(id, { alias, categoryPath: [chosenCategory] })` |
| Same company | `resolveAlias(id, { alias, categoryPath, targetEntityId })`, then `mergeEntity({ aliasEntityId, canonicalEntityId, reason, confidence })`, as the current screen does |
| Connection yes / no | `resolveSemanticCandidate(id, { action: 'approve', createRule })` / `{ action: 'reject' }` |
| Different / not transport | `ignoreAlias(id)` |
| Skip | Local only |

**Undo without rollback:** an answer is applied to local state immediately and added to `pending`. Each pending commit is sent when its 5-second toast expires, when the session ends, or when the app goes to background (`AppState`). Undo removes the pending commit before it is sent. The summary's “undo for 24 h” requires the backend undo endpoint below; until then the summary shows changes without the undo note.

**Tests:** rewrite `scripts/review-agent-smoke.mjs` for the new flow — keep the `?ux=loading|empty|edge` preview states, then start a session, accept with a click and with the keyboard, undo, skip, finish, and assert “Continue · N left” after exit. Keep failing on uncaught runtime errors.

Exit: the full queue can be answered with taps only, keys only, and VoiceOver/TalkBack only; harness green; flag flipped to `true` once backend fields are live.

### Phase 8: Cleanup

- Delete the 22 aliases and the deprecated re-exports once nothing imports them (`grep` in `app/` and `components/`).
- Delete the private copies listed in the current-state table.
- Update `docs/component-inventory.md`, `docs/screen-component-spec.md`, `docs/navigation.md`, `docs/theme-system.md`, and add the decisions below to `docs/decision-log.md`.
- Remove `settings.reviewSession` and the old review screen.

Exit: `components/` exports match the 24-component list; no unused exports.

## Backend contract additions

Additive fields; the client works without them using the fallbacks above. Document them in `docs/backend-contract.md`.

| Field / endpoint | Purpose | Fallback without it |
| --- | --- | --- |
| `ReviewItem.confidence: number` | Order queue, show “93% sure”, gate auto-handle | 0.5; hide the pill |
| `ReviewItem.impact: { transactions: number; amount: number; currency: string }` | “Tidies 14 transactions”, ordering | Count from cached transactions |
| `ReviewItem.suggestions: { value: string; categoryPath?: string[]; score: number }[]` | One-tap answer and alternatives | Use `normalizedValue` and `categoryPath` only |
| `ReviewItem.rationale: string` | “Why?” text | Use existing `reason` |
| `ReviewItem.groupKey: string` | Batch variants | Group by `normalizedValue` |
| `GET /api/v1/review/auto?since=` | “Handled for you” list | Hide the card |
| `POST /api/v1/review/{id}/undo` (24 h) | Undo from the summary and the auto list | Undo only within the 5-second window |
| Server-side auto-resolve at confidence ≥ 0.95 for names and duplicate merchants | Removes obvious items from the queue | Off |

## Performance and motion budgets

- 60 fps on a mid-range Android device for tab switches, dock glide, card swipe and chart selection.
- Live `BlurView`s per screen: 6 or fewer; lists use one blurred group container, never one per row.
- Animate transforms and opacity only; never animate blur radius.
- Ambient drift runs only on Today and only while the screen is focused.
- Count-up animations on the UI thread (`useDerivedValue`) or capped at 30 fps on JS.

## Accessibility checklist (every phase)

- Reduce Transparency → `glass.solid`; Reduce Motion → instant changes, cross-fades instead of flights, no burst.
- Text contrast over `glass.solid.regular`: primary ≥ 15:1, secondary ≥ 7:1, muted ≥ 4.5:1.
- Selected states change fill and text colour and set `accessibilityState.selected`.
- Targets ≥ 44 × 44 pt (review answers ≥ 50 pt), `hitSlop` on compact icon buttons.
- Font scale 1.3: tile grids drop to one column, hero numerals step down one size (prototype layout change 09).
- Swiping is never the only way to act.

## Validation for every PR

```sh
npm run lint
npx tsc --noEmit
npm run agent:harness            # add -- --full for screen phases
node scripts/ux-shots.mjs         # before/after at compact and standard widths
```

Plus the runtime QA list in `AGENTS.md` for any touched screen.

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Android blur cost | Jank on low-end devices | Real blur on chrome only; solid fallback; measure in phase 2 before continuing |
| Visual change lands app-wide in phase 1 | Screens look mixed until migrated | Phases 1–6 in quick succession; tokens chosen so old components still read correctly |
| Review data lacks confidence/impact | Weaker ordering and copy | Client-side fallbacks; flag stays off until fields exist |
| Gesture conflicts with scroll | Mis-swipes on cards | Pan activates only on horizontal movement (`activeOffsetX`), card body scrolls vertically |
| Smoke tests tied to old review form | Harness red during phase 7 | Rewrite `review-agent-smoke.mjs` in the same PR as the review session |
| Undo deferral loses answers if the app is killed | Missed decisions | Persist `pending` and flush on next launch |

## Decisions needed from the owner

1. Auto-handle obvious matches on by default? (Prototype assumes yes, names and duplicate merchants only.)
2. Review session hides the dock (full-screen modal)? (Prototype assumes yes.)
3. Accept the larger radii (10–28 instead of 4–10), which relaxes the “disciplined radii” note in `AGENTS.md`.
4. Lime `#C4F54A` as the single accent (replacing indigo), consistent with `docs/bibiz-reference-brief.md`.
5. Who builds the backend fields in [Backend contract additions](#backend-contract-additions), and when, since phase 7 rollout depends on them.
