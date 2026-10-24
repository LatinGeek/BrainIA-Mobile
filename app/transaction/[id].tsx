import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Button, Chip, Field, SegmentedControl, Tag } from '@/components/controls';
import { Amount, IconTile, Row } from '@/components/data/Row';
import { StateView } from '@/components/data/StateView';
import { Timeline } from '@/components/data/Timeline';
import { GlassPressable } from '@/components/glass/GlassPressable';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { BottomSheet } from '@/components/layout/BottomSheet';
import { Screen, Section } from '@/components/layout/Screen';
import { useAppState, useBrainIAClient, useTheme } from '@/lib/app-state';
import { loadTransactionBundle } from '@/lib/api';
import { useAsyncResource } from '@/lib/hooks';
import { formatCategoryLabel, formatCurrency, parseCurrency } from '@/lib/format';
import { maskAccount, shouldShowEvidenceDetail } from '@/lib/presentation';
import { DEFAULT_FINANCIAL_CATEGORIES, type FinancialAccount, type FinancialCategories } from '@/lib/domain';

type EditableTransactionKind = 'expense' | 'income' | 'transfer';

export default function TransactionDetailScreen() {
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: 'category' }>();
  const client = useBrainIAClient();
  const { invalidateFinancialData, settings } = useAppState();
  const theme = useTheme();
  const [editorOpen, setEditorOpen] = useState(false);
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<FinancialCategories>(DEFAULT_FINANCIAL_CATEGORIES);
  const [transactionKind, setTransactionKind] = useState<EditableTransactionKind>('expense');
  const [currency, setCurrency] = useState<'UYU' | 'USD'>('UYU');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [destinationAccountId, setDestinationAccountId] = useState<string | null>(null);
  const [destinationCurrency, setDestinationCurrency] = useState<'UYU' | 'USD'>('UYU');
  const [amount, setAmount] = useState('');
  const [destinationAmount, setDestinationAmount] = useState('');
  const [fromAccountName, setFromAccountName] = useState('');
  const [toAccountName, setToAccountName] = useState('');
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [badgeExplanationOpen, setBadgeExplanationOpen] = useState(false);
  const [titleEditorOpen, setTitleEditorOpen] = useState(false);
  const [removingTransaction, setRemovingTransaction] = useState(false);
  const didOpenRequestedEditor = useRef(false);
  const loader = useMemo(() => () => loadTransactionBundle(client, id), [client, id]);
  const { data, loading, error, refresh, reload } = useAsyncResource(loader, [loader]);

  const transaction = data?.transaction;
  const evidenceItems = transaction?.evidence.length
    ? transaction.evidence
    : transaction?.primarySource
      ? [{ id: `${transaction.id}_primary-source`, rawEventId: undefined, source: transaction.primarySource, kind: transaction.kind, amount: transaction.amount, merchantLabel: transaction.merchantLabel, observedAt: transaction.observedAt, matchReason: 'Fuente principal de este movimiento.' }]
      : [];
  const originEventId = evidenceItems.find((item) => item.rawEventId)?.rawEventId;
  const originLoader = useMemo(() => async () => originEventId ? client.getEvent(originEventId) : undefined, [client, originEventId]);
  const { data: originEvent } = useAsyncResource(originLoader, [originLoader]);
  const originSource = originEvent?.source ?? evidenceItems[0]?.source ?? transaction?.primarySource;
  const displayMerchantLabel = transaction?.displayMerchantLabel ?? transaction?.merchantLabel;
  const [title, setTitle] = useState('');
  const [titleSaving, setTitleSaving] = useState(false);
  const [titleMessage, setTitleMessage] = useState<string | null>(null);

  const openEditor = useCallback(() => {
    if (!transaction) return;
    const initialKind: EditableTransactionKind = transaction.kind === 'income' || transaction.kind === 'transfer' ? transaction.kind : 'expense';
    setCategory(transaction.category ?? '');
    setTransactionKind(initialKind);
    setCurrency(transaction.currency === 'USD' ? 'USD' : 'UYU');
    setAccountId(transaction.accountId ?? null);
    setDestinationAccountId(transaction.destinationAccountId ?? null);
    setDestinationCurrency(transaction.destinationCurrency === 'USD' ? 'USD' : transaction.destinationCurrency === 'UYU' ? 'UYU' : transaction.currency === 'USD' ? 'USD' : 'UYU');
    setAmount(transaction.amount);
    setDestinationAmount(transaction.destinationAmount ?? (initialKind === 'transfer' ? transaction.amount : ''));
    setFromAccountName(transaction.accountId ? '' : transaction.account ?? '');
    setToAccountName(transaction.destinationAccountId ? '' : transaction.destinationAccount ?? '');
    setSaveError(null);
    setEditorOpen(true);
    void Promise.allSettled([client.listFinancialAccounts(), client.listFinancialCategories()])
      .then(([accountsResult, categoriesResult]) => {
        if (accountsResult.status === 'fulfilled') setAccounts(accountsResult.value);
        else setAccounts([]);
        if (categoriesResult.status === 'fulfilled') setCategories(categoriesResult.value);
        else setCategories(DEFAULT_FINANCIAL_CATEGORIES);
      });
  }, [client, transaction]);

  useEffect(() => {
    if (edit !== 'category' || !transaction || didOpenRequestedEditor.current) return;
    didOpenRequestedEditor.current = true;
    openEditor();
  }, [edit, openEditor, transaction]);

  async function saveContext() {
    if (!transaction) return;
    const parsedAmount = parseCurrency(amount);
    const parsedDestinationAmount = parseCurrency(destinationAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setSaveError('Agrega un monto enviado válido.');
      return;
    }
    if (transactionKind === 'transfer' && !accountId && !fromAccountName.trim()) {
      setSaveError('Elige o crea la cuenta de la que sale la transferencia.');
      return;
    }
    if (transactionKind === 'transfer' && !destinationAccountId && !toAccountName.trim()) {
      setSaveError('Elige o crea la cuenta que recibe la transferencia.');
      return;
    }
    if (transactionKind === 'transfer' && (!Number.isFinite(parsedDestinationAmount) || parsedDestinationAmount <= 0)) {
      setSaveError('Indica el monto que recibe la cuenta de destino.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      let selectedAccountId = accountId;
      if (!selectedAccountId && fromAccountName.trim()) {
        const created = await client.createFinancialAccount({ name: fromAccountName.trim(), currency });
        selectedAccountId = created.id;
      }
      let selectedDestinationAccountId = destinationAccountId;
      if (transactionKind === 'transfer' && !selectedDestinationAccountId && toAccountName.trim()) {
        const created = await client.createFinancialAccount({ name: toAccountName.trim(), currency: destinationCurrency });
        selectedDestinationAccountId = created.id;
      }
      if (transactionKind === 'transfer' && selectedAccountId === selectedDestinationAccountId) {
        setSaveError('Una transferencia debe usar dos cuentas distintas.');
        return;
      }
      await client.updateTransactionContext(transaction.id, {
        category: transactionKind === 'transfer' ? null : category,
        amount: parsedAmount,
        accountId: selectedAccountId,
        destinationAccountId: transactionKind === 'transfer' ? selectedDestinationAccountId : null,
        destinationAmount: transactionKind === 'transfer' ? parsedDestinationAmount : null,
        destinationCurrency: transactionKind === 'transfer' ? destinationCurrency : null,
        currency,
        kind: transactionKind,
      });
      setEditorOpen(false);
      invalidateFinancialData();
      await reload();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'No se pudo guardar el movimiento.');
    } finally {
      setSaving(false);
    }
  }

  async function saveTitle() {
    if (!transaction || !title.trim()) return;
    setTitleSaving(true);
    setTitleMessage(null);
    try {
      await client.updateTransactionContext(transaction.id, { title: title.trim() });
      setTitleMessage('Título guardado.');
      invalidateFinancialData();
      await reload();
      setTitleEditorOpen(false);
    } catch (error) {
      setTitleMessage(error instanceof Error ? error.message : 'No se pudo guardar este título.');
    } finally {
      setTitleSaving(false);
    }
  }

  function openTitleEditor() {
    setTitle(displayMerchantLabel ?? transaction?.merchantLabel ?? '');
    setTitleMessage(null);
    setTitleEditorOpen(true);
  }

  function confirmRemoveTransaction(kind: 'promotion' | 'delete') {
    if (!transaction || removingTransaction) return;
    const promotion = kind === 'promotion';
    Alert.alert(
      promotion ? '¿No fue un movimiento?' : '¿Eliminar movimiento financiero?',
      promotion ? 'Se quitará de Dinero y se recordará que esta notificación es promocional.' : 'Se quitará de Dinero y de los informes. El registro de origen se conservará.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: promotion ? 'Marcar como promoción' : 'Eliminar',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setRemovingTransaction(true);
              try {
                if (promotion) await client.markTransactionFalsePositive(transaction.id);
                else await client.deleteTransaction(transaction.id);
                invalidateFinancialData();
                router.replace('/financials');
              } catch (removalError) {
                Alert.alert('No se pudo actualizar el movimiento', removalError instanceof Error ? removalError.message : 'Prueba nuevamente.');
              } finally {
                setRemovingTransaction(false);
              }
            })();
          },
        },
      ],
    );
  }

  const evidenceCount = transaction?.evidenceCount ?? evidenceItems.length;
  // Long merchant names are clamped to two lines in the title; the full name moves to the subtitle.
  const isLongTitle = (displayMerchantLabel ?? '').length > 26;

  return (
    <Screen
      title={displayMerchantLabel ?? 'Transacción'}
      titleLines={2}
      overline="Movimiento"
      subtitle={isLongTitle ? `${displayMerchantLabel} · Movimiento de dinero con su contexto de origen.` : 'Movimiento de dinero con el contexto de origen detrás del resumen.'}
      back
      refreshing={loading}
      onRefresh={refresh}
      actions={<GlassPressable accessibilityRole="button" accessibilityLabel="Editar título del movimiento" onPress={openTitleEditor} scaleTo={0.9} style={{ width: theme.layout.minTarget, height: theme.layout.minTarget, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.glass.inner }}><Feather name="edit-2" size={18} color={theme.colors.textPrimary} /></GlassPressable>}
    >
      {error ? <StateView kind="error" title="No se pudo cargar el movimiento" description={error} actionLabel="Reintentar" onAction={refresh} /> : null}
      {loading && !transaction ? <StateView kind="loading" title="Cargando" skeleton="detail" skeletonCount={2} /> : null}

      {transaction ? (
        <>
          <GlassSurface level="strong" tone={transaction.kind === 'income' ? 'finance' : 'neutral'} padding="lg" contentStyle={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <Tag label={transaction.excludedFromReports ? 'Ajuste de saldo' : transaction.kind === 'income' ? 'Ingreso' : transaction.kind === 'transfer' ? 'Transferencia' : 'Gasto'} tone={transaction.kind === 'income' ? 'positive' : transaction.kind === 'transfer' ? 'info' : 'danger'} icon={transaction.kind === 'income' ? 'arrow-down-left' : transaction.kind === 'transfer' ? 'repeat' : 'arrow-up-right'} />
              <GlassPressable accessibilityRole="button" accessibilityLabel="Sobre esta señal" onPress={() => setBadgeExplanationOpen(true)} scaleTo={0.92} style={{ width: theme.layout.minTarget, height: theme.layout.minTarget, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.glass.inner }}>
                <Feather name="info" size={15} color={theme.colors.textMuted} />
              </GlassPressable>
            </View>
            <Amount value={transaction.amount} currency={transaction.currency} tone={transaction.kind === 'income' ? 'income' : 'expense'} size="hero" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Fact label="Categoría" value={transaction.excludedFromReports ? 'Ajuste de saldo' : formatCategoryLabel(transaction.category)} />
              <Fact label="Cuenta" value={maskAccount(transaction.account, settings.dataVisibility)} />
              <Fact label="Fecha" value={transaction.observedAt ?? 'Desconocida'} />
              <Fact label="Fuentes" value={`${evidenceCount} ${evidenceCount === 1 ? 'fuente' : 'fuentes'}`} />
            </View>
          </GlassSurface>

          <Section title="Origen" subtitle={transaction.excludedFromReports ? 'Creado manualmente para conciliar el saldo de una cuenta.' : 'El registro capturado que originó este movimiento.'}>
            <GlassSurface level="thin" padding="md" contentStyle={{ gap: 8 }}>
              <Row
                title={originEvent?.title ?? (transaction.excludedFromReports ? 'Ajuste manual de saldo' : formatSourceLabel(originSource))}
                subtitle={originEvent ? `${formatSourceLabel(originEvent.source)} · ${originEvent.kind}` : originSource ? `Capturada mediante ${formatSourceLabel(originSource)}` : 'La fuente todavía se está vinculando'}
                description={originEvent?.body ? originEvent.body.slice(0, 150) : originEventId ? 'Abre el evento original para revisar su contenido.' : transaction.excludedFromReports ? 'Este registro cambia el saldo de la cuenta pero no cuenta como ingreso ni gasto.' : 'Todavía no hay un evento capturado vinculado.'}
                leading={<IconTile icon={transaction.excludedFromReports ? 'user' : 'inbox'} color={transaction.excludedFromReports ? theme.colors.user : theme.colors.captured} />}
                trailing={originEventId ? <Tag label="Abrir" tone="info" /> : undefined}
                onPress={originEventId ? () => router.push({ pathname: '/event/[id]', params: { id: originEventId } }) : undefined}
                accessory="none"
              />
            </GlassSurface>
          </Section>

          {transaction.kind === 'transfer' ? (
            <Section title="Transferencia">
              <Row title={maskAccount(transaction.account, settings.dataVisibility)} subtitle="Cuenta de origen" leading={<IconTile icon="credit-card" />} accessory="none" />
              <Row title={maskAccount(transaction.destinationAccount, settings.dataVisibility)} subtitle="Cuenta de destino" leading={<IconTile icon="credit-card" />} accessory="none" />
              {transaction.destinationAmount && transaction.destinationCurrency ? <Row title={formatCurrency(parseCurrency(transaction.destinationAmount), transaction.destinationCurrency)} subtitle="Monto recibido" leading={<IconTile icon="repeat" />} accessory="none" /> : null}
            </Section>
          ) : null}

          <Section title="Contexto" subtitle="Categoriza este movimiento y asócialo con una cuenta de tu portafolio.">
            <Button label="Editar categoría y cuenta" variant="secondary" onPress={openEditor} icon={<Feather name="edit-2" size={14} color={theme.colors.textPrimary} />} />
          </Section>

          <Section title="Explicación">
            <GlassSurface level="thin" padding="md" contentStyle={{ gap: 6 }}>
              <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Construido a partir de {evidenceCount} {evidenceCount === 1 ? 'fuente' : 'fuentes'}</Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Las fuentes aparecen debajo en las vistas Balanced y Detailed.</Text>
              {transaction.status ? <Text style={[theme.typography.mono, { color: theme.colors.textMuted }]}>Estado: {transaction.status}</Text> : null}
            </GlassSurface>
          </Section>

          {shouldShowEvidenceDetail(settings.dataVisibility) ? (
            <Section title="Fuentes" subtitle={transaction.observedWindow ?? 'Observaciones vinculadas'}>
              {evidenceItems.length ? (
                <Timeline items={evidenceItems.map((item) => ({
                  id: item.id,
                  icon: item.source.toLowerCase().includes('mail') || item.source.toLowerCase().includes('gmail') ? 'mail' : item.source.toLowerCase().includes('wallet') ? 'credit-card' : 'bell',
                  title: item.source,
                  subtitle: item.kind,
                  amount: item.amount ? `${item.amount} ${item.currency ?? ''}`.trim() : undefined,
                  time: item.observedAt,
                  reason: item.matchReason,
                  onPress: item.rawEventId ? () => router.push({ pathname: '/event/[id]', params: { id: item.rawEventId! } }) : undefined,
                }))} />
              ) : <StateView title="Todavía no hay fuentes vinculadas" description="Esta transacción aún no está vinculada con un correo, notificación, recibo o registro de billetera capturado." />}
            </Section>
          ) : <StateView title="Evidencia oculta" description="Cambia Fuentes de datos a Balanced o Detailed en Ajustes para inspeccionar las observaciones vinculadas." />}

          <Section title="¿Hay un error?" subtitle="Podés quitar este registro de Dinero o indicar que la notificación era una promoción.">
            {!transaction.excludedFromReports ? <Button label="Marcar como promoción" variant="secondary" onPress={() => confirmRemoveTransaction('promotion')} disabled={removingTransaction} /> : null}
            <Button label="Eliminar movimiento" variant="danger" onPress={() => confirmRemoveTransaction('delete')} disabled={removingTransaction} />
          </Section>
        </>
      ) : (
        <StateView title="Movimiento no disponible" description="Todavía no hay detalles de este movimiento." />
      )}

      <BottomSheet visible={editorOpen} title="Contexto del movimiento" onClose={() => setEditorOpen(false)}>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Tipo de movimiento</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(['expense', 'income', 'transfer'] as const).map((kind) => (
            <Chip key={kind} label={kind === 'expense' ? 'Gasto' : kind === 'income' ? 'Ingreso' : 'Transferencia'} selected={transactionKind === kind} onPress={() => { setTransactionKind(kind); setCategory(''); setSaveError(null); if (kind === 'transfer' && !destinationAmount) setDestinationAmount(transaction?.amount ?? ''); }} />
          ))}
        </View>
        {transactionKind === 'transfer' ? <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Es una transferencia entre cuentas. No se suma a gastos ni ingresos.</Text> : (
          <>
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Categoría</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {Array.from(new Set([category, ...categories[transactionKind]])).filter(Boolean).map((option) => (
                <Chip key={option} label={option} selected={category === option} onPress={() => setCategory(option)} />
              ))}
            </View>
          </>
        )}
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{transactionKind === 'transfer' ? 'Moneda de origen' : 'Moneda del movimiento'}</Text>
        <SegmentedControl items={[{ value: 'UYU', label: 'UYU' }, { value: 'USD', label: 'USD' }]} value={currency} onChange={(value) => { setCurrency(value as 'UYU' | 'USD'); setAccountId(null); setFromAccountName(''); }} />
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{transactionKind === 'transfer' ? 'Cuenta de origen' : 'Cuenta del portafolio'}</Text>
        {accounts.filter((account) => account.currency === currency).map((account) => (
          <Row key={account.id} title={account.name} subtitle={`${account.type} · ${account.currency}`} leading={<IconTile icon="credit-card" color={account.color} />} trailing={<Text style={{ color: accountId === account.id ? theme.colors.success : theme.colors.textMuted }}>{accountId === account.id ? 'Elegida' : 'Usar'}</Text>} onPress={() => { setAccountId(account.id); if (destinationAccountId === account.id) setDestinationAccountId(null); setFromAccountName(''); }} />
        ))}
        <Field label={transactionKind === 'transfer' ? 'Nueva cuenta de origen' : 'Nombre de la nueva cuenta'} value={fromAccountName} onChangeText={(value) => { setFromAccountName(value); setAccountId(null); }} placeholder="Cuenta bancaria principal" />
        <Field label={transactionKind === 'transfer' ? `Monto enviado (${currency})` : `Monto (${currency})`} accessibilityLabel="Monto de origen editado" value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" variant="amount" />
        {transactionKind === 'transfer' ? (
          <>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Moneda de destino</Text>
            <SegmentedControl items={[{ value: 'UYU', label: 'UYU' }, { value: 'USD', label: 'USD' }]} value={destinationCurrency} onChange={(value) => { setDestinationCurrency(value as 'UYU' | 'USD'); setDestinationAccountId(null); setToAccountName(''); }} />
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Cuenta de destino</Text>
            {accounts.filter((account) => account.currency === destinationCurrency && account.id !== accountId).map((account) => (
              <Row key={`destination_${account.id}`} title={account.name} subtitle={`${account.type} / ${account.currency}`} leading={<IconTile icon="credit-card" color={account.color} />} trailing={<Text style={{ color: destinationAccountId === account.id ? theme.colors.success : theme.colors.textMuted }}>{destinationAccountId === account.id ? 'Elegida' : 'Usar'}</Text>} onPress={() => { setDestinationAccountId(account.id); setToAccountName(''); }} />
            ))}
            <Field label="Nombre de la cuenta de destino" value={toAccountName} onChangeText={(value) => { setToAccountName(value); setDestinationAccountId(null); }} placeholder="Cuenta bancaria de destino" />
            <Field label={`Monto recibido (${destinationCurrency})`} accessibilityLabel="Monto de destino editado" value={destinationAmount} onChangeText={setDestinationAmount} placeholder="0.00" keyboardType="decimal-pad" variant="amount" />
          </>
        ) : null}
        {saveError ? <Text style={{ color: theme.colors.danger }}>{saveError}</Text> : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button label="Guardar" onPress={saveContext} loading={saving} />
          <Button label="Cancelar" onPress={() => setEditorOpen(false)} variant="secondary" disabled={saving} />
        </View>
      </BottomSheet>

      <BottomSheet visible={titleEditorOpen} title="Editar título del movimiento" onClose={() => !titleSaving && setTitleEditorOpen(false)}>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Usa un nombre claro que reconozcas. Solo cambia este movimiento y deja intacto el registro capturado.</Text>
        <Field label="Título" value={title} onChangeText={setTitle} placeholder={transaction?.merchantLabel ?? 'Título del movimiento'} autoFocus />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button label="Guardar título" onPress={saveTitle} disabled={!title.trim() || titleSaving} loading={titleSaving} />
          <Button label="Cancelar" onPress={() => setTitleEditorOpen(false)} variant="secondary" disabled={titleSaving} />
        </View>
        {titleMessage ? <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{titleMessage}</Text> : null}
      </BottomSheet>

      <BottomSheet visible={badgeExplanationOpen} title="Sobre esta señal" onClose={() => setBadgeExplanationOpen(false)}>
        <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Movimiento detectado</Text>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>BrainIA reconoció esta actividad capturada como un movimiento de dinero y creó este movimiento a partir de su evento de origen.</Text>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Todavía puede necesitar revisión. Comprueba la fuente, la categoría y la cuenta antes de usarla en tu vista financiera.</Text>
      </BottomSheet>
    </Screen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={{ width: '48%', flexGrow: 1, padding: 10, borderRadius: theme.radius.md, backgroundColor: theme.glass.inner, borderWidth: 1, borderColor: theme.glass.divider, gap: 2 }}>
      <Text style={[theme.typography.overline, { color: theme.colors.textMuted }]}>{label}</Text>
      <Text numberOfLines={2} style={[theme.typography.caption, { color: theme.colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

function formatSourceLabel(source?: string) {
  if (!source) return 'Fuente desconocida';
  const labels: Record<string, string> = {
    'make.gmail': 'Gmail vía Make',
    'make.outlook': 'Outlook vía Make',
    wallet: 'Captura de billetera',
    notification: 'Notificación del dispositivo',
  };
  return labels[source.toLowerCase()] ?? source.replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
