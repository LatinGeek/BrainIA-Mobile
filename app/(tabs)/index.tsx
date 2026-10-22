import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Text, View } from 'react-native';

import { Chip, Tag } from '@/components/controls';
import { Amount, IconTile, TransactionRow } from '@/components/data/Row';
import { SignalCarousel } from '@/components/data/SignalCard';
import { StateView } from '@/components/data/StateView';
import { StatGrid, StatTile } from '@/components/data/StatTile';
import { GlassPressable } from '@/components/glass/GlassPressable';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { Screen, Section } from '@/components/layout/Screen';
import { useAppState } from '@/lib/app-state';
import { loadDashboardBundle } from '@/lib/api';
import { useAsyncResource } from '@/lib/hooks';
import { formatCategoryInsight, formatCurrency, formatDate, isUncategorizedLabel } from '@/lib/format';
import { summarizeFinancialTransactions } from '@/lib/financial-summary';
import { groupTransactionsByField } from '@/lib/grouping';

const quickActions = [
  { id: 'expense', label: 'Gasto', icon: 'arrow-up-right' as const, href: { pathname: '/capture', params: { mode: 'expense' } } },
  { id: 'income', label: 'Ingreso', icon: 'arrow-down-left' as const, href: { pathname: '/capture', params: { mode: 'income' } } },
  { id: 'note', label: 'Nota', icon: 'edit-3' as const, href: { pathname: '/capture', params: { mode: 'note' } } },
  { id: 'search', label: 'Buscar', icon: 'search' as const, href: '/search' },
];

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
  const financialSummary = summarizeFinancialTransactions(transactions, 'UYU');
  const insights = data?.insights ?? [];
  const digests = data?.digests ?? [];
  const categoryGroups = groupTransactionsByField(reportTransactions.filter((transaction) => transaction.currency === 'UYU'), 'category');
  const topCategory = categoryGroups[0];
  const primaryInsight = insights[0];
  const primaryDigest = digests[0];
  const net = financialSummary.income - financialSummary.expenses;
  const pendingCount = pendingReviews?.length ?? 0;

  const startReview = () => {
    router.push('/review-session' as never);
  };

  const briefItems = [
    pendingCount ? {
      id: 'review-pending',
      title: `${pendingCount} ${pendingCount === 1 ? 'decisión te espera' : 'decisiones te esperan'}`,
      summary: 'Una respuesta por tarjeta. Menos de un minuto para dejar tus datos en orden.',
      origin: 'pending' as const,
      meta: 'Revisión',
      onActionPress: startReview,
    } : undefined,
    ...(primaryInsight?.cards?.length ? primaryInsight.cards.map((card, index) => ({
      id: `insight:${primaryInsight.id}:${index}`,
      title: card.title,
      summary: card.summary,
      origin: 'model' as const,
      confidence: primaryInsight.confidence,
      onActionPress: () => router.push(`/insight/${primaryInsight.id}`),
    })) : primaryInsight ? [{
      id: `insight:${primaryInsight.id}`,
      title: primaryInsight.title,
      summary: primaryInsight.summary,
      origin: 'model' as const,
      confidence: primaryInsight.confidence,
      onActionPress: () => router.push(`/insight/${primaryInsight.id}`),
    }] : []),
    ...(primaryDigest?.cards?.length ? primaryDigest.cards.map((card, index) => ({
      id: `digest:${primaryDigest.id}:${index}`,
      title: card.title,
      summary: card.summary,
      origin: 'model' as const,
      meta: primaryDigest.windowLabel,
      onActionPress: () => router.push(`/digest/${primaryDigest.id}`),
    })) : primaryDigest ? [{
      id: `digest:${primaryDigest.id}`,
      title: primaryDigest.title,
      summary: primaryDigest.summary,
      origin: 'model' as const,
      meta: primaryDigest.windowLabel,
      onActionPress: () => router.push(`/digest/${primaryDigest.id}`),
    }] : []),
    topCategory ? {
      id: `category:${topCategory.label}`,
      title: 'Principal área de gasto',
      summary: formatCategoryInsight(topCategory.label, formatCurrency(topCategory.total, 'UYU')),
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
    <Screen
      title="Tu día, en perspectiva"
      overline={data?.cachedAt ? `Actualizado ${formatDate(data.cachedAt)}` : 'Hoy'}
      subtitle="Lo importante de tu conocimiento, tu dinero y tus decisiones."
      ambientAnimated
      refreshing={loading}
      onRefresh={refresh}
      actions={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Tag label={loading ? 'Actualizando' : error ? 'Sin conexión' : data?.live ? 'En vivo' : 'Vista guardada'} tone={error ? 'warning' : data?.live ? 'positive' : 'neutral'} live={Boolean(data?.live)} />
          <GlassPressable accessibilityRole="button" accessibilityLabel="Settings" onPress={() => router.push('/settings')} scaleTo={0.9} style={{ width: theme.layout.minTarget, height: theme.layout.minTarget, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.glass.inner }}>
            <Feather name="settings" size={18} color={theme.colors.textPrimary} />
          </GlassPressable>
        </View>
      }
    >
      {error ? (
        <StateView kind="error" title="Datos en vivo no disponibles" description={error} actionLabel="Reintentar" onAction={refresh} secondaryActionLabel="Ajustes" onSecondaryAction={() => router.push('/settings')} />
      ) : null}

      {loading && !data ? <StateView kind="loading" title="Cargando" skeleton="detail" skeletonCount={3} /> : null}

      {data ? (
        <>
          <GlassSurface level="strong" tone="finance" padding="lg" contentStyle={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ gap: 2 }}>
                <Text style={[theme.typography.overline, { color: theme.colors.textMuted }]}>Este ciclo</Text>
                <Text style={[theme.typography.headline, { color: theme.colors.textSecondary, fontSize: 14 }]}>Movimiento neto</Text>
              </View>
              <Tag label={net >= 0 ? 'Positivo' : 'Gasto excedido'} tone={net >= 0 ? 'positive' : 'danger'} icon={net >= 0 ? 'trending-up' : 'trending-down'} />
            </View>
            <Amount value={net} currency="UYU" tone={net >= 0 ? 'positive' : 'expense'} size="hero" signed />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 14, rowGap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.status.income }} />
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Ingresos {formatCurrency(financialSummary.income, 'UYU')}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.status.expense }} />
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Gastado {formatCurrency(financialSummary.expenses, 'UYU')}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {quickActions.map((action) => (
                <GlassPressable
                  key={action.id}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  haptic="selection"
                  scaleTo={0.94}
                  onPress={() => router.push(action.href as never)}
                  style={{ flex: 1 }}
                >
                  <GlassSurface level="thin" padding="none" radius="md" contentStyle={{ minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <Feather name={action.icon} size={17} color={action.id === 'expense' ? theme.status.expense : action.id === 'income' ? theme.status.income : theme.colors.textPrimary} />
                    <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, fontSize: 10 }]}>{action.label}</Text>
                  </GlassSurface>
                </GlassPressable>
              ))}
            </View>
          </GlassSurface>

          {briefItems.length ? (
            <Section title="Lo más importante" subtitle="Lo que merece tu atención." count={briefItems.length} actionLabel={pendingCount ? 'Revisar' : undefined} onActionPress={pendingCount ? startReview : undefined}>
              <SignalCarousel items={briefItems.slice(0, 6).map((item) => ({
                id: item.id,
                title: item.title,
                summary: item.summary,
                origin: item.origin,
                confidence: 'confidence' in item ? item.confidence : undefined,
                meta: 'meta' in item ? item.meta : undefined,
                onPress: item.onActionPress,
              }))} />
            </Section>
          ) : null}

          <Section title="Finanzas" subtitle="Ingresos y gastos del ciclo actual." actionLabel="Abrir Dinero" onActionPress={() => router.push('/financials')}>
            <StatGrid>
              <StatTile label="Ingresos" value={financialSummary.income} currency="UYU" tone="income" icon="arrow-down-left" />
              <StatTile label="Gastos" value={financialSummary.expenses} currency="UYU" tone="expense" icon="arrow-up-right" />
            </StatGrid>
          </Section>

          <Section title="Actividad reciente" subtitle="Tus últimos movimientos, con acceso directo a su evidencia." actionLabel="Buscar todo" onActionPress={() => router.push('/search')}>
            {transactions.length ? (
              transactions.slice(0, 3).map((transaction) => (
                <TransactionRow key={transaction.id} transaction={transaction} onPress={() => router.push(`/transaction/${transaction.id}`)} />
              ))
            ) : (
              <StateView title="Sin actividad reciente" description="Aquí aparecerán tus notas, notificaciones, correos y movimientos." />
            )}
          </Section>

          {topCategory ? (
            <Section title="En contexto" subtitle="La señal que explica tu ciclo.">
              <GlassSurface level="thin" padding="md" contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <IconTile icon="pie-chart" color={theme.colors.model} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{topCategory.label}</Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{formatCategoryInsight(topCategory.label, formatCurrency(topCategory.total, 'UYU'))}</Text>
                </View>
                <Chip label={`${topCategory.count}`} static />
              </GlassSurface>
            </Section>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
