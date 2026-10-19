import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Button, Tag } from '@/components/controls';
import { IconTile, Row } from '@/components/data/Row';
import { StatGrid, StatTile } from '@/components/data/StatTile';
import { StateView } from '@/components/data/StateView';
import { GlassPressable } from '@/components/glass/GlassPressable';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { Screen, Section } from '@/components/layout/Screen';
import { useBrainIAClient, useTheme } from '@/lib/app-state';
import { loadReviewBundle } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { useAsyncResource } from '@/lib/hooks';
import { buildReviewQueue, decisionEffort } from '@/lib/review-session';

export default function ReviewHomeScreen() {
  const theme = useTheme();
  const client = useBrainIAClient();
  const [starting, setStarting] = useState(false);

  const loader = useMemo(() => async () => {
    const [bundle, candidates, transactions, categories] = await Promise.all([
      loadReviewBundle(client),
      client.listSemanticCandidates().catch(() => []),
      client.listTransactions(500).catch(() => []),
      client.listFinancialCategories().catch(() => ({ expense: [], income: [] })),
    ]);
    const resolved = await client.listReviews('resolved').catch(() => []);
    return {
      reviews: bundle.reviews,
      resolved,
      candidates,
      queue: buildReviewQueue({ reviews: bundle.reviews, candidates, transactions, categories: [...categories.expense, ...categories.income] }),
    };
  }, [client]);
  const { data, loading, error, refresh } = useAsyncResource(loader, [loader]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const queue = useMemo(() => data?.queue ?? [], [data?.queue]);
  const pendingCount = data?.reviews.length ?? 0;
  const resolvedCount = data?.resolved.length ?? 0;
  const total = pendingCount + resolvedCount;
  const progress = total ? resolvedCount / total : 1;
  const tidyCount = queue.reduce((sum, decision) => sum + decision.impact.transactions, 0);
  const tidyAmount = queue.reduce((sum, decision) => sum + decision.impact.amount, 0);
  const topics = useMemo(() => {
    const byTopic = new Map<string, number>();
    queue.forEach((decision) => byTopic.set(decision.topic, (byTopic.get(decision.topic) ?? 0) + 1));
    return [...byTopic.entries()].sort((left, right) => right[1] - left[1]);
  }, [queue]);

  const start = (topic?: string) => {
    if (starting) return;
    setStarting(true);
    router.push({ pathname: '/review-session' as never, params: topic ? { topic } : {} });
    setTimeout(() => setStarting(false), 600);
  };

  return (
    <Screen
      title="Revisar"
      overline="Review"
      subtitle="Una decisión por tarjeta. Menos de un minuto para dejar tus datos en orden."
      refreshing={loading}
      onRefresh={refresh}
      actions={<Tag label={pendingCount ? `${pendingCount} pending` : 'All clear'} tone={pendingCount ? 'warning' : 'positive'} />}
    >
      {error ? <StateView kind="error" title="No se pudo cargar la revisión" description={error} actionLabel="Reintentar" onAction={refresh} /> : null}
      {loading && !data ? <StateView kind="loading" title="Loading" skeleton="card" skeletonCount={2} /> : null}

      {data ? (
        <>
          <GlassSurface level="strong" tone={pendingCount ? 'review' : 'accent'} padding="lg" contentStyle={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <ProgressRing value={progress} size={92} label={`${Math.round(progress * 100)}%`} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[theme.typography.overline, { color: theme.colors.textMuted }]}>Review progress</Text>
                <Text style={[theme.typography.headline, { color: theme.colors.textPrimary, fontSize: 22, lineHeight: 27 }]}>
                  {pendingCount ? decisionEffort(queue.length) : 'All clear'}
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  {pendingCount
                    ? tidyCount
                      ? `About ${tidyCount} transactions and ${formatCurrency(tidyAmount, 'UYU')} become easier to recognise.`
                      : 'Each answer improves names, categories and connections.'
                    : 'New decisions appear as activity arrives, usually after payday.'}
                </Text>
              </View>
            </View>
            {pendingCount ? (
              <Button label={starting ? 'Starting…' : `Continue · ${queue.length} left`} onPress={() => start()} loading={starting} full icon={<Feather name="play" size={15} color={theme.colors.onAccent} />} />
            ) : (
              <Button label="Refresh" variant="secondary" onPress={refresh} full icon={<Feather name="refresh-cw" size={15} color={theme.colors.textPrimary} />} />
            )}
          </GlassSurface>

          {topics.length > 1 ? (
            <Section title="Or pick a topic" subtitle="Start with the kind of decision you feel like making.">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {topics.slice(0, 6).map(([topic, count]) => (
                  <GlassPressableTopic key={topic} topic={topic} count={count} onPress={() => start(topic)} />
                ))}
              </View>
            </Section>
          ) : null}

          <Section title="This week">
            <StatGrid>
              <StatTile label="Decisions" value={resolvedCount} icon="check" tone="positive" />
              <StatTile label="Pending" value={pendingCount} icon="clock" tone="warning" />
            </StatGrid>
          </Section>

          {queue.length ? (
            <Section title="What you will review" subtitle="The highest-impact decisions come first." count={queue.length}>
              {queue.slice(0, 4).map((decision) => (
                <Row
                  key={decision.id}
                  title={decision.title}
                  subtitle={decision.kind === 'relation' ? 'Connection' : decision.kind === 'batch' ? `${decision.reviewIds.length} variants` : decision.kind === 'category' ? 'Category' : 'Name'}
                  description={decision.impact.transactions ? `${decision.impact.transactions} transactions · ${formatCurrency(decision.impact.amount, decision.impact.currency)}` : decision.rationale}
                  leading={<IconTile icon={decision.kind === 'relation' ? 'link-2' : decision.kind === 'same' ? 'users' : 'tag'} color={theme.status.review} />}
                  accessory="none"
                />
              ))}
            </Section>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function ProgressRing({ value, size, label }: { value: number; size: number; label: string }) {
  const theme = useTheme();
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={theme.glass.divider} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={theme.colors.accent} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${circumference * clamped} ${circumference}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary, position: 'absolute' }]}>{label}</Text>
    </View>
  );
}

function GlassPressableTopic({ topic, count, onPress }: { topic: string; count: number; onPress: () => void }) {
  const theme = useTheme();
  return (
    <GlassSurface level="thin" padding="sm" style={{ minWidth: 110 }} contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <GlassPressable onPress={onPress}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <IconTile icon="tag" size="sm" color={theme.status.review} />
          <View style={{ gap: 1 }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textPrimary }]}>{topic}</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted, fontSize: 10 }]}>{count} to answer</Text>
          </View>
        </View>
      </GlassPressable>
    </GlassSurface>
  );
}
