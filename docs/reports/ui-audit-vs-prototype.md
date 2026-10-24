# UI/UX audit: mobile app vs glass prototype

Date: 2026-10-19 · Branch `glass/full-migration` · Reference: `docs/prototypes/glass-ui-prototype.html` (section 02 "Every screen" frames, 22 figures)

## Method and limits

- Web export (`expo export --platform web`) served locally, 390×844, with `?ux=edge` preview fixtures where available. Screens: Today, Dinero (Money), Capturar, Revisar, Review session, Explorar, Ajustes, Transaction.
- Prototype frames captured from the DOM (`figure.shot`) and compared side by side.
- Not covered: 320pt width, Dinero Accounts/Activity views, Review batch/category/"Why?" variants, Insight/Entity/Digest detail, dark/light, device blur. Discover and Settings were captured without fixtures, so they show empty or unavailable states. Those are not judged here.
- Screenshots: `output/audit/ui-audit/` (git-ignored).

## Verdict

The structure matches the prototype: the 5-tab dock, collapsing headers, the Capture pinned save, the review session card and the transaction facts grid are all close. The gaps are mostly content and copy, plus a few missing visual signals. Two items are copy-language issues, which need a product decision before a visual pass.

## Findings

Severity: **High** = visibly off-spec or inconsistent, **Med** = noticeable polish gap, **Low** = minor.

| # | Sev | Screen | Prototype | App | Recommendation |
|---|---|---|---|---|---|
| 1 | High | All | Single language across the frames (prototype is English) | Mixed Spanish and English on the same screen. Today hero: `Income` / `Spent` / `Positive` / `THIS CYCLE` (hardcoded in `app/(tabs)/index.tsx:150`), with `Ingresos` / `Gastos` in the tiles below. Transaction: `Category` / `Account` / `Time` / `Sources` next to Spanish copy. | Decide the copy language. The brief says "Spanish coming soon", so default to Spanish and localise hardcoded English strings. |
| 2 | High | Today | Net hero has a sparkline and two tiles (Income, Expenses) with arrows | Hero shows a text line `Income · Spent` and no sparkline. Finanzas tiles appear later in the page. | Add the sparkline (thin, lime, `dataviz` rules) and move the income/expense tiles into the hero, as in the frame. |
| 3 | High | Today | Highlight #1 is the "6 quick decisions to review" card, with an "UNRESOLVED" tag | Highlight #1 is a Food-delivery insight in the fixture. Review is added to `briefItems` (`index.tsx:60`) and sorts by data. | Pin the review highlight first while `pendingCount > 0`, as the prototype's "Review lives in the first highlight" says. |
| 4 | Med | Dock (all tabs) | Revisar carries a lime `6` badge on every frame | Badge appears only on some frames (Capture, Transaction, Settings) and is missing on Today, Dinero and Explorar. Likely because the pending count comes from the API, so this needs a check with data. | Confirm the badge reads `pendingReviews.length` on every tab and is not gated by the screen. |
| 5 | Med | Dinero · Overview | Expense mix is a multi-segment donut (Housing, Food, …) with the total in the centre and a legend | Single solid lime ring when the fixture has one group. Legend row is truncated (`Groceries and hous…`). | Use the category palette for segments. Shorten or wrap legend labels. Check that the lime ring is not the only encoding (colour is the only signal today). |
| 6 | Med | Dinero | Currency is `UYU` in the hero and amounts (`UYU 33,190`) | Mixed: `$` in the headline (`≈ $ 49.214,80`), `US$` in transactions, `UYU` in tiles. | Use one currency format across the app, per the `formatCurrency` contract. |
| 7 | Med | Transaction detail | Short title (`Tienda Inglesa`) fits in one line | Long merchant names wrap to three lines in Poppins at 28pt, pushing the amount and facts below the fold. | Clamp the title to two lines and move the full name to a subtitle. |
| 8 | Low | Capturar | Default is "Movement" compact mode with a large amount | Default is "Nota rápida" with an empty note field. Movement is the second tab. | Keep if note capture is the intended default; otherwise match the prototype. Product call, not a bug. |
| 9 | Low | Explorar | Search is pinned at the top with the graph focused beneath it | Layout matches, but the graph falls below the dock on short screens, and the header-search gap is wider than in the frame. | Tighten the spacing between the header and the search field to match the frame. |
| 10 | Low | Review session | Card, progress "1 of 6", swipe hint, Skip bottom-left | Matches closely. Progress bar and "Tidies 14 transactions" are present. | No change. Good match. |

## What already matches

- Dock: five tabs with the centre lime `+`, active pill and label, and the shrink on scroll (see `docs/reports/glass-design-audit.md`).
- Collapsing compact header with the blur bar.
- Review session: one question per card, lime answer button in the lower half, Skip with the "Swipe right to accept" hint.
- Capture: pinned lime save above the dock.
- Transaction: hero with the facts grid (Category, Account, Time, Sources).
- Settings: grouped rows with icon tiles.

## Suggested order

1. Copy language decision (finding 1). It affects most screens and should land before visual work.
2. Today hero: sparkline, tiles, and review-first highlight (2, 3).
3. Dock badge consistency and Money donut palette (4, 5).
4. Currency format and transaction title clamp (6, 7).
5. Re-capture at 320pt and with fixtures for Discover, Settings, Accounts/Activity and Review batch variants, to cover what this pass skipped.
