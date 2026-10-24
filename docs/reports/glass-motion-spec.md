# Glass motion spec — closing the gaps to prototype section 06

Task: `task_e4ab3b300ca3` · Branch `LatinGeek/glass-design-polish` @ `fe0c8b5` · 2026-10-20
Scope: design spec only. No file under `app/`, `components/` or `lib/` was modified.

Sources read: `docs/prototypes/glass-ui-prototype.html` (section 06 *Motion*, CSS motion
variables and keyframes, the JS motion helpers, and the Implementation lists *Motion in
Reanimated*, *Accessibility* and *Review session: gesture and access*), `lib/themes.ts`,
`lib/hooks.ts`, `lib/dock-scroll.ts`, `components/layout/{Screen,Dock,BottomSheet,Toast}.tsx`,
`components/data/{TrendChart,MixCard,Row}.tsx`, `components/controls/index.tsx`,
`components/glass/GlassPressable.tsx`, `app/_layout.tsx`, `app/(tabs)/{_layout,index,financials,review}.tsx`,
`app/review-session.tsx`. Installed: Expo ~57, expo-router ~57, Reanimated 4.5.0,
react-native-screens 4.25.2.

---

## 0. Token vocabulary used in this spec

Existing tokens (`lib/themes.ts:182-194`), referenced as `M = theme.motion`:

| Token | Value | Prototype name | Prototype use |
|---|---|---|---|
| `M.duration.press` | 140 | `--d1` | press, colour |
| `M.duration.quick` | 240 | `--d2` | toggles, fades, exits |
| `M.duration.enter` | 420 | `--d3` | screen enter, expand |
| `M.duration.count` | 800 | `--d4` 700ms+ | counts, chart draw |
| `M.stagger` | 45 | `--stagger` | per-item enter delay |
| `M.easing.out` | `[0.2,0.8,0.2,1]` | `--ease-out` | entrances, reveals |
| `M.easing.in` | `[0.4,0,1,1]` | `--ease-in` | exits only |
| `M.easing.soft` | `[0.25,1.1,0.4,1]` | `--ease-soft` | ambient drift, loops |
| `M.spring.thumb` | 16 / 220 / 0.9 | `--ease-spring` | thumbs, dock pill, glides |
| `M.spring.press` | 18 / 320 / 1 | `--ease-spring` | presses, pops |
| `theme.layout.dockMinScale` | 0.86 | `.dock-min scale(.86)` | minimized dock |

Shorthand below: `ease(M.easing.out)` = `Easing.bezier(...M.easing.out)`.

### 0.1 Missing tokens (escalated to the coordinator)

The prototype uses five constants that have no token. Gap 5 cannot be specified without (a).
Proposed **additive** `ThemeTokens.motion` fields (the implementer edits `lib/themes.ts`; this
spec did not):

| Proposed token | Value | Prototype source | Needed by |
|---|---|---|---|
| `M.duration.reduced` | 120 | Accessibility list: "springs become 120ms fades" | Gap 5 (required) |
| `M.staggerMax` | 9 | Durations card: "45ms, capped at 9 items"; JS `Math.min(i, 9)` | Gap 1, TrendChart |
| `M.distance.rise` | 14 | `@keyframes in-rise translateY(14px)`; "children rise 14pt" | Gap 1 |
| `M.distance.push` | 34 | `@keyframes in-push/in-pop translateX(±34px)` | Gap 2 (in-screen slide only) |
| `M.distance.headerCollapse` | 64 | "After 64pt the compact header drops in" | Gap 3 (already a literal in `Screen.tsx:76`) |

**Approved by the coordinator (option A, §8).** Superseded fallback, kept for the record: `M.duration.reduced` → `M.duration.press`
(140ms, the closest existing value; 20ms longer than the prototype), and the four distances /
cap become named module constants at the top of the owning file. Everything below is written
against the proposed names; the coordinator's decision is recorded in §8.

`M.easing` has no spring curve and no expo curve. Neither is needed: springs use
`M.spring.*` configs directly, and the count tween uses `M.easing.out` (see Gap 4).

---

## 1. Current state at a glance

| Prototype rule | App today | Status |
|---|---|---|
| Screen children rise + fade, 45ms stagger, cap 9 | No entering on `Screen` children | **Missing** |
| Push / back slide | Native stack default (`app/_layout.tsx:78-91`); review session `animation: 'fade'` | **Platform default, not specified** |
| Compact header after 64pt | `Screen.tsx:72-86` single `useAnimatedScrollHandler` → `scrollY`, compact bar opacity 56→84 | **Present** |
| Dock shrinks on scroll *down*, restores on scroll *up* | `dockScroll` follows *position* 48→120 (`Screen.tsx:75`), never resets on tab change; non-scrollable `Screen` branch has no handler | **Partial** |
| Numbers count old → new, 800ms | `Amount` (`Row.tsx:147-167`) JS rAF tween, cubic-out, 60fps `setState`, ignores reduce motion | **Partial** |
| Charts draw once when a view opens; selection never redraws | `TrendChart.tsx:51-54` / `MixCard.tsx:73-76` draw on mode/length change; bars `FadeInUp` w/ literal `9` | **Present, ungated** |
| Reduce Motion: staggers/counts/draws instant, springs → 120ms fades | Only `GlassPressable` (scale off) and `AmbientBackground` (drift off) read `useReduceMotion` | **Missing** |
| `LinearTransition.springify()` on review queue and accounts | Accounts: `financials.tsx:870` with literal `damping(18).stiffness(180)`. Review queue (`review.tsx:120`): none | **Partial** |

Two platform facts that shape every rule below:

1. **Reanimated 4 already honours the OS setting by default** (`ReduceMotion.System`): with
   Reduce Motion on, `withTiming`/`withSpring` and layout animations jump straight to their end
   value. "Instant" rules therefore come free, but **"springs become 120ms fades" does not**:
   the replacement fade must pass `reduceMotion: ReduceMotion.Never` or it will also be skipped.
2. **`lib/hooks.ts:101` `useReduceMotion()` resolves asynchronously** (initial `false`), so the
   first frame of a screen can start a full animation before the flag flips. Recommended
   change in `lib/hooks.ts`: seed the state from Reanimated's synchronous
   `useReducedMotion()` and keep the `AccessibilityInfo` listener for live changes. All gates
   below read `useReduceMotion()` from `lib/hooks.ts` (one source of truth); worklets read it
   as a captured boolean.

---

## 2. Gap 1 — Screen enter stagger

**Prototype.** Tab switch: "Children rise 14pt and fade in with a 45ms stagger." Durations:
"d3 · 420ms Screen enter"; "stagger 45ms, capped at 9 items". View switch: "Only the body
below the segmented control re-staggers; the header and the control stay still."
CSS: `in-rise { from { opacity: 0; transform: translateY(14px) scale(.985) } }` with
`--i = min(i, 9)`. Reanimated note: `FadeInDown.duration(420).delay(i * 45)`.

**Owner file.** `components/layout/Screen.tsx` (new internal `StaggerItem`), consumed
automatically by every `Screen`. Secondary owner for view switches:
`app/(tabs)/financials.tsx` (view body below the `SegmentedControl` at line 532).

**Decision.** Do **not** use the `FadeInDown` builder for the tab case. Tab scenes stay
mounted under `Tabs`, so `entering` would fire only on the first visit, and `FadeInDown`'s
built-in offset is not the prototype's 14pt. Use a focus-driven shared value instead:

- `Screen` gets `const focused = useIsFocused()` and an `enterKey` that increments on every
  `false → true` focus transition (and on mount).
- Children are flattened one Fragment level (`Children.toArray`, expanding a top-level
  `<>…</>`, which `index.tsx`, `financials.tsx` and `review.tsx` all use) and each is wrapped
  in `StaggerItem index={i}`. The header block is index 0.
- `StaggerItem`: `progress = useSharedValue(0)`; on `enterKey` change:
  `progress.value = 0; progress.value = withDelay(Math.min(index, M.staggerMax) * M.stagger, withTiming(1, { duration: M.duration.enter, easing: ease(M.easing.out) }))`.
  Style: `opacity: progress`, `translateY: (1 - progress) * M.distance.rise`. No `scale`
  (the 0.985 scale in the CSS is sub-pixel on phones and forces rasterisation of glass; drop it).
- **View switch** (Money tabs): wrap the view body in `<StaggerGroup key={view}>` that
  restarts only its own children; the header, `SegmentedControl` and currency control are
  outside the group so they stay still while the thumb slides.
- Opt-out prop `Screen.stagger={false}` for screens that render a single full-height element
  (`review-session.tsx` doesn't use `Screen`; none needed today).

Animate opacity/transform only, never layout. Index ≥ `M.staggerMax` all share the cap delay
(max total entrance = 9 × 45 + 420 = 825ms).

**Reduce motion.** `reduceMotion === true` → skip `withDelay`/`withTiming`, set
`progress.value = 1` synchronously. No fade at all (prototype: "staggers … into instant changes").

**Acceptance check.**
1. Today tab: record at 4× slow (or `adb shell settings put global animator_duration_scale 4`);
   card *n* starts `n × 45ms` after card 0, rises from +14pt, finishes 420ms later; the 10th+
   child starts with the 9th.
2. Switch Today → Money → Today: the stagger replays each time; scroll position and
   expanded state survive (no remount).
3. Money: switching Summary → Accounts re-staggers only the body; header and segmented
   control do not move.
4. OS Reduce Motion on: every child is fully visible on the first painted frame.
5. `grep -n "45\|420\|\b9\b" components/layout/Screen.tsx` finds no motion literals.

---

## 3. Gap 2 — Push / back slide

**Prototype.** Choreography: "Push and back — Content slides 34pt from the trailing or
leading edge. The compact header resets." Reanimated note: "`SlideInRight` and `SlideInLeft`
for push and back." Review session: "Present the session as a full-screen modal."

**Prototype inconsistency (flagged).** The two statements disagree: Reanimated's
`SlideInRight`/`SlideInLeft` translate by the full window width, the CSS keyframes
(`in-push`/`in-pop`) translate 34pt + fade. The prototype is a single-page HTML mock with no
navigator, so it **does not specify where the transition lives in a native stack**, nor
interactive swipe-back. This spec decides it.

**Owner file.** `app/_layout.tsx` (root `Stack` `screenOptions` and per-screen options).
`components/layout/Screen.tsx` owns the "compact header resets" part.

**Decision.**
- Push/back belong to the **native stack**, not to Reanimated `entering` on `Screen`.
  Reasons: back on a native stack does not remount the previous screen, so a `SlideInLeft`
  entering animation would never fire on back; a Reanimated slide stacked on the native
  transition double-animates; and the native transition carries the interactive iOS
  edge-swipe and Android predictive back for free.
- Root `Stack` `screenOptions`: `animation: reduceMotion ? 'fade' : 'slide_from_right'`,
  `animationDuration: M.duration.enter` (honoured on iOS; Android uses its platform
  duration — acceptable), `gestureEnabled: true`. This gives "slides from the trailing edge"
  on push and "from the leading edge" on back on both platforms (Android's default is a
  fade-from-bottom, so this is a real change there).
- Keep `settings` as `presentation: 'modal'` and `review-session` as
  `presentation: 'fullScreenModal'`; change `review-session`'s `animation: 'fade'` to
  `animation: reduceMotion ? 'fade' : 'slide_from_bottom'` (a modal is not a push; the
  prototype's `deal` keyframe has the card stack rise from below).
- `SlideInRight`/`SlideInLeft` are **not** used for navigation. If an in-screen drill-down
  (no route change) ever needs the 34pt slide, it is
  `SlideInRight`-equivalent built as a custom entering:
  `translateX: M.distance.push → 0` + opacity, `M.duration.enter`, `ease(M.easing.out)`.
  None exists today.
- Compact header reset: `Screen` already gets a fresh `scrollY` per instance, so pushed
  screens start expanded. Additionally reset `dockScroll.value = 0` on focus (see Gap 3).

**Reduce motion.** Stack `animation: 'fade'` (native cross-fade; platform duration).
Reduce Motion users get no horizontal travel. Swipe-back gesture stays enabled — it is
user-driven motion, which the guideline allows.

**Acceptance check.**
1. Today → transaction detail: content enters from the right edge, back exits to the right
   and the previous screen returns from the left; iOS edge-swipe back tracks the finger.
2. Android: the same direction (no fade-from-bottom).
3. `app/_layout.tsx` contains no duration literal; `animationDuration` reads `M.duration.enter`.
4. Reduce Motion on: push and back are cross-fades; review session opens with a fade.
5. Pushed screen always shows the large title and an expanded dock on arrival.

---

## 4. Gap 3 — Scroll-linked header opacity and dock scale

**Prototype.** "After 64pt the compact header drops in. Scrolling down shrinks the dock;
scrolling up restores it." Principle: "Both come back as soon as you scroll up."
Reanimated note: "one `useAnimatedScrollHandler` per Screen feeds header opacity and a dock
scale shared value." Token: dock "68, scale .86 minimized"; minimized dock keeps 44pt targets.

**Owner files.** `components/layout/Screen.tsx` (handler, header), `components/layout/Dock.tsx`
(dock style), `lib/dock-scroll.ts` (shared signal).

**What already matches.** One `useAnimatedScrollHandler` per scrollable `Screen`
(`Screen.tsx:72`); compact bar fades/drops in around 64pt; dock reads a UI-thread shared value
and uses `theme.layout.dockMinScale`; labels fade via opacity only.

**Decision (changes).**
1. **Direction, not position.** In the handler keep `lastY` in a shared value;
   `delta = y - lastY`. If `y <= M.distance.headerCollapse` → target 0. Else if
   `delta > 0` (down) → target 1; if `delta < 0` (up) → target 0; `delta === 0` keeps the
   current target. Ignore bottom overscroll by clamping `y` to
   `contentSize.height - layoutMeasurement.height` before computing `delta`. Act on a target change only:
   `dockScroll.value = withTiming(target, { duration: M.duration.quick, easing: ease(target ? M.easing.in : M.easing.out) })`.
   (Shrink is an exit-like move → `easing.in`; restore is an entrance → `easing.out`.)
2. **Header thresholds from the token.** Compact bar: opacity/translateY interpolate over
   `[M.distance.headerCollapse - M.distance.rise/2, M.distance.headerCollapse + M.distance.rise]`
   (≈ 57→78, i.e. today's 56→84 band expressed in tokens); `runOnJS(setCompactVisible)` fires
   only when the boolean flips (track the previous value in a shared value — today it calls
   into JS on every scroll frame). Large-title fade: `[0, M.distance.headerCollapse]` → `[1, 0.18]`.
3. **Non-scrollable branch** (`Screen.tsx:144-150`): attach the same handler to the inner
   `ScrollView` (make it `Animated.ScrollView`), so every Screen has exactly one handler.
4. **Reset on focus / unmount.** `dockScroll` is a module-global; a minimized dock currently
   stays minimized after switching to a tab scrolled to top. On `Screen` focus:
   `dockScroll.value = withTiming(0, { duration: M.duration.quick, easing: ease(M.easing.out) })`.
5. Dock keeps scale `1 → dockMinScale` and labels opacity-only; tabs keep
   `theme.layout.minTarget` hit areas (`hitSlop` grows by `(1 - dockMinScale)` share when
   minimized if measurement shows < 44pt).

**Reduce motion.** Header: unchanged — it is scroll-*linked* (position-driven, user-controlled),
not autonomous motion. Dock: **do not minimize** (`dockScroll` stays 0) — a size change that
the user did not directly drive is the kind of motion Reduce Motion asks to drop; the dock
also stays maximally legible. Compact bar still appears so the title remains reachable.

**Acceptance check.**
1. Today: scroll down 30pt → nothing; past 64pt → compact bar in, dock shrinks to 0.86 over
   240ms; scroll up 10pt anywhere → dock restores at once.
2. Scroll Money down, switch to Today → dock is full size.
3. A non-scrollable `Screen` (`scrollable={false}`) also drives header + dock.
4. JS-thread profiler: `setCompactVisible` called only on threshold crossings.
5. Minimized dock: each tab's touch target ≥ 44 × 44 (Accessibility Inspector / `uiautomator dump`).
6. Reduce Motion on: dock never shrinks; compact bar still appears after 64pt.

---

## 5. Gap 4 — Count-up numerals

**Prototype.** "Numbers count from the old value to the new one (easeOutExpo, 800ms).
Currency and period toggles morph every amount." JS: `tween(el, from, to, 800)`; `from` is the
previously shown value, or 0 only when the view is first entered. Reanimated note:
"`useDerivedValue` with `withTiming(800)` into an animated text input, or a JS tween capped at
30fps."

**Owner file.** `components/data/Row.tsx` (`Amount`, lines ~130-180). Consumers that get it
for free: `StatTile` (`StatTile.tsx:42`), Today hero (`index.tsx:146`), Money totals and
`MixCard` centre value. List rows keep `animated={false}` (`Row.tsx:238`, `financials.tsx:939`).

**Decision.**
- Keep the JS tween (an animated `TextInput` breaks `adjustsFontSizeToFit` and the
  tile-fit fix from `fe0c8b5`), but:
  - duration `M.duration.count`, easing `ease(M.easing.out)` via
    `Easing.bezier(...M.easing.out).factory()` evaluated in JS (replaces the hand-written
    cubic). `easing.out` is a steep ease-out close to the prototype's easeOutExpo; no new
    easing token is proposed.
  - **cap at 30fps**: skip `setDisplay` if < 33ms since the last write (the prototype's own
    allowance); always write the final value.
  - **from = last displayed value** (already true); **first mount**: start from 0 only when
    the containing `Screen` is entering (first focus), otherwise start at the target — so a
    re-render with an unchanged value never counts.
  - Currency / period toggles change `target`, which re-runs the tween from the current
    display value: this is the prototype's "morph every amount".
- Accessibility: the `Text` gets `accessibilityLabel` = the formatted **target**, so screen
  readers never hear intermediate values.

**Reduce motion.** `reduceMotion === true` → `setDisplay(target)` immediately, no rAF.

**Acceptance check.**
1. Money: toggle UYU → USD; every visible amount tweens from its UYU figure to its USD
   figure over 800ms and lands on the exact formatted value.
2. Today first open: hero net counts up from 0; pull-to-refresh with unchanged data: no
   count.
3. React DevTools profiler: `Amount` re-renders ≤ 25 times per tween.
4. VoiceOver/TalkBack reads the final amount during the tween.
5. Reduce Motion on: amounts change in a single frame.

---

## 6. Gap 5 — Reduce Motion

**Prototype.** Accessibility: "`isReduceMotionEnabled()` turns staggers, counts and chart
draws into instant changes; springs become 120ms fades." Review session: "Reduce Motion:
cards cross-fade instead of flying, and the summary burst is skipped." Phase 5 acceptance:
"Reduce Motion skips draw-in." Phase 2: `useReduceMotion` hook.

**Owner files.** Gate: `lib/hooks.ts` `useReduceMotion` (sync seed, §1). Per-site owners in
the table. Token: `M.duration.reduced` (proposed; fallback `M.duration.press`).

Two shared helpers, owned by `lib/motion.ts` (new file; or inline in `lib/hooks.ts` if the
team prefers no new module):
- `reducedFade = { duration: M.duration.reduced, easing: ease(M.easing.out), reduceMotion: ReduceMotion.Never }`
- `springOrFade(reduce, toValue, springConfig)` → `reduce ? withTiming(toValue, reducedFade) : withSpring(toValue, springConfig)` —
  only valid for opacity-like values; for positional springs the rule is "jump position,
  fade the element" (below).

| Motion | Owner | Normal | Reduce Motion |
|---|---|---|---|
| Screen stagger | `Screen.tsx` | Gap 1 | instant (progress = 1) |
| View-switch stagger | `financials.tsx` | Gap 1 | instant |
| Count-up | `Row.tsx` `Amount` | Gap 4 | instant |
| Line draw | `TrendChart.tsx:51-54` | `withTiming(1, {duration: M.duration.count, easing: ease(M.easing.out)})` (replace `Easing.out(Easing.cubic)`) | `draw.value = 1` |
| Bar rise | `TrendChart.tsx:112` | `FadeInUp.delay(min(i, M.staggerMax) * M.stagger).duration(M.duration.enter)` (replace literal `9`) | `entering={undefined}` |
| Donut reveal | `MixCard.tsx:73-76` | as line draw | `reveal.value = 1` |
| Segmented thumb | `controls/index.tsx:150-151` | `withSpring(x, M.spring.thumb)` | position + width set instantly; thumb opacity `0 → 1` with `reducedFade` |
| Dock pill | `Dock.tsx:61` | `withSpring(x, M.spring.thumb)` | same as thumb |
| Press scale | `GlassPressable.tsx:33-48` | already scale-off; spring-back opacity | opacity uses `reducedFade` instead of `M.spring.press` |
| Bottom sheet | `BottomSheet.tsx:35` | `FadeInDown.springify().damping(M.spring.press.damping).stiffness(…)` → use `M.spring.thumb` config (removes literals `18`/`180`); children stagger per Gap 1 | `FadeIn.duration(M.duration.reduced).reduceMotion(ReduceMotion.Never)` |
| Toast | `Toast.tsx:54-55` | `FadeInDown/FadeOutDown.duration(M.duration.quick)` | `FadeIn/FadeOut.duration(M.duration.reduced).reduceMotion(ReduceMotion.Never)` |
| Review card fly-out / spring-back | `review-session.tsx:239-257` | exit `withTiming(±1.2w, {duration: M.duration.quick, easing: ease(M.easing.in)})`, settle `withSpring(0, M.spring.thumb)` | button answers: card opacity `1 → 0` with `reducedFade`, next card fades in; drag still follows the finger (user-driven) but release-to-settle jumps to 0 |
| Review summary burst | `review-session.tsx` | (not built; see §9) | skipped |
| Account / queue reflow | Gap 6 | `LinearTransition` | Gap 6 |
| Push / back | `app/_layout.tsx` | Gap 2 | native `'fade'` |
| Dock minimize | `Screen.tsx` | Gap 3 | disabled |
| Ambient drift | `AmbientBackground.tsx` | already off under Reduce Motion | — |

**Acceptance check.**
1. With OS Reduce Motion on (iOS Settings › Accessibility › Motion; Android
   *Remove animations*), cold-start the app: no element translates, scales or draws; the only
   motion is ≤ 120ms opacity fades on sheets, toasts, thumbs and review cards.
2. Toggle the OS setting while the app is open: the next interaction follows the new mode
   (listener in `useReduceMotion`).
3. Fades still play under Reduce Motion (proves `ReduceMotion.Never` is applied; without it
   Reanimated skips them).
4. `grep -rn "useReduceMotion" components app` lists every owner in the table.
5. No literal durations in the touched files (`grep -nE "duration\(\d|duration: \d|damping\(\d" …`).

---

## 7. Gap 6 — `LinearTransition` on review queue and accounts

**Prototype.** "Lists: `LinearTransition.springify()` where items leave (review queue,
accounts)." No spring parameters are given; the spring curve is `--ease-spring`, tokenised as
`M.spring.*`.

**Owner files.**
- Accounts: `app/(tabs)/financials.tsx` — `AccountRow` (line 870) and the two lists that
  render it (Summary preview, line 593; Accounts view, line 668).
- Review queue: `app/(tabs)/review.tsx` — "What you will review" rows (line 120-129).
  *Interpretation flag:* the prototype's "review queue" could also mean the card stack in
  `review-session.tsx`; that is a stack with its own fly-out choreography (Gap 5 row), not a
  list, so `LinearTransition` applies to the Review tab queue list.

**Decision.**
- Shared builder (in `lib/motion.ts`): `listLayout = LinearTransition.springify().damping(M.spring.thumb.damping).stiffness(M.spring.thumb.stiffness).mass(M.spring.thumb.mass)`.
  `M.spring.thumb` is the "glide" spring the prototype uses for moving things; it replaces
  the untokenised `damping(18).stiffness(180)` at `financials.tsx:870`.
- Accounts: keep `layout={listLayout}` on `AccountRow`; add
  `exiting={FadeOut.duration(M.duration.quick).easing(ease(M.easing.in))}` so a deleted
  account leaves before siblings glide up (the prototype's rule is "where items leave").
  Expanding/collapsing an account already reflows via the same transition.
- Review queue: wrap each queue `Row` in `Animated.View key={decision.id} layout={listLayout} exiting={FadeOut.duration(M.duration.quick).easing(ease(M.easing.in))}`.
  Items leave when the queue is re-read on refocus after a session.
- Avoid `layout` on items inside a `FlatList` with virtualization (none today).

**Reduce motion.** `layout={reduceMotion ? undefined : listLayout}` and no `exiting` —
items vanish and siblings snap. (Reanimated would already skip it under
`ReduceMotion.System`; passing `undefined` makes the intent explicit and avoids a
one-frame jump artefact.)

**Acceptance check.**
1. Money › Accounts: delete an account — it fades out (240ms) and the rows below glide up
   on the `M.spring.thumb` spring.
2. Expand/collapse an account — siblings glide, no jump.
3. Review tab: finish one decision in the session, return — the resolved row fades and the
   rest glide up.
4. `financials.tsx` no longer contains `damping(18)` / `stiffness(180)`.
5. Reduce Motion on: rows disappear and reflow in one frame.

---

## 8. Coordinator decision on tokens

Asked via `orca orchestration ask` (option A: propose additive tokens; option B: map to
existing tokens). Outcome: see the line below.

DECISION: **Option A.** The coordinator approved proposing the additive tokens
`motion.duration.reduced = 120`, `motion.staggerMax = 9` and
`motion.distance = { rise: 14, push: 34, headerCollapse: 64 }`. The implementer adds them to
`lib/themes.ts` (type at `ThemeTokens.motion`, value at the `motion:` block) in the
implementation step. This turn stayed read-only for source. The §0.1 fallback no longer
applies.

---

## 9. Prototype items not specified (flags)

- **Push/back placement in a native navigator** — not specified; the Reanimated note
  (`SlideInRight`, full width) contradicts the choreography (34pt). Decided in Gap 2.
- **Spring parameters for `LinearTransition`** — not specified; `M.spring.thumb` chosen.
- **Dock behaviour under Reduce Motion** — not specified; this spec disables minimisation.
- **Header compact-bar under Reduce Motion** — not specified; kept (scroll-linked).
- **Count easing token** — prototype uses easeOutExpo, which has no token; `M.easing.out`
  used instead of proposing a sixth easing.
- **"120ms fade"** — specified, but no token exists (§0.1).
- **Review summary burst** — specified in the prototype (`@keyframes spark`) but not built in
  `review-session.tsx`; out of scope here, Reduce Motion rule recorded for when it is.
- **Chart draw duration** — prototype d4 is "700ms+"; existing `M.duration.count` (800) is
  inside that band and is reused, no new token.

## 10. Implementation order (suggested)

1. Tokens (§0.1) + sync `useReduceMotion` + `lib/motion.ts` helpers.
2. Gap 5 sweep (mechanical, per table) — lowest risk, removes literals.
3. Gap 3 (Screen/Dock) and Gap 1 (stagger) together — both live in `Screen.tsx`.
4. Gap 4 (`Amount`), Gap 6 (lists), Gap 2 (`app/_layout.tsx`).
Validate each step with `npm run lint`, `npx tsc --noEmit`, `npm run agent:harness`, plus the
per-gap checks on a mid-range Android device with Reduce Motion both on and off.
