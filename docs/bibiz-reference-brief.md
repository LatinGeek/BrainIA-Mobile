# Bibiz Reference Brief

## Purpose

Use the Behance project "Bibiz - Timeless Crypto Wallet" as the current visual reference for BrainIA-Mobile UI refinement.

Source:

- https://www.behance.net/gallery/215243743/Bibiz-Timeless-srypto-Wallet

## Why It Fits BrainIA

Bibiz presents finance as secure, premium, compact, and high-signal. That overlaps with BrainIA-Mobile's goal of feeling like a personal knowledge and finance console rather than a generic dashboard.

The reference should influence visual language, hierarchy, and interaction density. Do not copy brand assets, logos, layouts, screenshots, or proprietary compositions.

## Reference Traits To Borrow

- Premium near-black interface with confident contrast.
- Electric lime as the primary action and live-signal color.
- Monochrome gray surfaces with small hue variation, not a colorful palette.
- Large, crisp financial/data moments supported by compact labels.
- Dense cards and lists with strong grouping and minimal decoration.
- Rounded but disciplined containers; avoid soft consumer-app pill overload.
- Strong bottom navigation with compact icon labels.
- Data visualizations that are sparse, thin, and purposeful.
- Security/trust posture: polished, calm, and precise.
- Headings with Poppins-like geometric boldness; body text with Inter-like readability.

## BrainIA Translation

### Home

- Lead with one high-signal summary block, then compact supporting signals.
- Daily brief should feel like a priority scanner, not a paragraph feed.
- Avoid low-value placeholder insight cards; omit weak content rather than filling space.

### Money

- Treat the main balance/net movement as the visual anchor.
- Use lime for active/safe/positive emphasis, not every finance element.
- Expense/warning states may use warmer accents, but keep them subordinate to the dark/lime system.
- Keep charts minimal: thin line or bar forms, clear labels, no decorative chart chrome.

### Search

- Use compact command/search controls with immediate result grouping.
- Prioritize strong result titles and restrained metadata.

### Capture

- Make the primary capture action feel obvious and fast.
- Avoid dense forms until the user selects a specific capture mode.

### Review

- Review decisions should feel like trust and cleanup work, not admin queue processing.
- Use direct action language and compact decision cards.

## Visual Guardrails

- Do not make the app one-note neon. Lime should be a signal color with restraint.
- Do not add crypto-specific imagery, token metaphors, pixel mascots, or blockchain jargon.
- Do not copy the Bibiz logo, NFT screens, or wallet-specific components.
- Do not replace BrainIA's product model with a wallet model.
- Maintain accessibility contrast and readable text at larger font scales.
- Preserve the semantic theme system; screens should consume tokens, not hardcoded Bibiz colors.

## Token Direction

When refining the `intelligence-console` theme, bias toward:

- `background`: true black or near black.
- `surface`: coal black.
- `surfaceRaised`: graphite.
- `surfaceSubtle`: dark gray.
- `accent`: electric lime.
- `accentSoft`: dark olive/lime wash.
- `textPrimary`: white/platinum.
- `textSecondary`: silver.
- `textMuted`: chrome/gray.

Suggested reference values:

- Black: `#000000`
- Coal: `#161616`
- Graphite: `#1E1E1E`
- Gray: `#2C2C2C`
- Silver: `#D7D7D7`
- Platinum: `#E7E7E7`
- White: `#F2F2F2`
- Lime: `#BBFF00`

## Implementation Checklist

Before shipping a UI refinement inspired by this reference:

- The screen still answers the BrainIA user question first.
- Primary data is larger and clearer than supporting metadata.
- Cards are compact and purposeful.
- Lime is limited to primary actions, live status, selection, and the most important signal.
- Placeholder, backend, or generic copy is removed from primary UI.
- The result passes `npm run lint`, `npx tsc --noEmit`, and relevant runtime/smoke checks.
