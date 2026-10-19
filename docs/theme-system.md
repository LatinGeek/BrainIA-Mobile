# Theme System

## Goal

BrainIA-Mobile debe poder cambiar de lenguaje visual sin reescribir pantallas ni componentes.

La app tendra una capa de tema base y varias variantes intercambiables:

- Editorial Minimal
- Intelligence Console
- Warm Knowledge

La referencia visual activa para refinamientos actuales es `docs/bibiz-reference-brief.md`.

## Design principle

Los componentes no deben conocer colores o tipografias concretas.

Solo deben consumir tokens semanticos:

- `background`
- `surface`
- `surfaceRaised`
- `border`
- `textPrimary`
- `textSecondary`
- `textMuted`
- `accent`
- `accentSoft`
- `success`
- `warning`
- `danger`
- `chartPrimary`
- `chartSecondary`
- `chartTertiary`

El tema decide como se ven esos tokens.

## Architecture

### 1. Base tokens

Tokens comunes para toda la app:

- spacing scale
- radius scale
- shadow scale
- motion scale
- typography roles
- icon sizing
- chart sizing

### 2. Semantic tokens

Mapean la intencion de UI a color y tipografia.

Ejemplo:

- `surface` es la tarjeta principal
- `surfaceRaised` es una tarjeta o sheet secundaria
- `textPrimary` es el texto principal
- `accent` es la accion principal
- `border` es la separacion visual entre bloques

### 3. Theme variants

Cada variante redefine solo el mapeo de tokens semanticos y algunos estilos de componentes.

### 4. Component recipes

Los componentes usan los tokens semanticos y no valores hardcodeados.

## Theme registry

La app deberia tener un registro central de temas.

Ejemplo conceptual:

```ts
type ThemeId = "editorial-minimal" | "intelligence-console" | "warm-knowledge";

type Theme = {
  id: ThemeId;
  name: string;
  colors: Record<string, string>;
  typography: Record<string, string>;
  radius: Record<string, number>;
  shadows: Record<string, object>;
};
```

## Theme selection

El tema activo se resuelve en este orden:

1. preferencia del usuario
2. override de preview o experimentacion
3. tema por defecto del producto

Para BrainIA-Mobile el default sera:

- `Intelligence Console`

## Concrete theme definitions

### Editorial Minimal

### Intent

Calma, precision y densidad legible.

### Color system

- `background`: `#F7F5F0`
- `surface`: `#FFFFFF`
- `surfaceRaised`: `#F1EDE5`
- `surfaceSubtle`: `#ECE7DD`
- `border`: `#D8D2C7`
- `textPrimary`: `#111111`
- `textSecondary`: `#444444`
- `textMuted`: `#6C675F`
- `accent`: `#00B8E6`
- `accentSoft`: `#D7F5FB`
- `success`: `#1D7A54`
- `warning`: `#A86B00`
- `danger`: `#C23A3A`

### Typography

- `display`: `Sora`
- `headline`: `Sora`
- `body`: `Manrope`
- `caption`: `Manrope`
- `mono`: `IBM Plex Mono`

### Shape and motion

- radius: medium to rounded, but disciplined
- shadows: soft and minimal
- motion: short and subtle

### Component feel

- cards are compact and structured
- dividers are thin and visible
- charts are understated
- action buttons are crisp and minimal

### Intelligence Console

### Intent

Premium, tecnologica y de alta densidad visual. Esta variante debe acercarse al lenguaje Bibiz: finanzas oscuras, seguras, compactas y con lima electrica como senal principal.

### Color system

- `background`: `#000000`
- `surface`: `#161616`
- `surfaceRaised`: `#1E1E1E`
- `surfaceSubtle`: `#2C2C2C`
- `border`: `#3A3A3A`
- `textPrimary`: `#F2F2F2`
- `textSecondary`: `#D7D7D7`
- `textMuted`: `#8E8E8E`
- `accent`: `#BBFF00`
- `accentSoft`: `#263600`
- `success`: `#51D17F`
- `warning`: `#FFB84D`
- `danger`: `#FF6B6B`

### Typography

- `display`: `Poppins`
- `headline`: `Poppins`
- `body`: `Inter`
- `caption`: `Inter`
- `mono`: `JetBrains Mono`

### Shape and motion

- radius: slightly sharper
- shadows: controlled glow and depth
- motion: a little more pronounced than Editorial Minimal

### Component feel

- cards are compact, dark, and layered with minimal borders
- lime is reserved for primary actions, active selections, live/safe status, and key chart strokes
- charts are thin, sparse, and data-first
- numeric values can be large and confident, with compact supporting labels
- avoid decorative glow, crypto imagery, and wallet-specific metaphors unless the product surface genuinely needs them

### Warm Knowledge

### Intent

Editorial, calm and human.

### Color system

- `background`: `#F5EBDD`
- `surface`: `#FFF9F1`
- `surfaceRaised`: `#F0E0CB`
- `surfaceSubtle`: `#E5D3B8`
- `border`: `#D4C0A5`
- `textPrimary`: `#1F1B16`
- `textSecondary`: `#51473F`
- `textMuted`: `#75695E`
- `accent`: `#D88A2B`
- `accentSoft`: `#F7E3BE`
- `success`: `#2C7A59`
- `warning`: `#C17C12`
- `danger`: `#B84A3A`

### Typography

- `display`: `Fraunces`
- `headline`: `Fraunces`
- `body`: `Manrope`
- `caption`: `Manrope`
- `mono`: `IBM Plex Mono`

### Shape and motion

- radius: softer and more organic
- shadows: warm, paper-like
- motion: slow and gentle

### Component feel

- cards feel like paper sheets
- sections have more breathing room
- charts are softer and less technical
- navigation feels less sharp and more editorial

## Layout tokens

### Spacing

- `xs`: 4
- `sm`: 8
- `md`: 12
- `lg`: 16
- `xl`: 24
- `2xl`: 32
- `3xl`: 40

### Radius

- `sm`: 10
- `md`: 14
- `lg`: 18
- `xl`: 24

### Elevation

- `flat`
- `raised`
- `floating`

## Core component system

The first shared components should be implemented as theme-aware recipes:

- `AppShell`
- `TopBar`
- `BottomTabs`
- `SummaryCard`
- `MetricCard`
- `InsightCard`
- `DigestCard`
- `FinancialSnapshotCard`
- `ChartCard`
- `ListRow`
- `FilterChip`
- `EntityPill`
- `SectionHeader`
- `DetailBlock`
- `ActionRow`
- `EmptyState`
- `ErrorState`
- `LoadingSkeleton`

## Component rules

- cards read from semantic tokens only
- chart colors come from theme palettes, not hardcoded values
- typography variants map to tokens, not raw font names in components
- spacing must come from the spacing scale only
- icon colors must follow semantic meaning

## Theme switching

The app should support theme switching without code changes in screens.

Recommended mechanism:

- store selected theme id in user settings
- load theme from registry at app bootstrap
- allow preview mode for testing
- keep the default theme aligned with the current premium dark direction unless changed deliberately

## Future proofing

To support future themes safely:

- keep token names stable
- version the theme contract
- avoid using color literals in feature code
- add contrast checks for text and surfaces
- define chart and status palettes per theme
- keep component recipes theme-neutral

## Implementation order

1. define token types
2. define semantic theme registry
3. implement shared primitives
4. wire Intelligence Console as default
5. add theme switch settings
6. add Intelligence Console and Warm Knowledge variants

## Recommendation

Build the app on top of the semantic token layer from day one.

That gives us:

- a stable product shell
- easy theme swaps
- less UI rewrite cost later
- room for visual experimentation without affecting behavior

## Glass tokens (current)

`lib/themes.ts` is the source of truth. The glass frontend (see `docs/glass-frontend-integration-plan.md`) adds:

| Group | Tokens | Use |
| --- | --- | --- |
| `glass.blur` | `thin 12`, `regular 22`, `strong 36` | Blur radius per glass level. Never animate it. |
| `glass.fill` | two-stop gradients per level | Fill over the blur. |
| `glass.edge`, `stroke`, `inner`, `innerStroke`, `divider` | hairlines | Specular top edge, outer stroke, inset rows, list dividers. |
| `glass.chromeBase` | `0.74` | Opacity of the solid base under the dock and bars. |
| `glass.selected` / `onSelected` | near-white pill / near-black text | Selected segment, chip and dock item. |
| `glass.solid` | opaque fills per level | Reduce Transparency fallback. |
| `ambient` | base, raised base, three orbs, ring | Background field behind each screen. |
| `motion.duration` | `press 140`, `quick 240`, `enter 420`, `count 800` | Timings in ms. `fast`, `base`, `slow`, `spring` remain as deprecated aliases. |
| `motion.springs` | `thumb`, `press` | Sliding thumbs and pressed scale. |
| `motion.easing` | `out`, `in`, `soft` | Cubic-bezier control points. |
| `typography.title`, `numeral`, `numeralCompact` | Poppins title; Inter 700 tabular numerals | Screen titles and money values. |
