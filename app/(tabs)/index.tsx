import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  DigestCard,
  InsightCard,
  TodayFinanceSnapshot,
} from '@/components/cards';
import { DailyBrief } from '@/components/knowledge';
import { AppScreen, Section, TopBar } from '@/components/layout';
import { Button, Panel, StatusBadge } from '@/components/primitives';
import { EmptyState, LoadingSkeleton } from '@/components/states';
import { useAppState } from '@/lib/app-state';
import { loadDashboardBundle } from '@/lib/api';
import { useAsyncResource } from '@/lib/hooks';
import { formatCategoryInsight, formatCategoryLabel, formatCurrency, formatDate, isUncategorizedLabel, joinDisplayParts, parseCurrency } from '@/lib/format';
import { groupTransactionsByField } from '@/lib/grouping';

function sumByKind(transactions: { amount: string; kind: string }[], kind: 'income' | 'expense') {
  return transactions.reduce((total, transaction) => {
    return transaction.kind === kind ? total + parseCurrency(transaction.amount) : total;
  }, 0);
}

export default function HomeScreen() {
  const { client, settings, theme } = useAppState();
  const loader = useMemo(
    () => () => loadDashboardBundle(client, settings.financialPeriodStartDay),
    [client, settings.financialPeriodStartDay],
  );
  const { data, loading, error, refresh } = useAsyncResource(loader, [loader]);
  const reviewLoader = useMemo(() => () => client.listReviews('pending'), [client]);
  const { data: pendingReviews, refresh: refreshReviews } = useAsyncResource(reviewLoader, [reviewLoader]);
  useFocusEffect(useCallback(() => {
    void refresh();
    void refreshReviews();
  }, [refresh, refreshReviews]));

  const transactions = data?.transactions ?? [];
  const reportTransactions = transactions.filter((transaction) => !transaction.excludedFromReports);
  const summaryCurrency = reportTransactions[0]?.currency === 'USD' ? 'USD' : 'UYU';
  const summaryTransactions = reportTransactions.filter((transaction) => transaction.currency === summaryCurrency);
  const insights = data?.insights ?? [];
  const digests = data?.digests ?? [];
  const monthlySpend = sumByKind(summaryTransactions, 'expense');
  const income = sumByKind(summaryTransactions, 'income');
  const categoryGroups = groupTransactionsByField(summaryTransactions, 'category');
  const topCategory = categoryGroups[0];
  const topTransaction = transactions[0];
  const primaryInsight = insights[0];
  const primaryDigest = digests[0];

  const briefItems = [
    pendingReviews?.length ? {
      id: 'review-pending',
      text: `${pendingReviews.length} data decision${pendingReviews.length === 1 ? '' : 's'} can improve future search and graph connections.`,
      onActionPress: () => router.push('/review'),
    } : undefined,
    primaryInsight ? {
      id: `insight:${primaryInsight.id}`,
      text: primaryInsight.summary,
      onActionPress: () => router.push(`/insight/${primaryInsight.id}`),
    } : undefined,
    primaryDigest ? {
      id: `digest:${primaryDigest.id}`,
      text: primaryDigest.summary,
      onActionPress: () => router.push(`/digest/${primaryDigest.id}`),
    } : undefined,
    topCategory ? {
      id: `category:${topCategory.label}`,
      text: formatCategoryInsight(topCategory.label, formatCurrency(topCategory.total, summaryCurrency)),
      onActionPress: () => {
        const transactionNeedingReview = topCategory.items[0];
        if (isUncategorizedLabel(topCategory.label) && transactionNeedingReview) {
          router.push({ pathname: '/transaction/[id]', params: { id: transactionNeedingReview.id, edit: 'category' } });
          return;
        }
        router.push('/financials');
      },
    } : undefined,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <AppScreen refreshing={loading} onRefresh={refresh}>
      <TopBar
        title="Today"
        subtitle={data?.cachedAt ? `Last refreshed ${formatDate(data.cachedAt)}` : 'What matters now across knowledge, money, and review.'}
        secondaryAction={
          <StatusBadge
            label={loading ? 'Syncing' : error ? 'Offline' : data?.live ? 'Live' : 'Saved view'}
            tone={error ? 'warning' : data?.live ? 'positive' : 'neutral'}
          />
        }
      />

      {error ? (
        <EmptyState
          title="Live data unavailable"
          description={error}
          primaryActionLabel="Retry"
          onPrimaryAction={refresh}
          secondaryActionLabel="Settings"
          onSecondaryAction={() => router.push('/settings')}
        />
      ) : null}

      {loading && !data ? <LoadingSkeleton variant="detail" count={3} /> : null}

      {data ? (
        <>
          {briefItems.length ? <DailyBrief items={briefItems} /> : null}

          <Section title="Knowledge highlights" subtitle="Readable conclusions and recent summaries." actionLabel="Search" onActionPress={() => router.push('/search')}>
            {primaryInsight ? (
              <InsightCard insight={primaryInsight} onPress={() => router.push(`/insight/${primaryInsight.id}`)} />
            ) : (
              <EmptyState title="No insight yet" description="Insights will appear here once BrainIA finds useful patterns." />
            )}
            {primaryDigest ? <DigestCard digest={primaryDigest} onPress={() => router.push(`/digest/${primaryDigest.id}`)} /> : null}
          </Section>

          <Section title="Finance snapshot" subtitle="Enough context to decide whether to open Money." actionLabel="Open Money" onActionPress={() => router.push('/financials')}>
            <TodayFinanceSnapshot
              income={formatCurrency(income, summaryCurrency)}
              expenses={formatCurrency(monthlySpend, summaryCurrency)}
              net={formatCurrency(income - monthlySpend, summaryCurrency)}
              topCategory={topCategory ? formatCategoryLabel(topCategory.label) : undefined}
              topCategoryAmount={topCategory ? formatCurrency(topCategory.total, summaryCurrency) : undefined}
              onPress={() => router.push('/financials')}
            />
            <Panel tone="finance" style={{ gap: theme.spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing.md }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>
                    {topCategory ? formatCategoryLabel(topCategory.label) : 'No category trend yet'}
                  </Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                    {topCategory ? `${topCategory.count} transaction${topCategory.count === 1 ? '' : 's'} in this group.` : 'Transactions will be grouped once finance data arrives.'}
                  </Text>
                </View>
                <StatusBadge label={topCategory ? formatCurrency(topCategory.total, summaryCurrency) : 'Waiting'} />
              </View>
            </Panel>
          </Section>

          {pendingReviews?.length ? <Section title="Needs review" subtitle="Small decisions that improve future search and finance." actionLabel="Review" onActionPress={() => router.push('/review')}>
            <Panel tone="review" style={{ gap: theme.spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                <Feather name="shield" size={20} color={theme.status.review} />
                <View style={{ flex: 1 }}>
                  <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Merchant and category cleanup</Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                    Confirm friendly names so future searches and money summaries stay readable.
                  </Text>
                </View>
              </View>
              <Button label="Open Review" onPress={() => router.push('/review')} variant="secondary" />
            </Panel>
          </Section> : null}

          <Section title="Recent activity" subtitle="Your latest money movement, with a clear path back to its evidence." actionLabel="Search all" onActionPress={() => router.push('/search')}>
            {topTransaction ? (
              transactions.slice(0, 3).map((transaction) => (
                <Pressable key={transaction.id} accessibilityRole="button" accessibilityLabel={`Open ${transaction.displayMerchantLabel ?? transaction.merchantLabel}`} onPress={() => router.push(`/transaction/${transaction.id}`)}>
                  <Panel tone="finance" style={{ gap: theme.spacing.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                      <View style={{ width: 10, height: 10, borderRadius: 99, backgroundColor: transaction.kind === 'income' ? theme.status.income : transaction.kind === 'transfer' ? theme.status.transfer : theme.status.expense }} />
                      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, flex: 1 }]}>{joinDisplayParts([transaction.kind === 'income' ? 'Income' : transaction.kind === 'transfer' ? 'Transfer' : 'Expense', transaction.kind === 'transfer' ? undefined : formatCategoryLabel(transaction.category), transaction.currency])}</Text>
                      <Text style={[theme.typography.bodyStrong, { color: transaction.kind === 'income' ? theme.status.income : transaction.kind === 'transfer' ? theme.status.transfer : theme.status.expense }]}>{transaction.amount}</Text>
                    </View>
                    <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>{transaction.displayMerchantLabel ?? transaction.merchantLabel}</Text>
                  </Panel>
                </Pressable>
              ))
            ) : (
              <EmptyState title="No recent activity" description="Captured notes, notifications, emails, and wallet events will show up here." />
            )}
          </Section>
        </>
      ) : null}
    </AppScreen>
  );
}
