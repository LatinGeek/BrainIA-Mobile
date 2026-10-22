# Design audit: sub-screens B (digest, insight, intelligence)

Task `task_bb222ab3fec7`, branch `LatinGeek/glass-design-polish`. This was a read-only code audit. No source files were edited, and nothing was run on a device.

**Scope.** `app/digest/[id].tsx`, `app/insight/[id].tsx`, `app/intelligence/index.tsx`, `app/intelligence/[id].tsx`, `components/intelligence/index.tsx` (ArtifactCard, statusLabels), `components/intelligence/CorrectionPanel.tsx` (mounted in `app/event/[id].tsx:59`).

**Shared components read.** Screen/Section, GlassSurface, GlassPressable, SignalCard, Row/IconTile, StateView, Timeline, BottomSheet, Button/Chip/SegmentedControl/Field/Tag/ConfidenceMeter, `useAsyncResource`, Toast.

**Rules applied.**
- Surfaces come from `GlassSurface` only.
- The page gutter is 20 (`Screen`) and spacing comes from `theme.spacing` (4/8/12/16/24/32/40). Radii come from `theme.radius`.
- Targets are at least 44 (`theme.layout.minTarget`) or padded with `hitSlop`.
- Copy is Spanish, apart from proper nouns.
- Motion uses `theme.motion` tokens and respects Reduce Motion.

Severity: **H** means broken or misleading UI that a user hits on a normal path. **M** means visible inconsistency or degraded UX. **L** means polish.

---

## Cross-cutting findings (affect several of the assigned screens)

| # | Sev | Where | Problem | Why it matters | Fix |
|---|---|---|---|---|---|
| X1 | H | `app/digest/[id].tsx:59`, `app/insight/[id].tsx:110` | The empty state sits in the `: …` branch of `digest ? … : <StateView "No hay … disponible">`, so it renders whenever data is null. That includes **during the first load**, under the skeleton, and **on error**, under the error card. | On every open, the user briefly sees a skeleton *and* "No hay resumen disponible", or an error *and* an empty message. The two contradict each other. | Gate the empty state: `{!loading && !error && !digest ? <StateView … /> : null}`, and render the content block only with `{digest ? (…) : null}`. Do the same in insight. |
| X2 | H | Shared, from `components/data/Row.tsx:86` (`numberOfLines={2}`) | Sentence-length content goes through `Row title`, which clamps at 2 lines with no way to expand: digest highlights `:34` and recommended action `:47`, insight takeaways `:61`, intelligence uncertainty `:128` and actions `:134`. These rows are `accessory="none"` and not pressable. | Model output is cut off with "…" and the full text cannot be reached. That is data loss on detail screens whose whole purpose is reading. | Add `titleLines?: number` to `Row` (default 2, `0` = unlimited: `numberOfLines={titleLines \|\| undefined}`) and pass `titleLines={0}` at these call sites. An alternative is to render them as bullet `Text` rows, as insight `:80-83` already does for its next step. |
| X3 | M | Same call sites as X2; `Row.tsx:274-281` | The rows render as bare transparent shells (`paddingHorizontal: 12`, `borderRadius: 12`, hairline bottom border) straight on the ambient field, not on a `GlassSurface`. Text starts at x=32, while Section titles start at x=20 and `SignalCard` (`padding lg`) content starts at x=36. The last row also leaves a dangling divider. | Rule 1 (surfaces) and rule 2 (ragged left edge). The lists read as floating text with stray lines next to glass cards. | Group each list in one surface: `<GlassSurface level="thin" padding="none">{rows}</GlassSurface>`. The 12pt row inset then matches the `padding md` cards at x=32, and you get one blur per list instead of none. Drop the bottom border on the last row (`style={index === arr.length - 1 ? { borderBottomWidth: 0 } : undefined}`). Also change `radius: 12` to `theme.radius.md`. |
| X4 | M | `components/data/SignalCard.tsx:15-18`, `components/controls/index.tsx:465` (ConfidenceMeter), `components/data/Timeline.tsx:20`, `components/data/StateView.tsx:43`, `components/layout/BottomSheet.tsx:24,29`, `components/layout/Screen.tsx:336`, `lib/hooks.ts:30` | Shared English copy shows up on these screens:<br>• visible text: provenance tags `Captured`/`You`/`Pending`, confidence words `Clear`/`Unsure`/`Guess` (visible on insight, `SignalCard` block with `showValue`), Timeline `No supporting evidence is available.`, the loading fallback `Unable to load data` (shown as the error description)<br>• accessibility labels only: `… confidence, N percent`, `${skeleton} loading state`, `Close` ×2, `Back`. | Spanish everywhere is the rule. | `Capturado`/`Tú`/`Pendiente`; `Clara`/`Dudosa`/`Estimada` and `` `Confianza ${word}, ${n} por ciento` ``; `No hay evidencia de respaldo.`; `` `Cargando ${…}` `` or just `Cargando`; `Cerrar`; `Volver`; `No se pudieron cargar los datos.` |
| X5 | M | `app/intelligence/index.tsx:43`, `app/intelligence/[id].tsx:80` | `onRefresh` is passed without `refreshing`, so `RefreshControl refreshing={false}` is constant and the spinner snaps back immediately. Nothing shows that a reload is in progress. | Rule 6/7: pull to refresh gives no feedback. | Track a `refreshing` state: `const [refreshing, setRefreshing] = useState(false); const pull = () => { setRefreshing(true); void load().finally(() => setRefreshing(false)); };` then `<Screen refreshing={refreshing} onRefresh={pull}>`. |
| X6 | L | `components/layout/Screen.tsx:426-439` vs `:491-503` | On `back` screens, the back button exists only inside the compact bar, which appears after 64pt of scroll. At scroll 0 the large header has no back affordance. All four assigned screens use `back`. | Android's system back covers navigation, but a pushed detail screen opened from a card shows no way back at the top. This is outside the brief's scope but visible on every assigned screen. | Render the same 44pt `GlassPressable` arrow (`accessibilityLabel="Volver"`) at the start of `headerTop` when `back`. |

---

## `app/digest/[id].tsx`

| # | Sev | Line | Problem | Why | Fix |
|---|---|---|---|---|---|
| D1 | H | 59 | The empty state shows together with the loading skeleton and the error state (X1). | — | See X1. |
| D2 | H | 34, 47 | Highlight rows and the recommended action are clamped to 2 lines (X2). | — | `titleLines={0}`. |
| D3 | M | 24 | English: overline fallback `'Digest'`. | Copy rule. | `'Resumen'`. |
| D4 | M | 33, 38, 45, 52, 54-55 | English section titles and buttons: `Highlights`, `Activity metrics`, `Next step`, `Follow-up`, `Search`, `Money`. `Money` is also wrong as a tab name; the Dock calls it `Dinero`. | Copy rule, and the label does not match the tab it opens. | `Destacados`, `Métricas de actividad`, `Próximo paso`, `Seguir explorando`; buttons `Explorar` (matches Dock `search`) and `Dinero`. |
| D5 | M | 26 | The loading `StateView title="Loading"` passes English. It is only used for a11y, and the label is built from `skeleton`. | Copy rule. | `title="Cargando resumen"`, and make StateView use `title` as its a11y label (X4). |
| D6 | M | 24, 30 | The same `windowLabel` renders three times: Screen overline, Screen subtitle, and SignalCard `meta`. `digest.title` also renders twice, as the Screen title and the SignalCard title. | Redundant header noise, and the SignalCard header row (Tag + meta + confidence) can overflow at 320 with a long window label. `meta` has no `numberOfLines`. | Screen: `overline="Resumen"`, `subtitle={digest?.windowLabel ?? '…'}`. SignalCard: `title="Resumen del período"` (as insight does with "Perspectiva asistida") and no `meta`. Add `numberOfLines={1}` + `flexShrink: 1` to the meta `Text` in `SignalCard.tsx:61`. |
| D7 | M | 44-50 | The recommended-action `Row` is nested inside `GlassSurface padding="md"`, so text sits at 20+12+12=44, a 24pt inset. Every other card on the screen sits at 32–36. | Ragged left edge (rule 2). | Use the insight pattern (`app/insight/[id].tsx:80-83`): `GlassSurface … contentStyle={{ flexDirection: 'row', gap: theme.spacing.md }}` with `IconTile` + `Text`, no Row. |
| D8 | L | 30 vs 38-42 | SignalCard already shows the first 3 metrics, and "Activity metrics" lists them all again. | Duplication. | Either drop `metrics` from the SignalCard, or list only `digest.metrics.slice(3)` in the section and hide the section when nothing is left. |
| D9 | L | 38-41 | Metrics use `Row title=label subtitle=value`, so the value is in small caption text under the label. | A metric's value is the primary datum. | Use `trailing={<Text style={[theme.typography.bodyStrong, { fontVariant: ['tabular-nums'] }]}>{metric.value}</Text>}` instead of `subtitle`. |
| D10 | L | 53 | `gap: 8` is a literal. | Token rule. | `theme.spacing.sm`. |

**Overlays:** none on this screen. **Motion:** Screen stagger and press feedback come from Button/Row; there is no gap here.

---

## `app/insight/[id].tsx`

| # | Sev | Line | Problem | Why | Fix |
|---|---|---|---|---|---|
| I1 | H | 110 | The empty state shows together with the loading skeleton and the error state (X1). | — | See X1. |
| I2 | H | 30-39 | `submitFeedback` has `try/finally` and no `catch`. A failed request gives an unhandled promise rejection and no visible message; the buttons just re-enable. | Rule 7: silent failure on a user action. | Add `catch { toast.show('No se pudo registrar tu respuesta.', { tone: 'danger' }); }` (`useToast` from `components/layout/Toast.tsx:78`), or set a local error string shown under the buttons. |
| I3 | M | 89-90 | `loading={savingFeedback && feedback !== 'reject'}` and its mirror. On the first press `feedback` is still `null`, so **both** buttons show a spinner. | It is unclear which choice is being saved. | Track the pending action: `const [pending, setPending] = useState<'accept'\|'reject'\|null>(null)`; `loading={pending === 'accept'}` / `loading={pending === 'reject'}`. |
| I4 | H | 61 | Takeaways are clamped to 2 lines (X2). | — | `titleLines={0}`. |
| I5 | M | 42, 48, 51, 59, 66, 79, 92, 96-99, 103, 105-106 | English copy:<br>• headings and text: overline `Insight`, meta `Generated …`, `Why it matters`, `Takeaways`, subtitle `Only references returned with this insight.`, `Next step`, Tag `Thanks — this adjusts future signals.`<br>• Technical details section: `Technical details`, `Model`, `Supporting items`, `Generated`, `Unknown`<br>• buttons: `More context`, `Search`, `Today`. | Copy rule. | Overline `Perspectiva`. Drop the SignalCard `meta` (it duplicates the subtitle at `:42`) or use `Generada …`. `Por qué importa`, `Conclusiones`, `Solo las referencias que acompañan esta perspectiva.`, `Próximo paso`, `Gracias. Esto ajusta las próximas señales.`. Technical details: `Detalles técnicos`, `Modelo`, `Elementos de respaldo`, `Generada`, `Desconocido`. Buttons: `Más contexto`, `Explorar`, `Hoy`. |
| I6 | M | 71 | Timeline `subtitle: reference.kind` prints the raw enum (`transaction`, `event`, …). | English, and an internal identifier is shown to the user. | `subtitle: ({ transaction: 'Movimiento', event: 'Evento' } as Record<string, string>)[reference.kind] ?? 'Referencia'`. |
| I7 | M | 44 | The loading `title="Loading"` is English (see D5). | — | `title="Cargando perspectiva"`. |
| I8 | L | 52, 80 | `contentStyle={{ flexDirection: 'row', gap: 10 }}`: 10 is off the spacing scale. | Token rule. | `gap: theme.spacing.md`. |
| I9 | L | 88, 104 | `gap: 8` literals. | Token rule. | `theme.spacing.sm`. |
| I10 | L | 92 | The confirmation Tag appears instantly with no enter motion, and the button label swaps instantly. | Rule 6: an instant swap after the action. | Wrap it in `<Animated.View entering={FadeIn.duration(theme.motion.duration.quick)}>`. This respects Reduce Motion by default in Reanimated 4. |

**Overlays:** none. **Targets:** `Button size="sm"` is 44, which is fine.

---

## `app/intelligence/index.tsx`

| # | Sev | Line | Problem | Why | Fix |
|---|---|---|---|---|---|
| N1 | H | 19, 23-24, 67 | There is no loading state. `items` starts as `[]`, so the first paint, and every refocus after a failed fetch, shows the onboarding empty state "Tu primera pregunta es el comienzo" even for users who have a library. If the list fails, the empty state also shows under the error. | Rule 7: misleading first paint and flicker on every open. | Add `const [loaded, setLoaded] = useState(false)` set in `.finally`. Render `StateView kind="loading" skeleton="card" skeletonCount={2}` while `!loaded`, and the empty state only when `loaded && !error && !items.length`. |
| N2 | M | 36, 51 | List-load errors and submit errors share one `error` string under the title "No se pudo iniciar", with action "Reintentar" → `load()`. A failed submit's retry reloads the list instead of resubmitting, and a failed list load reads as "could not start". | Wrong recovery action. | Split them into `listError` (title "No se pudo cargar tu biblioteca", retry `load`) and `submitError` (show it as `Field error={submitError}` under the question; the main button already retries). |
| N3 | M | 54-56 | Prompt chips are direct children of `Section`, which stacks them in a column with `alignItems: stretch`, so each becomes a full-width 34pt pill with left-aligned text. At 320 the longest prompt (≈280pt at 12pt plus 24pt padding) hits `numberOfLines={1}` and truncates. | Rule 2/4: the chips do not read as chips, and they risk truncation. | Wrap them in `<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>`. The Chip then sizes to its label, and a long one wraps onto its own line. |
| N4 | M | 46 | `Field multiline` has no `minHeight` or `textAlignVertical`. On Android a multiline `TextInput` centres its text vertically, and the box stays 44 tall. | The main input of the screen looks like a one-line field and the caret floats mid-box. | `style={{ minHeight: 88, textAlignVertical: 'top' }}` (same as `CorrectionPanel.tsx:106`). Consider adding `minHeight`/`textAlignVertical` as a `Field` default when `multiline`. |
| N5 | M | 43, 245 | English copy: overline `Knowledge`, empty-state action `Ask`. | Copy rule. | `Conocimiento`; `Preguntar`. |
| N6 | M | 43 | `onRefresh` has no `refreshing` (X5). | — | See X5. |
| N7 | L | 62 | `ANÁLISIS EN CURSO` is a hand-uppercased overline `Text`, the only sub-heading in the app that does not use a Section. It is coloured accent rather than `textMuted`. | Inconsistent hierarchy. | Split it into `<Section title="En curso" count={active.length}>` and `<Section title="Tu biblioteca">`, or at least write `'Análisis en curso'` and let `overline`'s `textTransform` handle the case. |
| N8 | L | 55 | Tapping a prompt chip only sets the text. There is no focus, the kind is not reset, and nothing reacts. | Rule 6: the input changes value with no feedback. | Keep a `ref` on the `TextInput` (forward it through `Field`) and call `ref.current?.focus()` after `setQuestion`. |
| N9 | L | — | No in-app route pushes `/intelligence` (grep: only `app/intelligence/*` and deep links). The screen is effectively orphaned. | Discoverability. This is a product decision, not a code defect. | Link it from Explorar/Search or Today if it should be reachable. |

**Overlays:** none. **Surfaces:** the composer is a `GlassSurface padding="lg"`, so its content sits at x=36 against the Section titles at x=20. That matches the SignalCard block convention and is acceptable. **Keyboard:** Android uses `softwareKeyboardLayoutMode: "resize"` (`app.json:18`) and the Field is near the top, so this is fine.

---

## `app/intelligence/[id].tsx`

| # | Sev | Line | Problem | Why | Fix |
|---|---|---|---|---|---|
| K1 | H | 21, 80-157 | There is no loading state. Until `api.get` resolves, the screen shows only the title "Construyendo una perspectiva" and an empty body. A failed first load shows the error card under the same "building" title. | Rule 7: a blank screen, and a title that claims progress. | Add `{!artifact && !error ? <StateView kind="loading" skeleton="detail" skeletonCount={3} title="Cargando" /> : null}` and use the title `artifact?.content?.title ?? (artifact ? 'Construyendo una perspectiva' : 'Conocimiento')`. |
| K2 | H | 91, 93 | Terminal non-content states have no explanation. For `failed`/`stale`/`cancelled` there is only a bare full-width "Actualizar análisis" button. For `insufficient` (`statusLabels`) nothing renders but the subtitle. | Rule 7: the user cannot tell what happened or why. | Render a `StateView` per status: `kind="error"` with title `statusLabels[status]`, a description per status (e.g. insufficient: "No encontramos evidencia suficiente en tus fuentes."), `actionLabel="Actualizar análisis"` and `onAction={() => void action('refresh')}`. |
| K3 | M | 138-144 | The feedback chips have no `selected` state and no `disabled={busy}`, so repeated taps send repeated `feedback` actions. The only confirmation is the `notice` text at `:82`, which is at the top of the page and off-screen when the user is at the bottom. | Rule 6: no visible response at the point of action, and duplicate writes. | Keep `const [feedbackValue, setFeedbackValue] = useState<string \| null>(null)`. Pass `selected={feedbackValue === value}` and `disabled={busy}`, and confirm via `useToast().show('Gracias. Tu valoración mejora las próximas perspectivas.')` instead of the top-of-page notice. Wrap the chips with `role="radio"` semantics, or use a `SegmentedControl` for single choice. |
| K4 | M | 25, 45, 70, 82 | `notice` is never cleared, so "Listo." / "Guardado…" stay forever and stale ones carry over between actions. It also appears with no motion. | Stale status copy. | Use the toast for transient confirmations (as in K3) and delete `notice`. If inline text is kept, clear it in `action`/`save` before the request. |
| K5 | M | 104-109 | The confirm `Button` label `Confirmar como conocimiento personal` (15pt, `numberOfLines={1}`) is ≈290pt. It stretches to the card's inner width, about 256pt at 320 (20+20 gutter, 12+12 card padding) and about 296pt at 360, so it truncates at 320. The toggled label `Confirmado por ti · Deshacer` hides the "undo" verb behind a dot. | Rule 4: the main action label is truncated. | Shorter copy: `Confirmar` / `Confirmado · Deshacer`, `size="sm"`, `style={{ alignSelf: 'flex-start' }}`. |
| K6 | M | 117 | English fallback `'Source'`. | Copy rule. | `'Fuente'`. |
| K7 | M | 80 | Overline `Knowledge`. | Copy rule. | `Conocimiento`. |
| K8 | M | 147 | Notes `Field multiline` has no `minHeight`/`textAlignVertical` (N4). | — | `style={{ minHeight: 88, textAlignVertical: 'top' }}`. |
| K9 | M | 80 | `onRefresh` has no `refreshing` (X5). | — | See X5. |
| K10 | M | 93-156 | When polling flips `queued/running → ready`, the progress card is swapped for the summary, claims and sections with no transition. Screen's stagger only replays on focus. | Rule 6: a large instant swap on the screen's main state change. | Key a `StaggerGroup` to the status (`<StaggerGroup enterKey={artifact.status === 'ready' ? 1 : 0}>…</StaggerGroup>`, exported from `Screen.tsx:326`), or wrap the content in `Animated.View entering={FadeIn.duration(theme.motion.duration.enter)}`. Both respect Reduce Motion. |
| K11 | L | 97-124 | Claims render as loose top-level cards with no section header, while everything after them is in Sections. The kind is only an overline colour (`warning` for inference, `accent` otherwise), so the colour carries meaning on its own. | Hierarchy, and colour as the only signal (the overline text does say it, so this is minor). | Wrap them in `<Section title="Conclusiones" count={claims.length}>`. Prefix the overline with an icon (`alert-circle` for Hipótesis, `check-circle` for Observación/Cálculo). |
| K12 | L | 34-38 | The 6s `setInterval` poll runs while the screen is mounted but not focused, for example after `ask()` pushes a child artifact on top. | Wasted requests, and the hidden parent re-renders. | Move it into `useFocusEffect(useCallback(() => { … }, [artifact?.status, load]))`. |
| K13 | L | 128, 134 | Uncertainty and action rows are clamped and sit bare (X2, X3), and are keyed by index. | — | See X2/X3. Keying by text is fine. |
| K14 | L | 85-89 | The running card uses a bare `ActivityIndicator` with no elapsed or step hint. Cancel is a full-width secondary button. | Polish only; the copy explains that the user can leave. | Optional: `Button size="sm"` with `alignSelf: 'center'`. |
| K15 | L | 139 | `gap: 8` literal. | Token rule. | `theme.spacing.sm`. |

**Keyboard:** the follow-up and notes Fields are at the bottom of the page above the dock. The Android `resize` mode plus Screen's `bottomPadding` (dock + 24) keeps them reachable, and the ScrollView has `keyboardShouldPersistTaps="handled"`. Nothing to fix.

---

## `components/intelligence/index.tsx` (ArtifactCard)

| # | Sev | Line | Problem | Why | Fix |
|---|---|---|---|---|---|
| A1 | H | 27, 36-41 | The card is a plain RN `Pressable`, so it has no scale, opacity or haptic feedback. It is also built by hand from two siblings: a `SignalCard` with full `radius.lg` corners, then a second `GlassSurface` "status strip" with square top corners butted under it. The SignalCard's rounded bottom corners leave notches against the square strip, the hairline borders double up at the seam, and each card mounts two blur/backdrop layers. | Rules 1 and 6. This is the main list item on the intelligence screen, and it looks broken at the seam and gives no press feedback. | Delete the strip and the `Pressable`, and use SignalCard's own press path: `<SignalCard variant="brief" origin="model" title={title} summary={summary} meta={kindLabel} action={<Tag label={statusLabels[artifact.status] ?? artifact.status} tone={tone} />} onPress={() => router.push(\`/intelligence/${artifact.id}\`)} />`. SignalCard already wraps in `GlassPressable scaleTo={0.985}` and shows the arrow icon. |
| A2 | M | 34, 38 | The status is shown twice, as the SignalCard `footer` and as the strip overline. | Redundant. | Fixed by A1: show it once, as a Tag. |
| A3 | M | 33 | English meta: `Knowledge`, `Your week`, `Your day`, `Answer`. | Copy rule. | `Página`, `Tu semana`, `Tu día`, `Respuesta`. |
| A4 | L | 34 | `tone` maps `cancelled` and `insufficient` to `info` (cyan, the same as running). | A terminal state reads as in progress. | `insufficient`/`cancelled` → `'neutral'`; `queued`/`running` → `'info'`. |
| A5 | L | 46 | Strip literals `paddingVertical: 6`, `gap: 6`, `fontSize 13` icon. | Token rule. | Removed by A1. |

`statusLabels` copy is Spanish. There are no overlays.

---

## `components/intelligence/CorrectionPanel.tsx` (used in `app/event/[id].tsx:59`)

| # | Sev | Line | Problem | Why | Fix |
|---|---|---|---|---|---|
| C1 | M | 84 | The mode `SegmentedControl` uses `flex: 1` segments with icon + `Evento o notificación` / `Transacción` at 12pt, `numberOfLines={1}`. At 320, each segment's label box is about 90pt, so the first label truncates to "Evento o notif…". | Rule 4. | Shorter labels: `Evento` / `Movimiento` (the app's word for transactions elsewhere). Alternatively drop the icons below 360 width. |
| C2 | M | 91-92, 37 | Switching `kind` between `expense` and `income` does not clear `financialCategory`. An expense category stays selected for an income, and the chip shows it as chosen. `categoryOptions` changes underneath it. | A wrong category gets taught to the model. | `onChange={(next) => { setKind(next); setFinancialCategory(''); }}`. |
| C3 | M | 120-126 | The sheet's "Nueva categoría" `onSubmitEditing` fires `client.createFinancialCategory` with no `catch` and no feedback. If the category list is empty (fetch failed silently at `:40`), the sheet shows an empty `View` with no empty state. | Rule 7: silent failure and an empty sheet. | Use `.catch(() => setStatus('No se pudo crear la categoría.'))`, and add `{categoryOptions.length ? … : <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Todavía no hay categorías. Escribe una nueva.</Text>}`. |
| C4 | M | 107-111 | The dictation button is hand-built: 44/22 literals, raw `backgroundColor: theme.glass.inner`, no visible label, left-aligned on its own row under the field. Nothing pulses or moves while recording; only a caption appears. | Rules 1, 2 and 6. It reads as an orphaned icon, and the recording state is weak. | Move it into the Field: `trailing={<Button iconOnly size="sm" variant="secondary" accessibilityLabel=… icon={<Feather …/>} onPress={…} />}`. That uses tokens and gives a 44 target. While `recording`, set `variant="danger"`, or add a reduce-motion-gated opacity pulse with `withRepeat(withTiming(0.5, { duration: theme.motion.duration.count }), -1, true)`. |
| C5 | L | 82, 106, 112, 72 | The copy uses voseo (`Decidí`, `Contale`, `tocá`, `Intentá`) while every other assigned screen uses tú (`Pregunta`, `Conecta`, `Puedes`, `Intenta`). | Inconsistent voice. | Pick one register app-wide. For tú: `Decide`, `Cuéntale`, `toca`, `Intenta`. |
| C6 | L | 98, 102 | Single-choice event-kind chips and suggestion chips use `Chip selected`, which shows an `x` icon (Chip `:28`). That suggests "remove", not "chosen", and there is no radio semantics. | It misleads users about what the control does. | Add a `Chip` prop such as `dismissible={false}` to hide the `x`, or use `SegmentedControl role="radio" scrollable` for event kinds. |
| C7 | L | 101 | `gap: 6` here vs `gap: 8` at `:97`; both are literals. | Token rule. | `theme.spacing.sm` for both. |
| C8 | L | 18 | `Transferir` (a verb) sits next to the nouns `Gasto`/`Ingreso`. | Copy consistency. | `Transferencia`. |
| C9 | L | 113-114 | The status text replaces the button result with no motion. The success message stays until the next interaction. | Rule 6 (minor). | `useToast().show(...)` for success; keep the inline danger text for errors. |

**Overlays:** BottomSheet has a scrim tap to dismiss, `onRequestClose` (Android back), a safe-area top and bottom, `KeyboardAvoidingView behavior="height"` on Android, a 44 close button with hitSlop, and a reduce-motion entrance. The only issue is the English `Close` a11y labels (X4). **Collapsible Section:** the open/close is an instant mount/unmount (`Screen.tsx:582`). Wrapping the children in `Animated.View entering={FadeIn} exiting={FadeOut}` would cover rule 6 there, and the change goes in the shared Section. Low.

---

## Severity summary

- **High (10):** X1 (digest/insight empty-state overlap), X2 (clamped sentences), I2, N1, K1, K2, A1. Some of these repeat across screens: D1/I1 are X1, and D2/I4 are X2.
- **Medium:** X3, X4, X5; D3–D7; I3, I5–I7; N2–N6; K3–K10; A2, A3; C1–C4.
- **Low:** everything else.

## Suggested fix order

1. Fix the state gating in X1, N1, K1 and K2. These are small, local and high-impact.
2. Rebuild ArtifactCard on SignalCard `onPress` (A1).
3. Add `Row titleLines` and group bare rows in a thin `GlassSurface` (X2, X3).
4. Do one copy sweep: X4, D3–D5, I5–I7, N5, K6–K7, A3, C1, C5, C8.
5. Wire refresh and feedback: X5, I2, I3, K3, K4.

None of these needs new dependencies or routing changes.

## Limitations

This was a code-reading audit only. Nothing was rendered, measured on device or run in the web build. The truncation widths (N3, K5, C1) are estimates from font size, padding and the 20pt gutter, not measurements.
