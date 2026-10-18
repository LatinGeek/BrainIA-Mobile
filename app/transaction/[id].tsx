import { useLocalSearchParams, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { FinancialSnapshotCard } from '@/components/cards';
import { EvidenceRow } from '@/components/finance';
import { AccountIcon } from '@/components/finance/AccountIcon';
import { CategoryPicker } from '@/components/review';
import { AppScreen, SectionHeader, TopBar } from '@/components/layout';
import { BottomSheet, Button, FilterChip, IconButton, Input, ListRow, Surface } from '@/components/primitives';
import { EmptyState, LoadingSkeleton } from '@/components/states';
import { MoneyAmount, ProvenanceMark } from '@/components/trust';
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
      ? [{ id: `${transaction.id}_primary-source`, rawEventId: undefined, source: transaction.primarySource, kind: transaction.kind, amount: transaction.amount, merchantLabel: transaction.merchantLabel, observedAt: transaction.observedAt, matchReason: 'Primary source for this transaction.' }]
      : [];
  const originEventId = evidenceItems.find((item) => item.rawEventId)?.rawEventId;
  const originLoader = useMemo(
    () => async () => originEventId ? client.getEvent(originEventId) : undefined,
    [client, originEventId]
  );
  const { data: originEvent } = useAsyncResource(originLoader, [originLoader]);
  const originSource = originEvent?.source ?? evidenceItems[0]?.source ?? transaction?.primarySource;
  const displayMerchantLabel = transaction?.displayMerchantLabel
    ?? transaction?.merchantLabel;
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
    const parsedAmount = Number(amount.replace(',', '.'));
    const parsedDestinationAmount = Number(destinationAmount.replace(',', '.'));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setSaveError('Agrega un monto enviado válido.');
      return;
    }
    if (transactionKind === 'transfer' && !accountId && !fromAccountName.trim()) {
      setSaveError('Choose or create the account the transfer is coming from.');
      return;
    }
    if (transactionKind === 'transfer' && !destinationAccountId && !toAccountName.trim()) {
      setSaveError('Choose or create the account receiving the transfer.');
      return;
    }
    if (transactionKind === 'transfer' && (!Number.isFinite(parsedDestinationAmount) || parsedDestinationAmount <= 0)) {
      setSaveError('Add the amount received by the destination account.');
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
        setSaveError('A transfer must use two different accounts.');
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
      setSaveError(error instanceof Error ? error.message : 'Could not save transaction details.');
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
      setTitleMessage('Transaction title saved.');
      invalidateFinancialData();
      await reload();
      setTitleEditorOpen(false);
    } catch (error) {
      setTitleMessage(error instanceof Error ? error.message : 'Could not save this transaction title.');
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
      promotion
        ? 'Se quitará de Dinero y se recordará que esta notificación es promocional.'
        : 'Se quitará de Dinero y de los informes. El registro de origen se conservará.',
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


  return (
    <AppScreen refreshing={loading} onRefresh={refresh}>
      <TopBar
        showBack
        title={displayMerchantLabel ?? 'Transacción'}
        subtitle="Movimiento de dinero con el contexto de origen disponible detrás del resumen."
        secondaryAction={<IconButton icon={<Feather name="edit-2" size={18} color={theme.colors.textPrimary} />} label="Editar título del movimiento" onPress={openTitleEditor} />}
      />

      {error ? <EmptyState title="No se pudo cargar el movimiento" description={error} primaryActionLabel="Reintentar" onPrimaryAction={refresh} /> : null}

      {loading && !transaction ? (
        <LoadingSkeleton variant="detail" count={2} />
      ) : transaction ? (
        <>
          <FinancialSnapshotCard
            title={displayMerchantLabel ?? transaction.merchantLabel}
            periodLabel={`${transaction.excludedFromReports ? 'Balance adjustment · excluded from reports' : transaction.kind === 'income' ? 'Ingresos' : formatCategoryLabel(transaction.category)} · ${transaction.currency}`}
            amount={formatCurrency(parseCurrency(transaction.amount), transaction.currency)}
            onBadgePress={() => setBadgeExplanationOpen(true)}
          />

          <SectionHeader title="Origen" subtitle={transaction.excludedFromReports ? 'Created manually to reconcile an account balance.' : 'The captured record that created this transaction.'} />
          <Surface variant="raised" style={{ gap: theme.spacing.xs, borderColor: theme.colors.accent + '55' }}>
            <ProvenanceMark origin={transaction.excludedFromReports ? 'user' : 'captured'} />
            <ListRow
              title={originEvent?.title ?? (transaction.excludedFromReports ? 'Manual balance adjustment' : formatSourceLabel(originSource))}
              subtitle={originEvent ? `${formatSourceLabel(originEvent.source)} · ${originEvent.kind}` : originSource ? `Capturada mediante ${formatSourceLabel(originSource)}` : 'La fuente todavía se está vinculando'}
              description={originEvent?.body ? originEvent.body.slice(0, 150) : originEventId ? 'Open the original captured event to inspect its contents.' : transaction.excludedFromReports ? 'This record changes the account balance but is not counted as income or spending.' : 'No linked captured event is available yet.'}
              trailing={originEventId ? <Text style={[theme.typography.caption, { color: theme.colors.accentStrong }]}>Abrir</Text> : undefined}
              onPress={originEventId ? () => router.push({ pathname: '/event/[id]', params: { id: originEventId! } }) : undefined}
            />
          </Surface>

          <SectionHeader title="Resumen del movimiento" />
          <View style={{ gap: 8 }}>
            <ListRow title={formatCurrency(parseCurrency(transaction.amount), transaction.currency)} subtitle={transaction.excludedFromReports ? `Ajuste de saldo (${transaction.kind})` : transaction.kind === 'income' ? 'Ingreso' : transaction.kind === 'transfer' ? 'Monto enviado' : 'Gasto'} description={transaction.observedAt} trailing={<MoneyAmount amount={transaction.amount} currency={transaction.currency} tone={transaction.kind === 'income' ? 'income' : 'expense'} compact />} />
            {transaction.kind === 'transfer' ? <>
              <ListRow title={maskAccount(transaction.account, settings.dataVisibility)} subtitle="Cuenta de origen" />
              {transaction.destinationAmount && transaction.destinationCurrency ? <ListRow title={formatCurrency(parseCurrency(transaction.destinationAmount), transaction.destinationCurrency)} subtitle="Importe recibido" /> : null}
              <ListRow title={maskAccount(transaction.destinationAccount, settings.dataVisibility)} subtitle="Cuenta de destino" />
            </> : <ListRow title={formatCategoryLabel(transaction.category)} subtitle="Categoría" />}
            <ListRow title={maskAccount(transaction.account, settings.dataVisibility)} subtitle={`Account · ${transaction.currency}`} />
          </View>

          <Surface variant="subtle" style={{ gap: theme.spacing.sm }}>
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Contexto del movimiento</Text>
            <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Categorize this movement and associate it with an account in your portfolio.</Text>
            <Button label="Editar categoría y cuenta" onPress={openEditor} variant="secondary" />
          </Surface>

          <Surface variant="subtle" style={{ gap: theme.spacing.sm }}>
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>¿Hay un error?</Text>
            <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Podés quitar este registro de Dinero o indicar que la notificación era una promoción.</Text>
            {!transaction.excludedFromReports ? <Button label="Marcar como promoción, no movimiento" onPress={() => confirmRemoveTransaction('promotion')} variant="secondary" disabled={removingTransaction} /> : null}
            <Button label="Eliminar movimiento" onPress={() => confirmRemoveTransaction('delete')} variant="danger" disabled={removingTransaction} />
          </Surface>

          <SectionHeader title="Explicación" />
          <Surface variant="subtle">
            <ListRow
              title={`Built from ${transaction.evidenceCount ?? evidenceItems.length} source${(transaction.evidenceCount ?? evidenceItems.length) === 1 ? '' : 's'}`}
              subtitle="Las fuentes aparecen debajo en las vistas Equilibrada y Detallada."
              description={transaction.status ? `Status: ${transaction.status}` : undefined}
            />
          </Surface>

          {shouldShowEvidenceDetail(settings.dataVisibility) ? (
            <>
              <SectionHeader title="Fuentes" subtitle={transaction.observedWindow ?? 'Linked observations'} />
              {evidenceItems.length ? evidenceItems.map((item) => <EvidenceRow key={item.id} source={item.source} kind={item.kind} amount={item.amount} merchantLabel={item.merchantLabel} observedAt={item.observedAt} matchReason={item.matchReason} onPress={item.rawEventId ? () => router.push({ pathname: '/event/[id]', params: { id: item.rawEventId! } }) : undefined} />) : <EmptyState title="Todavía no hay fuentes vinculadas" description="Esta transacción aún no está vinculada con un correo, notificación, recibo o registro de billetera capturado." />}
            </>
          ) : (
            <EmptyState title="Evidencia oculta" description="Cambia Fuentes de datos a Equilibrado o Detallado en Ajustes para inspeccionar las observaciones vinculadas." />
          )}

          <EmptyState
            title="Acciones relacionadas"
            description="Abre Dinero para ver tendencias o Explorar para encontrar este comercio en tu conocimiento y tus finanzas."
            primaryActionLabel="Dinero"
            onPrimaryAction={() => router.push('/financials')}
            secondaryActionLabel="Buscar comercio"
            onSecondaryAction={() => router.push('/search')}
          />
        </>
      ) : (
        <EmptyState title="Movimiento no disponible" description="Todavía no hay detalles de este movimiento." />
      )}

      <BottomSheet visible={editorOpen} title="Contexto del movimiento" onClose={() => setEditorOpen(false)}>
        <View style={{ gap: theme.spacing.md }}>
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Tipo de movimiento</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {(['expense', 'income', 'transfer'] as const).map((kind) => (
              <FilterChip
                key={kind}
                label={kind === 'expense' ? 'Expense' : kind === 'income' ? 'Ingresos' : 'Transfer'}
                selected={transactionKind === kind}
                onPress={() => {
                  setTransactionKind(kind);
                  setCategory('');
                  setSaveError(null);
                  if (kind === 'transfer' && !destinationAmount) setDestinationAmount(transaction?.amount ?? '');
                }}
              />
            ))}
          </View>
          {transactionKind === 'transfer'
            ? <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Es una transferencia entre cuentas. No se suma a gastos ni ingresos.</Text>
            : <><Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Categoría</Text><CategoryPicker categories={[category, ...categories[transactionKind]]} selectedCategory={category} onSelect={setCategory} /></>}
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{transactionKind === 'transfer' ? 'From currency' : 'Transaction currency'}</Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <FilterChip label="UYU" selected={currency === 'UYU'} onPress={() => { setCurrency('UYU'); setAccountId(null); setFromAccountName(''); if (transactionKind === 'transfer' && destinationCurrency === 'UYU') setDestinationAmount(transaction?.amount ?? ''); }} />
            <FilterChip label="USD" selected={currency === 'USD'} onPress={() => { setCurrency('USD'); setAccountId(null); setFromAccountName(''); if (transactionKind === 'transfer' && destinationCurrency === 'USD') setDestinationAmount(transaction?.amount ?? ''); }} />
          </View>
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{transactionKind === 'transfer' ? 'Cuenta de origen' : 'Portfolio account'}</Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Only {currency} accounts can be linked to this transaction.</Text>
          {accounts.filter((account) => account.currency === currency).map((account) => (
            <ListRow key={account.id} title={account.name} subtitle={`${account.type} · ${account.currency}`} leading={<AccountIcon color={account.color} />} trailing={<Text style={{ color: accountId === account.id ? theme.colors.success : theme.colors.textMuted }}>{accountId === account.id ? 'Selected' : 'Use'}</Text>} onPress={() => { setAccountId(account.id); if (destinationAccountId === account.id) setDestinationAccountId(null); setFromAccountName(''); }} />
          ))}
          <Input label={transactionKind === 'transfer' ? 'Nueva cuenta de origen' : 'Nombre de la nueva cuenta'} value={fromAccountName} onChangeText={(value) => { setFromAccountName(value); setAccountId(null); }} placeholder="Cuenta bancaria principal" />
          <Input label={transactionKind === 'transfer' ? `Monto enviado (${currency})` : `Monto (${currency})`} accessibilityLabel="Monto de origen editado" value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" />
          {transactionKind === 'transfer' ? <>
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Moneda de destino</Text>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <FilterChip label="UYU" selected={destinationCurrency === 'UYU'} onPress={() => { setDestinationCurrency('UYU'); setDestinationAccountId(null); setToAccountName(''); setDestinationAmount(currency === 'UYU' ? transaction?.amount ?? '' : ''); }} />
              <FilterChip label="USD" selected={destinationCurrency === 'USD'} onPress={() => { setDestinationCurrency('USD'); setDestinationAccountId(null); setToAccountName(''); setDestinationAmount(currency === 'USD' ? transaction?.amount ?? '' : ''); }} />
            </View>
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Cuenta de destino</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Only {destinationCurrency} accounts can receive this transfer.</Text>
            {accounts.filter((account) => account.currency === destinationCurrency && account.id !== accountId).map((account) => (
              <ListRow key={`destination_${account.id}`} title={account.name} subtitle={`${account.type} / ${account.currency}`} leading={<AccountIcon color={account.color} />} trailing={<Text style={{ color: destinationAccountId === account.id ? theme.colors.success : theme.colors.textMuted }}>{destinationAccountId === account.id ? 'Selected' : 'Use'}</Text>} onPress={() => { setDestinationAccountId(account.id); setToAccountName(''); }} />
            ))}
            <Input label="Nombre de la cuenta de destino" value={toAccountName} onChangeText={(value) => { setToAccountName(value); setDestinationAccountId(null); }} placeholder="Cuenta bancaria de destino" />
            <Input label={`Monto recibido (${destinationCurrency})`} accessibilityLabel="Monto de destino editado" value={destinationAmount} onChangeText={setDestinationAmount} placeholder="0.00" keyboardType="decimal-pad" />
          </> : null}
          {!accounts.some((account) => account.currency === currency) ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>No compatible account exists yet. Create a {currency} account below.</Text> : null}
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>New source account currency: {currency}{transactionKind === 'transfer' ? ` · New destination account currency: ${destinationCurrency}` : ''}</Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Button label="Guardar" onPress={saveContext} loading={saving} />
            <Button label="Cancelar" onPress={() => setEditorOpen(false)} variant="secondary" disabled={saving} />
          </View>
          {saveError ? <Text style={{ color: theme.colors.danger }}>{saveError}</Text> : null}
        </View>
      </BottomSheet>

      <BottomSheet visible={titleEditorOpen} title="Editar título del movimiento" onClose={() => !titleSaving && setTitleEditorOpen(false)}>
        <View style={{ gap: theme.spacing.md }}>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Use a clear name you will recognize. This changes only this transaction and keeps the original captured record unchanged.</Text>
          <Input label="Título" value={title} onChangeText={setTitle} placeholder={transaction?.merchantLabel ?? 'Transaction title'} autoFocus />
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Button label="Guardar título" onPress={saveTitle} disabled={!title.trim() || titleSaving} loading={titleSaving} />
            <Button label="Cancelar" onPress={() => setTitleEditorOpen(false)} variant="secondary" disabled={titleSaving} />
          </View>
          {titleMessage ? <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{titleMessage}</Text> : null}
        </View>
      </BottomSheet>

      <BottomSheet visible={badgeExplanationOpen} title="Sobre esta señal" onClose={() => setBadgeExplanationOpen(false)}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Movimiento detectado</Text>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>BrainIA recognized this captured activity as a money movement and created this transaction from its source event.</Text>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Todavía puede necesitar revisión. Comprueba la fuente, la categoría y la cuenta antes de usarla en tu vista financiera.</Text>
        </View>
      </BottomSheet>

    </AppScreen>
  );
}

function formatSourceLabel(source?: string) {
  if (!source) return 'Fuente desconocida';
  const labels: Record<string, string> = {
    'make.gmail': 'Gmail via Make',
    'make.outlook': 'Outlook via Make',
    wallet: 'Wallet capture',
    notification: 'Device notification',
  };
  return labels[source.toLowerCase()] ?? source.replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
