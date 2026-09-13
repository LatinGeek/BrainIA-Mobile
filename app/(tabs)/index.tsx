import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Text, View } from 'react-native';

import { TodayFinanceSnapshot } from '@/components/cards';
import { TransactionRow } from '@/components/finance';
import { DailyBrief } from '@/components/knowledge';
import { AppScreen, Section, TopBar } from '@/components/layout';
import { Button, Panel, StatusBadge } from '@/components/primitives';
import { EmptyState, LoadingSkeleton } from '@/components/states';
import { useAppState } from '@/lib/app-state';
import { loadDashboardBundle } from '@/lib/api';
import { useAsyncResource } from '@/lib/hooks';
import { formatCategoryInsight, formatCurrency, formatDate, isUncategorizedLabel, type SupportedCurrency } from '@/lib/format';
import { summarizeFinancialTransactions } from '@/lib/financial-summary';
import { groupTransactionsByField } from '@/lib/grouping';

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
  const summaryCurrency: SupportedCurrency = 'UYU';
  const summaryTransactions = reportTransactions.filter((transaction) => transaction.currency === summaryCurrency);
  const financialSummary = summarizeFinancialTransactions(transactions, summaryCurrency);
  const insights = data?.insights ?? [];
  const digests = data?.digests ?? [];
  const categoryGroups = groupTransactionsByField(summaryTransactions, 'category');
  const topCategory = categoryGroups[0];
  const topTransaction = transactions[0];
  const primaryInsight = insights[0];
  const primaryDigest = digests[0];

  const briefItems = [
    pendingReviews?.length ? {
      id: 'review-pending',
      title: `${pendingReviews.length} data decision${pendingReviews.length === 1 ? '' : 's'} need review`,
      summary: 'Reviewing them can improve future search and graph connections.',
      origin: 'pending' as const,
      onActionPress: () => router.push('/review'),
    } : undefined,
    ...(primaryInsight?.cards?.length ? primaryInsight.cards.map((card, index) => ({
      id: `insight:${primaryInsight.id}:${index}`,
      title: card.title,
      summary: card.summary,
      origin: 'model' as const,
      onActionPress: () => router.push(`/insight/${primaryInsight.id}`),
    })) : (primaryInsight ? [{ id: `insight:${primaryInsight.id}`, title: primaryInsight.title, summary: primaryInsight.summary, origin: 'model' as const, onActionPress: () => router.push(`/insight/${primaryInsight.id}`) }] : [])),
    ...(primaryDigest?.cards?.length ? primaryDigest.cards.map((card, index) => ({
      id: `digest:${primaryDigest.id}:${index}`,
      title: card.title,
      summary: card.summary,
      origin: 'model' as const,
      onActionPress: () => router.push(`/digest/${primaryDigest.id}`),
    })) : (primaryDigest ? [{ id: `digest:${primaryDigest.id}`, title: primaryDigest.title, summary: primaryDigest.summary, origin: 'model' as const, onActionPress: () => router.push(`/digest/${primaryDigest.id}`) }] : [])),
    topCategory ? {
      id: `category:${topCategory.label}`,
      title: 'Largest spending area',
      summary: formatCategoryInsight(topCategory.label, formatCurrency(topCategory.total, summaryCurrency)),
      origin: 'captured' as const,
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

          <Section title="Finance" actionLabel="Open Money" onActionPress={() => router.push('/financials')}>
            <TodayFinanceSnapshot
              income={formatCurrency(financialSummary.income, summaryCurrency)}
              expenses={formatCurrency(financialSummary.expenses, summaryCurrency)}
              net={formatCurrency(financialSummary.income - financialSummary.expenses, summaryCurrency)}
              onPress={() => router.push('/financials')}
            />
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
              transactions.slice(0, 3).map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} onPress={() => router.push(`/transaction/${transaction.id}`)} />)
            ) : (
              <EmptyState title="No recent activity" description="Captured notes, notifications, emails, and wallet events will show up here." />
            )}
          </Section>
        </>
      ) : null}
    </AppScreen>
  );
}
