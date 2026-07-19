import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import {
  InsightCard,
  FinancialSnapshotCard,
} from '@/components/cards';
import { ChartCard, SpendingRadial } from '@/components/charts';
import { TransactionRow } from '@/components/finance';
import { AppScreen, Section, TopBar } from '@/components/layout';
import { ListRow, Panel, SegmentedControl, StatusBadge, Surface } from '@/components/primitives';
import { EmptyState, LoadingSkeleton } from '@/components/states';
import { useBrainIAClient, useTheme } from '@/lib/app-state';
import { loadFinancialBundle } from '@/lib/api';
import { useAsyncResource } from '@/lib/hooks';
import { formatCategoryLabel, formatCurrency, parseCurrency } from '@/lib/format';
import { groupTransactionsByField } from '@/lib/grouping';

const views = [
  { value: 'overview', label: 'Overview' },
  { value: 'trends', label: 'Trends' },
  { value: 'categories', label: 'Categories' },
  { value: 'accounts', label: 'Accounts' },
  { value: 'transactions', label: 'Transactions' },
  { value: 'insights', label: 'Insights' },
] as const;

const periods = [
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
] as const;

type FinanceView = (typeof views)[number]['value'];
type FinancePeriod = (typeof periods)[number]['value'];

export default function FinancialsScreen() {
  const theme = useTheme();
  const client = useBrainIAClient();
  const [view, setView] = useState<FinanceView>('overview');
  const [period, setPeriod] = useState<FinancePeriod>('month');
  const loader = useMemo(() => () => loadFinancialBundle(client), [client]);
  const { data, loading, error, refresh } = useAsyncResource(loader, [loader]);

  const transactions = data?.transactions ?? [];
  const displayCurrency = transactions[0]?.currency === 'USD' ? 'USD' : 'UYU';
  const summaryTransactions = transactions.filter((transaction) => transaction.currency === displayCurrency);
  const insights = data?.insights ?? [];
  const categoryGroups = groupTransactionsByField(summaryTransactions, 'category');
  const accountGroups = groupTransactionsByField(summaryTransactions, 'account');
  const expenses = summaryTransactions.filter((transaction) => transaction.kind !== 'income');
  const income = summaryTransactions.filter((transaction) => transaction.kind === 'income');
  const monthlySpend = expenses.reduce((total, transaction) => total + parseCurrency(transaction.amount), 0);
  const totalIncome = income.reduce((total, transaction) => total + parseCurrency(transaction.amount), 0);
  const netMovement = totalIncome - monthlySpend;
  const periodMultiplier = period === 'year' ? 12 : 1;
  const periodSpend = monthlySpend * periodMultiplier;
  const periodIncome = totalIncome * periodMultiplier;
  const periodNet = netMovement * periodMultiplier;
  const periodLabel = period === 'year' ? 'Annual projection' : 'Monthly expenses';
  const merchantGroups = Array.from(expenses.reduce((groups, transaction) => {
    const label = transaction.displayMerchantLabel ?? transaction.merchantLabel;
    groups.set(label, (groups.get(label) ?? 0) + parseCurrency(transaction.amount));
    return groups;
  }, new Map<string, number>()).entries()).map(([label, total]) => ({ label, total }));
  const topCategory = categoryGroups[0];
  const topMerchant = expenses[0];
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
          <SegmentedControl value={period} onChange={setPeriod} options={periods} />
          <SegmentedControl value={view} onChange={setView} options={views.map((item) => ({ ...item, count: item.value === 'transactions' ? transactions.length : undefined }))} />

          {view === 'overview' ? (
            <>
              <Panel tone="finance" style={{ gap: theme.spacing.lg, paddingTop: theme.spacing.lg }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: theme.spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{period === 'year' ? 'Projected net movement' : 'Net movement'}</Text>
                    <Text style={[theme.typography.numeral, { color: periodNet >= 0 ? theme.colors.accent : theme.status.expense, marginTop: 4 }]}>
                      {formatCurrency(periodNet, displayCurrency)}
                    </Text>
                  </View>
                  <StatusBadge label={period === 'year' ? 'Year' : 'Month'} tone="neutral" />
                </View>
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                  <MoneyTile label="Income" value={formatCurrency(periodIncome, displayCurrency)} tone="positive" compact />
                  <MoneyTile label="Expenses" value={formatCurrency(periodSpend, displayCurrency)} tone="danger" compact />
                </View>
              </Panel>
              <SpendingRadial
                title="Expense mix"
                subtitle={period === 'year' ? 'Projected category share' : 'Category share this month'}
                amount={formatCurrency(periodSpend, displayCurrency)}
                segments={radialSegments}
                formatValue={(value) => formatCurrency(value, displayCurrency)}
              />
              <FinancialSnapshotCard
                title={periodLabel}
                periodLabel={`${summaryTransactions.length} ${displayCurrency} transaction${summaryTransactions.length === 1 ? '' : 's'} tracked`}
                amount={formatCurrency(periodSpend, displayCurrency)}
                amountTone="expense"
                chartValues={transactions.map((transaction) => parseCurrency(transaction.amount))}
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                <MoneyTile label="Net" value={formatCurrency(periodNet, displayCurrency)} tone={periodNet >= 0 ? 'positive' : 'danger'} />
                <MoneyTile label="Transactions" value={String(transactions.length)} tone="neutral" />
              </View>
              <Section title="At a glance" subtitle={period === 'year' ? 'Projected annual picture from current data.' : 'The biggest signals this month.'}>
                <ListRow title={topCategory ? formatCategoryLabel(topCategory.label) : 'No category yet'} subtitle="Top spending group" description={topCategory ? `${topCategory.count} transactions` : 'Grouped categories will appear after sync.'} />
                <ListRow title={topMerchant ? topMerchant.displayMerchantLabel ?? topMerchant.merchantLabel : 'No merchant yet'} subtitle="Top recent merchant" description={topMerchant?.amount ?? 'Waiting for transaction data.'} />
              </Section>
            </>
          ) : null}

          {view === 'trends' ? (
            <Section title="Trends" subtitle="Recent movement by transaction sequence.">
              <ChartCard title="Money movement" subtitle="Grouped by the merchant name you chose." values={merchantGroups.map((group) => group.total)} labels={merchantGroups.map((group) => group.label)} />
            </Section>
          ) : null}

          {view === 'categories' ? (
            <Section title="Categories" subtitle="Ranked spending areas with share of total." count={categoryGroups.length}>
              <ChartCard title="Category share" subtitle="Grouped expense totals" values={categoryGroups.map((group) => group.total)} labels={categoryGroups.map((group) => formatCategoryLabel(group.label))} />
              {categoryGroups.map((group) => (
                <ListRow
                  key={group.label}
                  title={formatCategoryLabel(group.label)}
                  subtitle={`${group.count} transaction${group.count === 1 ? '' : 's'}`}
                  description={`${Math.round((group.total / Math.max(monthlySpend, 1)) * 100)}% of expenses`}
                  trailing={<Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary, fontVariant: ['tabular-nums'] }]}>{formatCurrency(group.total, displayCurrency)}</Text>}
                />
              ))}
            </Section>
          ) : null}

          {view === 'accounts' ? (
            <Section title="Accounts" subtitle="Account-level movement with masked labels by default." count={accountGroups.length}>
              <ChartCard title="Account share" subtitle="Grouped totals" values={accountGroups.map((group) => group.total)} labels={accountGroups.map((group) => group.label)} />
              {accountGroups.map((group) => (
                <ListRow key={group.label} title={group.label} subtitle={`${group.count} entries`} description={`Total movement ${formatCurrency(group.total, displayCurrency)}`} />
              ))}
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
