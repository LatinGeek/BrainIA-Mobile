# Design audit — sub-screens C

Task `task_8d6e7d8ccd9c`, branch `LatinGeek/glass-design-polish`, working tree as of 2026-10-21 (including the uncommitted glass/motion changes). This is a read-only audit: no source file was edited, nothing was committed, and the phone/adb was not touched.

**Scope:** `app/learning.tsx`, `app/settings.tsx` (with the Advanced tools section and all three sheets), `app/modal.tsx`, `app/+not-found.tsx`, `app/+html.tsx`, `app/_layout.tsx` (stack transitions, toasts, global providers).

**Method:** I read each screen and every component it renders: `Screen`/`Section`, `GlassSurface`, `GlassPressable`, `Row`/`IconTile`, `StateView`, `BottomSheet`, `Toast`, and the `Button`/`Field`/`SegmentedControl`/`Chip`/`Tag` controls. I compared them against `docs/reports/glass-design-audit.md`, `lib/themes.ts` (spacing 4/8/12/16/24/32/40, radius 10/14/20/28/34, `layout.minTarget` 44, motion 140/240/420/800) and the 20dp page gutter in `Screen.tsx:226`. Nothing was checked on a device. Text-fit estimates use Inter 12/15 at roughly 0.5 em per character, at 320 and 390dp widths.

Severity: **High** means broken, misleading or destructive behaviour, or a rule broken on a primary path. **Medium** means a visible inconsistency, or a rule broken on a secondary path. **Low** means polish.

## Summary

| Screen | High | Medium | Low |
|---|---|---|---|
| `app/settings.tsx` (+ sheets, Advanced) | 5 | 9 | 5 |
| `app/learning.tsx` | 2 | 5 | 3 |
| `app/_layout.tsx` (+ Toast, providers) | 1 | 4 | 3 |
| `app/+not-found.tsx` | 0 | 2 | 1 |
| `app/modal.tsx` | 0 | 1 | 0 |
| `app/+html.tsx` | 0 | 0 | 3 |

Findings in shared components (`BottomSheet`, `Row`, `Chip`, `Toast`, `Screen`) are listed under the screen where they show up first, and marked **[shared]**. Fixing one of them fixes every screen that uses the component.

---

## 1. `app/settings.tsx`

### High

**S-H1 · English copy across the screen.** The rule is Spanish everywhere. These strings are still in English:
- `settings.tsx:21-23` segment labels `Balanced / Knowledge / Money`, and `:27-29` `Essential / Balanced / Detailed`.
- `:32-38` `ordinalDay()` gives `1st/2nd/3rd/Nth`, and `:258` reads ``${ordinal} of each month``.
- `:78` Alert `Invalid start day` / `Choose a day from 1 through 28…`.
- `:246` overline `Preferences`; `:248` Tag `Connected / Checking / Saved`.
- `:252` caption `Source detail`.
- `:256` section title `Money`; `:258` description `Monthly reports run from this day…`.
- `:263` section title `Notifications`.
- `:276` `Checking notification access...`, `Listener connected. Last forwarded …`, `Listener connected and ready.`, `Access enabled; the listener is reconnecting.`, `Access enabled. Connecting the listener service.`, `Notification access is disabled.`
- `:279` Tag `Checking / Running / Needs attention / Reconnecting / Disabled`.
- `:282` `Last notification read: …` / `No supported notification has been read yet.`; `:283` `Active notifications last checked: …`.
- `:288` `Checking... / Check active`; `:289` `Sending... / Send diagnostics`.
- `:295` `Advanced` / `Connection, credentials and maintenance.`; `:296` `Advanced tools`, `Hide/Show connection and diagnostics.`
- `:299-301` Field labels `Base URL`, `Client ID`, `API key`.
- `:310` `Checking connection...`, `Service reachable.`, `Service is not responding right now.`; `:312` `Checking... / Check service`.
- `:327` sheet body `Choose when a new monthly money cycle begins…`; `:328` error `Choose a day from 1 through 28.`
- `:258` trailing `Cambio` is a noun ("change"). The row is an action, so it should say `Cambiar`.
- **[shared]** `BottomSheet.tsx:37,42` `accessibilityLabel="Close"`, which TalkBack reads on every sheet.

*Why:* these strings sit next to Spanish ones in the same card, for example `:274` "Acceso a notificaciones" over an English status line. That reads as unfinished.
*Fix:* `Equilibrado / Conocimiento / Dinero`, `Esencial / Equilibrado / Detallado`. Replace `ordinalDay` with ``Día ${day} de cada mes`` and delete the helper. Then `Preferencias`, `Conectado / Comprobando / Sin conexión`, `Detalle de las fuentes`, `Dinero`, `Notificaciones`, `Avanzado` / `Conexión, credenciales y mantenimiento.`, `Herramientas avanzadas` / `Mostrar/Ocultar conexión y diagnóstico.`, `URL base`, `ID de cliente`, `Clave de API`. For the listener: `Comprobando acceso…`, `Servicio conectado. Último envío ${…}.`, `Servicio conectado y listo.`, `Acceso activo; reconectando el servicio.`, `Acceso activo. Conectando el servicio.`, `El acceso a notificaciones está desactivado.` Tags: `Comprobando / Activo / Requiere atención / Reconectando / Desactivado`. Buttons: `Comprobar activas`, `Enviar diagnóstico`, `Comprobar servicio`. Sheet: `Elige el día en que empieza cada ciclo de dinero. Con el día 28, por ejemplo, cada ciclo va del 28 al 27.` / `Elige un día del 1 al 28.` In `BottomSheet`: `accessibilityLabel="Cerrar"`. For dates, use `toLocaleString('es-UY')` (`:233, 276, 282, 283, 316` currently follow the device locale).

**S-H2 · The header status Tag says "Saved" when the backend is down** (`settings.tsx:248`). The ternary falls back to `'Saved'` in tone `neutral` whenever `data?.ok` is false and loading has finished, and that includes the `error` case. A failed connection is shown as a calm, neutral state.
*Fix:*
```tsx
actions={<Tag label={loading ? 'Comprobando' : data?.ok ? 'Conectado' : 'Sin conexión'} tone={loading ? 'neutral' : data?.ok ? 'positive' : 'warning'} live={loading} />}
```

**S-H3 · Row descriptions are cut at 2 lines and lose content** (`Row.tsx:87-88` **[shared]**, triggered by `settings.tsx:251, 257, 258, 264, 265`). `Row` forces `numberOfLines={2}` on subtitle and description. Inside the 20dp gutter, the 12dp row inset and the 38dp IconTile + 12dp gap leave about 206dp at 320 and about 276dp at 390.
- `:257`: "Los totales convertidos son estimaciones. Cada transacción conserva siempre su moneda original." is 95 characters, about 3 lines at both widths, so the sentence about the original currency is cut off.
- `:265`: "Un recordatorio cuando un nombre o una categoría necesiten una decisión." is 72 characters next to a roughly 52dp Switch, about 3 lines at 320, so it is truncated.
- `:258` (description, 75 chars) and `:264` are borderline at 320 and at font scale 1.3.

*Why:* explanatory copy that ends in "…" cannot be expanded.
*Fix:* add a `lines` prop to `Row` (`descriptionLines?: number`, default 2) and pass `descriptionLines={4}` from Settings. Alternatively, drop `numberOfLines` on `description` (it is secondary copy) and keep the clamp only on `title`/`subtitle`:
```tsx
{description ? <Text numberOfLines={descriptionLines} …>{…}</Text> : null}
```

**S-H4 · "Restablecer ajustes" is destructive, has no confirmation and is styled as the primary call to action** (`settings.tsx:321`). `StateView` (an empty-state component) renders a lime `primary` Button that calls `resetSettings`. That wipes the base URL, API key and client ID, so the app stops syncing, all in one tap and with no undo. "Vaciar caché" (`:319`) is also one tap with no confirmation.
*Fix:* do not use `StateView` here. Use a plain row of text and button:
```tsx
<Button label="Restablecer ajustes" variant="danger" size="sm" onPress={() => Alert.alert('Restablecer ajustes', 'Se restablecerán la conexión y las preferencias locales. Tendrás que volver a ingresar la clave de API.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Restablecer', style: 'destructive', onPress: resetSettings }])} />
```
Do the same for `clearLocalData` (`Vaciar caché`), and show a toast afterwards (see S-M6).

**S-H5 · Each keystroke in "Base URL" / "API key" starts a health check, and the header Tag flickers** (`settings.tsx:85-86, 299-301`). `onChangeText={setBaseUrl}` writes settings live. `client` is memoised on `baseUrl/apiKey/clientId` (`lib/app-state.tsx:145-153`), so `healthLoader` changes on every character and `useAsyncResource` refetches. Typing a 30-character URL fires about 30 requests against half-typed hosts. The Tag toggles Comprobando/Sin conexión, and the "Conexión" caption flashes raw fetch errors.
*Fix:* keep local drafts and commit on blur or submit:
```tsx
const [baseUrlDraft, setBaseUrlDraft] = useState(settings.baseUrl);
<Field label="URL base" value={baseUrlDraft} onChangeText={setBaseUrlDraft} onEndEditing={() => setBaseUrl(baseUrlDraft.trim())} keyboardType="url" returnKeyType="done" autoCapitalize="none" autoCorrect={false} />
```
Do the same for Client ID and the API key. `keyboardType="url"` is also missing today.

### Medium

**S-M1 · Settings rows float on the ambient background instead of sitting on glass, and the left edges are ragged** (`settings.tsx:250-266, 295-296`). In General, Money, Notifications and the Advanced toggle, bare `Row`s are direct children of `Section`. They have a transparent shell with a hairline bottom border, and `Row.tsx:278` gives them `paddingHorizontal: 12`. The captions and `SegmentedControl`s next to them (`:252-253, 259-260`) start at x = 0. Each section therefore has three left edges: the section title at 20, the row icon at 32, and the caption and segment track at 20. The captured-notifications and Advanced blocks do use `GlassSurface`, so in the same scroll some groups are glass and others are not. `Row.tsx:280` also uses `borderRadius: 12`, which is not a token and draws curved ends on the bottom hairline.
*Fix:* wrap each section body in one surface (the prototype pattern where a list uses one blurred group), and inset the loose captions and controls to the row inset:
```tsx
<Section title="General" …>
  <GlassSurface level="thin" padding="sm" contentStyle={{ gap: theme.spacing.sm }}>
    <Row … />
    <View style={{ paddingHorizontal: theme.spacing.md, gap: theme.spacing.sm }}>
      <Text …>Detalle de las fuentes</Text>
      <SegmentedControl … role="radio" accessibilityLabel="Detalle de las fuentes" />
    </View>
  </GlassSurface>
</Section>
```
In `Row.tsx:280`, set `borderRadius: theme.radius.md` from inline style, or drop the radius when `!selected`, so the divider stays straight.

**S-M2 · The SegmentedControls have no accessible name and the wrong role** (`settings.tsx:253, 260`). The labels are separate `Text` nodes. The control defaults to `role="tab"` (tablist), so TalkBack announces "Equilibrado, pestaña, 2 de 3" with no context. These controls are settings, not navigation tabs.
*Fix:* `role="radio" accessibilityLabel="Detalle de las fuentes"` and `role="radio" accessibilityLabel="Prioridad en Hoy"`.

**S-M3 · Opening Advanced tools swaps the content in instantly** (`settings.tsx:297-323`). The `GlassSurface` mounts and unmounts with a plain conditional. There is no enter or exit animation, and the content below jumps. That breaks the motion rule that expand/collapse is animated. The Screen stagger only covers direct Screen children on focus.
*Fix:*
```tsx
{advancedOpen ? (
  <Animated.View entering={reduceMotion ? FadeIn.duration(M.duration.reduced) : FadeInDown.duration(M.duration.quick).easing(Easing.bezier(...M.easing.out))} exiting={FadeOut.duration(M.duration.press)} layout={listLayout}>
    <GlassSurface …/>
  </Animated.View>
) : null}
```
Use `listLayout` from `lib/motion.ts`, and give the parent Section's wrapper a `layout={listLayout}` so the following content glides instead of jumping.

**S-M4 · The Advanced surface packs three groups into one undivided card** (`settings.tsx:298-322`). Fields, then "Sesión de datos v2", "Conexión" and "Diagnóstico" are spaced with a uniform `gap: 12`. The `bodyStrong` subheads have the same gap above as below, so they do not separate the groups. They also have no `accessibilityRole="header"`.
*Fix:* split the content into four `GlassSurface level="thin" padding="md"` blocks: Conexión (fields + health), Sesión v2, Diagnóstico, Restablecer. Put them in a `View` with `gap: theme.spacing.sm`, and use the GlassSurface `title` prop, which renders a header role (`GlassSurface.tsx:224`). This also shortens the surface, which helps the Android backdrop measure (`GlassSurface.tsx:94-102`).

**S-M5 · Taps in the app-selection sheet are dropped and the switches flicker** (`settings.tsx:153-168, 337`).
1. `saveCaptureSelection` returns early while `appSelectionSaving` is true. A second switch tapped during the save silently does nothing, and `Row` never disables its `Switch` (`Row.tsx:94-100` ignores `disabled`).
2. `captureApps` is updated only after the native save finishes. The controlled `Switch` flips, snaps back to the old value, then flips again.

*Fix:* update optimistically and roll back on error:
```tsx
const previous = captureApps; setCaptureApps(next);
try { await setCaptureAppPackages(…) } catch { setCaptureApps(previous); Alert… }
```
Pass `disabled={disabled}` through to `<Switch disabled={disabled} …>` in `Row`, and set `disabled={appSelectionSaving}` on each app row. Alternatively, queue the latest selection instead of returning early.

**S-M6 · Maintenance actions give no feedback** (`settings.tsx:286-289, 312-319`). "Vaciar caché", "Actualizar diagnóstico", "Recuperar valores" and "Send diagnostics" finish with no visible result. "Recuperar valores" in particular can silently change the fields. Only the button label changes while the action runs.
*Fix:* `const toast = useToast();`, then after each `await`, `toast.show('Caché vaciada', { tone: 'positive' })` (also `'Diagnóstico enviado'`, `'Valores recuperados'`). Use `Button loading={…}` (spinner, `busy` state) instead of swapping the label text (`:288-289, 312`).

**S-M7 · The credential sheet's save button scrolls with the content and can sit under the keyboard** (`settings.tsx:340-346`). The primary `Button` is a scroll child. On Android the two `Field`s plus the caption push it below the fold once the keyboard opens. With `softwareKeyboardLayoutMode: "resize"` and `KeyboardAvoidingView behavior="height"` in a `statusBarTranslucent` Modal, the sheet height shrinks but the button is still last in the scroll. The same pattern applies to the financial-period sheet (`:329`). There is also no `autoFocus`/`returnKeyType` chaining between the token and expiry fields.
*Fix:* move the action to the existing `footer` slot, which renders outside the ScrollView (`BottomSheet.tsx:55`):
```tsx
<BottomSheet … footer={<Button label={…} onPress={saveCredential} loading={credentialBusy} disabled={credentialTokenDraft.trim().length === 0} full />}>
```
Add `autoFocus returnKeyType="next" onSubmitEditing={() => expiryRef.current?.focus()}` on the token field and `returnKeyType="done" onSubmitEditing={saveCredential}` on the expiry field. That needs `Field` to forward a ref, which it does not do today.

**S-M8 · The credential sheet can be dismissed mid-save, and the draft lingers** (`settings.tsx:340`). `onClose` ignores `credentialBusy`. Closing the sheet during the save lets the success or failure `Alert` appear over the bare screen. The pasted token also stays in `credentialTokenDraft` after a dismissal; it is cleared only on the next open, at `:173`.
*Fix:* `onClose={() => { if (credentialBusy) return; setCredentialTokenDraft(''); setCredentialExpiryDraft(''); setCredentialSheetOpen(false); }}`.

**S-M9 · Validation in the financial-period sheet fires too early and blocks too late** (`settings.tsx:328-329, 75-79`). Clearing the field shows the error immediately, because `Number('')` is 0. Yet "Guardar" stays enabled, and an invalid day opens an English native Alert on top of the sheet.
*Fix:*
```tsx
const dayValid = /^\d{1,2}$/.test(financialPeriodDraft) && +financialPeriodDraft >= 1 && +financialPeriodDraft <= 28;
error={financialPeriodDraft && !dayValid ? 'Elige un día del 1 al 28.' : undefined}
<Button … disabled={!dayValid} />
```
Then delete the `Alert` branch in `saveFinancialPeriod`.

### Low

**S-L1 · Settings has no on-screen way back.** `Screen` is called without `back` (`settings.tsx:244`), and the route is `presentation: 'modal'` (`_layout.tsx:90`). On Android that is a normal push with no close button, so the user has to know the system back gesture. *Fix:* `<Screen back backLabel="Volver" …>`, plus the Screen fix in L-M1 so the back button is visible before scrolling.

**S-L2 · The scrim pressable scales the whole backdrop on touch** **[shared]** (`BottomSheet.tsx:37`). `GlassPressable` defaults to `scaleTo 0.98` and an opacity dip. Pressing the scrim to dismiss visibly shrinks the full-screen overlay. *Fix:* use a plain `Pressable` for the scrim, or pass `scaleTo={1}`. Also see L-H1.

**S-L3 · Sheet titles are not headers** **[shared]** (`BottomSheet.tsx:41`). *Fix:* add `accessibilityRole="header"` to the title `Text`.

**S-L4 · The sheet leaves without motion** **[shared]** (`BottomSheet.tsx:34, 38`). The sheet enters with a FadeInDown spring, but on close the `Modal`'s `fade` dissolves everything together. There is no slide down and no `exiting`. Drag-to-dismiss is also missing; the prototype sheet has a grabber. *Fix:* keep the Modal mounted for an `exiting={FadeOutDown.duration(M.duration.quick)}` on the sheet (local `mounted` state, unmounted after the duration), and add a 36×4 grabber `View` (`theme.glass.divider`, `radius.pill`) above the header. A pan-to-dismiss gesture is optional.

**S-L5 · Raw backend and native error strings are shown as is** (`settings.tsx:284, 310`). `notificationBridgeStatus.lastError` and the health `error` can be English or technical, for example "Network request failed". *Fix:* map known cases to Spanish (`'No se pudo conectar con el servicio.'`) and put the raw text in a muted `mono` line or behind "Detalles".

**Already fine:** every `Button sm` is 44dp. Segment and chip targets reach 44 with `hitSlop`. The sheet close button is 44. The scrim has dismissal, `onRequestClose` handles Android back, and safe-area padding is applied (`BottomSheet.tsx:36`). The secure field uses `secureTextEntry`. The Android-only capture card is gated correctly.

---

## 2. `app/learning.tsx`

### High

**L-H1 · Possible crash when any sheet opens: a stray text node in the scrim** **[shared]** (`BottomSheet.tsx:37`). `…style={StyleSheet.absoluteFill}> <View /> </GlassPressable>` has same-line spaces, so the children are `[" ", <View/>, " "]`. On native React Native, a bare string under a `View` throws *"Text strings must be rendered within a <Text> component"*. react-native-web only warns, so the web harness would not catch it. Learning has no sheets, but Settings has three and other screens use them too. This is not verified on device (adb was off-limits), so treat it as **plausible / high**. The fix costs nothing whatever the device result:
```tsx
<Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} style={StyleSheet.absoluteFill} />
```
(This also fixes S-L2.)

**L-H2 · English copy** (`learning.tsx:80` overline `Learning`; `:100` Section title `Corrections`). The status line `:82` also shows `error.message` from the API verbatim (`:25, 44, 59, 73`). *Fix:* `overline="Aprendizaje"`, `<Section title="Correcciones" count={items.length}>`, and map request failures to `'No se pudieron cargar las correcciones.'` (keep the raw message out of the UI). The `NavigationRail.tsx:63-64` entry points `Learning` / `Settings` are English too, though that file belongs to another audit.

### Medium

**L-M1 · There is no on-screen back control until the user scrolls past 64dp** **[shared]** (`Screen.tsx:187-199, 255-258`). `back` only renders inside the compact bar, which appears after `headerCollapse`. Learning passes `back` (`learning.tsx:80`), but at the top of the page there is nothing to tap. *Fix:* in `headerBlock`, render the same 44dp `GlassPressable` arrow before the title when `back` is true:
```tsx
{back ? <GlassPressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={goBack} hitSlop={4} scaleTo={0.92} style={[styles.iconButton, { width: theme.layout.minTarget, height: theme.layout.minTarget, borderRadius: theme.radius.pill, backgroundColor: theme.glass.inner, marginLeft: -theme.spacing.sm }]}><Feather name="arrow-left" size={18} color={theme.colors.textPrimary} /></GlassPressable> : null}
```
Also change the default `backLabel = 'Back'` (`Screen.tsx:97`) to `'Volver'`.

**L-M2 · No loading state, and an orphaned "Corrections" header** (`learning.tsx:81, 98-111`). While `enabled === null` (the capability request is in flight) and during `load()`, the screen shows only the header and an empty "Corrections" section. When learning is disabled (`enabled === false`), the section header still renders under the "no habilitado" card. Pull-to-refresh never shows a spinner, because `refreshing` is not passed (`:80`), and it calls `load()` even when learning is disabled.
*Fix:* add `const [loading, setLoading] = useState(true)` and set it around both requests, then:
```tsx
{enabled === null || loading ? <StateView kind="loading" skeleton="card" skeletonCount={3} title="Cargando" /> : null}
{enabled && items.length ? <Section title="Correcciones" count={items.length}>…</Section> : null}
<Screen … refreshing={loading} onRefresh={enabled ? () => void load() : undefined}>
```

**L-M3 · Load failure has no error state or retry** (`learning.tsx:25, 32`). A failed `/classification/corrections` request only sets `status` text. A failed capabilities request is treated as "Aprendizaje no habilitado", which is wrong: a network error is reported as the feature being disabled. *Fix:* keep `loadError` state, and render `<StateView kind="error" title="No se pudo cargar" description="Revisa la conexión e intenta de nuevo." actionLabel="Reintentar" onAction={…} />`. Set `enabled=false` only when the request succeeds with `learning: false`.

**L-M4 · Long event-chip labels overflow the preview card** **[shared]** (`learning.tsx:90`, `controls/index.tsx:294, 592-601`). The chip label is ``${title} → ${value}`` and can be any length (merchant names plus a category). `Chip`'s `Text` has `numberOfLines={1}` but no `flexShrink`, and the chip has no `maxWidth`. One long chip therefore grows wider than the card's inner width (about 236dp at 320) and is clipped by the surface's `overflow: hidden`, with no ellipsis. The selected chip also shows an `x`, which signals "remove", although here it means "included".
*Fix:* in `Chip`, add `maxWidth: '100%'` to `styles.chip` and `style={{ flexShrink: 1 }}` to the label `Text`. In Learning, set `icon={selected ? 'check' : undefined}` and pass `static`-style semantics as `accessibilityRole="checkbox"` with `accessibilityState={{ checked: selected }}` (Chip needs a `role` prop for this).

**L-M5 · Busy state gives no feedback, and results swap in instantly** (`learning.tsx:83, 93-94, 106-107`). `busy` disables every button, but none shows a spinner. Applying or undoing replaces the preview card with a status line and an "undo" button, with no transition. Closing the preview (`:94`) unmounts the card instantly. New children do get the Screen stagger enter, but nothing has an exit. *Fix:* use `Button loading={busy && pending === 'apply'}` (track which action is pending). Wrap the preview surface and the applied-undo button in `Animated.View entering={FadeInDown.duration(M.duration.quick)} exiting={FadeOut.duration(M.duration.press)} layout={listLayout}`.

### Low

**L-L1 · Pluralisation** (`learning.tsx:87, 93`). It reads "1 eventos equivalentes" and "Aplicar a 1 eventos". *Fix:* ``${n} ${n === 1 ? 'evento equivalente' : 'eventos equivalentes'}`` and ``Aplicar a ${n} ${n === 1 ? 'evento' : 'eventos'}``.

**L-L2 · An empty preview shows a dead card** (`learning.tsx:85-96`). When `preview.changes.length === 0`, the card reads "0 eventos equivalentes" over an empty chip row and a disabled button. *Fix:* when there are no changes, show `setStatus('No hay eventos anteriores para actualizar.')` and skip `setPreview`.

**L-L3 · Undo affordances are scattered** (`learning.tsx:83, 107`). The history undo is a full-width primary button at the top of the page, far from the change it reverts. *Fix:* show the history undo through `useToast().show('Historial actualizado', { action: { label: 'Deshacer', onPress: () => void undo(id, true) }, duration: 8000 })`, which keeps the button for a later visit. Make it `variant="secondary"` so it does not compete with "Aplicar".

**Already fine:** every card goes through `GlassSurface`, and spacing uses the Screen gutter plus `padding="md"/"lg"`. `accessibilityLiveRegion="polite"` is set on the status text. Buttons are at least 44dp. The empty state uses `StateView`.

---

## 3. `app/_layout.tsx` (navigation, toasts, global providers)

### High

**R-H1 · The global error screen is expo-router's default: English and unstyled** (`_layout.tsx:20`). `export { ErrorBoundary } from 'expo-router'` renders the built-in "Something went wrong" plus "Retry" view on a plain background. It is the one error state that every screen shares, and it ignores both the glass system and the Spanish rule.
*Fix:*
```tsx
import type { ErrorBoundaryProps } from 'expo-router';
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <Screen title="Algo salió mal" overline="Error" stagger={false}>
      <StateView kind="error" title="La pantalla no se pudo mostrar" description="Intenta de nuevo. Si vuelve a pasar, envía el diagnóstico desde Ajustes." errorCode={error.message.slice(0, 120)} actionLabel="Reintentar" onAction={retry} secondaryActionLabel="Ir al inicio" onSecondaryAction={() => router.replace('/')} />
    </Screen>
  );
}
```
The boundary renders inside the providers, so `useTheme` is available.

### Medium

**R-M1 · Toasts are hidden behind any open sheet** **[shared]** (`Toast.tsx:43`, `_layout.tsx:107-109`). `ToastView` renders in the root view tree, but `BottomSheet` is a native `Modal` with its own window, so a toast shown while a sheet is open (for example "Guardado" after a sheet action) appears under it. *Fix:* render the toast host through `Modal`-aware portals. The minimal version is to accept a `toast` slot in `BottomSheet` and render `<ToastHost />` inside the Modal as well, reading the same context. Otherwise, close the sheet before calling `show()`, and document that rule in `useToast`.

**R-M2 · A new toast swaps its text instantly when one is already showing** **[shared]** (`Toast.tsx:43`). `<ToastView toast={toast} />` has no `key`, so calling `show()` while a toast is up re-renders the same `Animated.View`. The message changes in place, with no exit or enter and no live-region re-announce. *Fix:* `{toast ? <ToastView key={toast.id} toast={toast} onDismiss={hide} /> : null}`.

**R-M3 · Toast position and gutter are hardcoded and collide with the pinned action bar** **[shared]** (`Toast.tsx:59, 87-88`). `bottom: 84 + insets.bottom` is a literal for "dock 68 + 16", and `left/right: 16` sits off the 20dp gutter. On screens with `Screen bar` (`Screen.tsx:267`, bottom = dockHeight, about 64dp tall) the toast lands on top of the action bar. On stack screens without a dock it floats 84dp up for no reason. *Fix:* use `bottom: theme.layout.dockHeight + theme.spacing.lg + insets.bottom` and `left/right: 20`. Expose an `offset` from a `ToastInsetContext` that `Screen` sets to `dockHeight + barHeight` when `bar` is present.

**R-M4 · A toast cannot be dismissed, and its duration is fixed** **[shared]** (`Toast.tsx:35, 61-73`). A toast lasts 5 s whatever the message length. Tapping it does nothing, and with an action it covers content for the whole time. *Fix:* wrap the plate in `GlassPressable onPress={onDismiss} scaleTo={0.98}` (or add a swipe-down `Gesture.Pan()`). Default to ``duration ?? Math.min(8000, 3000 + message.length * 50)``, and pause the timer while a screen reader is active (`AccessibilityInfo.isScreenReaderEnabled`).

### Low

**R-L1 · `animationDuration` has no effect on Android** (`_layout.tsx:84`). In react-native-screens 4.x, `animationDuration` applies on iOS only. Android pushes use the system default (about 350–400ms), so the `motion.duration.enter` token is not what users see. Not a bug; note it so nobody tunes the token expecting Android to change. On Android, `gestureEnabled` (`:85`) is also iOS-only.

**R-L2 · The bootstrap screen is English and off-system** (`_layout.tsx:28-46`). It shows "BrainIA Mobile" / "Initializing your second brain." on a flat background, with no ambient field, `padding: 24` off the gutter, and fonts that are not loaded yet. The native splash normally covers it (`hideAsync` waits for hydration), so users rarely see it. *Fix:* use `Brain IA` / `Preparando tu segundo cerebro…`, render `<AmbientBackground />` behind it, and use system font weights (Poppins is not loaded yet at this point).

**R-L3 · Undeclared routes inherit the defaults by accident** (`_layout.tsx:88-96`). `learning` and `modal` are not declared, so they get `slide_from_right`. That is fine for Learning, but declaring them makes the intent explicit: `<Stack.Screen name="learning" />`. `settings`' `presentation: 'modal'` does nothing on Android. Either remove it, or give Settings a close button, since a modal implies one (see S-L1).

**Already fine:** with reduce motion on, the stack swaps `slide_from_right`/`slide_from_bottom` for `fade` (`:83, 95`). `StatusBar` and the root background are themed through `SystemUI`. Splash hiding waits for hydration and fonts, and a font error is not fatal. `GestureHandlerRootView` wraps everything. Toast enter/exit animations honour reduce motion (`Toast.tsx:56-57`), and the toast plate uses `GlassSurface chrome` with a 44dp action target.

---

## 4. `app/+not-found.tsx`

### Medium

**N-M1 · The screen is hand-built and skips both `Screen` and `StateView`** (`+not-found.tsx:10-24`). It is a plain `View` on flat `theme.colors.background`: no ambient background, no glass card, no safe area, and `padding: 24` off the 20dp gutter. It is the only screen in this set that looks like a different app.
*Fix:*
```tsx
<Screen title="Pantalla no encontrada" back stagger={false}>
  <StateView icon="compass" title="Esta pantalla no existe" description="El enlace puede estar desactualizado." actionLabel="Volver al inicio" onAction={() => router.replace('/')} />
</Screen>
```

**N-M2 · The "Volver al inicio" link is a roughly 21dp target with no press feedback** (`+not-found.tsx:20-22`). A bare `Link` wrapping `Text` gives one body line height, no `hitSlop` and no feedback. *Fix:* the `StateView` action above, a 48dp `Button`, solves both.

### Low

**N-L1 · English route title** (`+not-found.tsx:9`). `title: 'Not found'` still feeds the web document title and accessibility metadata even with `headerShown: false`. *Fix:* `'No encontrada'`.

---

## 5. `app/modal.tsx`

### Medium

**M-M1 · A duplicate, unreachable Settings route** (`modal.tsx:1`). `export { default } from './settings'` registers `/modal` as a second copy of Settings. It is not declared in the Stack and nothing in `app/`, `components/` or `lib/` links to it (checked with grep). It is the Expo template leftover. Its only effect is a second way into Settings with a different transition and duplicate telemetry screen names. *Fix:* delete `app/modal.tsx`. If an old deep link must keep working, use `export default function Modal() { return <Redirect href="/settings" />; }`.

No other findings. The file has no UI of its own.

---

## 6. `app/+html.tsx` (web only; low priority while the app ships Android only)

### Low

**H-L1 · `lang="en"`** (`+html.tsx:6`). Screen readers and hyphenation treat the Spanish UI as English. *Fix:* `lang="es"`.

**H-L2 · The web background and theme colour are pure black, not the theme base** (`+html.tsx:12, 19`). `#000000` differs from `colors.background #091315`, so there is a black flash before hydration and a black area on overscroll. *Fix:* `content="#091315"` and `background-color: #091315;`.

**H-L3 · Brand spelling** (`+html.tsx:13`). The page title is `BrainIA`, but the copy elsewhere uses `Brain IA` (`settings.tsx:251, 333, 341`; `learning.tsx:80`). *Fix:* `<title>Brain IA</title>`, and align `_layout.tsx:41`.

**Already fine:** the viewport meta, `ScrollViewStyleReset` and the Spanish description are in place.

---

## Suggested fix order

1. **L-H1** (scrim text node). This is one line, and it can crash every sheet on device.
2. **S-H4, S-H5, S-H2.** These are behaviour problems: destructive reset, request storms and a misleading status.
3. **S-H1, L-H2, R-H1, N-L1, BottomSheet "Close".** One Spanish copy sweep.
4. **S-H3 + S-M1** (Row clamping and the Settings surface/edge alignment). These touch `Row` (shared), so check the other screens that use Row afterwards.
5. **L-M1** (visible back button in `Screen`), plus **S-L1**.
6. The toast items (**R-M1–R-M4**) in one change to `Toast.tsx`.
7. The remaining medium and low items.

## Limitations

- Nothing was checked on a device or emulator. L-H1 (crash) and the keyboard behaviour in S-M7 are based on reading the code and should be confirmed on Android.
- Text-fit numbers are estimates from the font metrics, not measurements.
- `NavigationRail.tsx` was not audited; it only renders at widths of 1024 and up. The English labels noted under L-H2 were seen in passing.
