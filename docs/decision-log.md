# Decision Log

Este documento registra las decisiones cerradas a partir del cuestionario inicial.

## Product decisions

1. Objetivo principal: leer el second-brain.
2. Usuario principal: power user individual.
3. Autenticacion: SSO o identidad empresarial.
4. Nivel de escritura: lectura + captura + operacion.
5. Pantalla inicial: dashboard de insights, con busqueda/assistant como superficie secundaria.
6. Navegacion: tabs inferiores.
7. Busqueda: estrategia futura de retrieval semantico.
8. Home experience: dashboard second-brain + dashboard financiero.
9. Contenido base: dashboard como pantalla central, no inbox.
10. Grafo: profundidad configurable.
11. Insights: tarjetas compactas.
12. Digests: diarios y semanales.
13. Finanzas: dashboard + detalle + evidencia.
14. Alias review: resolucion y rechazo desde la app.
15. Captura: note, email, notification, wallet, batch generico.
16. Offline: no como modo principal.
17. Sync: reintentos automaticos en background.
18. Notificaciones push: digests, capturas, review y alertas.
19. Plataforma: iOS y Android.
20. Stack: Expo + React Native + TypeScript.

## Product implications

- La app debe sentirse como un dashboard movil, no como un editor.
- La exploracion financiera merece una seccion propia, no solo un bloque dentro del home.
- Las herramientas operativas deben existir, pero no dominar la experiencia.
- La sincronizacion debe ser robusta, pero sin comprometer el alcance offline.

## Glass frontend decisions (v2.1)

Registradas al iniciar la migracion glass. El owner puede revertir cualquiera
de las cuatro primeras; la quinta depende del backend.

1. **Auto-handle on by default**, only for obvious names and duplicate
   merchants. The prototype default is assumed. Until the backend exposes
   confidence and server-side auto-resolve, the client shows the “Handled for
   you” card as unavailable and does not silently confirm anything.
2. **The review session is a full-screen modal with no dock.** Progress is kept
   when leaving; the tab bar is hidden for the whole session.
3. **Radii are 10 / 14 / 20 / 28** (sheet 34, pill 999), replacing the previous
   4–10 scale and relaxing the “disciplined radii” note.
4. **Lime `#C4F54A` is the single accent**, replacing indigo. It is reserved for
   the primary action, live state, positive net and capture; selection is an
   opaque white pill.
5. **Who builds the backend review fields is not decided here.** The client
   ships with the documented fallbacks (impact from cached transactions,
   confidence 0.5, `normalizedValue`/`categoryPath` suggestions). Because the
   session is now the only review surface and every fallback is explicit, the
   `settings.reviewSession` flag was removed during cleanup rather than flipped.
   Auto-handle remains off until the backend fields exist.

## Liquid glass material (v2.2)

Reference: a poured-glass capsule over a lit photograph. What carries the look
there is the *edge*: a bright rim that catches light along the top and turns
away at the bottom, light pooling just inside the top edge, and a shade where
the pane is thickest. The body stays clear so what is behind it keeps its
colour.

1. **The rim is drawn, not a border.** `glass/GlassPaint` renders the body haze,
   the rim, a bevel, the specular streaks, the corner light and the bottom
   shade, in that order. Two renderers follow the same numbers: native gradient
   views on Android (an SVG scene per card was measurable there) and one SVG
   scene everywhere else. `light.*` tokens hold the colours.
2. **The pane got clearer, not whiter.** Body fills dropped from 0.11/0.17 to
   0.10/0.15 at the top and the veil from 0.06 to 0.038, so cards show the
   ambient field instead of a white film. Android's blurred backdrop is now
   rendered at 1.28x saturation: light seen through glass comes out richer.
3. **No colour split along the rim.** Warm/cool dispersion was tried and
   removed: at card size over a dark field it read as a colour cast, not as a
   lens. Tone surfaces instead glow faintly inwards from their rim, so a
   `review` card still carries its colour.
4. **A caller's radius and border win.** The paint reads `borderRadius` and
   `borderColor` from the caller's `style` (sheets use 34, error fields use
   danger red), and `bordered={false}` drops the edge layers while keeping the
   body.
5. **Reduce Transparency still shows a solid surface**, with no paint layer:
   the material is decoration, and the data has to stay readable.

## Liquid glass on Android (v2.3)

Seen on the Xiaomi 25069PTEBG (Android 16) after the first release install.

1. **Corner lights must fade inside their own box.** A background-image radial
   is sized to its box's farthest corner, so a light drawn in a square of its
   radius is still ~30% strong at the square's edges and reads as a lit
   rectangle. Each corner light now gets a square of twice its radius with the
   transparent stop at `radius / (√2 · side)`, which puts the falloff at the
   same R pixels the SVG path uses. This was the "blocks" seen on device.
2. **The wash is scaled by surface height.** The same top haze on a 64pt tile
   covers half of it and turns milky; lights fade with `height / 130` so a tile
   reads as glass and a hero card still catches the light.
3. **No rings at a fixed inset.** Solid borders cannot fade, so any element
   drawn as a border — the bevel ring, the tone glow — has a hard inner edge at
   an exact distance from the rim, all the way round. At 3x density that reads as
   a picture frame, and it was the "hard stop near the borders" reported twice:
   first from the 1pt bevel ring (0.14 white), then from the 8pt tone ring
   (0.022). Both are gone on Android; tone is now only the flat wash from
   `toneTint`, and the pane's thickness comes from the top light and the bottom
   shade. The SVG path keeps its bevel because there the stroke is a gradient
   (lit at the top, shaded at the bottom) rather than a solid ring.
4. **The Android rim is the view's border**, uniform by construction, so it sits
   at 0.4 white and the top streak and corner light carry the direction. A
   dimmer border plus a bright streak reads as light; a bright uniform border
   reads as an outline.
5. **No grain.** The fractal noise under the pane was removed: with the clearer
   body it read as speckle rather than frosted glass. `BACKDROP_VERSION` moves
   with it so installed apps rebuild their cached backdrops.

## Cleaner glass (v2.4)

The pane was still reading milky, so the white lift and the frost came down:

- Body fills `0.06/0.10/0.15` → `0.045/0.072/0.105`; frame veil
  `0.022/0.038/0.055` → `0.014/0.024/0.036`.
- Blur sigma `2/3/5` → `1.5/2/3.5` on Android and `BlurView` intensity
  `12/22/36` → `8/14/22`. `AMBIENT_BLURS` follows the sigmas, otherwise the
  splash warms images the surfaces no longer ask for.
- Lights trimmed with the body: top haze `0.11` → `0.075`, the spill under the
  top edge `0.4` → `0.3`, side light `0.05/0.04` → `0.035/0.028`, corners
  `0.30/0.14/0.07` → `0.26/0.12/0.06`.
- Tone tints capped at one step (all `*0A`): with a darker body the warmer tints
  were reading as dirty rather than tinted.
- The rim is untouched, so it now carries more of the surface's contrast.

Measured on the device: hero interior luminance 114 → 89, Finanzas tile 43 → 35,
rim unchanged.

- The reflection at the top edge came down again on its own: `light.specular`
  `0.92` → `0.62`, the spill `0.3` → `0.12` over `18pt` instead of `24pt`, and
  the haze `0.075` → `0.038`. Peak brightness of that band over the card body is
  now `+37` (was `+65`), while the crisp top line stays.
- **Controls inside a card are flat, not glass.** The four quick actions in
  "Este ciclo" were nested `GlassSurface`s, so each drew its own rim, corner
  light and top reflection — glass on glass, and the busiest thing on screen.
  They are now a plain translucent fill (`glass.inner`) with a hairline divider,
  the same treatment as `IconTile` in "Actividad reciente". The material is for
  surfaces; controls inside one stay flat.

## The highlights rail runs to the screen edge (v2.5)

On Hoy, the second card of "Lo más importante" showed as a thin sliver that
stopped 20pt short of the right edge, so it read as a clipped card rather than
as the next one waiting to be swiped.

1. **The rail cancels the screen's inset.** `Screen` pads its scroll body by
   `screenGutter` (20, or 40 in the desktop layout), and the rail used to size
   its cards from the raw window width while living inside that padding: the
   36pt the width budget left for the peek was eaten down to 16, and what
   remained ended inside the content's margin. The rail now takes
   `marginHorizontal: -gutter` and pads its content back by the same amount, so
   the first card still starts on the content's edge and the last one ends
   there, while the cards in between run off the screen.
2. **The card keeps its width.** `signalCardWidth` subtracts the gutter, the
   rail's gap and `SIGNAL_CARD_PEEK` (36pt) instead of a flat 64pt, so a phone
   keeps the card it had (348pt at 412dp, 24pt below the content width) and the
   peek is measured from the screen edge instead of from the content's margin.
   Measured at 412dp: the peek goes from 16pt, ending 20pt short of the edge, to
   31pt reaching it (the off-focus card's 0.97 scale takes 5pt back). The
   loading rail uses the same function, so the content that replaces it lands in
   place.
3. **A lone card has nothing to peek.** One highlight used to take the same
   narrow width and leave a 36pt hole on its right, which reads as a card that
   failed to fill its row. With a single item the rail takes the content width,
   like the cards above it.



