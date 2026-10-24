# Component Inventory

## Purpose

`components/` now exports one glass system of 24 components. Screens compose
these components and never reimplement a control locally.

The public barrel is `components/index.ts`. Concrete modules stay importable
(`components/data/Row`, `components/layout/Screen`, …) so tree-shaking remains
predictable.

## The 24 components

| # | Component | Module | Replaces |
| --- | --- | --- | --- |
| 1 | `Screen` | `layout/Screen` | `AppScreen`, `AppShell`, `TopBar`, `ScreenHeader` |
| 2 | `Section` | `layout/Screen` | `Section`, `SectionHeader`, `SectionTitle`, `DetailBlock`, `DisclosureSection` |
| 3 | `GlassSurface` | `glass/GlassSurface` | `Surface`, `Panel`, `CommandPanel`, `ChartCard`, snapshot/overview cards |
| 3b | `GlassPaint` | `glass/GlassPaint` | the rim, bevel and specular layers of every surface |
| 4 | `Pressable` | `glass/GlassPressable` | `AnimatedPressable` |
| 5 | `Button` | `controls` | `Button`, `ActionButton`, `IconButton`, `ActionRow` (`ButtonGroup`) |
| 6 | `SegmentedControl` | `controls` | `SegmentedControl`, `CompactFinanceSwitch`, `CompactCurrencySwitch`, `CompactPeriodSwitch` |
| 7 | `Chip` | `controls` | `FilterChip`, `FilterButton`, `EntityPill`, `CategoryPicker`, `EntityTagPicker` (`ChipGroup`) |
| 8 | `Tag` | `controls` | `StatusBadge`, `ProvenanceMark`, `FxStamp` |
| 9 | `ConfidenceMeter` | `controls` | `ConfidenceTier` |
| 10 | `Field` | `controls` | `Input`, `SearchField` |
| 11 | `Row` | `data/Row` | `ListRow`, `ToggleRow`, `TransactionRow`, `RelationPathRow`, `GraphRelationRow`, `ReviewQueueItem`, `AccountListItem` |
| 12 | `IconTile` | `data/Row` | `AccountIcon` and ad-hoc leading tiles |
| 13 | `StatTile` | `data/StatTile` | `MetricCard`, `MoneyMetric`, `SummaryGrid`, `ReviewSummary`, `TodayFinanceSnapshot`, `MoneyTile` (`StatGrid`) |
| 14 | `Amount` | `data/Row` | `MoneyAmount` and screen numerals |
| 15 | `SignalCard` | `data/SignalCard` | `InsightCard`, `InsightArticleCard`, `DigestCard`, `DigestSummaryCard`, `GeneratedTextBlock`, `DailyBrief` (`SignalCarousel`), `EntitySummary` |
| 16 | `Timeline` | `data/Timeline` | `EvidenceRow`, `TransactionEvidenceTimeline`, `EvidenceTrail`, `EventTimeline` |
| 17 | `TrendChart` | `data/TrendChart` | `MonthlyCashFlowBar`, `MonthlyCashFlowLine`, `TrendChart` alias, both `MiniBarChart`s |
| 18 | `MixCard` | `data/MixCard` | `SpendingRadial`, `DistributionRing`, `AnimatedRadialSlice` |
| 19 | `Graph` | `data/Graph` | `GraphExplorer`, `GraphForceCanvas`, `GraphPreview` |
| 20 | `DecisionCard` | `review/DecisionCard` | `ResolutionForm`, `AliasDecisionForm`, `MergePreview`, `SemanticCandidateCard` |
| 21 | `CaptureForm` | `capture/CaptureForm` | `CaptureForm`, `QuickCapture`, `ExpenseCapture`, `EmailCapture`, `NotificationCapture`, `VoiceRecordButton` |
| 22 | `StateView` | `data/StateView` | `EmptyState`, `ErrorState`, `LoadingSkeleton`, `LoadingState`, `ActionPreview`, `CaptureSuccess` |
| 23 | `BottomSheet` | `layout/BottomSheet` | `BottomSheet` |
| 24 | `Dock` | `layout/Dock` | `TabIcon` and the default tab bar |

`Toast`/`useToast` live in `layout/Toast` and are infrastructure, not a
screen-level component.

## Conventions

- Every tappable target is at least 44×44 (review answers 50).
- `Row` accessories are `chevron`, `switch`, `expand` or `none`.
- `Tag` always pairs hue with a dot/icon and a word; colour is never the only
  signal.
- `StateView` covers empty, error, success and loading; screens do not import a
  second error component.
- A rail that peeks its next card cancels the screen inset (`screenGutter`) and
  sizes its cards from the screen edge, so the peek runs off the screen instead
  of stopping at the content's margin.
- All colours, radii and durations come from `lib/themes.ts`.
