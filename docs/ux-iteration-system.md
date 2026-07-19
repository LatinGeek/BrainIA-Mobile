# UX Iteration System

Este documento define el proceso obligatorio para iterar la app antes de generar un nuevo APK.
El objetivo es evitar builds prematuros y asegurar que la experiencia sea legible, estable y consistente.

## Principio rector

No se genera un APK nuevo hasta que:

- la pantalla afectada fue revisada en runtime
- los estados de loading, empty y error se validaron
- no existen errores de render visibles
- no hay overflow o clipping en la UI
- `lint` y `tsc` pasaron
- el smoke test web paso en rutas clave

## Iteration loop

### Paso 1. Cambiar una sola cosa relevante

- implementar un cambio acotado
- evitar mezclar correcciones visuales, de datos y de flujo en el mismo intento cuando sea posible
- mantener el cambio pequeno para poder entender su efecto

### Paso 2. Ejecutar validacion tecnica minima

Comandos requeridos:

- `npm run lint`
- `npx tsc --noEmit`
- `npm run smoke:web`

Si alguno falla, la iteracion no avanza.

### Paso 3. Abrir la app localmente

Validar la pantalla o flujo afectado en una de estas formas:

- emulador Android
- dispositivo fisico
- app local en desarrollo

La revision debe cubrir la experiencia real, no solo el compilado.

### Paso 4. Revisar la pantalla en contexto

Comprobar:

- jerarquia visual
- lectura de titulos y labels
- comportamiento de tarjetas y listas
- safe areas y headers
- scroll y contenido largo
- estados vacios o fallidos

### Paso 5. Corregir y repetir

Si algo falla:

- ajustar layout
- ajustar copy
- ajustar spacing
- ajustar estados
- volver a probar

Repetir hasta que la pantalla sea estable.

### Paso 6. Generar APK solo al final

Cuando la iteracion ya este aprobada:

- volver a correr el gate tecnico si hubo cambios finales
- generar el nuevo APK
- registrar la version o nota de cambio

## Required smoke test

Antes de cada APK nuevo, validar como minimo:

- la app abre sin errores visibles
- el dashboard carga y muestra contenido entendible
- search responde sin romper el layout
- capture permite avanzar sin friccion
- financials muestra cifras y labels legibles
- review no presenta acciones confusas
- un detalle de entidad o transaccion se ve correcto
- el bottom tab bar no tapa contenido ni se deforma

## Visual checklist

- no hay texto tecnico crudo
- no hay Markdown sin renderizar
- no hay claves internas expuestas
- no hay cards apretadas o truncadas
- los chips no desbordan
- los numeros estan formateados
- el contraste es suficiente
- el contenido cabe en ancho compacto

## Data-state checklist

- loading se entiende
- empty state no parece error
- error state explica el problema
- partial data no parece rotura
- fallback demo no parece accidental

## Device matrix

La iteracion debe revisarse en al menos dos perfiles:

- telefono compacto
- telefono estandar o grande

Si hay tiempo, validar tambien:

- modo oscuro
- modo claro
- pantalla con contenido largo

## Release gate

Un APK nuevo solo se aprueba si:

- no hay regresiones visuales en la pantalla principal
- no hay errores de consola nuevos
- no hay fallos de carga o parseo visibles
- no hay elementos superpuestos
- no hay pantallas sin estado vacio o error
- el smoke test automatizado paso en home, search, settings y detalles clave

## Iteration log

Cada iteracion deberia dejar una nota breve con:

- que se cambio
- que se valido
- que se rompio
- que queda pendiente

Esto sirve para evitar repetir trabajo y para comparar el estado entre builds.

## When to stop iterating

Detener la iteracion actual cuando:

- la pantalla se entiende sin explicacion extra
- la informacion importante entra en una sola lectura
- el flujo principal no produce dudas
- no hay defectos visuales obvios
- el build local ya no cambia nada relevante

## Relationship to the backlog

El backlog define que hacer.
Este sistema define como validarlo.

Ambos son obligatorios para BrainIA-Mobile.
