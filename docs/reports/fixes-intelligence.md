# Intelligence design audit fixes

Task: `task_4b7aaf2d6559` · Dispatch: `ctx_cc42166c146e`.

## Findings fixed

- **N1–N7:** initial library skeleton and gated empty state; separate list and submit errors with correct recovery; wrapping prompt chips; top-aligned 88dp composer; Spanish copy; refresh spinner; separate “En curso” section.
- **K1–K15:** detail skeleton; explanations and refresh actions for all terminal states including insufficient; selected, disabled feedback radio choices and toast confirmation; transient action/save toasts; short confirm/undo labels; existing Spanish overline/source fallback preserved; top-aligned notes; refresh spinner; status-keyed content fade using theme motion; conclusions section and explicit icons; polling only while focused; unlimited text rows grouped in glass with final dividers removed and token radii; compact centered cancel button; spacing tokens.
- **A1–A5:** ArtifactCard uses SignalCard’s press path and one surface; status appears once as a Tag; Spanish kind labels; neutral cancelled/insufficient status; removed strip literals.
- **C1–C9:** shorter mode labels; financial category reset on kind changes; caught category creation failures and visible sheet empty/error states; dictation button inside Field with danger recording state; neutral tuteo; radio choices without dismiss icons; spacing tokens; “Transferencia”; success toast and inline error text.

## Skipped / deviations

- **N8:** focus-on-prompt requires ref forwarding through shared `components/controls/index.tsx` Field, outside this worker’s permitted files. Prompt selection still sets the question; coordinator can add the shared API and wire focus in a follow-up.
- **N9:** linking intelligence from Search/Today requires editing another worker’s screen and a product placement choice; not changed.
- **C6 / K3:** added a small `ChoiceChip` in the owned intelligence component file: GlassPressable radio semantics around a static selected Chip, with disabled state. This avoids changing the shared Chip API or using SegmentedControl’s non-scrolling `scrollable` layout for long labels.
- **K6 / K7:** Spanish “Fuente” and “Conocimiento” were already present and retained.
- Multiline height uses `theme.layout.minTarget * 2` (88dp) rather than a numeric literal. Category creation now selects/closes only after successful persistence, so a failed request does not masquerade as a saved category.
- Shared Section collapse motion and shared copy/defaults were not edited.

## Files changed

- `app/intelligence/index.tsx`
- `app/intelligence/[id].tsx`
- `components/intelligence/index.tsx`
- `components/intelligence/CorrectionPanel.tsx`
- This report.

Existing repository changes, including the detail note draft handling, were preserved. UTF-8 and LF source encoding were verified.

## Verification

- `npm run lint -- app/intelligence/index.tsx "app/intelligence/[id].tsx" components/intelligence/index.tsx components/intelligence/CorrectionPanel.tsx`: **passed**, exit 0, no warnings/errors on final run. An earlier React Compiler dependency warning was fixed by capturing the primitive artifact status outside the focus callback.
- `npx tsc --noEmit`: **passed**, exit 0, no diagnostics on the final run. Earlier concurrent runs reported temporary errors in other workers’ files: `app/digest/[id].tsx:34,40` (optional arrays), `app/entity/[id].tsx:83` (nullable string), `app/event/[id].tsx:99` (missing Button onPress), `app/settings.tsx:303` (ordinalDay).
- `git diff --check --` the four owned files: **passed**.
- Source review checked state gating, radio accessibility/disabled state, poll cleanup, token use, and retained drafts. No APK build, device/adb operation, commit, stash, reset, or clean was performed. Device rendering was not part of this verification.
