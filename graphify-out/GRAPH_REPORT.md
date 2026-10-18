# Graph Report - BrainIA-Mobile  (2026-10-02)

## Corpus Check
- 100 files · ~113,041 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1160 nodes · 2173 edges · 94 communities (73 shown, 21 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.76)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a526b349`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_api.ts|api.ts]]
- [[_COMMUNITY_Data cards|Data cards]]
- [[_COMMUNITY_Screen Component Spec|Screen Component Spec]]
- [[_COMMUNITY_Concrete theme definitions|Concrete theme definitions]]
- [[_COMMUNITY_useTheme|useTheme]]
- [[_COMMUNITY_Functional requirements|Functional requirements]]
- [[_COMMUNITY_dependencies|dependencies]]
- [[_COMMUNITY_expo|expo]]
- [[_COMMUNITY_index.tsx|index.tsx]]
- [[_COMMUNITY_Detail and action components|Detail and action components]]
- [[_COMMUNITY_Primitive components|Primitive components]]
- [[_COMMUNITY_Iteration loop|Iteration loop]]
- [[_COMMUNITY_index.tsx|index.tsx]]
- [[_COMMUNITY_AppShell|AppShell]]
- [[_COMMUNITY_i|i]]
- [[_COMMUNITY_Practical Heuristics|Practical Heuristics]]
- [[_COMMUNITY_share-apk.mjs|share-apk.mjs]]
- [[_COMMUNITY_Design Direction|Design Direction]]
- [[_COMMUNITY_NotificationBridgeModule|NotificationBridgeModule]]
- [[_COMMUNITY_UX Iteration System|UX Iteration System]]
- [[_COMMUNITY_Bibiz Reference Brief|Bibiz Reference Brief]]
- [[_COMMUNITY_index.tsx|index.tsx]]
- [[_COMMUNITY_index.tsx|index.tsx]]
- [[_COMMUNITY_BrainIA-Mobile UX Rebuild Proposal|BrainIA-Mobile UX Rebuild Proposal]]
- [[_COMMUNITY_Backend Contract|Backend Contract]]
- [[_COMMUNITY_README|README.md]]
- [[_COMMUNITY_Mobile Architecture|Mobile Architecture]]
- [[_COMMUNITY_Expo Mobile UXUI Working Memory|Expo Mobile UX/UI Working Memory]]
- [[_COMMUNITY_l|l]]
- [[_COMMUNITY_p|p]]
- [[_COMMUNITY_scripts|scripts]]
- [[_COMMUNITY_p|p]]
- [[_COMMUNITY_Navigation|Navigation]]
- [[_COMMUNITY_Rebuild Roadmap|Rebuild Roadmap]]
- [[_COMMUNITY_id.tsx|[id].tsx]]
- [[_COMMUNITY_tsconfig.json|tsconfig.json]]
- [[_COMMUNITY_index.tsx|index.tsx]]
- [[_COMMUNITY_n|n]]
- [[_COMMUNITY_Technical Backlog|Technical Backlog]]
- [[_COMMUNITY_Information Architecture|Information Architecture]]
- [[_COMMUNITY_Global UX Principles|Global UX Principles]]
- [[_COMMUNITY_devDependencies|devDependencies]]
- [[_COMMUNITY_ux-smoke.mjs|ux-smoke.mjs]]
- [[_COMMUNITY_UX Rebuild Implementation Audit|UX Rebuild Implementation Audit]]
- [[_COMMUNITY_Data Presentation Rules|Data Presentation Rules]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_app-state.tsx|app-state.tsx]]
- [[_COMMUNITY_review.tsx|review.tsx]]
- [[_COMMUNITY_Component tiers|Component tiers]]
- [[_COMMUNITY_Visual Direction|Visual Direction]]
- [[_COMMUNITY_Capture|Capture]]
- [[_COMMUNITY_Today|Today]]
- [[_COMMUNITY_Search|Search]]
- [[_COMMUNITY_Finance|Finance]]
- [[_COMMUNITY_Review|Review]]
- [[_COMMUNITY_Product Direction|Product Direction]]
- [[_COMMUNITY_Component System Rebuild|Component System Rebuild]]
- [[_COMMUNITY_Knowledge Entity Detail|Knowledge Entity Detail]]
- [[_COMMUNITY_eslint.config.js|eslint.config.js]]
- [[_COMMUNITY_Theme System|Theme System]]
- [[_COMMUNITY_P2. Extensiones y refinamiento futuro|P2. Extensiones y refinamiento futuro]]
- [[_COMMUNITY_AccountIcon.tsx|AccountIcon.tsx]]
- [[_COMMUNITY_BrainIA-Mobile|BrainIA-Mobile]]
- [[_COMMUNITY_Architecture|Architecture]]
- [[_COMMUNITY_Suggested chart models|Suggested chart models]]
- [[_COMMUNITY_Architecture|Architecture]]
- [[_COMMUNITY_Layout tokens|Layout tokens]]
- [[_COMMUNITY_ux-shots.mjs|ux-shots.mjs]]
- [[_COMMUNITY_ActionPreview|ActionPreview]]
- [[_COMMUNITY_ReviewQueueItem|ReviewQueueItem]]
- [[_COMMUNITY_cc|cc]]
- [[_COMMUNITY_h|h]]
- [[_COMMUNITY_us|us]]
- [[_COMMUNITY_review.tsx|review.tsx]]
- [[_COMMUNITY_ce|ce]]
- [[_COMMUNITY__|_]]
- [[_COMMUNITY_cleanDisplayText|cleanDisplayText]]
- [[_COMMUNITY_cc|cc]]
- [[_COMMUNITY_bo|bo]]
- [[_COMMUNITY_sd|sd]]
- [[_COMMUNITY_VoiceNoteModule|VoiceNoteModule]]
- [[_COMMUNITY_Technical Backlog|Technical Backlog]]
- [[_COMMUNITY_GraphForceCanvas.tsx|GraphForceCanvas.tsx]]
- [[_COMMUNITY_NotificationReconciliationWorker|NotificationReconciliationWorker]]
- [[_COMMUNITY_P2. Extensiones y refinamiento futuro|P2. Extensiones y refinamiento futuro]]
- [[_COMMUNITY_agent-harness|agent-harness.md]]
- [[_COMMUNITY_financials.tsx|financials.tsx]]
- [[_COMMUNITY_capture-agent-smoke.mjs|capture-agent-smoke.mjs]]
- [[_COMMUNITY_transaction-edit-agent-smoke.mjs|transaction-edit-agent-smoke.mjs]]

## God Nodes (most connected - your core abstractions)
1. `useTheme()` - 101 edges
2. `Screen Component Spec` - 52 edges
3. `cleanDisplayText()` - 44 edges
4. `useAppState()` - 26 edges
5. `Button()` - 24 edges
6. `useBrainIAClient()` - 24 edges
7. `useAsyncResource()` - 23 edges
8. `BrainIA-Mobile UX Rebuild Proposal` - 22 edges
9. `Concrete theme definitions` - 19 edges
10. `TopBar()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `VoiceRecordButton()` --calls--> `useTheme()`  [EXTRACTED]
  app/(tabs)/capture.tsx → lib/app-state.tsx
- `CompactFinanceSwitch()` --calls--> `useTheme()`  [EXTRACTED]
  app/(tabs)/financials.tsx → lib/app-state.tsx
- `MoneyTile()` --calls--> `useTheme()`  [EXTRACTED]
  app/(tabs)/financials.tsx → lib/app-state.tsx
- `NotFoundScreen()` --calls--> `useTheme()`  [EXTRACTED]
  app/+not-found.tsx → lib/app-state.tsx
- `MiniBarChart()` --calls--> `useTheme()`  [EXTRACTED]
  components/charts/index.tsx → lib/app-state.tsx

## Import Cycles
- 1-file cycle: `app/+html.tsx -> app/+html.tsx`

## Communities (94 total, 21 thin omitted)

### Community 0 - "api.ts"
Cohesion: 0.07
Nodes (73): groupRelationsByType(), asArray(), asNumber(), asRecordMetrics(), asString(), buildCacheKey(), ClientConfig, compactNarrative() (+65 more)

### Community 1 - "Data cards"
Cohesion: 0.09
Nodes (23): `ChartCard`, Data cards, `DigestCard`, `EntityPill`, `EvidenceRow`, `FinancialSnapshotCard`, `InsightCard`, `ListRow` (+15 more)

### Community 2 - "Screen Component Spec"
Cohesion: 0.05
Nodes (42): Component contract rules, Global layout contract, Implementation order, Intent, Intent, Intent, Intent, Intent (+34 more)

### Community 3 - "Concrete theme definitions"
Cohesion: 0.11
Nodes (19): Color system, Color system, Color system, Component feel, Component feel, Component feel, Concrete theme definitions, Editorial Minimal (+11 more)

### Community 4 - "useTheme"
Cohesion: 0.05
Nodes (58): BootstrapScreen(), RootNavigator(), unstable_settings, NotFoundScreen(), dashboardModes, ordinalDay(), SettingsScreen(), visibilityModes (+50 more)

### Community 5 - "Functional requirements"
Cohesion: 0.06
Nodes (34): Acceptance criteria, Captura, Financias, FR-1, FR-10, FR-2, FR-3, FR-4 (+26 more)

### Community 6 - "dependencies"
Cohesion: 0.07
Nodes (28): dependencies, d3-force-3d, expo, expo-constants, expo-font, @expo-google-fonts/inter, @expo-google-fonts/jetbrains-mono, expo-haptics (+20 more)

### Community 7 - "expo"
Cohesion: 0.06
Nodes (30): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, backgroundColor, package, predictiveBackGestureEnabled (+22 more)

### Community 8 - "index.tsx"
Cohesion: 0.19
Nodes (17): AccountListItem(), displayAmount(), HomeScreen(), SearchResultItem, TransactionSummary, summarizeFinancialTransactions(), convertCurrency(), formatCategoryInsight() (+9 more)

### Community 9 - "Detail and action components"
Cohesion: 0.08
Nodes (24): `ActionItem`, `ActionRow`, `CaptureForm`, `CapturePayload`, Detail and action components, `DetailBlock`, `ExpandablePanel`, `GraphNodeCard` (+16 more)

### Community 10 - "Primitive components"
Cohesion: 0.08
Nodes (24): `AppShell`, `BottomTabs`, `Button`, `EmptyState`, `ErrorState`, `FilterChip`, `IconButton`, `LoadingSkeleton` (+16 more)

### Community 11 - "Iteration loop"
Cohesion: 0.06
Nodes (22): android, Promise, String, NotificationBridgeModule, List, ReactApplicationContext, ViewManager, NotificationBridgePackage (+14 more)

### Community 12 - "index.tsx"
Cohesion: 0.17
Nodes (11): AnimatedCircle, ChartCard(), DistributionRing(), formatChartPercentage(), MiniBarChart(), MonthlyCashFlowBar(), MonthlyCashFlowLine(), MonthlyCashFlowPoint (+3 more)

### Community 15 - "Practical Heuristics"
Cohesion: 0.09
Nodes (21): Accessibility, Android, Capture UX, Color, Distilled Judgment, Expo/React Native, Finance UX, Information Architecture (+13 more)

### Community 16 - "share-apk.mjs"
Cohesion: 0.10
Nodes (11): androidDir, apkPath, apkStat, defaultApkPath, __dirname, __filename, lanAddresses, port (+3 more)

### Community 17 - "Design Direction"
Cohesion: 0.11
Nodes (17): Bibiz, Design Direction, Goal, Inspirations, Interaction principles, Linear, Monzo, Name (+9 more)

### Community 18 - "NotificationBridgeModule"
Cohesion: 0.10
Nodes (17): CaptureKind, captureKinds, CaptureScreen(), Currency, TransactionType, VoiceNoteNativeModule, VoiceRecordButton(), VoiceState (+9 more)

### Community 19 - "UX Iteration System"
Cohesion: 0.12
Nodes (17): Data-state checklist, Device matrix, Iteration log, Iteration loop, Paso 1. Cambiar una sola cosa relevante, Paso 2. Ejecutar validacion tecnica minima, Paso 3. Abrir la app localmente, Paso 4. Revisar la pantalla en contexto (+9 more)

### Community 20 - "Bibiz Reference Brief"
Cohesion: 0.14
Nodes (13): Bibiz Reference Brief, BrainIA Translation, Capture, Home, Implementation Checklist, Money, Purpose, Reference Traits To Borrow (+5 more)

### Community 21 - "index.tsx"
Cohesion: 0.10
Nodes (35): KnowledgeDetail(), IntelligenceScreen(), Correction, LearningScreen(), Preview, CorrectionPanel(), eventCategorySuggestions, eventKinds (+27 more)

### Community 22 - "index.tsx"
Cohesion: 0.29
Nodes (5): DetailBlock(), styles, destinations, NavigationRail(), IconButton()

### Community 23 - "BrainIA-Mobile UX Rebuild Proposal"
Cohesion: 0.15
Nodes (12): Acceptance Criteria, Backend Capabilities To Design Around, BrainIA-Mobile UX Rebuild Proposal, Digests, Insights, Open Product Decisions, Purpose, Screen Proposals (+4 more)

### Community 24 - "Backend Contract"
Cohesion: 0.18
Nodes (11): Authentication expectation, Backend Contract, Backend source, Base contract, Client responsibilities, Core read flows, Data consumption rules, Implementation note (+3 more)

### Community 25 - "README.md"
Cohesion: 0.20
Nodes (3): Decision Log, Product decisions, Product implications

### Community 26 - "Mobile Architecture"
Cohesion: 0.14
Nodes (14): Architecture style, Auth integration, Data flow, Mobile Architecture, Network boundaries, Observability, Rendering strategy, Server state (+6 more)

### Community 27 - "Expo Mobile UX/UI Working Memory"
Cohesion: 0.22
Nodes (8): Accessibility And Responsiveness, Agent Instructions, Encoding, Expo Mobile UX/UI Working Memory, Implementation And QA, Mobile Interaction Standards, Product Taste, Visual System

### Community 28 - "l"
Cohesion: 0.10
Nodes (21): Boolean, Context, Int, Long, String, NotificationBridgeDiagnostics, completePendingReconciliations(), isConnected() (+13 more)

### Community 29 - "p"
Cohesion: 0.20
Nodes (5): String, MainActivity, Bundle, ReactActivity, ReactActivityDelegate

### Community 30 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, agent:harness, android, ios, lint, prebuild, share:apk, smoke:web (+3 more)

### Community 31 - "p"
Cohesion: 0.25
Nodes (5): MainApplication, Application, Configuration, ReactApplication, ReactHost

### Community 32 - "Navigation"
Cohesion: 0.15
Nodes (12): 1. Dashboard, 2. Search, 3. Capture, 4. Financials, 5. Review, Dashboard behavior, Depth rules, Main navigation (+4 more)

### Community 33 - "Rebuild Roadmap"
Cohesion: 0.29
Nodes (7): Milestone 1: UX Foundation, Milestone 2: Today + Search, Milestone 3: Finance Sub-App, Milestone 4: Knowledge Detail + Insights, Milestone 5: Capture + Review, Milestone 6: Release Hardening, Rebuild Roadmap

### Community 34 - "[id].tsx"
Cohesion: 0.19
Nodes (14): formatSourceLabel(), TransactionDetailScreen(), EvidenceRow(), TransactionRow(), AppSettings, joinDisplayParts(), BundleSource, DataVisibility (+6 more)

### Community 35 - "tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, paths, strict, extends, include, @/*

### Community 36 - "index.tsx"
Cohesion: 0.19
Nodes (26): DigestDetailScreen(), EmailDetailScreen(), EntityDetailScreen(), EventDetailScreen(), InsightDetailScreen(), resultTypeLabel(), SearchScreen(), sourceFilters (+18 more)

### Community 37 - "n"
Cohesion: 0.33
Nodes (5): Objetivo principal, Principios, Producto, Resultados esperados, Vision y Alcance

### Community 38 - "Technical Backlog"
Cohesion: 0.18
Nodes (11): Component rules, Core component system, Design principle, Future proofing, Goal, Implementation order, Recommendation, Theme registry (+3 more)

### Community 39 - "Information Architecture"
Cohesion: 0.33
Nodes (6): 1. Today, 2. Search, 3. Capture, 4. Finance, 5. Review, Information Architecture

### Community 40 - "Global UX Principles"
Cohesion: 0.33
Nodes (6): Global UX Principles, Hide Backend Complexity, Make Finance A Sub-App, Make Insights First-Class, Make Review Feel Safe, Use Progressive Disclosure

### Community 41 - "devDependencies"
Cohesion: 0.33
Nodes (6): devDependencies, eslint, eslint-config-expo, playwright, @types/react, typescript

### Community 43 - "UX Rebuild Implementation Audit"
Cohesion: 0.33
Nodes (5): 2026 Trust-Ledger Redesign, Current Completion Judgment, Evidence That Currently Passes, Remaining Gaps Before Marking Complete, UX Rebuild Implementation Audit

### Community 44 - "Data Presentation Rules"
Cohesion: 0.40
Nodes (5): Data Presentation Rules, Dates, Graph Language, Money, Source Data

### Community 45 - "package.json"
Cohesion: 0.40
Nodes (4): main, name, private, version

### Community 46 - "app-state.tsx"
Cohesion: 0.11
Nodes (33): DigestCard(), FinancialSnapshotCard(), InsightCard(), MetricCard(), MiniBarChart(), styles, TodayFinanceSnapshot(), DailyBrief() (+25 more)

### Community 47 - "review.tsx"
Cohesion: 0.21
Nodes (9): emptyCopy(), entityRoleOptions, formatRelationLabel(), relationTypeOptions, ReviewScreen(), ReviewType, reviewTypes, SemanticCandidateCard() (+1 more)

### Community 48 - "Component tiers"
Cohesion: 0.50
Nodes (4): Component tiers, Content cards, Detail and action components, Primitives

### Community 49 - "Visual Direction"
Cohesion: 0.50
Nodes (4): Avoid, Core Visual Rules, Feel, Visual Direction

### Community 50 - "Capture"
Cohesion: 0.50
Nodes (4): Capture, Current Problem, Design Rule, Target Structure

### Community 51 - "Today"
Cohesion: 0.50
Nodes (4): Current Problem, Remove From Default Home, Target Structure, Today

### Community 52 - "Search"
Cohesion: 0.50
Nodes (4): Current Problem, Result Card Types, Search, Target Structure

### Community 53 - "Finance"
Cohesion: 0.50
Nodes (4): Current Problem, Finance, Target Structure, Transaction Detail

### Community 54 - "Review"
Cohesion: 0.50
Nodes (4): Current Problem, Review, Target Structure, Tone

### Community 55 - "Product Direction"
Cohesion: 0.50
Nodes (4): Language, Primary Experience, Primary User, Product Direction

### Community 56 - "Component System Rebuild"
Cohesion: 0.67
Nodes (3): Component System Rebuild, Required Domain Components, Required Primitives

### Community 57 - "Knowledge Entity Detail"
Cohesion: 0.67
Nodes (3): Current Problem, Knowledge Entity Detail, Target Structure

### Community 60 - "Theme System"
Cohesion: 0.20
Nodes (9): Accessibility, Common props, Component Inventory, Data props, Event props, Implementation rule, Purpose, Shared conventions (+1 more)

### Community 61 - "P2. Extensiones y refinamiento futuro"
Cohesion: 0.29
Nodes (7): Capture, Dashboard, Entity Detail, Financials, Review, Screen-specific composition notes, Search

### Community 62 - "AccountIcon.tsx"
Cohesion: 0.60
Nodes (3): AccountIcon(), FINANCIAL_ACCOUNT_COLORS, financialAccountColor()

### Community 63 - "BrainIA-Mobile"
Cohesion: 0.40
Nodes (5): BrainIA-Mobile, Decisiones de producto, Documentacion, Objetivo, Stack definido

### Community 64 - "Architecture"
Cohesion: 0.40
Nodes (4): artifact, consoleErrors, errors, failedResponses

### Community 65 - "Suggested chart models"
Cohesion: 0.33
Nodes (6): `BreakdownItem`, `ChartPoint`, `DigestMetric`, `LegendItem`, Suggested chart models, `TrendState`

### Community 66 - "Architecture"
Cohesion: 0.40
Nodes (5): 1. Base tokens, 2. Semantic tokens, 3. Theme variants, 4. Component recipes, Architecture

### Community 67 - "Layout tokens"
Cohesion: 0.50
Nodes (4): Elevation, Layout tokens, Radius, Spacing

### Community 89 - "VoiceNoteModule"
Cohesion: 0.25
Nodes (4): fullSuite, port, portArgument, serverOutput

### Community 92 - "Technical Backlog"
Cohesion: 0.07
Nodes (26): Dependencia obligatoria, Milestone A, Milestone B, Milestone C, Milestones recomendados, P0.1 Rendering de datos y texto, P0.2 Estados de datos robustos, P0.3 Estabilidad del dashboard (+18 more)

### Community 93 - "GraphForceCanvas.tsx"
Cohesion: 0.14
Nodes (7): Community, ForceGraphComponent, ForceLink, ForceNode, GraphNode, GraphRelation, palette

### Community 95 - "NotificationReconciliationWorker"
Cohesion: 0.31
Nodes (7): cancelReconnect(), ensurePeriodicHealthCheck(), Context, NotificationReconciliationWorker, scheduleReconnect(), Result, Worker

### Community 115 - "financials.tsx"
Cohesion: 0.10
Nodes (21): buildMonthlyCashFlow(), CompactFinanceSwitch(), displayCurrencies, FinancePeriod, FinanceView, financialPeriodLabel(), financialPeriodRangeAtOffset(), FinancialsScreen() (+13 more)

## Knowledge Gaps
- **552 isolated node(s):** `NotificationBridgeConfig`, `name`, `slug`, `version`, `orientation` (+547 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Component Inventory` connect `Theme System` to `Suggested chart models`, `Data cards`, `Detail and action components`, `Primitive components`, `P2. Extensiones y refinamiento futuro`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `nativeModule` connect `Iteration loop` to `useTheme`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `Screen Component Spec` connect `Screen Component Spec` to `h`, `us`, `review.tsx`, `ce`, `Component tiers`, `_`, `cc`, `bo`, `sd`, `cleanDisplayText`, `README.md`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **What connects `NotificationBridgeConfig`, `name`, `slug` to the rest of the system?**
  _552 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._
- **Should `Data cards` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `Screen Component Spec` be split into smaller, more focused modules?**
  _Cohesion score 0.047619047619047616 - nodes in this community are weakly interconnected._