# Graph Report - android  (2026-07-21)

## Corpus Check
- 13 files · ~19,729 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 88 nodes · 109 edges · 12 communities (11 shown, 1 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `00f9f830`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_NotificationBridgeService|NotificationBridgeService]]
- [[_COMMUNITY_NotificationBridgeModule|NotificationBridgeModule]]
- [[_COMMUNITY_VoiceNoteModule|VoiceNoteModule]]
- [[_COMMUNITY_MainActivity|MainActivity]]
- [[_COMMUNITY_.createNativeModules|.createNativeModules]]
- [[_COMMUNITY_MainApplication|MainApplication]]
- [[_COMMUNITY_.createNativeModules|.createNativeModules]]
- [[_COMMUNITY_NotificationReconciliationWorker|NotificationReconciliationWorker]]
- [[_COMMUNITY_NotificationBridgeConfig.kt|NotificationBridgeConfig.kt]]

## God Nodes (most connected - your core abstractions)
1. `NotificationBridgeService` - 15 edges
2. `NotificationBridgeModule` - 10 edges
3. `VoiceNoteModule` - 8 edges
4. `MainActivity` - 6 edges
5. `MainApplication` - 6 edges
6. `NotificationBridgePackage` - 4 edges
7. `VoiceNotePackage` - 4 edges
8. `reconcileConnectedListener()` - 3 edges
9. `NotificationReconciliationWorker` - 3 edges
10. `NotificationBridgeConfig` - 1 edges

## Surprising Connections (you probably didn't know these)
- `NotificationBridgeModule` --inherits--> `ReactContextBaseJavaModule`  [EXTRACTED]
  app/src/main/java/com/brainia/mobile/notification/NotificationBridgeModule.kt →   _Bridges community 1 → community 2_
- `VoiceNotePackage` --implements--> `ReactPackage`  [EXTRACTED]
  app/src/main/java/com/brainia/mobile/voice/VoiceNotePackage.kt →   _Bridges community 4 → community 6_

## Import Cycles
- None detected.

## Communities (12 total, 1 thin omitted)

### Community 0 - "NotificationBridgeService"
Cohesion: 0.22
Nodes (7): Boolean, String, NotificationBridgeService, reconcileConnectedListener(), Long, NotificationListenerService, StatusBarNotification

### Community 1 - "NotificationBridgeModule"
Cohesion: 0.21
Nodes (4): Promise, String, NotificationBridgeModule, ReadableArray

### Community 2 - "VoiceNoteModule"
Cohesion: 0.18
Nodes (6): Boolean, Promise, String, VoiceNoteModule, ReactContextBaseJavaModule, SpeechRecognizer

### Community 3 - "MainActivity"
Cohesion: 0.20
Nodes (5): String, MainActivity, Bundle, ReactActivity, ReactActivityDelegate

### Community 4 - ".createNativeModules"
Cohesion: 0.28
Nodes (6): List, NativeModule, ReactApplicationContext, ViewManager, NotificationBridgePackage, ReactPackage

### Community 5 - "MainApplication"
Cohesion: 0.25
Nodes (5): MainApplication, Application, Configuration, ReactApplication, ReactHost

### Community 6 - ".createNativeModules"
Cohesion: 0.32
Nodes (5): List, NativeModule, ReactApplicationContext, ViewManager, VoiceNotePackage

### Community 7 - "NotificationReconciliationWorker"
Cohesion: 0.40
Nodes (3): NotificationReconciliationWorker, Result, Worker

## Knowledge Gaps
- **1 isolated node(s):** `NotificationBridgeConfig`
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `NotificationBridgeModule` connect `NotificationBridgeModule` to `VoiceNoteModule`, `.createNativeModules`?**
  _High betweenness centrality (0.116) - this node is a cross-community bridge._
- **Why does `VoiceNoteModule` connect `VoiceNoteModule` to `.createNativeModules`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **What connects `NotificationBridgeConfig` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._