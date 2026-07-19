# Mobile Architecture

## Stack

- Expo
- React Native
- TypeScript

## Architecture style

La app debe mantenerse como cliente delgado.

Responsabilidades del movil:

- presentacion
- navegacion
- autenticacion de sesion
- cache de lectura
- captura de eventos
- reintentos de red
- manejo de estado de UI

Responsabilidades del backend:

- ingestion
- clasificacion
- persistencia
- canonicalizacion
- consultas
- grafo
- insights
- digests
- finanzas

## Suggested module split

- `app/` para rutas o pantallas
- `components/` para UI reutilizable
- `features/dashboard/`
- `features/search/`
- `features/capture/`
- `features/entities/`
- `features/financials/`
- `features/review/`
- `features/insights/`
- `features/digests/`
- `lib/api/` para cliente HTTP
- `lib/auth/` para sesion
- `lib/cache/` para cache y reintentos
- `lib/formatters/` para fechas, moneda y labels

## State model

### Server state

Debe vivir en una capa de cache de datos con refetch y revalidacion.

### UI state

Debe manejarse localmente por pantalla o feature.

### Session state

Debe persistirse de forma segura para mantener la sesion de usuario.

## Data flow

1. el usuario abre una pantalla
2. la pantalla solicita datos al backend
3. la capa de red adjunta autenticacion
4. la respuesta se cachea temporalmente
5. la UI renderiza el estado mas reciente
6. si hay error, se reintenta segun politica

## Sync policy

No se define un modo offline completo.

Si una operacion falla por red:

- se informa al usuario
- se reintenta automaticamente cuando aplique
- no se promete persistencia offline ilimitada

## Network boundaries

La app consumira el backend BrainIA a traves de los endpoints versionados.

La UI no debe asumir:

- forma interna de las tablas
- reglas de canonicalizacion
- logica de grafo
- logica de clasificacion

## Auth integration

La capa de autenticacion debe abstraer el proveedor concreto.

La app debe estar preparada para:

- SSO o proveedor empresarial
- obtencion de credenciales de sesion
- envio de headers de autenticacion requeridos por BrainIA

## Rendering strategy

Pantallas de alta densidad:

- dashboard
- search
- entity detail
- financial summary

deben priorizar:

- jerarquia visual clara
- carga progresiva
- skeletons o placeholders
- componentes reutilizables

## Observability

La app deberia registrar:

- errores de red
- fallos de autenticacion
- tiempos de carga
- errores de render
- latencia de endpoints clave
