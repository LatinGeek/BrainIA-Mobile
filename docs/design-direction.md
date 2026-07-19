# Design Direction

> **Update 2026-07-14:** The active visual north star is now the Stitch project
> **"BrainIA Second Brain System"** (Stitch `projects/17053346601361389369`, design system
> "Technical Precision"): slate `#0B1326` canvas, indigo `#4F46E5` intelligence accent,
> emerald/rose money signals with directional icons, Inter + JetBrains Mono, 4–10px radii,
> tonal layering with hairline outlines. Screen references live in
> `docs/design-reference/stitch/`. The implemented theme is `intelligence-console`
> ("Technical Precision") in `lib/themes.ts`. The Bibiz lime direction below is superseded
> but kept for history.

## Goal

Define a visual language for BrainIA-Mobile before implementation starts.

The product should feel like a calm, high-density intelligence console for one user, not like a generic social app or a noisy finance app.

## Recommended direction

### Name

Premium Intelligence Wallet

### Summary

Combine:

- Bibiz-style premium dark finance UI
- Linear-style speed and structure
- Monzo-style financial clarity
- Stripe-style dashboard hierarchy
- Notion-style calm knowledge surfaces

This gives the app:

- strong information hierarchy
- compact data-rich layouts
- fast scanning
- financial trust
- second-brain feel instead of app-store noise
- secure, polished, high-contrast mobile surfaces

## Inspirations

### Bibiz

Why it fits:

- premium near-black mobile finance language
- compact wallet-like data hierarchy
- electric lime used as a confident action and status signal
- strong brand discipline without visual clutter
- security and trust expressed through restraint

What to borrow:

- black, coal, graphite, silver, and lime palette direction
- bold geometric headings paired with readable body text
- dense card and list layouts with clear primary values
- minimal line charts and compact signal labels
- bottom navigation that feels tool-like and precise

What not to borrow:

- crypto-specific imagery or terminology
- logo, mascot, NFT, or token visuals
- wallet flows that do not match BrainIA's knowledge and finance model

Source:

- [Bibiz - Timeless Crypto Wallet](https://www.behance.net/gallery/215243743/Bibiz-Timeless-srypto-Wallet)

### Linear

Why it fits:

- disciplined spacing
- strong typographic hierarchy
- fast command-oriented navigation
- mobile redesign with a bottom toolbar and frosted glass material

What to borrow:

- compact cards
- crisp dividers
- quick action affordances
- bottom navigation with dense but readable content

Source:

- [Linear homepage](https://linear.app/)
- [Linear mobile app](https://linear.app/mobile)
- [Linear mobile redesign changelog](https://linear.app/changelog/2025-10-16-mobile-app-redesign)

### Monzo

Why it fits:

- financial home screen as a core product surface
- clear money summaries
- friendly but not childish tone
- strong emphasis on full financial picture

What to borrow:

- summary-first dashboards
- category and account breakdowns
- transaction clarity
- gentle color accents for money states

Source:

- [Monzo homepage](https://monzo.com/)
- [Monzo home screen blog](https://monzo.com/blog/how-we-built-the-new-home-screen)

### Stripe

Why it fits:

- operational dashboard clarity
- strong charting and metric surfaces
- search and command efficiency
- enterprise-grade trust

What to borrow:

- dashboard blocks with clear labels
- metric cards
- charts that do not fight the content
- pragmatic visual hierarchy

Source:

- [Stripe homepage](https://stripe.com/)
- [Stripe Dashboard docs](https://docs.stripe.com/dashboard/basics)

### Notion

Why it fits:

- knowledge-base mental model
- calm page-like navigation
- good fit for second-brain content

What to borrow:

- page-like detail views
- structured content sections
- subtle hierarchy
- easy backtracking through content

Source:

- [Notion homepage](https://www.notion.so/)
- [Notion for mobile](https://www.notion.so/help/notion-for-mobile)
- [Notion sidebar navigation](https://www.notion.so/help/navigate-with-the-sidebar)

## Visual principles

- use a restrained color palette
- use the Bibiz reference as the current visual north star for premium dark refinements
- use electric lime sparingly for primary actions, selected states, live/safe signals, and the strongest data emphasis
- prioritize strong contrast and readability
- keep cards and sections visually consistent
- avoid decorative clutter
- avoid a generic purple SaaS look
- use one dominant accent color and one supporting status palette
- keep charts and tables compact
- reserve heavy motion for meaningful transitions

## Interaction principles

- home screen should answer "what matters now"
- search should be immediate
- capture should require minimal friction
- detail screens should reveal depth progressively
- operational actions should be explicit and reversible when possible

## Proposed layout language

- top app bar with concise title and utility actions
- bottom tabs for primary areas
- card-based dashboard
- section headers with summary metadata
- lightweight filters as chips
- detail pages with stacked blocks and expandable sections
- charts that use the minimum necessary ink

## Suggested tone

- precise
- calm
- trustworthy
- analytical
- dense without feeling crowded

## What not to do

- no generic gradient-heavy fintech look
- no playful consumer color chaos
- no empty spacious layout that wastes screen real estate
- no heavy shadow soup
- no overuse of glassmorphism
- no UI that hides the data behind visual effects

## Practical recommendation

If we need a single north star, use this:

BrainIA-Mobile should feel like Bibiz for premium dark mobile finance presence, Linear for structure, Monzo for money clarity, Stripe for dashboards, and Notion for knowledge.
