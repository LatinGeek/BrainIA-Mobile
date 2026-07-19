import { useLocalSearchParams, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { FinancialSnapshotCard } from '@/components/cards';
import { EvidenceRow } from '@/components/finance';
import { CategoryPicker, defaultCategoryPaths } from '@/components/review';
import { AppScreen, SectionHeader, TopBar } from '@/components/layout';
import { BottomSheet, Button, FilterChip, Input, ListRow, Surface } from '@/components/primitives';
import { EmptyState, LoadingSkeleton } from '@/components/states';
import { useAppState, useBrainIAClient, useTheme } from '@/lib/app-state';
import { loadTransactionBundle } from '@/lib/api';
import { useAsyncResource } from '@/lib/hooks';
import { formatCategoryLabel, formatCurrency, parseCurrency } from '@/lib/format';
import { maskAccount, shouldShowEvidenceDetail } from '@/lib/presentation';

export default function TransactionDetailScreen() {
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: 'category' }>();
  const client = useBrainIAClient();
  const { settings } = useAppState();
  const theme = useTheme();
  const [editorOpen, setEditorOpen] = useState(false);
  const [category, setCategory] = useState('');
  const [currency, setCurrency] = useState<'UYU' | 'USD'>('UYU');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [accountName, setAccountName] = useState('');
  const [accounts, setAccounts] = useState<{ id: string; name: string; type: string; currency?: 'UYU' | 'USD' }[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [badgeExplanationOpen, setBadgeExplanationOpen] = useState(false);
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
    setCategory(transaction.category ?? '');
    setCurrency(transaction.currency === 'USD' ? 'USD' : 'UYU');
    setAccountId(transaction.accountId ?? null);
    setAccountName(transaction.account ?? '');
    setSaveError(null);
    setEditorOpen(true);
    void client.listFinancialAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, [client, transaction]);

  useEffect(() => {
    if (edit !== 'category' || !transaction || didOpenRequestedEditor.current) return;
    didOpenRequestedEditor.current = true;
    openEditor();
  }, [edit, openEditor, transaction]);

  async function saveContext() {
    if (!transaction) return;
    setSaving(true);
    setSaveError(null);
    try {
      let selectedAccountId = accountId;
      if (!selectedAccountId && accountName.trim()) {
        const created = await client.createFinancialAccount({ name: accountName.trim(), currency });
        selectedAccountId = created.id;
      }
      await client.updateTransactionContext(transaction.id, { category, accountId: selectedAccountId, currency });
      setEditorOpen(false);
      await refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save transaction details.');
    } finally {
      setSaving(false);
    }
  }

  async function saveAlias() {
    if (!transaction?.merchantEntityId || !alias.trim()) return;
    setAliasSaving(true);
    setAliasMessage(null);
    try {
      await client.createEntityAlias({ entityId: transaction.merchantEntityId, alias: alias.trim() });
      setAlias('');
      setAliasMessage('Alias saved. It will be used as this merchant’s display name.');
      await refresh();
    } catch (error) {
      setAliasMessage(error instanceof Error ? error.message : 'Could not save this alias.');
    } finally {
      setAliasSaving(false);
    }
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
            periodLabel={`${transaction.kind === 'income' ? 'Income' : formatCategoryLabel(transaction.category)} · ${transaction.currency}`}
            amount={formatCurrency(parseCurrency(transaction.amount), transaction.currency)}
            onBadgePress={() => setBadgeExplanationOpen(true)}
          />

          <SectionHeader title="Origin" subtitle="The captured record that created this transaction." />
          <Surface variant="raised" style={{ gap: theme.spacing.xs, borderColor: theme.colors.accent + '55' }}>
            <ListRow
              title={originEvent?.title ?? formatSourceLabel(originSource)}
              subtitle={originEvent ? `${formatSourceLabel(originEvent.source)} · ${originEvent.kind}` : originSource ? `Captured via ${formatSourceLabel(originSource)}` : 'Source is still being linked'}
              description={originEvent?.body ? originEvent.body.slice(0, 150) : originEventId ? 'Open the original captured event to inspect its contents.' : 'No linked captured event is available yet.'}
              trailing={originEventId ? <Text style={[theme.typography.caption, { color: theme.colors.accentStrong }]}>Open</Text> : undefined}
              onPress={originEventId ? () => router.push({ pathname: '/event/[id]', params: { id: originEventId! } }) : undefined}
            />
          </Surface>

          <SectionHeader title="Transaction summary" />
          <View style={{ gap: 8 }}>
            <ListRow title={formatCurrency(parseCurrency(transaction.amount), transaction.currency)} subtitle={transaction.kind === 'income' ? 'Income' : 'Expense'} description={transaction.observedAt} />
            <ListRow title={formatCategoryLabel(transaction.category)} subtitle="Category" />
            <ListRow title={maskAccount(transaction.account, settings.dataVisibility)} subtitle={`Account · ${transaction.currency}`} />
          </View>

          <Surface variant="subtle" style={{ gap: theme.spacing.sm }}>
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Transaction context</Text>
            <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Categorize this movement and associate it with an account in your portfolio.</Text>
            <Button label="Edit category and account" onPress={openEditor} variant="secondary" />
          </Surface>

          {transaction.merchantEntityId ? (
            <Surface variant="subtle" style={{ gap: theme.spacing.sm }}>
              <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Merchant name</Text>
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Set the name you want BrainIA to use across Money, search, and future activity.</Text>
              <Input label="Alias" value={alias} onChangeText={setAlias} placeholder={displayMerchantLabel ?? 'Add an alias'} />
              {alias.trim() && aliasSuggestions.length ? (
                <View style={{ gap: 6 }}>
                  <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Existing aliases</Text>
                  {aliasSuggestions.map((candidate) => <ListRow key={candidate} title={candidate} subtitle="Use this name" onPress={() => setAlias(candidate)} />)}
                </View>
              ) : null}
              <Button label="Save alias" onPress={saveAlias} disabled={!alias.trim() || aliasSaving} loading={aliasSaving} variant="secondary" />
              {aliasMessage ? <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{aliasMessage}</Text> : null}
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
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Category</Text>
          <CategoryPicker categories={defaultCategoryPaths} selectedCategory={category} onSelect={setCategory} />
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Transaction currency</Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <FilterChip label="UYU" selected={currency === 'UYU'} onPress={() => { setCurrency('UYU'); setAccountId(null); setAccountName(''); }} />
            <FilterChip label="USD" selected={currency === 'USD'} onPress={() => { setCurrency('USD'); setAccountId(null); setAccountName(''); }} />
          </View>
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Portfolio account</Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Only {currency} accounts can be linked to this transaction.</Text>
          {accounts.filter((account) => account.currency === currency).map((account) => (
            <ListRow key={account.id} title={account.name} subtitle={`${account.type} · ${account.currency}`} trailing={<Text style={{ color: accountId === account.id ? theme.colors.success : theme.colors.textMuted }}>{accountId === account.id ? 'Selected' : 'Use'}</Text>} onPress={() => { setAccountId(account.id); setAccountName(account.name); }} />
          ))}
          {!accounts.some((account) => account.currency === currency) ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>No compatible account exists yet. Create a {currency} account below.</Text> : null}
          <Input label="New account name" value={accountName} onChangeText={(value) => { setAccountName(value); setAccountId(null); }} placeholder="Main bank account" />
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>New account currency: {currency}</Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Button label="Save" onPress={saveContext} loading={saving} />
            <Button label="Cancel" onPress={() => setEditorOpen(false)} variant="secondary" disabled={saving} />
          </View>
          {saveError ? <Text style={{ color: theme.colors.danger }}>{saveError}</Text> : null}
        </View>
      </BottomSheet>

      <BottomSheet visible={badgeExplanationOpen} title="About this signal" onClose={() => setBadgeExplanationOpen(false)}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Financial signal</Text>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>BrainIA recognized this captured activity as a money movement and created this transaction from its source event.</Text>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>It can still need review. Check the source, category, and account before relying on it in your financial view.</Text>
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
