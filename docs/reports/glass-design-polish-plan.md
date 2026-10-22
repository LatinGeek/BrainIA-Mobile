# Glass design polish: orchestrated plan

Status: approved in part. Owner decisions so far:
- Coding tasks: Codex (Terra). UI/design tasks: Opus 5.5.
- Base branch: `LatinGeek/glass-design-polish` (current worktree branch). Assumed; not yet confirmed.
- Device testing: open. Until a valid token is provided, use preview fixtures or skip live-data screens and say so in the report.

## Acceptance criteria

- Every screen matches prototype sections 03 (layout), 04 (review), 05 (components), 06 (motion), 07 (tokens), 08 (handoff).
- `components/` contains exactly the 24-component system; each `repl` entry is covered.
- 44pt minimum targets, WCAG AA text contrast, reduce-motion honored.
- Typecheck, lint and tests run green. Claims are backed by commands that actually ran.
- Screenshot diffs against the prototype are saved per screen.
- Blockers listed in the final report (live data returns `insufficientscope`).

## Orchestration

- Coordinator: Opus 5.5.
- Before any `orca orchestration` call: `orca skills get orchestration`, and verify syntax against the installed runtime.
- Workers:
  - Codex (Terra), medium effort: engineering, state and data wiring, refactors, debugging.
  - Opus 5.5, medium effort: tokens, chrome, layout, screen visuals, motion, accessibility design.
  - OpenCode / Luna, low effort: baseline inventory and deterministic gate runs.
- Concurrency: at most 3 or 4 workers at once.
- Git safety: no bare `git stash`, no `reset --hard`, no `clean -fd`. Record HEAD and pre-existing changes before writing.

## Workstreams

- **W0 Baseline (read-only, first):** run gates; capture screenshots of prototype sections 03–08 against the app; produce a gap list with file owners.
- **W1 Tokens and chrome (sequential):** `lib/themes.ts`, `glass.chrome`, `theme.layout`, `theme.motion`. Blocks everything else.
- **W2 Layout (section 03):** Dock, NavigationRail, Screen header, nine layout changes. Depends on W1.
- **W3 Screens (parallel, disjoint files):** Today (`app/(tabs)/index.tsx`), Money (`app/(tabs)/financials.tsx`), Explorar/Search, Transaction detail (`app/transaction/[id].tsx`), Capture (`components/capture/CaptureForm.tsx`), Ajustes, Review session (`app/review-session.tsx`, `DecisionCard.tsx`). Depends on W1 and W2.
- **W4 Components and accessibility:** 24-component `repl` check, targets, contrast. Stays on component files so it can run alongside W3.
- **W5 Motion (section 06):** depends on W1.
- **W6 Verification:** Playwright visual diff vs prototype, gate run, device check if possible.

## Worker contract

Every worker gets: objective and prototype section; owned files only; deliverable (commit on workstream branch + short report); acceptance (screenshot matches, gates pass); exact verification commands; escalation if a shared token or contract must change.

Coordinator inspects each diff and reruns gates before marking a workstream settled.

## Integration

- Merge W1, then W2, then parallel streams; rerun gates after each merge.
- Final report goes to this file's sibling `docs/reports/glass-design-audit.md`: worker assignments, verified models (from launch receipts), gate results, screenshots, limitations.

## Risks

- Backend auth (`insufficientscope`) blocks live-data verification on device.
- Windows gates may need `npm ci` in the worktree and global binaries.
- CRLF line endings: keep consistent to avoid noisy diffs.
- Opus cost: keep worker count low.
