# Theme System

## Goal

Every screen reads the same dark glass material. Components never hardcode a
colour, radius or duration; they consume `theme.glass`, `theme.motion`,
`theme.ambient`, the semantic `colors` and `status` blocks, and the typography
roles in `lib/themes.ts`.

The app is dark-only. There is one theme id, `intelligence-console`.

## Material tokens

`theme.glass` is additive. Old tokens keep their names until the migration is
complete, so screens that still read `theme.colors.surface` continue to work.

| Token | Values |
| --- | --- |
| `blur` | thin 12, regular 22, strong 36 |
| `fill` | thin `white .065 → .03`, regular `.11 → .035`, strong `.17 → .06` |
| `edge` | `rgba(255,255,255,.32)` → `rgba(255,255,255,.05)` |
| `inner` | `rgba(255,255,255,.06)` |
| `chromeBase` | `0.74` |
| `selected` | `rgba(246,249,248,.95)` |
| `onSelected` | `#0B1113` |
| `solid` | `#142124 / #1A2B2F / #22363B` |
| `divider` | `rgba(255,255,255,.08)` |

Rules:

- Real blur is reserved for `strong`/chrome on Android; other levels use the
  translucent fill.
- Android needs a real blur target: expo-blur 55+ renders only a translucent
  view unless the `BlurView` receives `blurTarget`. `Screen` wraps its content
  in a `BlurTargetView` and registers it; the dock, compact header and action
  bar blur that content. Non-chrome surfaces keep the fill to avoid blurring
  themselves inside the target.
- With Reduce Transparency on, every level uses `glass.solid` and no blur.
- No nested `BlurView` and no more than ~6 live blurs per screen.
- The specular edge is a one-pixel SVG stroke, not a second border.

## Motion tokens

`theme.motion` exposes four durations, a 45ms stagger and three curves:

| Token | Value |
| --- | --- |
| `duration.press` | 140 |
| `duration.quick` | 240 |
| `duration.enter` | 420 |
| `duration.count` | 800 |
| `stagger` | 45 |
| `spring.thumb` | damping 16, stiffness 220, mass .9 |
| `spring.press` | damping 18, stiffness 320 |
| `easing.out / in / soft` | `[.2,.8,.2,1] / [.4,0,1,1] / [.25,1.1,.4,1]` |

Legacy `fast`, `base`, `slow` and `spring` remain as aliases.

## Ambient field

`theme.ambient` defines the teal base (`#091315`), the second base
(`#0D1C1F`), three orbs (`#1F6E78`, `#24465A`, `#B9E85A`) and the ring
(`#5BB3BE`). `AmbientBackground` renders one field per screen. Drift is enabled
only on Today and stops when Reduce Motion is on.

## Colour

- Accent/live/positive: lime `#C4F54A`; `onAccent` is `#0B1205`.
- Income `#9FE870`, expense `#FF8E85`, transfer/user `#B5A8FF`, model
  `#74D7EE`, pending/review `#F6C65B`, captured `#AFBBC2`.
- Text: primary `#F4F7F6`, secondary 76% white, muted 58% white.
- Chart palette: lime, model, transfer, expense, pending, `#8FA3AD`.
- Selection is an opaque white pill, never lime. Lime is reserved for the
  primary action, live state, positive net and capture.

## Type

- Display and headlines: Poppins 600 (28/34 display, 17/23 headline).
- Body and captions: Inter 400/500/600.
- Numerals: Inter 700 with tabular figures, so counts do not jitter.
- Mono and overline: JetBrains Mono 500.

## Shape

Radius scale is 10 / 14 / 20 / 28, sheet 34, pill 999. Minimum target 44×44,
review answers at least 50. Dock height is 68 and scales to .86 while scrolling.

## Accessibility

- Reduce Transparency → solid material.
- Reduce Motion → no drift, presses resolve instantly, charts skip draw-in.
- Selected states change fill and text and set `accessibilityState.selected`.
- Font scale ≥ 1.3 reflows stat grids to one column and steps hero numerals down.
