import { useLocalSearchParams, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { FinancialSnapshotCard } from '@/components/cards';
import { EvidenceRow } from '@/components/finance';
import { AccountIcon } from '@/components/finance/AccountIcon';
import { CategoryPicker } from '@/components/review';
import { AppScreen, SectionHeader, TopBar } from '@/components/layout';
import { BottomSheet, Button, FilterChip, Input, ListRow, Surface } from '@/components/primitives';
import { EmptyState, LoadingSkeleton } from '@/components/states';
import { useAppState, useBrainIAClient, useTheme } from '@/lib/app-state';
import { loadTransactionBundle } from '@/lib/api';
import { useAsyncResource } from '@/lib/hooks';
import { formatCategoryLabel, formatCurrency, parseCurrency } from '@/lib/format';
import { maskAccount, shouldShowEvidenceDetail } from '@/lib/presentation';
import type { FinancialAccount, FinancialCategories } from '@/lib/domain';

type EditableTransactionKind = 'expense' | 'income' | 'transfer';

export default function TransactionDetailScreen() {
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: 'category' }>();
  const client = useBrainIAClient();
  const { settings } = useAppState();
  const theme = useTheme();
  const [editorOpen, setEditorOpen] = useState(false);
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<FinancialCategories>({ expense: [], income: [] });
  const [transactionKind, setTransactionKind] = useState<EditableTransactionKind>('expense');
  const [currency, setCurrency] = useState<'UYU' | 'USD'>('UYU');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [destinationAccountId, setDestinationAccountId] = useState<string | null>(null);
  const [destinationCurrency, setDestinationCurrency] = useState<'UYU' | 'USD'>('UYU');
  const [destinationAmount, setDestinationAmount] = useState('');
  const [fromAccountName, setFromAccountName] = useState('');
  const [toAccountName, setToAccountName] = useState('');
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [badgeExplanationOpen, setBadgeExplanationOpen] = useState(false);
  const [titleEditorOpen, setTitleEditorOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [mergeCandidates, setMergeCandidates] = useState<Awaited<ReturnType<typeof client.listTransactions>>>([]);
  const [merging, setMerging] = useState(false);
  const [manageError, setManageError] = useState<string | null>(null);
  const didOpenRequestedEditor = useRef(false);
  const loader = useMemo(() => () => loadTransactionBundle(client, id), [client, id]);
  const { data, loading, error, refresh } = useAsyncResource(loader, [loader]);

  const transaction = data?.transaction;
  const evidenceItems = transaction?.evidence.length
    ? transaction.evidence
    : transaction?.primarySource
      ? [{ id: `${transaction.id}_primary-source`, rawEventId: undefined, source: transaction.primarySource, kind: transaction.kind, amount: transaction.amount, merchantLabel: transaction.merchantLabel, observedAt: transaction.observedAt, matchReason: 'Primary source for this transaction.' }]
      : [];
  const originEventId = evidenceItems.find((item) => item.rawEventId)?.rawEventId;
  const originLoader = useMemo(
    () => async () => originEventId ? (await client.listEvents()).find((event) => event.id === originEventId) : undefined,
    [client, originEventId]
  );
  const { data: originEvent } = useAsyncResource(originLoader, [originLoader]);
  const originSource = originEvent?.source ?? evidenceItems[0]?.source ?? transaction?.primarySource;
  const aliasLoader = useMemo(
    () => async () => transaction?.merchantEntityId ? client.listEntityAliases(transaction.merchantEntityId) : [],
    [client, transaction]
  );
  const { data: merchantAliases } = useAsyncResource(aliasLoader, [aliasLoader]);
  const aliasSuggestionsLoader = useMemo(() => () => client.listEntityAliases(), [client]);
  const { data: allAliases } = useAsyncResource(aliasSuggestionsLoader, [aliasSuggestionsLoader]);
  const displayMerchantLabel = transaction?.displayMerchantLabel
    ?? merchantAliases?.find((alias) => alias.trim().toLocaleLowerCase() !== transaction?.merchantLabel.trim().toLocaleLowerCase())
    ?? transaction?.merchantLabel;
  const [alias, setAlias] = useState('');
  const [aliasSaving, setAliasSaving] = useState(false);
  const [aliasMessage, setAliasMessage] = useState<string | null>(null);
  const aliasSuggestions = (allAliases ?? [])
    .filter((candidate) => candidate.trim().toLocaleLowerCase().includes(alias.trim().toLocaleLowerCase()))
    .filter((candidate, index, values) => values.indexOf(candidate) === index)
    .slice(0, 5);

  const openEditor = useCallback(() => {
    if (!transaction) return;
    const initialKind: EditableTransactionKind = transaction.kind === 'income' || transaction.kind === 'transfer' ? transaction.kind : 'expense';
    setCategory(transaction.category ?? '');
    setTransactionKind(initialKind);
    setCurrency(transaction.currency === 'USD' ? 'USD' : 'UYU');
    setAccountId(transaction.accountId ?? null);
    setDestinationAccountId(transaction.destinationAccountId ?? null);
    setDestinationCurrency(transaction.destinationCurrency === 'USD' ? 'USD' : transaction.destinationCurrency === 'UYU' ? 'UYU' : transaction.currency === 'USD' ? 'USD' : 'UYU');
    setDestinationAmount(transaction.destinationAmount ?? (initialKind === 'transfer' ? transaction.amount : ''));
    setFromAccountName(transaction.accountId ? '' : transaction.account ?? '');
    setToAccountName(transaction.destinationAccountId ? '' : transaction.destinationAccount ?? '');
    setSaveError(null);
    setEditorOpen(true);
    void Promise.all([client.listFinancialAccounts(), client.listFinancialCategories()])
      .then(([availableAccounts, categorySets]) => {
        setAccounts(availableAccounts);
        setCategories(categorySets);
      })
      .catch(() => {
        setAccounts([]);
        setCategories({ expense: [], income: [] });
      });
  }, [client, transaction]);

  useEffect(() => {
    if (edit !== 'category' || !transaction || didOpenRequestedEditor.current) return;
    didOpenRequestedEditor.current = true;
    openEditor();
  }, [edit, openEditor, transaction]);

  async function saveContext() {
    if (!transaction) return;
    const parsedDestinationAmount = Number(destinationAmount.replace(',', '.'));
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
        accountId: selectedAccountId,
        destinationAccountId: transactionKind === 'transfer' ? selectedDestinationAccountId : null,
        destinationAmount: transactionKind === 'transfer' ? parsedDestinationAmount : null,
        destinationCurrency: transactionKind === 'transfer' ? destinationCurrency : null,
        currency,
        kind: transactionKind,
      });
      setEditorOpen(false);
      await refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save transaction details.');
    } finally {
      setSaving(false);
    }
  }

  async function saveAlias() {
    if (!transaction?.merchantEntityId || !alias.trim()) return false;
    setAliasSaving(true);
    setAliasMessage(null);
    try {
      await client.createEntityAlias({ entityId: transaction.merchantEntityId, alias: alias.trim() });
      setAlias('');
      setAliasMessage('Alias saved. It will be used as this merchant’s display name.');
      await refresh();
      return true;
    } catch (error) {
      setAliasMessage(error instanceof Error ? error.message : 'Could not save this alias.');
      return false;
    } finally {
      setAliasSaving(false);
    }
  }

  function openTitleEditor() {
    setAlias(displayMerchantLabel ?? transaction?.merchantLabel ?? '');
    setAliasMessage(null);
    setTitleEditorOpen(true);
  }

  async function saveTitle() {
    if (await saveAlias()) setTitleEditorOpen(false);
  }

  async function openManageTransaction() {
    if (!transaction) return;
    setManageError(null);
    setManageOpen(true);
    try {
      const items = await client.listTransactions(100);
      setMergeCandidates(items.filter(
        (candidate) =>
          candidate.id !== transaction.id
          && (candidate.kind === transaction.kind || (transaction.kind === 'transfer' && candidate.kind === 'expense'))
          && !candidate.excludedFromReports,
      ));
    } catch (error) {
      setManageError(error instanceof Error ? error.message : 'Could not load transactions to consolidate.');
    }
  }

  function confirmMerge(duplicateId: string, duplicateLabel: string) {
    if (!transaction) return;
    Alert.alert(
      'Consolidate transactions?',
      `Keep ${displayMerchantLabel ?? transaction.merchantLabel} as the main transaction and attach the evidence from ${duplicateLabel}. The selected duplicate will be hidden from Money, but its original event remains available.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Consolidate',
          onPress: () => {
            void (async () => {
              setMerging(true);
              setManageError(null);
              try {
                await client.mergeTransactions(transaction.id, duplicateId);
                setManageOpen(false);
                await refresh();
              } catch (error) {
                setManageError(error instanceof Error ? error.message : 'Could not consolidate these transactions.');
              } finally {
                setMerging(false);
              }
            })();
          },
        },
      ],
    );
  }

  function confirmDelete() {
    if (!transaction) return;
    Alert.alert(
      'Hide this transaction?',
      'It will be removed from Money and reports, while the original captured event stays intact. This choice is kept if the event is reprocessed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Hide transaction',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setMerging(true);
              setManageError(null);
              try {
                await client.deleteTransaction(transaction.id);
                setManageOpen(false);
                router.replace('/financials');
              } catch (error) {
                setManageError(error instanceof Error ? error.message : 'Could not hide this transaction.');
              } finally {
                setMerging(false);
              }
            })();
          },
        },
      ],
    );
  }

  return (
    <AppScreen refreshing={loading} onRefresh={refresh}>
      <TopBar showBack title={displayMerchantLabel ?? 'Transaction'} subtitle="Money movement with the source context kept behind the summary." />

      {error ? <EmptyState title="Unable to load transaction" description={error} primaryActionLabel="Retry" onPrimaryAction={refresh} /> : null}

      {loading && !transaction ? (
        <LoadingSkeleton variant="detail" count={2} />
      ) : transaction ? (
        <>
          <FinancialSnapshotCard
            title={displayMerchantLabel ?? transaction.merchantLabel}
            periodLabel={`${transaction.excludedFromReports ? 'Balance adjustment · excluded from reports' : transaction.kind === 'income' ? 'Income' : formatCategoryLabel(transaction.category)} · ${transaction.currency}`}
            amount={formatCurrency(parseCurrency(transaction.amount), transaction.currency)}
            onBadgePress={() => setBadgeExplanationOpen(true)}
          />

          <SectionHeader title="Origin" subtitle={transaction.excludedFromReports ? 'Created manually to reconcile an account balance.' : 'The captured record that created this transaction.'} />
          <Surface variant="raised" style={{ gap: theme.spacing.xs, borderColor: theme.colors.accent + '55' }}>
            <ListRow
              title={originEvent?.title ?? (transaction.excludedFromReports ? 'Manual balance adjustment' : formatSourceLabel(originSource))}
              subtitle={originEvent ? `${formatSourceLabel(originEvent.source)} · ${originEvent.kind}` : originSource ? `Captured via ${formatSourceLabel(originSource)}` : 'Source is still being linked'}
              description={originEvent?.body ? originEvent.body.slice(0, 150) : originEventId ? 'Open the original captured event to inspect its contents.' : transaction.excludedFromReports ? 'This record changes the account balance but is not counted as income or spending.' : 'No linked captured event is available yet.'}
              trailing={originEventId ? <Text style={[theme.typography.caption, { color: theme.colors.accentStrong }]}>Open</Text> : undefined}
              onPress={originEventId ? () => router.push({ pathname: '/event/[id]', params: { id: originEventId! } }) : undefined}
            />
          </Surface>

          <SectionHeader title="Transaction summary" />
          <View style={{ gap: 8 }}>
            <ListRow title={formatCurrency(parseCurrency(transaction.amount), transaction.currency)} subtitle={transaction.excludedFromReports ? `Balance adjustment (${transaction.kind})` : transaction.kind === 'income' ? 'Income' : transaction.kind === 'transfer' ? 'Sent amount' : 'Expense'} description={transaction.observedAt} />
            {transaction.kind === 'transfer' ? <>
              <ListRow title={maskAccount(transaction.account, settings.dataVisibility)} subtitle="From account" />
              {transaction.destinationAmount && transaction.destinationCurrency ? <ListRow title={formatCurrency(parseCurrency(transaction.destinationAmount), transaction.destinationCurrency)} subtitle="Received amount" /> : null}
              <ListRow title={maskAccount(transaction.destinationAccount, settings.dataVisibility)} subtitle="To account" />
            </> : <ListRow title={formatCategoryLabel(transaction.category)} subtitle="Category" />}
            <ListRow title={maskAccount(transaction.account, settings.dataVisibility)} subtitle={`Account · ${transaction.currency}`} />
          </View>

          <Surface variant="subtle" style={{ gap: theme.spacing.sm }}>
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Transaction context</Text>
            <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Categorize this movement and associate it with an account in your portfolio.</Text>
            <Button label="Edit category and account" onPress={openEditor} variant="secondary" />
          </Surface>

          <Surface variant="subtle" style={{ gap: theme.spacing.sm }}>
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Manage transaction</Text>
            <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Consolidate duplicate records from another app, or hide this financial projection while keeping its original event.</Text>
            <Button label="Consolidate or hide" onPress={openManageTransaction} variant="secondary" />
          </Surface>

          {transaction.merchantEntityId ? (
            <Surface variant="subtle" style={{ gap: theme.spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md }}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Transaction title</Text>
                  <Text numberOfLines={1} style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{displayMerchantLabel ?? transaction.merchantLabel}</Text>
                </View>
                <Button label="Edit title" onPress={openTitleEditor} variant="secondary" size="sm" />
              </View>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>BrainIA will use this title for future transactions from the same merchant.</Text>
            </Surface>
          ) : null}

          <SectionHeader title="Explanation" />
          <Surface variant="subtle">
            <ListRow
              title={`Built from ${transaction.evidenceCount ?? evidenceItems.length} source${(transaction.evidenceCount ?? evidenceItems.length) === 1 ? '' : 's'}`}
              subtitle="Sources are visible below in Balanced and Detailed views."
              description={transaction.status ? `Status: ${transaction.status}` : undefined}
            />
          </Surface>

          {shouldShowEvidenceDetail(settings.dataVisibility) ? (
            <>
              <SectionHeader title="Sources" subtitle={transaction.observedWindow ?? 'Linked observations'} />
              {evidenceItems.length ? evidenceItems.map((item) => <EvidenceRow key={item.id} source={item.source} kind={item.kind} amount={item.amount} merchantLabel={item.merchantLabel} observedAt={item.observedAt} matchReason={item.matchReason} onPress={item.rawEventId ? () => router.push({ pathname: '/event/[id]', params: { id: item.rawEventId! } }) : undefined} />) : <EmptyState title="No linked sources yet" description="This transaction has not been linked to a captured email, notification, receipt, or wallet record yet." />}
            </>
          ) : (
            <EmptyState title="Evidence hidden" description="Switch Data sources to Balanced or Detailed in Settings to inspect linked observations." />
          )}

          <EmptyState
            title="Related actions"
            description="Open Money for trends or Search to inspect this merchant across knowledge and finance."
            primaryActionLabel="Money"
            onPrimaryAction={() => router.push('/financials')}
            secondaryActionLabel="Search merchant"
            onSecondaryAction={() => router.push('/search')}
          />
        </>
      ) : (
        <EmptyState title="No transaction available" description="No transaction detail is available yet." />
      )}

      <BottomSheet visible={editorOpen} title="Transaction context" onClose={() => setEditorOpen(false)}>
        <View style={{ gap: theme.spacing.md }}>
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Transaction type</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {(['expense', 'income', 'transfer'] as const).map((kind) => (
              <FilterChip
                key={kind}
                label={kind === 'expense' ? 'Expense' : kind === 'income' ? 'Income' : 'Transfer'}
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
            ? <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>This is an account transfer. It is excluded from spending, income, and category totals.</Text>
            : <><Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Category</Text><CategoryPicker categories={[category, ...categories[transactionKind]]} selectedCategory={category} onSelect={setCategory} /></>}
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{transactionKind === 'transfer' ? 'From currency' : 'Transaction currency'}</Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <FilterChip label="UYU" selected={currency === 'UYU'} onPress={() => { setCurrency('UYU'); setAccountId(null); setFromAccountName(''); if (transactionKind === 'transfer' && destinationCurrency === 'UYU') setDestinationAmount(transaction?.amount ?? ''); }} />
            <FilterChip label="USD" selected={currency === 'USD'} onPress={() => { setCurrency('USD'); setAccountId(null); setFromAccountName(''); if (transactionKind === 'transfer' && destinationCurrency === 'USD') setDestinationAmount(transaction?.amount ?? ''); }} />
          </View>
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{transactionKind === 'transfer' ? 'From account' : 'Portfolio account'}</Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Only {currency} accounts can be linked to this transaction.</Text>
          {accounts.filter((account) => account.currency === currency).map((account) => (
            <ListRow key={account.id} title={account.name} subtitle={`${account.type} · ${account.currency}`} leading={<AccountIcon color={account.color} />} trailing={<Text style={{ color: accountId === account.id ? theme.colors.success : theme.colors.textMuted }}>{accountId === account.id ? 'Selected' : 'Use'}</Text>} onPress={() => { setAccountId(account.id); if (destinationAccountId === account.id) setDestinationAccountId(null); setFromAccountName(''); }} />
          ))}
          <Input label={transactionKind === 'transfer' ? 'New from account name' : 'New account name'} value={fromAccountName} onChangeText={(value) => { setFromAccountName(value); setAccountId(null); }} placeholder="Main bank account" />
          {transactionKind === 'transfer' ? <>
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>To currency</Text>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <FilterChip label="UYU" selected={destinationCurrency === 'UYU'} onPress={() => { setDestinationCurrency('UYU'); setDestinationAccountId(null); setToAccountName(''); setDestinationAmount(currency === 'UYU' ? transaction?.amount ?? '' : ''); }} />
              <FilterChip label="USD" selected={destinationCurrency === 'USD'} onPress={() => { setDestinationCurrency('USD'); setDestinationAccountId(null); setToAccountName(''); setDestinationAmount(currency === 'USD' ? transaction?.amount ?? '' : ''); }} />
            </View>
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>To account</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Only {destinationCurrency} accounts can receive this transfer.</Text>
            {accounts.filter((account) => account.currency === destinationCurrency && account.id !== accountId).map((account) => (
              <ListRow key={`destination_${account.id}`} title={account.name} subtitle={`${account.type} / ${account.currency}`} leading={<AccountIcon color={account.color} />} trailing={<Text style={{ color: destinationAccountId === account.id ? theme.colors.success : theme.colors.textMuted }}>{destinationAccountId === account.id ? 'Selected' : 'Use'}</Text>} onPress={() => { setDestinationAccountId(account.id); setToAccountName(''); }} />
            ))}
            <Input label="New to account name" value={toAccountName} onChangeText={(value) => { setToAccountName(value); setDestinationAccountId(null); }} placeholder="Destination bank account" />
            <Input label={`Received amount (${destinationCurrency})`} accessibilityLabel="Edited transfer destination amount" value={destinationAmount} onChangeText={setDestinationAmount} placeholder="0.00" keyboardType="decimal-pad" />
          </> : null}
          {!accounts.some((account) => account.currency === currency) ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>No compatible account exists yet. Create a {currency} account below.</Text> : null}
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>New source account currency: {currency}{transactionKind === 'transfer' ? ` · New destination account currency: ${destinationCurrency}` : ''}</Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Button label="Save" onPress={saveContext} loading={saving} />
            <Button label="Cancel" onPress={() => setEditorOpen(false)} variant="secondary" disabled={saving} />
          </View>
          {saveError ? <Text style={{ color: theme.colors.danger }}>{saveError}</Text> : null}
        </View>
      </BottomSheet>

      <BottomSheet visible={titleEditorOpen} title="Edit transaction title" onClose={() => !aliasSaving && setTitleEditorOpen(false)}>
        <View style={{ gap: theme.spacing.md }}>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Use a clear name you will recognize. It will also label future matching transactions when BrainIA can identify the same merchant.</Text>
          <Input label="Title" value={alias} onChangeText={setAlias} placeholder={transaction?.merchantLabel ?? 'Transaction title'} autoFocus />
          {alias.trim() && aliasSuggestions.length ? (
            <View style={{ gap: 6 }}>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Previously used titles</Text>
              {aliasSuggestions.map((candidate) => <ListRow key={candidate} title={candidate} subtitle="Use this title" onPress={() => setAlias(candidate)} />)}
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Button label="Save title" onPress={saveTitle} disabled={!alias.trim() || aliasSaving} loading={aliasSaving} />
            <Button label="Cancel" onPress={() => setTitleEditorOpen(false)} variant="secondary" disabled={aliasSaving} />
          </View>
          {aliasMessage ? <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{aliasMessage}</Text> : null}
        </View>
      </BottomSheet>

      <BottomSheet visible={badgeExplanationOpen} title="About this signal" onClose={() => setBadgeExplanationOpen(false)}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Financial signal</Text>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>BrainIA recognized this captured activity as a money movement and created this transaction from its source event.</Text>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>It can still need review. Check the source, category, and account before relying on it in your financial view.</Text>
        </View>
      </BottomSheet>

      <BottomSheet visible={manageOpen} title="Manage transaction" onClose={() => !merging && setManageOpen(false)}>
        <View style={{ gap: theme.spacing.md }}>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{transaction?.kind === 'transfer'
            ? 'Keep this transfer as the main record. You can consolidate a duplicate transfer or an expense that represents the same outgoing transfer from another app or source.'
            : 'Keep this transaction as the main record. Choose another transaction only when both records describe the same payment from different apps or sources.'}</Text>
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Possible duplicate</Text>
          {mergeCandidates.length ? mergeCandidates.map((candidate) => (
            <ListRow
              key={candidate.id}
              title={candidate.displayMerchantLabel ?? candidate.merchantLabel}
              subtitle={`${formatCurrency(parseCurrency(candidate.amount), candidate.currency)} · ${candidate.observedAt}`}
              description={`${candidate.evidenceCount ?? 1} source${(candidate.evidenceCount ?? 1) === 1 ? '' : 's'}`}
              trailing={<Text style={{ color: theme.colors.accentStrong }}>Merge</Text>}
              onPress={() => confirmMerge(candidate.id, candidate.displayMerchantLabel ?? candidate.merchantLabel)}
            />
          )) : <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{transaction?.kind === 'transfer' ? 'No recent duplicate transfer or expense is available to consolidate.' : 'No other recent transaction of the same type is available to consolidate.'}</Text>}
          <View style={{ gap: theme.spacing.xs }}>
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Incorrect record?</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Hide only this financial projection. Its captured email, notification, or event remains untouched.</Text>
            <Button label="Delete transaction" onPress={confirmDelete} variant="danger" disabled={merging} />
          </View>
          {manageError ? <Text style={{ color: theme.colors.danger }}>{manageError}</Text> : null}
        </View>
      </BottomSheet>
    </AppScreen>
  );
}

function formatSourceLabel(source?: string) {
  if (!source) return 'Unknown source';
  const labels: Record<string, string> = {
    'make.gmail': 'Gmail via Make',
    'make.outlook': 'Outlook via Make',
    wallet: 'Wallet capture',
    notification: 'Device notification',
  };
  return labels[source.toLowerCase()] ?? source.replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
