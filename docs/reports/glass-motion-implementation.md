# Glass motion implementation

Task: task_a0f9105baa0c / dispatch ctx_b23510218721
Branch: LatinGeek/glass-design-polish (base fe0c8b5)

Implemented the motion spec sections 2-7 in section 10 order. Existing copy, styles, numeral fitting, scroll positions and expanded state are preserved; no commit was created.

## Gap coverage

| Gap | Status | Implementation |
| --- | --- | --- |
| 1: screen/view entrance | Done | Focus-triggered 14pt rise and opacity, 420ms, 45ms stagger capped at index 9; one Fragment level flattened; header index 0; Screen stagger opt-out. Money controls remain outside the keyed body group. Groups own their entrance without a second wrapper animation; native sheets avoid empty scroll wrappers. |
| 2: native push/back | Done | Root stack explicitly slides from right with token duration and gestures; settings remains modal; review session remains full-screen modal and slides from bottom. Reduced mode uses native fades. The 34pt push token is available; no in-screen drill-down exists. |
| 3: header/dock scroll | Done | One handler in both Screen branches; clamped scroll delta chooses dock target, updates only on target changes, and restores on upward scroll. Token-derived header thresholds; JS compact visibility changes only at threshold crossings. Focus/cleanup resets dock; reduced mode disables minimization. Dock labels use opacity only and tabs retain minimum targets with scale-compensating hitSlop. |
| 4: counts | Done | Shared JS count hook interpolates from the last displayed number with token easing and 800ms duration, writes at most 30fps, lands exactly on target and skips unchanged targets. Zero starts require a mounting Screen entrance. Reduced mode renders target immediately; accessibility labels always contain target values. Money text totals and optional numeric MixCard centres use the same hook without changing their typography or formatting. |
| 5: reduced motion | Done | OS preference is synchronously seeded from Reanimated and still observes live AccessibilityInfo events. Staggers/counts/chart draws become instant; thumb/pill positions jump with explicit 120ms opacity fades, which use ReduceMotion.Never. Presses, sheets and toasts use replacement fades. Review answers wait for the token-eased exit or reduced fade before advancing; reduced drag settlement jumps to zero and next cards fade in. Existing ambient gating remains intact. |
| 6: list reflow | Done | Shared thumb-spring LinearTransition on account rows and review queue rows, tokenized fade exits, and explicit reduced-mode removal of layout/exit animations. The accounts collection keeps a shared parent so entrance wrappers do not isolate sibling layout transitions. |

Approved additive tokens: duration.reduced=120; staggerMax=9; distance={rise:14,push:34,headerCollapse:64}. New lib/motion.ts exports reducedFade, springOrFade and listLayout. No implementation item from sections 2-7 is blocked. The review summary burst remains out of scope per spec section 9 (there is no burst to disable).

## Coordinator clarifications

- Approved optional numeric centerAmount/currency props for MixCard: its existing centre was preformatted Text, rather than the Amount consumer described by the spec. Both Money totals are wired through the new optional props; existing string-only callers keep their original behavior and approximation prefix.
- Approved Expo Router focus APIs without adding packages. Expo 57 exposes useIsFocused directly; Screen uses that export with useFocusEffect for focus setup/cleanup, preserving the specified focus behavior.

## Changed files

- lib/themes.ts
- lib/hooks.ts
- lib/motion.ts (new)
- components/layout/Screen.tsx
- components/layout/Dock.tsx
- components/layout/BottomSheet.tsx
- components/layout/Toast.tsx
- components/glass/GlassPressable.tsx
- components/controls/index.tsx
- components/data/Row.tsx
- components/data/TrendChart.tsx
- components/data/MixCard.tsx
- app/_layout.tsx
- app/review-session.tsx
- app/(tabs)/financials.tsx
- app/(tabs)/review.tsx
- docs/reports/glass-motion-implementation.md (this report)

## Final verification

| Command | Exit code | Result |
| --- | --- | --- |
| npm run lint | 0 | Passed on final source; no warnings/errors |
| npx tsc --noEmit | 0 | Passed on final source |
| npm run agent:harness | 0 | Passed on final source; AGENT_HARNESS_OK |
| git diff --check | 0 | Passed |

The final complete harness run exited 0 with REVIEW_LOADING_OK, REVIEW_EMPTY_OK, REVIEW_ACCEPT_UNDO_OK, REVIEW_KEYBOARD_OK, REVIEW_SUMMARY_OK, REVIEW_AGENT_SMOKE_OK, CAPTURE_TRANSFER_AGENT_SMOKE_OK, TRANSACTION_RECLASSIFICATION_AGENT_SMOKE_OK, ACCOUNT_DELETE_AGENT_SMOKE_OK, INTELLIGENCE_UI_OK and AGENT_HARNESS_OK. Intermediate lint/typecheck/harness runs also exited 1 while an unavailable navigation import, a missing reduced-motion declaration, effect lint findings and a transient JSX edit were being corrected; they are not claimed as passes.

Source review found no literal animation durations or spring damping/stiffness values in the touched owners; the new constants live in themes. React component review covered hook ordering, callback dependencies, rAF cancellation, final-value accessibility labels, stable list keys, overlay spacing and avoiding duplicate group animation. Source edits retain UTF-8 and the repository's LF endings; existing untracked reports were preserved.

## Verification limitations

The harness uses browser fixtures/mocked APIs. Native Android/iOS slow-motion recordings, interactive edge/predictive back, OS Reduce Motion toggling, JS-thread profiling, actual per-frame timing and Accessibility Inspector/uiautomator target measurements were not performed; adb is not available on PATH in this session. The 44pt target rule is covered by source geometry/hitSlop, rather than a native measurement. These are remaining manual validation items, not claims of native acceptance.
