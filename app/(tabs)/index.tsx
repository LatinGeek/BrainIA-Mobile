import { Feather } from '@expo/vector-icons';
import { IntelligenceOverview } from '@/components/intelligence';
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
  const { client, financialDataRevision, settings, theme } = useAppState();
  const loader = useMemo(
    () => () => loadDashboardBundle(client, settings.financialPeriodStartDay),
    [client, settings.financialPeriodStartDay],
  );
  const { data, loading, error, refresh } = useAsyncResource(loader, [financialDataRevision, loader]);
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
      title: `${pendingReviews.length} ${pendingReviews.length === 1 ? 'decisión de datos necesita' : 'decisiones de datos necesitan'} revisión`,
      summary: 'Revisarlas puede mejorar búsquedas futuras y conexiones del conocimiento.',
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
      title: 'Principal área de gasto',
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
        title="Tu día, en perspectiva"
        subtitle={data?.cachedAt ? `Actualizado ${formatDate(data.cachedAt)}` : 'Lo importante de tu conocimiento, tu dinero y tus decisiones.'}
        secondaryAction={
          <StatusBadge
            label={loading ? 'Actualizando' : error ? 'Sin conexión' : data?.live ? 'En vivo' : 'Vista guardada'}
            tone={error ? 'warning' : data?.live ? 'positive' : 'neutral'}
          />
        }
      />

      <IntelligenceOverview/>
      {error ? (
        <EmptyState
          title="Datos en vivo no disponibles"
          description={error}
          primaryActionLabel="Reintentar"
          onPrimaryAction={refresh}
          secondaryActionLabel="Ajustes"
          onSecondaryAction={() => router.push('/settings')}
        />
      ) : null}

      {loading && !data ? <LoadingSkeleton variant="detail" count={3} /> : null}

      {data ? (
        <>

          {briefItems.length ? <DailyBrief items={briefItems.slice(0, 3)} /> : null}

          <Section title="Finanzas" actionLabel="Abrir Dinero" onActionPress={() => router.push('/financials')}>
            <TodayFinanceSnapshot
              income={formatCurrency(financialSummary.income, summaryCurrency)}
              expenses={formatCurrency(financialSummary.expenses, summaryCurrency)}
              net={formatCurrency(financialSummary.income - financialSummary.expenses, summaryCurrency)}
              onPress={() => router.push('/financials')}
            />
          </Section>

          {pendingReviews?.length ? <Section title="Para revisar" subtitle="Decisiones pequeñas que mejoran las próximas interpretaciones." actionLabel="Revisar" onActionPress={() => router.push('/review')}>
            <Panel tone="review" style={{ gap: theme.spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                <Feather name="shield" size={20} color={theme.status.review} />
                <View style={{ flex: 1 }}>
                  <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Comercios y categorías claros</Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                    Confirma nombres habituales para mejorar las búsquedas y los resúmenes.
                  </Text>
                </View>
              </View>
              <Button label="Abrir Revisar" onPress={() => router.push('/review')} variant="secondary" />
            </Panel>
          </Section> : null}

          <Section title="Actividad reciente" subtitle="Tus últimos movimientos, con acceso directo a su evidencia." actionLabel="Buscar todo" onActionPress={() => router.push('/search')}>
            {topTransaction ? (
              transactions.slice(0, 3).map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} onPress={() => router.push(`/transaction/${transaction.id}`)} />)
            ) : (
              <EmptyState title="Sin actividad reciente" description="Aquí aparecerán tus notas, notificaciones, correos y movimientos." />
            )}
          </Section>
        </>
      ) : null}
    </AppScreen>
  );
}
