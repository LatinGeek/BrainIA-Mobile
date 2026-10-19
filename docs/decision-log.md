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

