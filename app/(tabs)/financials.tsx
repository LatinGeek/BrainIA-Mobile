import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutUp,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import {
  InsightCard,
} from '@/components/cards';
import { MonthlyCashFlowBar, SpendingRadial, type MonthlyCashFlowPoint } from '@/components/charts';
import { TransactionRow } from '@/components/finance';
import { AccountIcon } from '@/components/finance/AccountIcon';
import { AppScreen, Section, TopBar } from '@/components/layout';
import { AnimatedPressable, BottomSheet, Button, Input, ListRow, Panel, SegmentedControl, StatusBadge, Surface } from '@/components/primitives';
import { EmptyState, LoadingSkeleton } from '@/components/states';
import { useAppState, useTheme } from '@/lib/app-state';
import { currentFinancialPeriodRange, loadFinancialBundle } from '@/lib/api';
import { useAsyncResource } from '@/lib/hooks';
import { convertCurrency, formatCategoryLabel, formatCurrency, parseCurrency, SupportedCurrency } from '@/lib/format';
import type { TransactionGroup } from '@/lib/grouping';
import type { FinancialAccount, TransactionSummary } from '@/lib/domain';
import { DEFAULT_FINANCIAL_ACCOUNT_COLOR, FINANCIAL_ACCOUNT_COLORS } from '@/lib/financial-accounts';

const views = [
  { value: 'overview', label: 'Overview' },
  { value: 'trends', label: 'Trends' },
  { value: 'accounts', label: 'Accounts' },
  { value: 'transactions', label: 'Transactions' },
  { value: 'insights', label: 'Insights' },
] as const;

const periods = [
  { value: 'month', label: 'Cycle' },
  { value: 'year', label: 'Year' },
] as const;

type FinanceView = (typeof views)[number]['value'];
type FinancePeriod = (typeof periods)[number]['value'];

const displayCurrencies = [
  { value: 'UYU', label: 'UYU' },
  { value: 'USD', label: 'USD' },
] as const;

function CompactFinanceSwitch<T extends string>({
  value,
  onChange,
  options,
  accessibilityLabel,
  minOptionWidth = 40,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  accessibilityLabel: string;
  minOptionWidth?: number;
}) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="radiogroup"
      style={{
        flexDirection: 'row',
        padding: 3,
        borderRadius: 999,
        backgroundColor: theme.colors.surfaceSubtle,
        borderWidth: 1,
        borderColor: theme.colors.border,
        gap: 2,
      }}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <AnimatedPressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={`${accessibilityLabel}: ${option.label}`}
            onPress={() => onChange(option.value)}
            scaleTo={0.96}
            style={{
              minWidth: minOptionWidth,
              height: 28,
              paddingHorizontal: 8,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? theme.colors.accentSoft : 'transparent',
              borderWidth: 1,
              borderColor: selected ? theme.colors.accentStrong + '99' : 'transparent',
            }}
          >
            <Text style={[theme.typography.caption, { color: selected ? theme.colors.accentStrong : theme.colors.textMuted, fontWeight: '700' }]}>{option.label}</Text>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

function CompactCurrencySwitch({ value, onChange }: { value: SupportedCurrency; onChange: (value: SupportedCurrency) => void }) {
  return <CompactFinanceSwitch value={value} onChange={onChange} options={displayCurrencies} accessibilityLabel="Display currency" />;
}

function CompactPeriodSwitch({ value, onChange }: { value: FinancePeriod; onChange: (value: FinancePeriod) => void }) {
  return <CompactFinanceSwitch value={value} onChange={onChange} options={periods} accessibilityLabel="Financial period" minOptionWidth={48} />;
}

function displayAmount(transaction: { amount: string; currency: string }, currency: SupportedCurrency) {
  return convertCurrency(parseCurrency(transaction.amount), transaction.currency, currency);
}

function financialPeriodLabel(range: { from: string; to: string }) {
  const from = new Date(range.from);
  const through = new Date(range.to);
  const format = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${format(from)} – ${format(through)}`;
}

function buildMonthlyCashFlow(
  transactions: TransactionSummary[],
  financialPeriodStartDay: number,
  currency: SupportedCurrency,
  monthCount = 6,
): MonthlyCashFlowPoint[] {
  const currentStart = new Date(currentFinancialPeriodRange(financialPeriodStartDay).from);
  const points = Array.from({ length: monthCount }, (_, index) => {
    const start = new Date(currentStart.getFullYear(), currentStart.getMonth() - (monthCount - 1 - index), financialPeriodStartDay);
    const next = new Date(start.getFullYear(), start.getMonth() + 1, financialPeriodStartDay);
    const end = new Date(next.getTime() - 1);
    return {
      label: start.toLocaleDateString(undefined, { month: 'short' }),
      periodLabel: financialPeriodLabel({ from: start.toISOString(), to: end.toISOString() }),
      income: 0,
      spending: 0,
      start: start.getTime(),
      end: end.getTime(),
    };
  });

  transactions.forEach((transaction) => {
    if (transaction.excludedFromReports || (transaction.kind !== 'income' && transaction.kind !== 'expense')) return;
    const observedAt = transaction.observedAt ? new Date(transaction.observedAt).getTime() : Number.NaN;
    if (!Number.isFinite(observedAt)) return;
    const point = points.find((candidate) => observedAt >= candidate.start && observedAt <= candidate.end);
    if (!point) return;
    const value = displayAmount(transaction, currency);
    if (transaction.kind === 'income') point.income += value;
    else point.spending += value;
  });

  return points.map(({ label, periodLabel, income, spending }) => ({
    label,
    periodLabel,
    income: Math.max(0, income),
    spending: Math.max(0, spending),
  }));
}

function groupTransactionsInCurrency(
  transactions: import('@/lib/domain').TransactionSummary[],
  field: 'category' | 'account',
  currency: SupportedCurrency,
): TransactionGroup[] {
  const groups = new Map<string, import('@/lib/domain').TransactionSummary[]>();
  transactions.forEach((transaction) => {
    const label = transaction[field] || 'Uncategorized';
    groups.set(label, [...(groups.get(label) ?? []), transaction]);
  });
  return Array.from(groups.entries())
    .map(([label, items]) => ({
      label,
      count: items.length,
      items,
      total: items.reduce((total, transaction) => total + (transaction.kind === 'expense' ? displayAmount(transaction, currency) : 0), 0),
    }))
    .sort((a, b) => b.total - a.total || b.count - a.count || a.label.localeCompare(b.label));
}

function AccountListItem({
  account,
  displayCurrency,
  expanded,
  onToggle,
  onEdit,
  onAdjust,
  onDelete,
  deleting,
}: {
  account: FinancialAccount;
  displayCurrency: SupportedCurrency;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onAdjust: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const theme = useTheme();
  const expansion = useSharedValue(expanded ? 1 : 0);
  const nativeCurrency = account.currency ?? 'UYU';
  const nativeBalance = parseCurrency(account.balance);
  const convertedBalance = convertCurrency(nativeBalance, nativeCurrency, displayCurrency);
  const accountColor = account.color ?? DEFAULT_FINANCIAL_ACCOUNT_COLOR;

  useEffect(() => {
    expansion.value = withSpring(expanded ? 1 : 0, { damping: 17, stiffness: 190, mass: 0.7 });
  }, [expanded, expansion]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${expansion.value * 180}deg` }],
  }));

  return (
    <Animated.View layout={LinearTransition.springify().damping(18).stiffness(180)}>
      <Surface
        variant={expanded ? 'raised' : 'subtle'}
        padding="none"
        style={{
          overflow: 'hidden',
          borderColor: expanded ? `${accountColor}66` : theme.depth.hairline,
          shadowColor: expanded ? accountColor : undefined,
        }}
      >
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: accountColor }} />
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${account.name}, ${formatCurrency(convertedBalance, displayCurrency)}. ${expanded ? 'Collapse account options' : 'Expand account options'}`}
          onPress={onToggle}
          scaleTo={0.993}
          style={{
            minHeight: 72,
            flexDirection: 'row',
            alignItems: 'center',
            paddingLeft: theme.spacing.md + 3,
            paddingRight: theme.spacing.sm,
            paddingVertical: theme.spacing.sm,
            gap: theme.spacing.sm,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: `${accountColor}1F`,
              borderWidth: 1,
              borderColor: `${accountColor}38`,
            }}
          >
            <AccountIcon color={accountColor} size={36} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text numberOfLines={1} style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{account.name}</Text>
            <Text numberOfLines={1} style={[theme.typography.caption, { color: theme.colors.textSecondary, textTransform: 'capitalize' }]}>
              {account.type} · {nativeCurrency}{account.mask ? ` · ${account.mask}` : ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', minWidth: 84, gap: 2 }}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
              style={[
                theme.typography.bodyStrong,
                {
                  color: convertedBalance >= 0 ? theme.colors.textPrimary : theme.status.expense,
                  fontVariant: ['tabular-nums'],
                  maxWidth: 128,
                },
              ]}
            >
              {formatCurrency(convertedBalance, displayCurrency)}
            </Text>
            {nativeCurrency !== displayCurrency ? (
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, fontVariant: ['tabular-nums'] }]}>{formatCurrency(nativeBalance, nativeCurrency)}</Text>
            ) : (
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Available balance</Text>
            )}
          </View>
          <Animated.View style={[{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: expanded ? `${accountColor}20` : theme.colors.surface }, chevronStyle]}>
            <Feather name="chevron-down" size={17} color={expanded ? accountColor : theme.colors.textMuted} />
          </Animated.View>
        </AnimatedPressable>

        {expanded ? (
          <Animated.View
            entering={FadeInDown.duration(220)}
            exiting={FadeOutUp.duration(150)}
            style={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md, paddingLeft: theme.spacing.md + 3 }}
          >
            <View style={{ height: 1, backgroundColor: theme.colors.border, marginBottom: theme.spacing.md }} />
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
              <View style={{ flex: 1, padding: theme.spacing.sm, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceSubtle, gap: 3 }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Native balance</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary, fontVariant: ['tabular-nums'] }]}>{formatCurrency(nativeBalance, nativeCurrency)}</Text>
              </View>
              <View style={{ flex: 1, padding: theme.spacing.sm, borderRadius: theme.radius.md, backgroundColor: `${accountColor}12`, gap: 3 }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Portfolio value</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit style={[theme.typography.bodyStrong, { color: accountColor, fontVariant: ['tabular-nums'] }]}>{formatCurrency(convertedBalance, displayCurrency)}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button label="Edit account" variant="secondary" size="sm" onPress={onEdit} icon={<Feather name="edit-2" size={14} color={theme.colors.textPrimary} />} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Adjust balance" variant="secondary" size="sm" onPress={onAdjust} icon={<Feather name="sliders" size={14} color={theme.colors.textPrimary} />} />
              </View>
            </View>
            <View style={{ marginTop: theme.spacing.sm }}>
              <Button
                label={deleting ? 'Deleting account...' : 'Delete account'}
                variant="danger"
                size="sm"
                loading={deleting}
                onPress={onDelete}
                icon={<Feather name="trash-2" size={14} color={theme.colors.onAccent} />}
              />
            </View>
          </Animated.View>
        ) : null}
      </Surface>
    </Animated.View>
  );
}

export default function FinancialsScreen() {
  const { client, settings, theme } = useAppState();
  const [view, setView] = useState<FinanceView>('overview');
  const [period, setPeriod] = useState<FinancePeriod>('month');
  const [displayCurrency, setDisplayCurrency] = useState<SupportedCurrency>('UYU');
  const [accountEditorOpen, setAccountEditorOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);
  const [accountName, setAccountName] = useState('');
  const [accountMask, setAccountMask] = useState('');
  const [accountCurrency, setAccountCurrency] = useState<SupportedCurrency>('UYU');
  const [accountColor, setAccountColor] = useState(DEFAULT_FINANCIAL_ACCOUNT_COLOR);
  const [adjustingAccount, setAdjustingAccount] = useState<FinancialAccount | null>(null);
  const [targetBalance, setTargetBalance] = useState('');
  const [adjustmentNote, setAdjustmentNote] = useState('');
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const loader = useMemo(
    () => () => loadFinancialBundle(client, settings.financialPeriodStartDay),
    [client, settings.financialPeriodStartDay],
  );
  const { data, loading, error, refresh } = useAsyncResource(loader, [loader]);
  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));
  const financialPeriodRange = useMemo(
    () => currentFinancialPeriodRange(settings.financialPeriodStartDay),
    [settings.financialPeriodStartDay],
  );
  const cycleLabel = financialPeriodLabel(financialPeriodRange);

  const transactions = data?.transactions ?? [];
  const accounts = data?.accounts ?? [];
  const insights = data?.insights ?? [];
  const reportTransactions = transactions.filter((transaction) => !transaction.excludedFromReports);
  const expenses = reportTransactions.filter((transaction) => transaction.kind === 'expense');
  const categoryGroups = groupTransactionsInCurrency(expenses, 'category', displayCurrency);
  const income = reportTransactions.filter((transaction) => transaction.kind === 'income');
  const monthlySpend = expenses.reduce((total, transaction) => total + displayAmount(transaction, displayCurrency), 0);
  const totalIncome = income.reduce((total, transaction) => total + displayAmount(transaction, displayCurrency), 0);
  const netMovement = totalIncome - monthlySpend;
  const periodMultiplier = period === 'year' ? 12 : 1;
  const periodSpend = monthlySpend * periodMultiplier;
  const periodIncome = totalIncome * periodMultiplier;
  const periodNet = netMovement * periodMultiplier;
  const monthlyCashFlow = useMemo(
    () => buildMonthlyCashFlow(data?.trendTransactions ?? [], settings.financialPeriodStartDay, displayCurrency),
    [data?.trendTransactions, displayCurrency, settings.financialPeriodStartDay],
  );
  const merchantGroups = Array.from(expenses.reduce((groups, transaction) => {
    const label = transaction.displayMerchantLabel ?? transaction.merchantLabel;
    groups.set(label, (groups.get(label) ?? 0) + displayAmount(transaction, displayCurrency));
    return groups;
  }, new Map<string, number>()).entries()).map(([label, total]) => ({ label, total }));
  const topCategory = categoryGroups[0];
  const topMerchant = expenses[0];
  const totalAccountBalance = accounts.reduce(
    (total, account) => total + convertCurrency(parseCurrency(account.balance), account.currency ?? 'UYU', displayCurrency),
    0,
  );
  const portfolioSegments = accounts.map((account) => {
    const convertedBalance = convertCurrency(parseCurrency(account.balance), account.currency ?? 'UYU', displayCurrency);
    return {
      label: account.name,
      value: Math.abs(convertedBalance),
      displayValue: convertedBalance,
      color: account.color,
    };
  });
  const radialSegments = categoryGroups.length
    ? categoryGroups.map((group) => ({
        label: formatCategoryLabel(group.label),
        value: group.total * periodMultiplier,
      }))
    : [
        {
          label: 'No spend',
          value: 1,
        },
      ];

  function openCreateAccount() {
    setEditingAccount(null);
    setAccountName('');
    setAccountMask('');
    setAccountCurrency(displayCurrency);
    setAccountColor(DEFAULT_FINANCIAL_ACCOUNT_COLOR);
    setAccountEditorOpen(true);
  }

  function openEditAccount(account: FinancialAccount) {
    setEditingAccount(account);
    setAccountName(account.name);
    setAccountMask(account.mask ?? '');
    setAccountCurrency(account.currency ?? 'UYU');
    setAccountColor(account.color ?? DEFAULT_FINANCIAL_ACCOUNT_COLOR);
    setAccountEditorOpen(true);
  }

  async function saveAccount() {
    if (!accountName.trim()) return;
    setSaving(true);
    try {
      const input = { name: accountName.trim(), mask: accountMask.trim() || undefined, currency: accountCurrency, color: accountColor, type: editingAccount?.type || 'bank' };
      if (editingAccount) await client.updateFinancialAccount(editingAccount.id, input);
      else await client.createFinancialAccount(input);
      setAccountEditorOpen(false);
      await refresh();
    } catch (saveError) {
      Alert.alert('Unable to save account', saveError instanceof Error ? saveError.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  function confirmDeleteAccount(account: FinancialAccount) {
    Alert.alert(
      'Delete account?',
      `${account.name} will be removed. Existing transactions will be preserved but will no longer be assigned to this account.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setDeletingAccountId(account.id);
              try {
                const result = await client.deleteFinancialAccount(account.id);
                setExpandedAccountId((current) => current === account.id ? null : current);
                await refresh();
                if (result.detachedTransactions > 0) {
                  Alert.alert(
                    'Account deleted',
                    `${result.detachedTransactions} transaction${result.detachedTransactions === 1 ? '' : 's'} remain in your history and are now unassigned.`,
                  );
                }
              } catch (deleteError) {
                Alert.alert('Unable to delete account', deleteError instanceof Error ? deleteError.message : 'Try again.');
              } finally {
                setDeletingAccountId(null);
              }
            })();
          },
        },
      ],
    );
  }

  function openAdjustment(account: FinancialAccount) {
    setAdjustingAccount(account);
    setTargetBalance(Number(account.balance).toFixed(2));
    setAdjustmentNote('');
  }

  async function saveAdjustment() {
    if (!adjustingAccount) return;
    const parsedTarget = Number(targetBalance.replace(',', '.'));
    if (!Number.isFinite(parsedTarget)) {
      Alert.alert('Invalid balance', 'Enter the current account balance as a number.');
      return;
    }
    setSaving(true);
    try {
      await client.createBalanceAdjustment(adjustingAccount.id, { targetBalance: parsedTarget, note: adjustmentNote.trim() || undefined });
      setAdjustingAccount(null);
      await refresh();
    } catch (saveError) {
      Alert.alert('Unable to adjust balance', saveError instanceof Error ? saveError.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppScreen refreshing={loading} onRefresh={refresh}>
      <TopBar
        title="Money"
        subtitle="Where your money moved and what changed."
        secondaryAction={<StatusBadge label={loading ? 'Syncing' : error ? 'Offline' : 'Current'} tone={error ? 'warning' : 'positive'} />}
      />

      {error ? <EmptyState title="Could not load Money" description={error} primaryActionLabel="Retry" onPrimaryAction={refresh} /> : null}
      {loading && !data ? <LoadingSkeleton variant="chart" count={2} /> : null}

      {data ? (
        <>
          <SegmentedControl scrollable value={view} onChange={setView} options={views.map((item) => ({ ...item, count: item.value === 'transactions' ? transactions.length : undefined }))} />

          {view === 'overview' ? (
            <>
              <Panel tone="finance" style={{ gap: theme.spacing.lg, paddingTop: theme.spacing.lg }}>
                <View style={{ gap: theme.spacing.sm }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.md }}>
                    <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{period === 'year' ? 'Projected net movement' : 'Net movement'}</Text>
                    <CompactPeriodSwitch value={period} onChange={setPeriod} />
                  </View>
                  <Text style={[theme.typography.numeral, { color: periodNet >= 0 ? theme.colors.accent : theme.status.expense }]}>
                    {formatCurrency(periodNet, displayCurrency)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                  <MoneyTile label="Income" value={formatCurrency(periodIncome, displayCurrency)} tone="positive" compact />
                  <MoneyTile label="Expenses" value={formatCurrency(periodSpend, displayCurrency)} tone="danger" compact />
                </View>
              </Panel>
              <SpendingRadial
                title="Expense mix"
                subtitle={period === 'year' ? 'Projected category share' : `Category share · ${cycleLabel}`}
                amount={formatCurrency(periodSpend, displayCurrency)}
                segments={radialSegments}
                formatValue={(value) => formatCurrency(value, displayCurrency)}
                headerAction={<CompactCurrencySwitch value={displayCurrency} onChange={setDisplayCurrency} />}
              />
              <Section title="At a glance" subtitle={period === 'year' ? 'Projected annual picture from current cycle data.' : `The biggest signals for ${cycleLabel}.`}>
                <ListRow title={topCategory ? formatCategoryLabel(topCategory.label) : 'No category yet'} subtitle="Top spending group" description={topCategory ? `${topCategory.count} transactions` : 'Grouped categories will appear after sync.'} />
                <ListRow title={topMerchant ? topMerchant.displayMerchantLabel ?? topMerchant.merchantLabel : 'No merchant yet'} subtitle="Top recent merchant" description={topMerchant?.amount ?? 'Waiting for transaction data.'} />
              </Section>
            </>
          ) : null}

          {view === 'trends' ? (
            <Section title="Trends" subtitle="Recent movement by transaction sequence.">
              <MonthlyCashFlowBar
                points={monthlyCashFlow}
                subtitle="Income versus spending across the last six financial cycles."
                formatValue={(value) => formatCurrency(value, displayCurrency)}
                headerAction={<CompactCurrencySwitch value={displayCurrency} onChange={setDisplayCurrency} />}
              />
              <SpendingRadial
                title="Money movement"
                subtitle={period === 'year' ? 'Projected merchant share' : `Merchant share · ${cycleLabel}`}
                amount={formatCurrency(periodSpend, displayCurrency)}
                segments={merchantGroups.map((group) => ({ label: group.label, value: group.total * periodMultiplier }))}
                formatValue={(value) => formatCurrency(value, displayCurrency)}
                itemNoun="merchant"
                percentageNoun="spend"
                emptyLabel="No merchants"
                headerAction={<CompactCurrencySwitch value={displayCurrency} onChange={setDisplayCurrency} />}
              />
            </Section>
          ) : null}

          {view === 'accounts' ? (
            <Section title="Accounts" subtitle="Your current money across every linked account." count={accounts.length}>
              <SpendingRadial
                title="Portfolio overview"
                subtitle="Net portfolio value split across your accounts. Negative balances count toward account share by magnitude."
                amount={formatCurrency(totalAccountBalance, displayCurrency)}
                segments={portfolioSegments}
                formatValue={(value) => formatCurrency(value, displayCurrency)}
                totalLabel="Total portfolio"
                itemNoun="account"
                percentageNoun="portfolio"
                emptyLabel="No accounts"
                headerAction={<CompactCurrencySwitch value={displayCurrency} onChange={setDisplayCurrency} />}
              />
              <Panel tone="finance" style={{ gap: theme.spacing.md }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Total available in {displayCurrency}</Text>
                <Text style={[theme.typography.numeral, { color: totalAccountBalance >= 0 ? theme.colors.accent : theme.status.expense }]}>
                  {formatCurrency(totalAccountBalance, displayCurrency)}
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Balances include transfers and balance adjustments. Adjustments never affect Money reports.</Text>
                <Button label="Create account" onPress={openCreateAccount} icon={<Feather name="plus" size={16} color={theme.colors.onAccent} />} />
              </Panel>
              {accounts.length ? accounts.map((account) => (
                <AccountListItem
                  key={account.id}
                  account={account}
                  displayCurrency={displayCurrency}
                  expanded={expandedAccountId === account.id}
                  onToggle={() => setExpandedAccountId((current) => current === account.id ? null : account.id)}
                  onEdit={() => openEditAccount(account)}
                  onAdjust={() => openAdjustment(account)}
                  onDelete={() => confirmDeleteAccount(account)}
                  deleting={deletingAccountId === account.id}
                />
              )) : <EmptyState title="No accounts yet" description="Create an account, then set its current balance with an adjustment." />}
            </Section>
          ) : null}

          {view === 'transactions' ? (
            <Section title="Transactions" subtitle="Grouped financial records with source evidence in detail." count={transactions.length}>
              {transactions.length ? (
                transactions.map((transaction) => (
                  <TransactionRow key={transaction.id} transaction={transaction} onPress={() => router.push(`/transaction/${transaction.id}`)} />
                ))
              ) : (
                <EmptyState title="No transactions" description="Wallet, receipt, and bank notification records will appear here." />
              )}
            </Section>
          ) : null}

          {view === 'insights' ? (
            <Section title="Finance insights" subtitle="Patterns worth noticing.">
              {insights.length ? (
                insights.map((insight) => <InsightCard key={insight.id} insight={insight} onPress={() => router.push(`/insight/${insight.id}`)} />)
              ) : (
                <EmptyState title="No finance insights yet" description="Recurring charges, unusual activity, and category trends will appear here." />
              )}
            </Section>
          ) : null}
        </>
      ) : null}

      <BottomSheet visible={accountEditorOpen} title={editingAccount ? 'Edit account' : 'Create account'} onClose={() => setAccountEditorOpen(false)}>
        <Input label="Account name" value={accountName} onChangeText={setAccountName} placeholder="Main bank account" autoCapitalize="words" />
        <Input label="Mask or last digits (optional)" value={accountMask} onChangeText={setAccountMask} placeholder="•••• 5343" />
        <View style={{ gap: theme.spacing.xs }}>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Currency</Text>
          <SegmentedControl value={accountCurrency} onChange={(value) => setAccountCurrency(value as SupportedCurrency)} options={displayCurrencies} />
        </View>
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Account color</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {FINANCIAL_ACCOUNT_COLORS.map((option) => (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                accessibilityState={{ selected: accountColor === option.value }}
                onPress={() => setAccountColor(option.value)}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: option.value,
                  borderWidth: accountColor === option.value ? 3 : 0,
                  borderColor: theme.colors.textPrimary,
                }}
              >
                {accountColor === option.value ? <Feather name="check" size={18} color="#FFFFFF" /> : null}
              </Pressable>
            ))}
          </View>
        </View>
        <Button label={editingAccount ? 'Save changes' : 'Create account'} onPress={saveAccount} loading={saving} disabled={!accountName.trim()} />
      </BottomSheet>

      <BottomSheet visible={Boolean(adjustingAccount)} title="Adjust account balance" onClose={() => setAdjustingAccount(null)}>
        {adjustingAccount ? (
          <>
            <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Set the real current balance for {adjustingAccount.name}. BrainIA will create an excluded income or expense for the difference.</Text>
            <Input label={`Current balance (${adjustingAccount.currency ?? 'UYU'})`} value={targetBalance} onChangeText={setTargetBalance} keyboardType="decimal-pad" placeholder="0.00" />
            <Input label="Note (optional)" value={adjustmentNote} onChangeText={setAdjustmentNote} placeholder="Statement reconciliation" />
            <Button label="Sync balance" onPress={saveAdjustment} loading={saving} />
          </>
        ) : null}
      </BottomSheet>
    </AppScreen>
  );
}

function MoneyTile({ label, value, tone, compact = false }: { label: string; value: string; tone: 'neutral' | 'positive' | 'warning' | 'danger'; compact?: boolean }) {
  const theme = useTheme();
  const color = tone === 'positive' ? theme.colors.success : tone === 'warning' ? theme.colors.warning : tone === 'danger' ? theme.colors.danger : theme.colors.textPrimary;
  const directionIcon = tone === 'positive' ? 'arrow-up-right' : tone === 'warning' || tone === 'danger' ? 'arrow-down-right' : null;

  return (
    <Surface variant="subtle" padding={compact ? 'sm' : 'md'} style={{ flex: 1, minWidth: compact ? 0 : '47%', gap: 4, borderColor: color + '33' }}>
      <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {directionIcon ? <Feather name={directionIcon} size={compact ? 14 : 16} color={color} /> : null}
        <Text style={[theme.typography.numeral, { color, fontSize: compact ? 17 : 18, lineHeight: compact ? 22 : 24 }]}>{value}</Text>
      </View>
    </Surface>
  );
}
