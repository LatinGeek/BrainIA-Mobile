# Glass design audit and polish pass

Branch `LatinGeek/glass-design-polish`, base `552e103`. This audits the app against `docs/prototypes/glass-ui-prototype.html` sections 03–08, the integration plan and the theme docs.

The 24-component system, the layout changes 01–08 and the Android gradient-stop fix were already in place. This pass fixes the mismatches that were verified. It does not redesign anything.

## Findings

| # | Prototype reference | Current behaviour (before) | Change | Evidence |
|---|---|---|---|---|
| 1 | 07 Foundations · glass ladder; 05 GlassSurface | On web, the fill and specular-edge `<Svg>` had no width or height, so it rendered at the 300×150 SVG default. Fill and edge stopped part-way across every card taller than 150px or wider than 300px, visible as a lighter inner rectangle. | Gave both SVG layers `width="100%" height="100%"`. | DOM probe: SVG `300x150` inside a `350x231` card before, `348x229` after. Screenshots `today-390.png`, `money-390-scrolled.png`. |
| 2 | 08 Handoff · "No nested BlurViews; at most ~6 live blurs" | Every `GlassSurface` mounted its own `BlurView`, including surfaces inside other surfaces (hero → stat tiles, decision card → tiles). | Added an `InsideGlass` context. Nested surfaces keep their fill, tint and edge but skip the `BlurView`. | `components/glass/GlassSurface.tsx`. Code-path evidence; blurs were not counted on device. |
| 3 | 07 · `chromeBase 0.74`; "no hardcoded colours" | Chrome used hex-alpha strings: `${ambient.base}BD` (surface and compact bar), `…DB` (action bar), `…66` (rail). `chromeBase` was declared but not used. | Added the `glass.chrome` and `glass.chromeStrong` tokens, built from the base at 0.74 and 0.86. Surface, compact bar, action bar and rail now read them. | `lib/themes.ts`, `Screen.tsx`, `NavigationRail.tsx` |
| 4 | 03 Layout 01 · collapsing header ("compact glass bar") | The compact bar was a plain translucent `View` with no blur or specular edge, a hardcoded radius of 16, a 36pt back button, and a title with no header role. | It now renders as a `GlassSurface chrome` (blur + edge, `radius.md`). The back button is 44pt and the title is a header. | `transaction-320-scrolled.png`, `money-390-scrolled.png` |
| 5 | 03 Layout 02 · dock shrink; 06 "transforms/opacity only" | Dock labels animated `height` (relayout every frame). The scale `0.86` and the height `68` were literals. | Labels now fade and translate, and icons drop 7pt to centre the capsule. Added the `layout.dockMinScale` and `layout.dockHeight` tokens, and Screen bottom padding uses the token. | `components/layout/Dock.tsx`, `*-scrolled.png` |
| 6 | 04 Review · "answer buttons ≥ 50pt in the lower half"; "every gesture has a button" | The session showed two Skip/Accept rows, one inside the card mid-screen and one in the footer, both 48pt. Category options were 34pt chips. | Added `Button size="lg"` (52pt, `layout.answerTarget`). Card answers now sit at the card's base in the thumb zone (`flexGrow`), and the duplicate footer row is removed; the swipe hint and amount stay. Category options are now 52pt tiles. Selected uses the white pill + check icon + "suggested" label, so colour is not the only signal. | `review-session-390.png`, `review-session-320.png`; `REVIEW_SESSION_OK` (tests use `.first()`, so no assertion changes) |
| 7 | 07 · min target 44×44 | Several targets were under 44pt: `Button sm` 40, section action 32, toast Undo 32, sheet close 36, session close 40, Today settings 40, transaction edit 40 and info badge 32, Money cycle arrows 36, account colour swatches 42, MixCard legend rows 36, chart month labels about 16. | All of these are now 44pt (`layout.minTarget`), or padded to 44 with `hitSlop` where the visual size is part of the design: chips (34 + 5), segments (38 + 4, mini 28 + 8) and chart labels. | Playwright scan: Today, Review, Session and Transaction show 0 targets under 44px. The counts left on Money, Capture, Discover and Settings are segments and chips whose `hitSlop` is not in `getBoundingClientRect`. |
| 8 | 06 Motion · 140/240/420/800, no literals | Literal durations: Money expand 220/150, swipe exit 260, Capture 260/180/140, record pulse 720, Toast 240/180. The swipe spring-back used a literal spring. | Replaced them with `theme.motion.duration.{press,quick,count}` and `theme.motion.spring.thumb`. | `rg "duration: [0-9]"` now matches only the 28 s ambient drift, which is documented as ambient. |
| 9 | 07 · radii 10/14/20/28 | Decision card compare box used radius 12, the rail used 12, and the swatches used 21. | Changed to `radius.md` / `radius.pill`. Static StyleSheet radii (10, 14) are annotated with their token. | `DecisionCard.tsx` |
| 10 | 03 Layout 09 · font scale 1.3 reflow | Screen title, StatTile, Row and MixCard already reflow. The Today income/spent line could not wrap at 320pt. | Made that line `flexWrap` with row and column gaps. | `today-320.png` |
| 11 | 08 · Reduce Motion | Reanimated 4 layout animations, `withTiming` and `withSpring` default to `ReduceMotion.System`. `GlassPressable` and `AmbientBackground` check `useReduceMotion`. | No change needed; verified by reading the code. | — |
| 12 | 08 · Reduce Transparency | `GlassSurface` swaps to `glass.solid` and drops the sheen. | Not changed. The compact bar now gets this behaviour because it uses `GlassSurface`. | — |
| 13 | Android gradient stops (`552e103`) | `svgStop()` splits rgba into `rgb()` + `stopOpacity`. | Not changed. Both SVG layers keep this path, and the new tokens are rgba strings used only as `backgroundColor` (safe on native). | Code path in `GlassSurface.tsx` |

## Screenshots

`output/audit/design-audit/` (git-ignored), 390×844 and 320×844, each with a `-scrolled` variant taken after a 600px wheel scroll. That variant shows the compact header and the minimised dock:

`today`, `money`, `capture`, `review`, `review-session`, `discover`, `transaction`, `settings` → `<name>-<width>.png`, `<name>-<width>-scrolled.png` (32 files).

The data comes from the app's built-in `?ux=edge` local preview fixtures; no backend was used. Horizontal overflow was 0 on all 16 screen/width pairs, and there were no console errors or page errors.

## Gates

- `npx tsc --noEmit`: passed
- `npm run lint`: passed, 0 problems
- `npm run agent:harness -- --full`: `AGENT_HARNESS_OK` (all browser checks, UX smoke, review/capture/transaction/intelligence smokes)

`npm ci` was run first because the worktree had no `node_modules`. It used the lockfile, so no dependencies were added.

## Not changed / limitations

- I did not verify anything on an iOS or Android device. The native-sensitive items (nested-blur skip, Android blur gating, gradient stops, rgba tokens used only as background colours) are supported by the code paths described above, not by device runs.
- The live-blur count per screen was not measured. The nested-blur guard caps blurs at one per top-level surface, but a long list of top-level cards could still exceed about 6 on iOS and web. The prototype's "lists use one blurred group" approach was not attempted.
- On Money, the mini segmented control truncates "Ciclo" to "Ci…" at 390pt (`money-390-scrolled.png`). This is left for a copy or width decision.
- Some hex-alpha tint suffixes (`${color}1F`-style) are still used for tints computed from data. They are hex strings, so native colour handling is fine, but they are not named tokens.
- No copy, API, product model or routing changes, and no test assertions changed.
