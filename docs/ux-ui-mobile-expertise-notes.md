# Mobile UX/UI Expertise Notes

## Purpose

This is the agent's working reference for future BrainIA-Mobile UX/UI refinement. It distills current mobile UX, accessibility, platform, and Expo/React Native guidance into practical rules for this app.

Confidence to proceed with future UI work: 96%.

## Sources Reviewed

- Apple Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines
- Apple HIG Accessibility: https://developer.apple.com/design/human-interface-guidelines/accessibility
- Apple HIG Typography: https://developer.apple.com/design/human-interface-guidelines/typography
- Apple HIG Color: https://developer.apple.com/design/human-interface-guidelines/color
- Material Design 3: https://m3.material.io/
- Android Developers, Material Design for Android: https://developer.android.com/develop/ui/views/theming/look-and-feel
- React Native Accessibility: https://reactnative.dev/docs/accessibility
- React Native Pressable: https://reactnative.dev/docs/pressable
- React Native useWindowDimensions: https://reactnative.dev/docs/usewindowdimensions
- React Native PixelRatio: https://reactnative.dev/docs/pixelratio
- Expo UI: https://docs.expo.dev/versions/latest/sdk/ui/
- Expo Haptics: https://docs.expo.dev/versions/latest/sdk/haptics/
- W3C WCAG2Mobile guidance for WCAG 2.2: https://www.w3.org/TR/wcag2mobile-22/
- W3C WCAG 2.2 Target Size Minimum: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- Nielsen Norman Group Mobile UX study guide: https://www.nngroup.com/articles/mobile-ux-study-guide/
- Nielsen Norman Group Mobile UX limitations and strengths: https://www.nngroup.com/articles/mobile-ux/
- Nielsen Norman Group touch target research: https://www.nngroup.com/articles/touch-target-size/
- Nielsen Norman Group mobile navigation patterns: https://www.nngroup.com/articles/mobile-navigation-patterns/

## Distilled Judgment

BrainIA-Mobile should optimize for clarity under interruption. Mobile users have small screens, short sessions, touch input, variable connectivity, and fragmented attention. The app should make the next useful thing obvious without hiding important depth.

The right UX posture is "personal knowledge ledger":

- calm enough for daily use
- trustworthy enough for finance
- fast enough for capture and search
- rich enough for insights and graph-backed explanations
- approachable enough for a non-technical user

## Platform Taste

### iOS

- Use clarity, deference, and depth as the default taste filters.
- Let content lead; chrome should support orientation, action, and hierarchy.
- Use system-like navigation, sheets, lists, grouped settings, and semantic colors where they fit.
- Typography should adapt to Dynamic Type. Custom font choices must preserve legibility and hierarchy at larger accessibility sizes.

### Android

- Respect Material conventions for components, color roles, elevation restraint, navigation, and touch feedback.
- Support dark theme and adaptive/responsive layout assumptions.
- Do not force iOS-only visual patterns onto Android when a native Android expectation exists.

### Expo/React Native

- Prefer React Native primitives and Expo SDK capabilities before adding extra UI dependencies.
- `@expo/ui` can be useful for native SwiftUI/Jetpack Compose-backed components, but use it deliberately because it is a bridge to platform-native UI, not a universal replacement for the design system.
- Use `expo-haptics` as interaction punctuation, not as constant decoration.

## Practical Heuristics

### Information Architecture

- Each tab should answer one user question:
  - Today: what matters now?
  - Search: what do I know about this?
  - Capture: how do I add this quickly?
  - Finance: where did my money go?
  - Review: what needs my decision?
- Use bottom navigation consistently for primary app areas.
- Avoid putting rare diagnostics, settings, or advanced controls in top-level flows.
- Preserve visible wayfinding: clear screen title, current time window/filter, selected tab, and back path.

### Layout

- Start every screen with a high-signal summary, then supporting lists/details.
- Use a spacing scale and stable dimensions for tabs, controls, metrics, chips, list rows, charts, and icon buttons.
- Avoid card nesting. Use sections and dividers for hierarchy inside a screen.
- Design compact phones first, then ensure larger phones gain room without becoming sparse.
- Keep keyboard interactions ergonomic on Capture and Search.

### Touch

- Aim for 44 x 44 point targets for all primary actions and icons.
- Use `hitSlop` for visually small icon controls.
- Keep competing targets separated enough to avoid accidental activation.
- Pressed states should be visible. Disabled states should be clear but still readable.
- Gestures must have visible alternatives. Do not make swipe-only actions mandatory.

### Accessibility

- Use `accessibilityRole` for custom buttons, tabs, switches, search fields, alerts, headers, and progress indicators.
- Use `accessibilityLabel` when icon-only or composed controls do not have a clear text label.
- Use `accessibilityState` for selected, disabled, checked, expanded, busy, and mixed states.
- Use `accessibilityHint` only when the result of activating the control is not obvious.
- Make dynamic updates polite unless they are urgent.
- Respect system font scaling. If text overflows, improve the layout instead of turning scaling off.
- Test long names, long amounts, large fonts, and bilingual strings.

### Typography

- Use typography roles, not ad hoc font sizes.
- Separate title, section heading, body, label, metadata, and mono/numeric roles.
- Avoid huge hero type inside mobile app dashboards; it wastes space and harms scan speed.
- Use tabular or consistent numeric treatment for money, counts, and metrics.
- Metadata should not compete with primary values.

### Color

- Use semantic color tokens only.
- Maintain contrast across surfaces, text, icons, chart strokes, and status chips.
- Pair status color with text or icon. Red/green alone is not enough.
- Keep finance semantics consistent: income, expense, neutral, warning, danger, success.
- Avoid one-note palettes and generic purple/blue gradient tech styling.

### Motion And Haptics

- Use short, functional motion for state changes, transitions, expansion, selection, and feedback.
- Avoid motion that delays reading or capture.
- Haptics should map to meaning:
  - selection: tab/mode selection when meaningful
  - success: capture saved, review accepted
  - warning/error: failed action or destructive warning
  - impact: intentional drag/drop or key confirmation

### Finance UX

- Always make direction obvious: income vs expense vs transfer.
- Format money consistently with currency and sign.
- Show trend context next to metrics, not buried in charts.
- Let categories, merchants, accounts, and transaction lists cross-link.
- Evidence should build trust, but stay secondary until the user opens transaction detail.

### Knowledge UX

- Translate graph terms into normal language.
- Entity screens should start with "what this is" and "why it matters", not aliases or IDs.
- Insights should feel like readable artifacts with title, summary, takeaways, and supporting data.
- Digests should be time-window summaries, not raw activity dumps.

### Capture UX

- Default capture should be possible in two steps: type, submit.
- Source-specific fields should appear only after the user picks or implies a type.
- Success state should be immediate and low-friction.
- Preserve user's typed content if submit fails.

### Review UX

- Review items should explain the detected issue, suggested decision, and future effect.
- Actions should be explicit: accept, edit, ignore, later.
- Avoid backend words like canonical, descriptor, root, queue, reprocess, and normalized unless inside Advanced.

## Runtime QA Checklist

Use this after any substantial UI change:

- Compact phone width works.
- Standard/large phone width works.
- Safe areas are respected.
- Bottom tabs do not cover scroll content.
- Text wraps without clipping at larger font sizes.
- Loading, empty, error, and partial-data states are present.
- Icon-only controls have accessibility labels.
- Custom controls have roles and selected/disabled/busy states.
- Tap targets are comfortable.
- Charts have readable labels and formatted values.
- No raw IDs, backend names, or debug metadata appear in primary UI.
- `npm run lint`, `npx tsc --noEmit`, and `npm run smoke:web` pass before release/build handoff.

