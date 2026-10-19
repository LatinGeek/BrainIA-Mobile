import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Tag } from '@/components/controls';
import { IconTile, Row } from '@/components/data/Row';
import { SignalCard } from '@/components/data/SignalCard';
import { StateView } from '@/components/data/StateView';
import { Timeline } from '@/components/data/Timeline';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { Screen, Section } from '@/components/layout/Screen';
import { useAppState, useBrainIAClient, useTheme } from '@/lib/app-state';
import { loadInsightBundle } from '@/lib/api';
import { useAsyncResource } from '@/lib/hooks';
import { shouldShowOperationalDetail } from '@/lib/presentation';

export default function InsightDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useBrainIAClient();
  const { settings } = useAppState();
  const theme = useTheme();
  const loader = useMemo(() => () => loadInsightBundle(client, { id }), [client, id]);
  const { data, loading, error, refresh } = useAsyncResource(loader, [loader]);
  const [feedback, setFeedback] = useState<'accept' | 'reject' | null>(null);
  const [savingFeedback, setSavingFeedback] = useState(false);

  const insight = data?.insight;

  async function submitFeedback(action: 'accept' | 'reject') {
    if (!insight?.id) return;
    setSavingFeedback(true);
    try {
      await client.recordKnowledgeFeedback({ action, targetType: 'insight', targetId: insight.id });
      setFeedback(action);
    } finally {
      setSavingFeedback(false);
    }
  }

  return (
    <Screen title={insight?.title ?? 'Perspectiva'} overline="Insight" subtitle={insight?.timestamp ? `Generada ${insight.timestamp}` : 'Conclusión clara con contexto de respaldo.'} back refreshing={loading} onRefresh={refresh}>
      {error ? <StateView kind="error" title="No se pudo cargar la perspectiva" description={error} actionLabel="Reintentar" onAction={refresh} /> : null}
      {loading && !insight ? <StateView kind="loading" title="Loading" skeleton="detail" skeletonCount={2} /> : null}

      {insight ? (
        <>
          <SignalCard variant="block" origin="model" title="Perspectiva asistida" summary={insight.summary} confidence={insight.confidence} meta={insight.timestamp ? `Generated ${insight.timestamp}` : undefined} />

          {insight.whyItMatters ? (
            <Section title="Why it matters">
              <GlassSurface level="thin" padding="md" contentStyle={{ flexDirection: 'row', gap: 10 }}>
                <IconTile icon="zap" color={theme.colors.model} />
                <Text style={[theme.typography.body, { color: theme.colors.textSecondary, flex: 1 }]}>{insight.whyItMatters}</Text>
              </GlassSurface>
            </Section>
          ) : null}

          <Section title="Takeaways">
            {insight.takeaways.length ? insight.takeaways.map((takeaway) => (
              <Row key={takeaway} title={takeaway} leading={<IconTile icon="check" size="sm" color={theme.colors.accent} />} accessory="none" />
            )) : <StateView title="Todavía no hay conclusiones" description="No hay acciones concretas que recomendar por ahora." />}
          </Section>

          {insight.supportingReferences?.length ? (
            <Section title="Fuentes de respaldo" subtitle="Only references returned with this insight.">
              <Timeline items={insight.supportingReferences.map((reference) => ({
                id: `${reference.kind}-${reference.id}`,
                icon: reference.kind === 'transaction' ? 'credit-card' : reference.kind === 'event' ? 'inbox' : 'link-2',
                title: reference.label,
                subtitle: reference.kind,
                reason: reference.description,
                onPress: reference.route ? () => router.push(reference.route as never) : undefined,
              }))} />
            </Section>
          ) : null}

          {insight.recommendedAction ? (
            <Section title="Next step">
              <GlassSurface level="thin" tone="accent" padding="md" contentStyle={{ flexDirection: 'row', gap: 10 }}>
                <IconTile icon="arrow-right" color={theme.colors.accent} />
                <Text style={[theme.typography.body, { color: theme.colors.textPrimary, flex: 1 }]}>{insight.recommendedAction}</Text>
              </GlassSurface>
            </Section>
          ) : null}

          <Section title="¿Te resultó útil?" subtitle="Tu respuesta ajusta qué patrones BrainIA prioriza en el futuro.">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Button label={feedback === 'accept' ? 'Marcado como útil' : 'Sí, es útil'} size="sm" variant={feedback === 'accept' ? 'primary' : 'secondary'} loading={savingFeedback && feedback !== 'reject'} onPress={() => submitFeedback('accept')} disabled={savingFeedback || feedback === 'accept'} icon={<Feather name="thumbs-up" size={14} color={feedback === 'accept' ? theme.colors.onAccent : theme.colors.textPrimary} />} />
              <Button label={feedback === 'reject' ? 'Marcado como no útil' : 'No es útil'} size="sm" variant="ghost" loading={savingFeedback && feedback !== 'accept'} onPress={() => submitFeedback('reject')} disabled={savingFeedback || feedback === 'reject'} icon={<Feather name="thumbs-down" size={14} color={theme.colors.textMuted} />} />
            </View>
            {feedback ? <Tag label="Thanks — this adjusts future signals." tone="positive" icon="check" /> : null}
          </Section>

          {shouldShowOperationalDetail(settings.dataVisibility) ? (
            <Section title="Technical details">
              <Row title="Model" subtitle={insight.model ?? 'heuristic-v1'} accessory="none" />
              <Row title="Supporting items" subtitle={String(insight.relatedCount ?? 0)} accessory="none" />
              <Row title="Generated" subtitle={insight.timestamp ?? 'Unknown'} accessory="none" />
            </Section>
          ) : null}

          <Section title="More context">
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Button label="Search" variant="secondary" onPress={() => router.push('/search')} /></View>
              <View style={{ flex: 1 }}><Button label="Today" variant="ghost" onPress={() => router.push('/')} /></View>
            </View>
          </Section>
        </>
      ) : <StateView title="No hay perspectiva disponible" description="Todavía no hay una perspectiva para este elemento." />}
    </Screen>
  );
}
