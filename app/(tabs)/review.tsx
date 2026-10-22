import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { Easing, FadeOut } from 'react-native-reanimated';

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
import { useAsyncResource, useReduceMotion } from '@/lib/hooks';
import { listLayout } from '@/lib/motion';
import { setReviewQueueSize } from '@/lib/review-queue';
import { buildReviewQueue, decisionSeconds } from '@/lib/review-session';

export default function ReviewHomeScreen() {
  const theme = useTheme();
  const client = useBrainIAClient();
  const reduceMotion = useReduceMotion();
  const [starting, setStarting] = useState(false);

  const loader = useMemo(() => async () => {
    const [bundle, candidates, transactions, categories] = await Promise.all([
      loadReviewBundle(client),
      client.listSemanticCandidates().catch(() => []),
      client.listTransactions(500).catch(() => []),
      client.listFinancialCategories().catch(() => ({ expense: [], income: [] })),
    ]);
    const resolved = await client.listReviews('resolved').catch(() => []);
    const builtQueue = buildReviewQueue({ reviews: bundle.reviews, candidates, transactions, categories: [...categories.expense, ...categories.income] });
    setReviewQueueSize(builtQueue.length);
    return {
      reviews: bundle.reviews,
      resolved,
      candidates,
      queue: builtQueue,
    };
  }, [client]);
  const { data, loading, error, refresh } = useAsyncResource(loader, [loader]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const queue = useMemo(() => data?.queue ?? [], [data?.queue]);
  const pendingCount = data?.queue.length ?? 0;
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
      overline="Revisión"
      subtitle="Una decisión por tarjeta. Menos de un minuto para dejar tus datos en orden."
      refreshing={loading}
      onRefresh={refresh}
      actions={<Tag label={pendingCount ? `${pendingCount} ${pendingCount === 1 ? 'pendiente' : 'pendientes'}` : 'Todo al día'} tone={pendingCount ? 'warning' : 'positive'} />}
    >
      {error ? <StateView kind="error" title="No se pudo cargar la revisión" description={error} actionLabel="Reintentar" onAction={refresh} /> : null}
      {loading && !data ? <StateView kind="loading" title="Cargando" skeleton="card" skeletonCount={2} /> : null}

      {data ? (
        <>
          <GlassSurface level="strong" tone={pendingCount ? 'review' : 'accent'} padding="lg" contentStyle={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <ProgressRing value={progress} size={92} label={`${Math.round(progress * 100)}%`} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[theme.typography.overline, { color: theme.colors.textMuted }]}>{`Progreso general · ${resolvedCount} de ${total}`}</Text>
                <Text style={[theme.typography.headline, { color: theme.colors.textPrimary, fontSize: 22, lineHeight: 27 }]}>
                  {pendingCount ? `${queue.length} ${queue.length === 1 ? 'decisión rápida' : 'decisiones rápidas'}` : 'Todo al día'}
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  {pendingCount
                    ? tidyCount
                      ? `Unos ${decisionSeconds(queue.length)} segundos. ${tidyCount} movimientos y ${formatCurrency(tidyAmount, 'UYU')} se vuelven más fáciles de reconocer.`
                      : `Unos ${decisionSeconds(queue.length)} segundos. Cada respuesta mejora nombres, categorías y conexiones.`
                    : 'Las nuevas decisiones aparecen a medida que llega actividad, normalmente tras el cobro.'}
                </Text>
              </View>
            </View>
            {pendingCount ? (
              <Button label={starting ? 'Iniciando…' : `Continuar · ${queue.length} restantes`} onPress={() => start()} loading={starting} full icon={<Feather name="play" size={15} color={theme.colors.onAccent} />} />
            ) : (
              <Button label="Actualizar" variant="secondary" onPress={refresh} full icon={<Feather name="refresh-cw" size={15} color={theme.colors.textPrimary} />} />
            )}
          </GlassSurface>

          {topics.length > 1 ? (
            <Section title="O elige un tema" subtitle="Empieza por el tipo de decisión que prefieras.">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {topics.slice(0, 6).map(([topic, count]) => (
                  <GlassPressableTopic key={topic} topic={topic} count={count} onPress={() => start(topic)} />
                ))}
              </View>
            </Section>
          ) : null}

          <Section title="En total">
            <StatGrid>
              <StatTile label="Resueltas" value={resolvedCount} icon="check" tone="positive" />
              <StatTile label="Pendientes" value={pendingCount} icon="clock" tone="warning" />
            </StatGrid>
          </Section>

          {queue.length ? (
            <Section title="Lo que revisarás" subtitle="Primero las decisiones de mayor impacto." count={queue.length}>
              {queue.slice(0, 4).map((decision) => (
                <Animated.View key={decision.id} layout={reduceMotion ? undefined : listLayout} exiting={reduceMotion ? undefined : FadeOut.duration(theme.motion.duration.quick).easing(Easing.bezier(...theme.motion.easing.in))}>
                <Row
                  title={decision.title}
                  subtitle={decision.kind === 'relation' ? 'Conexión' : decision.kind === 'batch' ? `${decision.reviewIds.length} variantes` : decision.kind === 'category' ? 'Categoría' : 'Nombre'}
                  description={decision.impact.transactions ? `${decision.impact.transactions} ${decision.impact.transactions === 1 ? 'movimiento' : 'movimientos'} · ${formatCurrency(decision.impact.amount, decision.impact.currency)}` : decision.rationale}
                  leading={<IconTile icon={decision.kind === 'relation' ? 'link-2' : decision.kind === 'same' ? 'users' : 'tag'} color={theme.status.review} />}
                  accessory="none"
                />
                </Animated.View>
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
    <GlassPressable accessibilityRole="button" accessibilityLabel={`${topic}, ${count} por responder`} haptic="selection" scaleTo={0.96} onPress={onPress} style={{ minWidth: 110 }}>
      <GlassSurface level="thin" padding="sm" radius="md" contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: theme.layout.minTarget - 16 }}>
        <IconTile icon={topic === 'Conexiones' ? 'link-2' : topic === 'Identidades' ? 'users' : 'tag'} size="sm" color={theme.status.review} />
        <View style={{ gap: 1 }}>
          <Text style={[theme.typography.caption, { color: theme.colors.textPrimary }]}>{topic}</Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, fontSize: 10 }]}>{count} por responder</Text>
        </View>
      </GlassSurface>
    </GlassPressable>
  );
}
