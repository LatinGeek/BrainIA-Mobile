# Agent Instructions

These instructions apply to the whole repository.

## Encoding

- Prefer UTF-8 for reading, writing, and patching files.
- Avoid introducing mojibake. If existing text appears incorrectly encoded, preserve unrelated content and only fix encoding when the change is clearly in scope.

## Expo Mobile UX/UI Working Memory

Use the guidance in `docs/ux-ui-mobile-expertise-notes.md` before refining BrainIA-Mobile screens or components.
Use `docs/bibiz-reference-brief.md` as the active visual reference for current BrainIA-Mobile UI refinements.

### Product Taste

- BrainIA-Mobile should feel like a calm personal knowledge and finance app, not a backend dashboard or debug console.
- Current visual north star: Bibiz-style premium dark finance UI. Borrow its secure near-black surfaces, restrained electric-lime signal color, compact data density, and bold geometric hierarchy without copying wallet-specific brand assets or crypto metaphors.
- Prioritize readable density: compact, scannable, and structured, but never cramped.
- Hide backend concepts by default. Translate them into user language and put raw IDs, source metadata, graph terms, cache details, and diagnostics behind advanced/detail sections.
- Use progressive disclosure on complex screens: summary first, inspection second, technical/audit detail last.
- Treat Finance as a real sub-app with clear money hierarchy, trend context, categories, accounts, and transaction evidence.

### Mobile Interaction Standards

- Design for short, interrupted sessions. The first screen of each tab should answer the user's main question in under 10 seconds.
- Keep primary navigation consistent and visible. Bottom tabs should remain predictable and should not cover content.
- Use native-feeling controls where practical: Pressable feedback, platform-appropriate sheets/modals, segmented controls, switches, lists, and navigation affordances.
- Minimum interactive target: 44 x 44 React Native points for primary controls; never go below 24 x 24 without spacing and an equivalent larger target.
- Use `hitSlop` for small icon buttons while preserving visual alignment.
- Make touch feedback explicit with pressed states; use haptics sparingly for successful capture, destructive confirmation, warning/error, or mode selection.

### Accessibility And Responsiveness

- Every custom interactive element needs the correct accessibility role, label, state, and hint when the visible text does not explain the action.
- Respect system font scaling. Do not disable font scaling to solve layout problems. Test at larger font sizes and adjust layout, line height, wrapping, and vertical spacing.
- Use `useWindowDimensions()` for responsive layout decisions and font-scale-aware constraints.
- Maintain strong contrast for text, icons, charts, and status colors across light and dark themes.
- Do not encode meaning by color alone. Pair color with label, icon, position, or copy.
- Keep focus/order logical for screen readers; avoid nested accessible elements that make VoiceOver or TalkBack navigation confusing.

### Visual System

- Use semantic tokens from the theme layer instead of hardcoded colors, typography, spacing, or chart palettes.
- Prefer full-width sections, dividers, and list rows over nested cards. Cards are for distinct repeated objects, summaries, modals, or framed tools.
- Keep cards at the token radii (10/14/20/28) and minimal elevation. Avoid heavy shadows, decorative gradients, and generic purple SaaS styling.
- Typography should carry hierarchy: concise titles, readable body text, small metadata, and no oversized headings inside compact panels.
- Charts should use minimum necessary ink: clear labels, trend direction, formatted values, and no unlabeled decorative visualization.
- Use icons for familiar actions and pair them with labels when ambiguity would slow the user down.

### Implementation And QA

- Before significant UI edits, read the relevant screen docs in `docs/` and inspect existing component patterns.
- Keep UI changes scoped and validate in runtime, not only by static review.
- Required technical checks before a build or handoff after UI changes:
  - `npm run lint`
  - `npx tsc --noEmit`
  - `npm run agent:harness` (starts Expo web, runs static checks, and executes the browser smoke suite)
- Runtime QA should cover compact and standard/large phone widths, loading/empty/error states, long content, keyboard behavior, safe areas, and bottom-tab overlap.
- Any screen touched for UX/UI should be checked for text clipping, overflow, accidental technical copy, and accessibility labels on custom controls.
