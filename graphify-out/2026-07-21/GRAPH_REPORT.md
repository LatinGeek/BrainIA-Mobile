# Graph Report - BrainIA-Mobile  (2026-07-21)

## Corpus Check
- 188 files · ~202,279 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1123 nodes · 1854 edges · 99 communities (80 shown, 19 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.76)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `00f9f830`
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
- [[_COMMUNITY_P1. Mejora fuerte de UX|P1. Mejora fuerte de UX]]
- [[_COMMUNITY_Detail and action components|Detail and action components]]
- [[_COMMUNITY_Primitive components|Primitive components]]
- [[_COMMUNITY_Iteration loop|Iteration loop]]
- [[_COMMUNITY_State model|State model]]
- [[_COMMUNITY_cleanDisplayText|cleanDisplayText]]
- [[_COMMUNITY_i|i]]
- [[_COMMUNITY_Practical Heuristics|Practical Heuristics]]
- [[_COMMUNITY_share-apk.mjs|share-apk.mjs]]
- [[_COMMUNITY_Design Direction|Design Direction]]
- [[_COMMUNITY_themes.ts|themes.ts]]
- [[_COMMUNITY_UX Iteration System|UX Iteration System]]
- [[_COMMUNITY_Bibiz Reference Brief|Bibiz Reference Brief]]
- [[_COMMUNITY_t|t]]
- [[_COMMUNITY_c|c]]
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
- [[_COMMUNITY_n|n]]
- [[_COMMUNITY_tsconfig.json|tsconfig.json]]
- [[_COMMUNITY_target-appmodules-RelWithDebInfo-e08a06a60d0b184efdbc.json|target-appmodules-RelWithDebInfo-e08a06a60d0b184efdbc.json]]
- [[_COMMUNITY_n|n]]
- [[_COMMUNITY_Vision y Alcance|Vision y Alcance]]
- [[_COMMUNITY_Information Architecture|Information Architecture]]
- [[_COMMUNITY_Global UX Principles|Global UX Principles]]
- [[_COMMUNITY_devDependencies|devDependencies]]
- [[_COMMUNITY_ux-smoke.mjs|ux-smoke.mjs]]
- [[_COMMUNITY_UX Rebuild Implementation Audit|UX Rebuild Implementation Audit]]
- [[_COMMUNITY_Data Presentation Rules|Data Presentation Rules]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_BrainIA-Mobile|BrainIA-Mobile]]
- [[_COMMUNITY_push|push]]
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
- [[_COMMUNITY_Theme behavior|Theme behavior]]
- [[_COMMUNITY_Screen specs|Screen specs]]
- [[_COMMUNITY_target-appmodules-RelWithDebInfo-9f1d1f93f39a811dbdf0.json|target-appmodules-RelWithDebInfo-9f1d1f93f39a811dbdf0.json]]
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
- [[_COMMUNITY_useTheme|useTheme]]
- [[_COMMUNITY_review.tsx|review.tsx]]
- [[_COMMUNITY_themes.ts|themes.ts]]
- [[_COMMUNITY_app-state.tsx|app-state.tsx]]
- [[_COMMUNITY_Technical Backlog|Technical Backlog]]
- [[_COMMUNITY_GraphForceCanvas.tsx|GraphForceCanvas.tsx]]
- [[_COMMUNITY_P2. Extensiones y refinamiento futuro|P2. Extensiones y refinamiento futuro]]
- [[_COMMUNITY_NotificationReconciliationWorker|NotificationReconciliationWorker]]
- [[_COMMUNITY_P2. Extensiones y refinamiento futuro|P2. Extensiones y refinamiento futuro]]
- [[_COMMUNITY_search.tsx|search.tsx]]

## God Nodes (most connected - your core abstractions)
1. `useTheme()` - 77 edges
2. `Screen Component Spec` - 52 edges
3. `cleanDisplayText()` - 39 edges
4. `useBrainIAClient()` - 26 edges
5. `useAsyncResource()` - 23 edges
6. `BrainIA-Mobile UX Rebuild Proposal` - 22 edges
7. `useAppState()` - 20 edges
8. `Concrete theme definitions` - 19 edges
9. `Surface()` - 18 edges
10. `EmptyState()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `MoneyTile()` --calls--> `useTheme()`  [EXTRACTED]
  app/(tabs)/financials.tsx → lib/app-state.tsx
- `AnimatedPressable()` --calls--> `useTheme()`  [EXTRACTED]
  components/primitives/index.tsx → lib/app-state.tsx
- `TabLayout()` --calls--> `useAppState()`  [EXTRACTED]
  app/(tabs)/_layout.tsx → lib/app-state.tsx
- `CaptureScreen()` --calls--> `useBrainIAClient()`  [EXTRACTED]
  app/(tabs)/capture.tsx → lib/app-state.tsx
- `CaptureScreen()` --calls--> `useTheme()`  [EXTRACTED]
  app/(tabs)/capture.tsx → lib/app-state.tsx

## Import Cycles
- 1-file cycle: `app/+html.tsx -> app/+html.tsx`

## Communities (99 total, 19 thin omitted)

### Community 0 - "api.ts"
Cohesion: 0.07
Nodes (71): groupRelationsByType(), asArray(), asNumber(), asRecordMetrics(), asString(), BrainIAClient, buildCacheKey(), ClientConfig (+63 more)

### Community 1 - "Data cards"
Cohesion: 0.04
Nodes (45): Accessibility, `BreakdownItem`, Capture, `ChartCard`, `ChartPoint`, Common props, Component Inventory, Dashboard (+37 more)

### Community 2 - "Screen Component Spec"
Cohesion: 0.05
Nodes (42): Component contract rules, Global layout contract, Implementation order, Intent, Intent, Intent, Intent, Intent (+34 more)

### Community 3 - "Concrete theme definitions"
Cohesion: 0.05
Nodes (39): 1. Base tokens, 2. Semantic tokens, 3. Theme variants, 4. Component recipes, Architecture, Color system, Color system, Color system (+31 more)

### Community 4 - "useTheme"
Cohesion: 0.19
Nodes (20): loadSettings(), CacheEnvelope, clearAllJsonCache(), deleteJsonCache(), readIndex(), readJsonCache(), registerKey(), writeIndex() (+12 more)

### Community 5 - "Functional requirements"
Cohesion: 0.06
Nodes (34): Acceptance criteria, Captura, Financias, FR-1, FR-10, FR-2, FR-3, FR-4 (+26 more)

### Community 6 - "dependencies"
Cohesion: 0.06
Nodes (33): dependencies, d3-force-3d, expo, expo-constants, expo-font, @expo-google-fonts/fraunces, @expo-google-fonts/ibm-plex-mono, @expo-google-fonts/inter (+25 more)

### Community 7 - "expo"
Cohesion: 0.07
Nodes (29): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, backgroundColor, package, predictiveBackGestureEnabled (+21 more)

### Community 8 - "P1. Mejora fuerte de UX"
Cohesion: 0.16
Nodes (22): displayAmount(), displayCurrencies, FinancePeriod, FinanceView, FinancialsScreen(), groupTransactionsInCurrency(), MoneyTile(), periods (+14 more)

### Community 9 - "Detail and action components"
Cohesion: 0.08
Nodes (24): `ActionItem`, `ActionRow`, `CaptureForm`, `CapturePayload`, Detail and action components, `DetailBlock`, `ExpandablePanel`, `GraphNodeCard` (+16 more)

### Community 10 - "Primitive components"
Cohesion: 0.08
Nodes (24): `AppShell`, `BottomTabs`, `Button`, `EmptyState`, `ErrorState`, `FilterChip`, `IconButton`, `LoadingSkeleton` (+16 more)

### Community 11 - "Iteration loop"
Cohesion: 0.05
Nodes (28): Promise, String, NotificationBridgeModule, List, ReactApplicationContext, ViewManager, NotificationBridgePackage, Boolean (+20 more)

### Community 12 - "State model"
Cohesion: 0.09
Nodes (22): artifacts, backtrace, backtraceGraph, commands, files, nodes, compileGroups, dependencies (+14 more)

### Community 13 - "cleanDisplayText"
Cohesion: 0.26
Nodes (19): DigestDetailScreen(), EmailDetailScreen(), EntityDetailScreen(), EventDetailScreen(), InsightDetailScreen(), formatSourceLabel(), TransactionDetailScreen(), AppScreen() (+11 more)

### Community 14 - "i"
Cohesion: 0.18
Nodes (19): FinancialSnapshotCard(), InsightCard(), MetricCard(), styles, TodayFinanceSnapshot(), ChartCard(), EvidenceRow(), TransactionRow() (+11 more)

### Community 15 - "Practical Heuristics"
Cohesion: 0.09
Nodes (21): Accessibility, Android, Capture UX, Color, Distilled Judgment, Expo/React Native, Finance UX, Information Architecture (+13 more)

### Community 16 - "share-apk.mjs"
Cohesion: 0.10
Nodes (11): androidDir, apkPath, apkStat, defaultApkPath, __dirname, __filename, lanAddresses, port (+3 more)

### Community 17 - "Design Direction"
Cohesion: 0.11
Nodes (17): Bibiz, Design Direction, Goal, Inspirations, Interaction principles, Linear, Monzo, Name (+9 more)

### Community 18 - "themes.ts"
Cohesion: 0.33
Nodes (6): 1. Dashboard, 2. Search, 3. Capture, 4. Financials, 5. Review, Recommended tabs

### Community 19 - "UX Iteration System"
Cohesion: 0.12
Nodes (17): Data-state checklist, Device matrix, Iteration log, Iteration loop, Paso 1. Cambiar una sola cosa relevante, Paso 2. Ejecutar validacion tecnica minima, Paso 3. Abrir la app localmente, Paso 4. Revisar la pantalla en contexto (+9 more)

### Community 20 - "Bibiz Reference Brief"
Cohesion: 0.14
Nodes (13): Bibiz Reference Brief, BrainIA Translation, Capture, Home, Implementation Checklist, Money, Purpose, Reference Traits To Borrow (+5 more)

### Community 21 - "t"
Cohesion: 0.09
Nodes (22): artifacts, backtrace, backtraceGraph, commands, files, nodes, compileGroups, dependencies (+14 more)

### Community 22 - "c"
Cohesion: 0.09
Nodes (22): artifacts, backtrace, backtraceGraph, commands, files, nodes, compileGroups, dependencies (+14 more)

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
Cohesion: 0.22
Nodes (7): Boolean, String, NotificationBridgeService, reconcileConnectedListener(), Long, NotificationListenerService, StatusBarNotification

### Community 29 - "p"
Cohesion: 0.20
Nodes (5): String, MainActivity, Bundle, ReactActivity, ReactActivityDelegate

### Community 30 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, android, ios, lint, prebuild, share:apk, smoke:web, start (+1 more)

### Community 31 - "p"
Cohesion: 0.25
Nodes (5): MainApplication, Application, Configuration, ReactApplication, ReactHost

### Community 32 - "Navigation"
Cohesion: 0.29
Nodes (6): Dashboard behavior, Depth rules, Main navigation, Navigation, Search behavior, Secondary surfaces

### Community 33 - "Rebuild Roadmap"
Cohesion: 0.29
Nodes (7): Milestone 1: UX Foundation, Milestone 2: Today + Search, Milestone 3: Finance Sub-App, Milestone 4: Knowledge Detail + Insights, Milestone 5: Capture + Review, Milestone 6: Release Hardening, Rebuild Roadmap

### Community 34 - "n"
Cohesion: 0.10
Nodes (27): dashboardModes, themeModes, visibilityModes, CaptureKind, captureKinds, CaptureScreen(), ActionRow(), CaptureSuccess() (+19 more)

### Community 35 - "tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, paths, strict, extends, include, @/*

### Community 36 - "target-appmodules-RelWithDebInfo-e08a06a60d0b184efdbc.json"
Cohesion: 0.09
Nodes (22): artifacts, backtrace, backtraceGraph, commands, files, nodes, compileGroups, dependencies (+14 more)

### Community 37 - "n"
Cohesion: 0.33
Nodes (5): Objetivo principal, Principios, Producto, Resultados esperados, Vision y Alcance

### Community 38 - "Vision y Alcance"
Cohesion: 0.40
Nodes (5): BrainIA-Mobile, Decisiones de producto, Documentacion, Objetivo, Stack definido

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
Cohesion: 0.40
Nodes (4): Current Completion Judgment, Evidence That Currently Passes, Remaining Gaps Before Marking Complete, UX Rebuild Implementation Audit

### Community 44 - "Data Presentation Rules"
Cohesion: 0.40
Nodes (5): Data Presentation Rules, Dates, Graph Language, Money, Source Data

### Community 45 - "package.json"
Cohesion: 0.40
Nodes (4): main, name, private, version

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

### Community 68 - "target-appmodules-RelWithDebInfo-9f1d1f93f39a811dbdf0.json"
Cohesion: 0.29
Nodes (6): Dependencia obligatoria, Milestone A, Milestone B, Milestone C, Milestones recomendados, Technical Backlog

### Community 88 - "useTheme"
Cohesion: 0.15
Nodes (15): NotFoundScreen(), DigestCard(), MiniBarChart(), DistributionRing(), MiniBarChart(), RadialSegment, SpendingRadial(), styles (+7 more)

### Community 89 - "review.tsx"
Cohesion: 0.13
Nodes (11): emptyCopy(), formatRelationLabel(), ReviewScreen(), ReviewType, reviewTypes, SemanticCandidateCard(), uniqueSuggestions(), SummaryGrid() (+3 more)

### Community 90 - "themes.ts"
Cohesion: 0.16
Nodes (13): TabLayout(), consoleTheme, editorial, hexToRgba(), makeShadow(), motion, radius, radiusTight (+5 more)

### Community 91 - "app-state.tsx"
Cohesion: 0.18
Nodes (12): BootstrapScreen(), RootNavigator(), unstable_settings, SettingsScreen(), CaptureForm(), AppStateContext, AppStateProvider(), AppStateValue (+4 more)

### Community 92 - "Technical Backlog"
Cohesion: 0.25
Nodes (8): P1.1 Dashboard mas accionable, P1.2 Financials mas claros, P1.3 Search mas util, P1.4 Entity detail y graph, P1.5 Review y operaciones, P1.6 Estilo editorial minimal, P1.7 Accesibilidad y responsive, P1. Mejora fuerte de UX

### Community 93 - "GraphForceCanvas.tsx"
Cohesion: 0.15
Nodes (6): Community, ForceLink, ForceNode, GraphNode, GraphRelation, palette

### Community 94 - "P2. Extensiones y refinamiento futuro"
Cohesion: 0.33
Nodes (6): P0.1 Rendering de datos y texto, P0.2 Estados de datos robustos, P0.3 Estabilidad del dashboard, P0.4 Navegacion base sin friccion, P0.5 Pipeline minimo de calidad antes de generar APK, P0. Bloqueadores de producto

### Community 95 - "NotificationReconciliationWorker"
Cohesion: 0.40
Nodes (3): NotificationReconciliationWorker, Result, Worker

### Community 96 - "P2. Extensiones y refinamiento futuro"
Cohesion: 0.33
Nodes (6): P2.1 Tema intercambiable por tokens, P2.2 Observabilidad y analitica de uso, P2.3 Cache y experiencia offline parcial, P2.4 Notificaciones y digests, P2.5 Personalizacion avanzada, P2. Extensiones y refinamiento futuro

### Community 97 - "search.tsx"
Cohesion: 0.36
Nodes (7): resultTypeLabel(), SearchScreen(), sourceFilters, GraphExplorer(), SearchField(), clusterSearchResults(), useDebouncedValue()

## Knowledge Gaps
- **583 isolated node(s):** `artifacts`, `backtrace`, `commands`, `files`, `nodes` (+578 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Component Inventory` connect `Data cards` to `Detail and action components`, `Primitive components`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Why does `Screen Component Spec` connect `Screen Component Spec` to `h`, `us`, `review.tsx`, `ce`, `Component tiers`, `_`, `cc`, `bo`, `sd`, `cleanDisplayText`, `README.md`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **What connects `artifacts`, `backtrace`, `commands` to the rest of the system?**
  _583 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06590151795631248 - nodes in this community are weakly interconnected._
- **Should `Data cards` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._
- **Should `Screen Component Spec` be split into smaller, more focused modules?**
  _Cohesion score 0.047619047619047616 - nodes in this community are weakly interconnected._
- **Should `Concrete theme definitions` be split into smaller, more focused modules?**
  _Cohesion score 0.05128205128205128 - nodes in this community are weakly interconnected._