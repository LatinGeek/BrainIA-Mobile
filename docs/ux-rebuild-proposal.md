# BrainIA-Mobile UX Rebuild Proposal

## Purpose

BrainIA-Mobile should become a friendly personal knowledge app with a dedicated personal finance section.

The app ingests daily user data from notes, notifications, email-like sources, wallet events, and future integrations. The mobile experience should help a standard user understand that data, inspect it, search it, review it, and turn it into useful insights across life areas.

This proposal intentionally allows a deep rebuild. No current component or screen structure is protected if replacing it improves clarity, trust, and ease of use.

## Product Direction

### Primary Experience

The app should feel like:

- a personal knowledge home
- a personal finance sub-app
- an insight and trend reader
- a light review workspace

It should not feel like:

- a backend admin dashboard
- a debugging console
- a raw graph browser
- a technical operations panel

### Primary User

The initial user is one individual user, but the product should be understandable by a standard non-technical user.

This means:

- technical complexity stays behind the backend
- backend concepts appear only when they help trust or explainability
- screens use familiar language
- advanced inspection remains available, but never dominates the default experience

### Language

Spanish and English are both acceptable. The product can start bilingual, but each individual screen should avoid mixing languages casually.

Recommended default:

- navigation and common actions in English for now, matching the current app
- user-facing domain copy can support Spanish where source data or category names are Spanish
- future setting: app language `English | Español | System`

## Backend Capabilities To Design Around

The backend already supports the main UX direction:

- generic event ingestion through `/api/v1/events`
- quick capture routes for notes, email, notifications, wallet events, and batches
- raw event preservation plus derived classification
- canonical entities, aliases, merges, and relations
- bounded graph expansion by entity
- text search across events, entities, and relations
- compact insights for entity or query-centric conclusions
- digests for time-window summaries
- financial transactions grouped from one or more raw events
- transaction evidence rows that explain source observations
- alias review queue for financial merchant/category cleanup
- event reprocessing when derived knowledge becomes stale

The mobile app should not expose these as technical modules. It should translate them into normal user jobs:

- "What happened recently?"
- "What do I know about this?"
- "Where did my money go?"
- "What needs my attention?"
- "Can I capture this quickly?"

## Information Architecture

Keep bottom tabs, but rebuild their meaning and hierarchy.

### 1. Today

Main personal knowledge home.

User question:

> What matters right now across my life data?

Primary content:

- daily or weekly brief
- recent insights
- important changes
- review reminders
- finance snapshot
- recent knowledge items
- quick search and capture access

### 2. Search

Universal retrieval surface.

User question:

> What do I know about this person, place, merchant, topic, event, or transaction?

Primary content:

- instant search
- recent searches
- suggested searches
- grouped results
- entity, event, relation, insight, and transaction previews
- result explanations in plain language

### 3. Capture

Fast daily input.

User question:

> How do I add something with the least friction?

Primary content:

- quick note
- wallet/expense input
- notification payload
- email-like payload
- generic event
- batch/offline queue later

### 4. Finance

Dedicated personal finance sub-app.

User question:

> How is my money moving, and what trends should I notice?

Primary content:

- monthly overview
- annual overview
- income
- expenses
- accounts
- categories
- trends
- finance insights
- transaction list
- transaction detail and evidence

### 5. Review

Human cleanup and validation.

User question:

> What needs my decision to improve future insights?

Primary content:

- aliases
- categorization
- suggested merges
- reprocess actions
- resolved history

## Global UX Principles

### Hide Backend Complexity

Default screens should not show:

- API source labels
- cache timestamps as primary UI
- data visibility policy cards
- raw canonicalization language
- event ids
- match strategy
- classification versions
- request/audit metadata

Those belong in secondary "Details" or "Technical info" sections.

### Use Progressive Disclosure

Every major screen should have three layers:

1. summary: what the user needs now
2. inspection: supporting data, trends, lists
3. audit: evidence, raw source, technical details

### Make Insights First-Class

Insights and digests should not feel like generic cards. They should feel like readable artifacts:

- title
- summary
- key takeaways
- supporting data
- related entities
- related transactions/events
- generated time

### Make Finance A Sub-App

Finance is stored in the global knowledge graph, but the mobile experience should treat it as a dedicated section.

The finance section should support:

- spending trends
- income and expense separation
- category and account breakdowns
- unusual activity
- recurring merchants
- transaction evidence
- finance-specific insights

### Make Review Feel Safe

Review actions improve the graph. They should feel helpful, reversible where possible, and clear before action.

Each review item should explain:

- what was detected
- why it needs a decision
- recommended action
- effect of accepting
- effect of ignoring

## Visual Direction

Recommended direction: Personal Knowledge Ledger.

This evolves the existing "Editorial Control Room" idea into something warmer and more approachable.

### Feel

- calm
- readable
- trustworthy
- organized
- polished
- data-rich without feeling technical

### Avoid

- generic SaaS dashboards
- excessive badges
- debug-like status strips
- heavy shadows
- purple/blue gradient tech styling
- nested cards
- raw graph/database language

### Core Visual Rules

- use compact but breathable sections
- make the first screen scannable in under 10 seconds
- use cards only for distinct repeated objects or summaries
- prefer dividers and section bands over card nesting
- keep charts clear and labeled
- use icons for common actions
- keep tap targets comfortable
- avoid showing more than two levels of metadata at once

## Screen Proposals

## Today

### Current Problem

The current home screen mixes finance, knowledge, transactions, policy/debug UI, insights, digests, and shortcuts in one long feed.

This makes the first impression feel busy and technical.

### Target Structure

1. Header
   - "Today"
   - date or time window
   - one subtle sync indicator only when useful

2. Daily Brief
   - 2-4 summarized bullets
   - one primary insight
   - one recommended next action

3. Knowledge Highlights
   - recent insight cards
   - recent digest preview
   - notable entity changes

4. Finance Snapshot
   - monthly spend
   - income vs expense
   - trend vs previous period
   - biggest category
   - unusual item if available

5. Needs Review
   - pending count
   - top review item
   - direct action button

6. Recent Activity
   - compact, human-readable event list
   - no raw ids

### Remove From Default Home

- full transaction list
- data policy card
- expense distribution chart unless it is part of Finance Snapshot
- technical backend source strips
- generic "Settings" action in the top bar

## Search

### Current Problem

Search is functional, but filters dominate early and results are shown as clustered cards rather than a fast retrieval experience.

### Target Structure

1. Search input
   - sticky at top
   - placeholder examples: "Spotify, groceries, last week, receipts"

2. Before Search
   - recent searches
   - suggested searches
   - common entry points: merchants, notes, emails, expenses

3. Results
   - Top match
   - Entities
   - Insights
   - Transactions
   - Events
   - Relations

4. Result Explanation
   - plain-language match reason
   - example: "Matched merchant name and two expense events"

5. Filters
   - moved behind a filter button or compact horizontal row
   - source, kind, date, finance-only, knowledge-only

### Result Card Types

- Entity result: title, type, short summary, connected count
- Transaction result: merchant, amount, date, category
- Event result: source-friendly label, title, date
- Relation result: readable path sentence
- Insight result: title, summary, generated date

## Capture

### Current Problem

Capture is form-first and source-type-first. It is usable, but not optimized for the most common mobile behavior: quickly dropping information.

### Target Structure

1. Quick Capture
   - large input
   - "What do you want to remember?"
   - submit button

2. Capture Type
   - icon segmented control
   - Note
   - Expense
   - Notification
   - Email
   - Event

3. Source-Specific Fields
   - hidden until type is selected or needed
   - wallet/expense gets amount, merchant, account, date
   - email gets subject, from, body/snippet
   - notification gets app/source, title, body

4. Success State
   - inline confirmation
   - "Captured"
   - "View event" only if useful
   - "Capture another"

### Design Rule

The default capture path should be possible in two taps:

1. type text
2. submit

## Finance

### Current Problem

The finance screen has metrics, charts, clusters, and transactions, but it does not yet feel like a finance product.

### Target Structure

1. Finance Home
   - monthly summary
   - income
   - expenses
   - net movement
   - trend vs previous month
   - top category
   - top merchant

2. Tabs Or Segmented Views
   - Overview
   - Trends
   - Categories
   - Accounts
   - Transactions
   - Insights

3. Trends
   - line or bar chart by week/month
   - trend labels
   - moving average later

4. Categories
   - ranked categories
   - contribution percentage
   - trend indicators
   - drilldown into transactions

5. Accounts
   - account-level spend/income
   - masked identifiers by default
   - account trend

6. Transactions
   - search and filters
   - grouped by date
   - merchant, amount, category, account
   - evidence count only as subtle secondary info

7. Finance Insights
   - "Spending increased in food delivery"
   - "Recurring charge detected"
   - "Largest expense this week"
   - "Uncategorized merchants need review"

### Transaction Detail

Recommended sections:

1. Transaction summary
   - merchant
   - amount
   - date
   - category
   - account

2. Explanation
   - "This transaction was built from 2 matching sources"

3. Evidence Timeline
   - wallet notification
   - bank notification
   - receipt email

4. Related Knowledge
   - merchant entity
   - related aliases
   - category

5. Actions
   - edit category through review flow
   - search merchant
   - open related entity

## Knowledge Entity Detail

### Current Problem

Entity detail exposes graph objects, aliases, and linked events, but it lacks a friendly narrative.

### Target Structure

1. Entity Header
   - name
   - type
   - short summary
   - canonical status hidden unless relevant

2. What This Is
   - plain-language summary
   - important context

3. Connections
   - visual graph preview
   - relation count
   - top connected entities
   - depth control

4. Related Activity
   - events where this entity appeared
   - related transactions if merchant/finance entity

5. Aliases And Names
   - friendly labels
   - raw descriptors hidden behind "more"

6. Technical Details
   - ids, graph depth, relation scores, event ids
   - hidden by default

## Insights

### Target Structure

1. Insight Header
   - title
   - generated date
   - topic/entity if available

2. Summary
   - readable paragraph

3. Key Takeaways
   - bullet list

4. Supporting Data
   - entities
   - relations
   - transactions
   - events

5. Follow-Up
   - search topic
   - open entity
   - generate updated insight later

## Digests

### Target Structure

1. Time Window
   - today, this week, this month, custom later

2. Summary
   - what changed
   - what matters
   - what needs action

3. Activity Metrics
   - events
   - entities
   - relations
   - sources

4. Highlights
   - notable items
   - related insights

5. Recent Activity
   - compact list

## Review

### Current Problem

Review already has useful grouping logic, but it explains too much backend behavior and not enough user decision context.

### Target Structure

1. Review Summary
   - pending count
   - priority items
   - quick resolve opportunities

2. Review Types
   - Merchant names
   - Categories
   - Entity merges
   - Reprocess suggestions
   - Resolved

3. Review Item
   - detected value
   - suggested friendly name
   - suggested category
   - source context
   - why this matters

4. Action Preview
   - "Future searches for X will match Y"
   - "Transactions like this will appear under Food Delivery"

5. Actions
   - accept
   - edit
   - ignore
   - later

### Tone

Use approachable copy:

- "Help BrainIA recognize this merchant"
- "Should this be Food Delivery?"
- "Ignore this if it is not a real merchant"

Avoid default copy:

- "canonical root"
- "descriptor-like candidate"
- "queue item"
- "normalized value"

## Settings

### Target Structure

Settings should be compact and non-technical.

Recommended sections:

- Appearance
- Language
- Finance preferences
- Data sources
- Notifications
- Advanced

Move backend connection, API key, diagnostics, cache clearing, and health checks into Advanced.

Advanced should be collapsed by default.

## Component System Rebuild

The current shared component file is too broad. Split it into focused modules:

- `components/primitives`
- `components/layout`
- `components/cards`
- `components/charts`
- `components/forms`
- `components/finance`
- `components/knowledge`
- `components/review`
- `components/states`

### Required Primitives

- `AppShell`
- `ScreenHeader`
- `Section`
- `SectionTitle`
- `ActionButton`
- `IconButton`
- `SegmentedControl`
- `FilterButton`
- `SearchField`
- `ListRow`
- `EmptyState`
- `ErrorState`
- `LoadingState`
- `BottomSheet`

### Required Domain Components

Knowledge:

- `DailyBrief`
- `InsightArticleCard`
- `DigestSummaryCard`
- `EntitySummary`
- `GraphPreview`
- `RelationPathRow`
- `EventTimeline`

Finance:

- `FinanceOverview`
- `MoneyMetric`
- `TrendChart`
- `CategoryBreakdown`
- `AccountBreakdown`
- `TransactionListItem`
- `TransactionEvidenceTimeline`
- `FinanceInsightCard`

Review:

- `ReviewSummary`
- `ReviewQueueItem`
- `AliasDecisionForm`
- `MergePreview`
- `ActionPreview`

Capture:

- `QuickCapture`
- `ExpenseCapture`
- `EmailCapture`
- `NotificationCapture`
- `CaptureSuccess`

## Data Presentation Rules

### Dates

Use human dates by default:

- Today
- Yesterday
- Jul 14
- This week
- Last 30 days

Technical timestamps appear only in Advanced/Details.

### Money

Always show:

- amount
- currency
- sign/direction
- merchant or source
- category where available

Separate income and expenses visually.

### Source Data

Translate raw source into user language:

- `wallet` -> Wallet
- `notification` -> Notification
- `email` -> Email
- `mobile` -> Mobile
- `tasker` -> Automation

### Graph Language

Translate graph terms:

- entity -> item, topic, person, merchant, place depending on type
- relation -> connection
- alias -> alternate name
- canonical -> preferred name
- event -> activity
- evidence -> source

## Rebuild Roadmap

### Milestone 1: UX Foundation

Goal:

Create the new shell, design system, and screen architecture.

Tasks:

- split component system
- define final tokens
- define typography scale
- build layout primitives
- remove technical cards from primary flow
- unify settings styling
- define bilingual copy conventions

Deliverable:

- app still works
- UI shell feels coherent
- no screen exposes debug concepts by default

### Milestone 2: Today + Search

Goal:

Make the app useful immediately on open.

Tasks:

- rebuild Today as daily brief
- rebuild Search as universal retrieval
- add grouped result types
- add plain-language match reasons
- add useful empty states

Deliverable:

- user can understand recent life data and retrieve knowledge quickly

### Milestone 3: Finance Sub-App

Goal:

Make Finance feel like a real personal finance product.

Tasks:

- build Finance Overview
- add Trends, Categories, Accounts, Transactions views
- rebuild transaction detail
- add evidence timeline
- add finance insight cards

Deliverable:

- user can answer "where did my money go?" at a glance

### Milestone 4: Knowledge Detail + Insights

Goal:

Make knowledge inspection approachable.

Tasks:

- rebuild entity detail
- build graph preview
- rebuild insight detail as readable artifact
- rebuild digest detail as time-window summary

Deliverable:

- graph data becomes understandable without technical knowledge

### Milestone 5: Capture + Review

Goal:

Make daily input and cleanup simple.

Tasks:

- rebuild quick capture
- add source-specific capture forms
- rebuild review with decision previews
- separate aliases, categories, merges, reprocess

Deliverable:

- user can add data and improve the graph without feeling like an operator

### Milestone 6: Release Hardening

Goal:

Prepare stable release.

Tasks:

- compact phone QA
- large phone QA
- loading/empty/error pass
- accessibility pass
- chart readability pass
- `npm run lint`
- `npx tsc --noEmit`
- runtime smoke test

Deliverable:

- stable release candidate

## Acceptance Criteria

The rebuild is successful when:

- a standard user can understand the home screen without explanation
- finance works as its own personal finance section
- search retrieves knowledge, finance, and activity clearly
- capture is fast enough for daily use
- review explains decisions in normal language
- graph and backend concepts are hidden until needed
- insights and digests feel like useful reading artifacts
- charts communicate trends at a glance
- technical controls are not part of the default experience
- the app feels coherent across all tabs and detail screens

## Open Product Decisions

These can be decided during implementation:

- whether the default app language is English or Spanish
- whether Finance uses top tabs or segmented controls
- whether graph preview is visual in v1 or structured list first
- whether insights are generated on demand or only read from history
- whether daily digest is the first card on Today
- how much manual review should be possible before auth exists

