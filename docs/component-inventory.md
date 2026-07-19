# Component Inventory

## Purpose

Este inventario define los componentes reutilizables de BrainIA-Mobile y las props esperadas para cada uno.

La idea es que las pantallas se construyan por composicion, con APIs estables y compatibles con el sistema de temas.

## Shared conventions

### Common props

Muchos componentes comparten estas props conceptuales:

- `className?`
- `style?`
- `testID?`
- `themeOverride?`
- `variant?`
- `size?`
- `disabled?`

### Event props

Los handlers deben usar nombres claros y predecibles:

- `onPress`
- `onLongPress`
- `onRetry`
- `onSubmit`
- `onClear`
- `onChange`
- `onSelect`

### Data props

Los componentes de datos deben aceptar:

- `title`
- `subtitle`
- `description`
- `leading`
- `trailing`
- `metadata`
- `status`

### Accessibility

Todos los componentes interactivos deben soportar:

- `accessibilityLabel`
- `accessibilityHint`
- `accessibilityRole`
- `accessibilityState`

## Primitive components

### `AppShell`

Responsible for the global page frame.

#### Props

- `header?: ReactNode`
- `children: ReactNode`
- `footer?: ReactNode`
- `scrollable?: boolean`
- `safeArea?: boolean`
- `backgroundVariant?: "default" | "subtle" | "raised"`

### `TopBar`

Top application bar for screen title and actions.

#### Props

- `title: string`
- `subtitle?: string`
- `leftAction?: ReactNode`
- `rightActions?: ReactNode`
- `sticky?: boolean`
- `showDivider?: boolean`

### `BottomTabs`

Primary navigation container.

#### Props

- `items: TabItem[]`
- `activeKey: string`
- `onChange: (key: string) => void`

#### `TabItem`

- `key: string`
- `label: string`
- `icon: ReactNode`
- `badgeCount?: number`
- `disabled?: boolean`

### `Surface`

Generic themed container.

#### Props

- `children: ReactNode`
- `variant?: "default" | "raised" | "subtle"`
- `padding?: "none" | "sm" | "md" | "lg"`
- `radius?: "sm" | "md" | "lg" | "xl"`
- `bordered?: boolean`

### `SectionHeader`

Section title with optional supporting metadata.

#### Props

- `title: string`
- `subtitle?: string`
- `actionLabel?: string`
- `onActionPress?: () => void`
- `count?: number`

### `Button`

Primary action button.

#### Props

- `label: string`
- `onPress: () => void`
- `variant?: "primary" | "secondary" | "ghost" | "danger"`
- `size?: "sm" | "md" | "lg"`
- `loading?: boolean`
- `disabled?: boolean`

### `IconButton`

Compact icon-only action.

#### Props

- `icon: ReactNode`
- `onPress: () => void`
- `variant?: "ghost" | "filled"`
- `size?: "sm" | "md"`
- `label: string`

### `FilterChip`

Filter or toggle chip.

#### Props

- `label: string`
- `selected?: boolean`
- `count?: number`
- `onPress: () => void`
- `disabled?: boolean`

### `EmptyState`

Empty or no-result placeholder.

#### Props

- `title: string`
- `description?: string`
- `icon?: ReactNode`
- `primaryActionLabel?: string`
- `onPrimaryAction?: () => void`
- `secondaryActionLabel?: string`
- `onSecondaryAction?: () => void`

### `ErrorState`

Error display with recovery affordance.

#### Props

- `title: string`
- `description?: string`
- `errorCode?: string`
- `retryLabel?: string`
- `onRetry?: () => void`

### `LoadingSkeleton`

Placeholder while data is loading.

#### Props

- `variant: "card" | "list" | "detail" | "chart"`
- `count?: number`
- `animated?: boolean`

## Data cards

### `SummaryCard`

High-level summary block for dashboards.

#### Props

- `title: string`
- `value?: string`
- `subtitle?: string`
- `trend?: TrendState`
- `icon?: ReactNode`
- `onPress?: () => void`

### `MetricCard`

Single metric with label and value.

#### Props

- `label: string`
- `value: string`
- `delta?: string`
- `deltaDirection?: "up" | "down" | "flat"`
- `helpText?: string`
- `onPress?: () => void`

### `InsightCard`

Compact insight preview.

#### Props

- `title: string`
- `summary: string`
- `takeaways?: string[]`
- `model?: string`
- `timestamp?: string`
- `onPress?: () => void`

### `DigestCard`

Time-window summary preview.

#### Props

- `title: string`
- `summary: string`
- `windowLabel: string`
- `metrics?: DigestMetric[]`
- `relatedCount?: number`
- `onPress?: () => void`

### `FinancialSnapshotCard`

Aggregate view for finances.

#### Props

- `title: string`
- `periodLabel: string`
- `amount?: string`
- `currency?: string`
- `chartData?: ChartPoint[]`
- `breakdown?: BreakdownItem[]`
- `onPress?: () => void`

### `ChartCard`

Chart container with title and helper text.

#### Props

- `title: string`
- `subtitle?: string`
- `chartType: "line" | "bar" | "area" | "donut"`
- `data: ChartPoint[]`
- `legend?: LegendItem[]`
- `emptyLabel?: string`

### `ListRow`

Generic row for list-based navigation.

#### Props

- `title: string`
- `subtitle?: string`
- `description?: string`
- `leading?: ReactNode`
- `trailing?: ReactNode`
- `onPress?: () => void`
- `selected?: boolean`

### `EntityPill`

Compact entity identifier.

#### Props

- `label: string`
- `type?: string`
- `size?: "sm" | "md"`
- `canonical?: boolean`
- `onPress?: () => void`

### `RelationRow`

Row for graph relations.

#### Props

- `label: string`
- `description: string`
- `relationType: string`
- `direction?: "incoming" | "outgoing" | "bidirectional"`
- `confidence?: number`
- `importanceScore?: number`
- `onPress?: () => void`

### `TransactionRow`

Row for canonical financial transactions.

#### Props

- `merchantLabel: string`
- `amount: string`
- `currency: string`
- `kind: string`
- `observedAt?: string`
- `category?: string`
- `account?: string`
- `status?: string`
- `onPress?: () => void`

### `EvidenceRow`

Evidence item linked to a transaction.

#### Props

- `source: string`
- `kind: string`
- `amount?: string`
- `currency?: string`
- `merchantLabel?: string`
- `observedAt?: string`
- `matchReason?: string`

## Detail and action components

### `DetailBlock`

Reusable detail section wrapper.

#### Props

- `title: string`
- `subtitle?: string`
- `children: ReactNode`
- `collapsible?: boolean`
- `defaultExpanded?: boolean`

### `ExpandablePanel`

Expandable container for secondary content.

#### Props

- `title: string`
- `subtitle?: string`
- `children: ReactNode`
- `expanded?: boolean`
- `onToggle?: () => void`

### `ActionRow`

Action strip with one or more buttons.

#### Props

- `primaryAction?: ActionItem`
- `secondaryActions?: ActionItem[]`
- `alignment?: "start" | "between" | "end"`

#### `ActionItem`

- `label: string`
- `onPress: () => void`
- `variant?: "primary" | "secondary" | "ghost" | "danger"`
- `disabled?: boolean`

### `Timeline`

Ordered event or evidence timeline.

#### Props

- `items: TimelineItem[]`
- `mode?: "compact" | "expanded"`

#### `TimelineItem`

- `title: string`
- `subtitle?: string`
- `timestamp?: string`
- `status?: string`
- `leading?: ReactNode`

### `GraphNodeCard`

Node card for graph expansion screens.

#### Props

- `title: string`
- `type?: string`
- `rootDistance?: number`
- `canonical?: boolean`
- `confidence?: number`
- `onPress?: () => void`

### `GraphRelationRow`

Relation row optimized for traversal context.

#### Props

- `label: string`
- `description: string`
- `direction: "incoming" | "outgoing" | "bidirectional"`
- `depth?: number`
- `importanceScore?: number`
- `onPress?: () => void`

### `ResolutionForm`

Entity or alias resolution form.

#### Props

- `title: string`
- `defaultAlias?: string`
- `defaultCategoryPath?: string[]`
- `suggestions?: string[]`
- `onResolve: (payload: ResolvePayload) => void`
- `onIgnore?: () => void`

#### `ResolvePayload`

- `alias: string`
- `categoryPath: string[]`
- `notes?: string`

### `MergeForm`

Merge canonicalization form.

#### Props

- `sourceEntityLabel: string`
- `canonicalEntityLabel: string`
- `reason?: string`
- `confidence?: number`
- `onMerge: (payload: MergePayload) => void`

#### `MergePayload`

- `canonicalEntityId: string`
- `reason: string`
- `confidence: number`

### `CaptureForm`

Generic capture form with source-specific fields.

#### Props

- `kind: "note" | "email" | "notification" | "wallet" | "event"`
- `initialValues?: Record<string, unknown>`
- `onSubmit: (payload: CapturePayload) => void`
- `onCancel?: () => void`
- `submitLabel?: string`

#### `CapturePayload`

- `title?: string`
- `body?: string`
- `timestamp?: string`
- `externalId?: string`
- `tags?: string[]`
- `raw?: Record<string, unknown>`

## Suggested chart models

### `ChartPoint`

- `label: string`
- `value: number`
- `secondaryValue?: number`

### `LegendItem`

- `label: string`
- `colorToken: string`

### `BreakdownItem`

- `label: string`
- `value: string`
- `ratio?: number`

### `TrendState`

- `direction: "up" | "down" | "flat"`
- `label?: string`

### `DigestMetric`

- `label: string`
- `value: string`

## Screen-specific composition notes

### Dashboard

- use `SummaryCard`, `InsightCard`, `DigestCard`, `FinancialSnapshotCard`
- keep the primary action area small and fast

### Search

- use `FilterChip`, `ListRow`, `EntityPill`, `RelationRow`
- group results clearly by type

### Entity Detail

- use `GraphNodeCard`, `GraphRelationRow`, `DetailBlock`, `ExpandablePanel`
- expose canonical vs alias state explicitly

### Financials

- use `ChartCard`, `TransactionRow`, `EvidenceRow`, `FinancialSnapshotCard`
- keep charts readable and not decorative

### Capture

- use `CaptureForm`, `Button`, `ActionRow`
- keep helper text compact and visible

### Review

- use `ResolutionForm`, `MergeForm`, `ListRow`, `ActionRow`
- require explicit confirmations for destructive actions

## Theme compatibility

Every component should read from the theme context for:

- color
- typography
- border radius
- spacing
- elevation
- motion

## Implementation rule

If a component cannot be themed without changing its public API, the API is probably too tied to presentation.

Prefer a small, composable prop surface over many theme-specific branches.
