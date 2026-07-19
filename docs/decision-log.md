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
