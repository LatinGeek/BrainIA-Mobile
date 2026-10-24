# Glass design polish: W0 baseline

Read-only baseline. No source files were modified, and no screenshots were taken in this step. The prior captures in `output/audit/design-audit/` come from the earlier audit pass and are git-ignored.

## Repository state

- Branch: `LatinGeek/glass-design-polish`
- HEAD: `fe0c8b5d660b6ccb8e7e6f526fe932431e0f9bdf` (fix(glass): fit Today tile amounts, untruncate Money period toggle, cap review card)
- Pre-existing changes: none tracked. One untracked file: `docs/reports/glass-design-polish-plan.md`. This report adds `docs/reports/glass-design-polish-baseline.md`.
- `node_modules` was already present, so `npm ci` was not run.

## Gates

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` (`tsc --noEmit`) | exit 0, no errors |
| Lint | `npm run lint` (`expo lint`) | exit 0, no problems |
| Tests | none: `package.json` has no `test` script | n/a |
| Harness (closest test suite) | `npm run agent:harness -- --full` | exit 0, `AGENT_HARNESS_OK` (EDGE/ERROR/LOADING checks, `UX_SMOKE_OK`, `INTELLIGENCE_UI_OK`) |

## Gap list vs prototype sections 03–08

The earlier audit (`docs/reports/glass-design-audit.md`) already closed its findings 1–13 and F1–F3. The gaps below are what remains. Items marked "verify" were inferred from code and still need a screenshot or device check.

| # | Screen / component | Section | Gap | Likely owner file(s) | WS |
|---|---|---|---|---|---|
| 1 | Screen / Section | 05 repl | Aliases are still exported: `AppScreen`, `AppShell`, `TopBar`, `ScreenHeader`, `SectionHeader`, `SectionTitle`, `DetailBlock`, `DisclosureSection`. The prototype says to delete them. | `components/layout/Screen.tsx`, `components/index.ts` | W4 |
| 2 | Row | 05 repl | `TransactionRow` is still a separate export and is used by Today, Money and Search. Check whether it is a thin `Row` wrapper or a duplicate. | `components/data/Row.tsx`, `app/(tabs)/{index,financials,search}.tsx` | W4 |
| 3 | Graph | 05 repl | `components/knowledge/GraphExplorer.tsx` and `GraphForceCanvas.tsx` live outside the 24-component system. `Graph` wraps them instead of replacing them. | `components/knowledge/*`, `components/data/Graph.tsx` | W4 |
| 4 | Extra component folders | 05 | `components/intelligence/` (CorrectionPanel) and `Telemetry.tsx` are not in the 24-component list. Decide whether to keep them as non-UI or fold them in. | `components/intelligence/*`, `components/Telemetry.tsx` | W4 |
| 5 | Graph canvas | 07 "no hardcoded colours" | About 10 literal hex colours (palette, background, link and label fills) are not themed or light-mode aware. | `components/knowledge/GraphForceCanvas.tsx`, `lib/themes.ts` | W1 (token) + W4 |
| 6 | Data-derived tints | 07 | `${color}1F`-style hex-alpha suffixes are still used and are not named tokens (open item from the audit). | `lib/themes.ts`, call sites in `components/data/*` | W1 |
| 7 | Glass lists | 08 "lists use one blurred group", ≤6 live blurs | Not attempted. Long lists of top-level cards can exceed about 6 blurs. The blur count was never measured. | `components/glass/GlassSurface.tsx`, list screens | W1 / W3 |
| 8 | Layout 09 large text | 03 (status: proposed) | StatTile, Row, MixCard and the Screen title reflow at fontScale ≥ 1.3. Not verified: the four review counters, Money tiles and DecisionCard at 1.3+. | `components/data/StatTile.tsx`, `app/(tabs)/review.tsx`, `components/review/DecisionCard.tsx` | W2 |
| 9 | Targets via hitSlop | 07 min target 44 | Segments and chips reach 44 only through `hitSlop`, which the Playwright scan cannot measure. Needs a different check (for example a pressable-rect probe). | `components/controls/index.tsx` | W4 / W6 |
| 10 | Review session | 04 | Fixture cards leave about 200pt of empty space inside the 540pt card at 390. Verify the "Why?" inline expand, keyboard keys 1–3/Z/Esc and screen-reader custom actions against the section 04 table. | `app/review-session.tsx`, `components/review/DecisionCard.tsx` | W3 |
| 11 | Motion | 06 | Literal durations are gone (12 `duration:`/hex hits remain, mostly `+html.tsx` and the graph canvas). Not verified: the stagger token on list entry, and Graph node pop-in using the motion tokens. | `components/data/Graph.tsx`, list screens, `lib/themes.ts` | W5 |
| 12 | Native behaviour | 08 | Nested-blur skip, Android blur gating, gradient stops and Reduce Transparency are supported by code paths only. Nothing was verified on a device. | `components/glass/*` | W6 |
| 13 | Screenshot diffs | Plan acceptance | No per-screen diff against the prototype exists yet. The earlier captures are app-only. | `output/audit/` | W6 |

## Blockers and limitations

- There is no `test` script. The harness is the only automated behavioural suite.
- Live data returns `insufficientscope`, so only the `?ux=edge` preview fixtures can be checked.
- No device (iOS or Android) is available in this step.
- No Orca workers were launched; this step was run directly.
