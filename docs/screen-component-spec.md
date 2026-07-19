# Screen Component Spec

## Purpose

Esta especificacion traduce el producto y el sistema de temas a componentes concretos por pantalla.

La regla principal es simple:

- las pantallas ensamblan componentes
- los componentes consumen tokens semanticos
- el tema decide el aspecto visual

## Component tiers

### Primitives

- `AppShell`
- `TopBar`
- `BottomTabs`
- `Surface`
- `SectionHeader`
- `TextBlock`
- `IconButton`
- `Button`
- `FilterChip`
- `EmptyState`
- `ErrorState`
- `LoadingSkeleton`

### Content cards

- `SummaryCard`
- `MetricCard`
- `InsightCard`
- `DigestCard`
- `FinancialSnapshotCard`
- `ChartCard`
- `ListRow`
- `EntityPill`
- `RelationRow`
- `TransactionRow`
- `EvidenceRow`

### Detail and action components

- `DetailBlock`
- `ActionRow`
- `ExpandablePanel`
- `Timeline`
- `GraphNodeCard`
- `GraphRelationRow`
- `ResolutionForm`
- `MergeForm`
- `CaptureForm`

## Global layout contract

Every screen should follow the same structure:

1. app shell
2. top bar
3. page content
4. optional sticky action area
5. bottom tabs

This keeps the app coherent across themes.

## Screen specs

### Dashboard

## Intent

The dashboard is the home screen and the executive summary of the second-brain.

## Primary components

- `AppShell`
- `TopBar`
- `SummaryCard`
- `InsightCard`
- `DigestCard`
- `FinancialSnapshotCard`
- `MetricCard`
- `ListRow`
- `ActionRow`
- `BottomTabs`

## Required sections

- top summary area
- insights rail
- digest preview
- financial snapshot
- recent activity
- quick actions

## State variants

- loading
- empty
- partial data
- error
- refreshed

## Theme behavior

- Editorial Minimal: compact cards, thin dividers, crisp hierarchy
- Intelligence Console: darker surfaces, stronger depth, brighter status accents
- Warm Knowledge: warmer surfaces, softer cards, more breathing room

### Search

## Intent

Search is the main retrieval surface for events, entities, and relations.

## Primary components

- `AppShell`
- `TopBar`
- `FilterChip`
- `SearchInput`
- `SectionHeader`
- `ListRow`
- `EntityPill`
- `RelationRow`
- `EmptyState`
- `BottomTabs`

## Required sections

- query input
- filter chips
- entity results
- event results
- relation results

## State variants

- idle
- typing
- loading
- no results
- results with mixed entities and relations
- error

## Theme behavior

- Editorial Minimal: plain, fast, high contrast search
- Intelligence Console: denser result rows and stronger hierarchy
- Warm Knowledge: calmer result cards and softer separators

### Entity Detail and Graph

## Intent

Entity detail explains what the node is, how it resolves, and how it connects to the graph.

## Primary components

- `AppShell`
- `TopBar`
- `SummaryCard`
- `EntityPill`
- `SectionHeader`
- `DetailBlock`
- `GraphNodeCard`
- `GraphRelationRow`
- `RelationRow`
- `ListRow`
- `ExpandablePanel`
- `ActionRow`

## Required sections

- entity header
- canonical resolution summary
- graph overview
- relation list
- related events
- alias visibility
- actions for merge or reprocess when allowed

## State variants

- canonical entity
- alias resolved to canonical root
- graph truncated
- graph loading
- graph empty

## Theme behavior

- Editorial Minimal: structured blocks and readable paths
- Intelligence Console: higher density graph context and subtle glow for edges
- Warm Knowledge: more editorial spacing and softer graph surfaces

### Financials

## Intent

Financials is a first-class analytical dashboard.

## Primary components

- `AppShell`
- `TopBar`
- `FinancialSnapshotCard`
- `ChartCard`
- `MetricCard`
- `TransactionRow`
- `EvidenceRow`
- `SectionHeader`
- `FilterChip`
- `ListRow`
- `BottomTabs`

## Required sections

- monthly summary
- annual summary
- category breakdown
- account breakdown
- transaction list
- transaction detail
- evidence timeline

## State variants

- overview
- filtered
- transaction detail
- empty data
- error

## Theme behavior

- Editorial Minimal: precise, compact analytical layout
- Intelligence Console: higher contrast charts and stronger data separation
- Warm Knowledge: softer chart treatment and friendlier money surfaces

### Capture

## Intent

Capture should minimize friction and preserve raw input.

## Primary components

- `AppShell`
- `TopBar`
- `CaptureForm`
- `Button`
- `IconButton`
- `ActionRow`
- `SectionHeader`
- `EmptyState`
- `LoadingSkeleton`

## Required sections

- capture type selector
- source-specific form
- raw preview or metadata preview
- submit action
- success feedback

## State variants

- note capture
- email capture
- notification capture
- wallet capture
- generic event capture
- batch flush
- success
- validation error
- network error

## Theme behavior

- Editorial Minimal: fast form language and clear affordances
- Intelligence Console: more compact form blocks and stronger feedback states
- Warm Knowledge: gentler spacing and more readable helper text

### Review and Operations

## Intent

The review area supports alias cleanup, merges, and reprocess operations.

## Primary components

- `AppShell`
- `TopBar`
- `ResolutionForm`
- `MergeForm`
- `ActionRow`
- `ListRow`
- `SectionHeader`
- `DetailBlock`
- `Button`
- `EmptyState`

## Required sections

- pending aliases list
- alias detail
- resolve form
- ignore action
- merge action
- reprocess action

## State variants

- pending review
- resolved review
- ignored review
- merge candidate
- action confirmation
- error

## Theme behavior

- Editorial Minimal: clean operational panel with restrained emphasis
- Intelligence Console: more assertive action states and denser lists
- Warm Knowledge: softer warnings and more explanatory copy

### Insights

## Intent

Insights should feel like compact conclusions with evidence.

## Primary components

- `AppShell`
- `TopBar`
- `InsightCard`
- `MetricCard`
- `SectionHeader`
- `DetailBlock`
- `EvidenceRow`
- `ListRow`

## Required sections

- summary
- takeaways
- supporting entities
- supporting relations
- audit metadata

## State variants

- fresh insight
- historical insight
- summary unavailable
- error

### Digests

## Intent

Digests summarize a time window and recent activity.

## Primary components

- `AppShell`
- `TopBar`
- `DigestCard`
- `ChartCard`
- `MetricCard`
- `SectionHeader`
- `ListRow`

## Required sections

- time window
- filters
- aggregate metrics
- recent events
- related insights
- generated summary

## State variants

- default window
- custom window
- filtered digest
- history item
- error

### Settings

## Intent

Settings should stay compact and functional.

## Primary components

- `AppShell`
- `TopBar`
- `ListRow`
- `SectionHeader`
- `FilterChip`
- `Button`
- `BottomTabs`

## Required sections

- account
- theme selection
- notification settings
- cache and sync settings
- app metadata

## State variants

- signed in
- signed out
- theme preview
- notification blocked

## Theme behavior

- theme switching must be visible here
- preview mode should allow visual comparison without changing app logic

## Component contract rules

- no screen should hardcode a color literal
- no screen should hardcode a font family
- no screen should bypass semantic tokens
- charts should receive palette tokens from theme context
- typography variants should be mapped centrally
- spacing and radius should be imported from base tokens

## Responsive behavior

- mobile phone layouts should be the default
- tablet layouts can widen cards and split detail panes
- the same component tree should support both

## Implementation order

1. define primitive components
2. define cards and rows
3. define dashboard and search screens
4. define detail screens
5. define financial screens
6. define capture and review flows
7. define settings and theme switching

## Recommendation

Implement this as a composition system, not a style sheet collection.

That way:

- the default theme can be Editorial Minimal
- future themes can reuse the exact same component tree
- screen logic stays stable while the presentation changes
