import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Button, Tag } from '@/components/controls';
import { IconTile, Row } from '@/components/data/Row';
import { SignalCard } from '@/components/data/SignalCard';
import { StateView } from '@/components/data/StateView';
import { Timeline } from '@/components/data/Timeline';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { useToast } from '@/components/layout/Toast';
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
  const toast = useToast();
  const loader = useMemo(() => () => loadInsightBundle(client, { id }), [client, id]);
  const { data, loading, error, refresh } = useAsyncResource(loader, [loader]);
  const [feedback, setFeedback] = useState<'accept' | 'reject' | null>(null);
  const [pending, setPending] = useState<'accept' | 'reject' | null>(null);

  const insight = data?.insight;

  async function submitFeedback(action: 'accept' | 'reject') {
    if (!insight?.id || pending) return;
    setPending(action);
    try {
      await client.recordKnowledgeFeedback({ action, targetType: 'insight', targetId: insight.id });
      setFeedback(action);
    } catch {
      toast.show('No se pudo registrar tu respuesta.', { tone: 'danger' });
    } finally {
      setPending(null);
    }
  }

  return (
    <Screen title={insight?.title ?? 'Perspectiva'} overline="Perspectiva" subtitle={insight?.timestamp ? `Generada ${insight.timestamp}` : 'Conclusión clara con contexto de respaldo.'} back refreshing={loading && Boolean(insight)} onRefresh={refresh}>
      {error ? <StateView kind="error" title="No se pudo cargar la perspectiva" description={friendlyError(error)} actionLabel="Reintentar" onAction={refresh} /> : null}
      {loading && !insight ? <StateView kind="loading" title="Cargando perspectiva" skeleton="detail" skeletonCount={2} /> : null}

      {insight ? (
        <>
          <SignalCard variant="block" origin="model" title="Perspectiva asistida" summary={insight.summary} confidence={insight.confidence} />

          {insight.whyItMatters ? (
            <Section title="Por qué importa">
              <GlassSurface level="thin" padding="md" contentStyle={{ flexDirection: 'row', gap: theme.spacing.md }}>
                <IconTile icon="zap" color={theme.colors.model} />
                <Text style={[theme.typography.body, { color: theme.colors.textSecondary, flex: 1 }]}>{insight.whyItMatters}</Text>
              </GlassSurface>
            </Section>
          ) : null}

          <Section title="Conclusiones">
            {insight.takeaways.length ? <GlassSurface level="thin" padding="none">{insight.takeaways.map((takeaway, index) => (
              <Row style={index === insight.takeaways.length - 1 ? { borderBottomWidth: 0 } : undefined} key={takeaway} title={takeaway} titleLines={0} leading={<IconTile icon="check" size="sm" color={theme.colors.accent} />} accessory="none" />
            ))}</GlassSurface> : <StateView title="Todavía no hay conclusiones" description="No hay acciones concretas que recomendar por ahora." />}
          </Section>

          {insight.supportingReferences?.length ? (
            <Section title="Fuentes de respaldo" subtitle="Solo las referencias que acompañan esta perspectiva.">
              <Timeline items={insight.supportingReferences.map((reference) => ({
                id: `${reference.kind}-${reference.id}`,
                icon: reference.kind === 'transaction' ? 'credit-card' : reference.kind === 'event' ? 'inbox' : 'link-2',
                title: reference.label,
                subtitle: ({ transaction: 'Movimiento', event: 'Evento' } as Record<string, string>)[reference.kind] ?? 'Referencia',
                reason: reference.description,
                onPress: reference.route ? () => router.push(reference.route as never) : undefined,
              }))} />
            </Section>
          ) : null}

          {insight.recommendedAction ? (
            <Section title="Próximo paso">
              <GlassSurface level="thin" tone="accent" padding="md" contentStyle={{ flexDirection: 'row', gap: theme.spacing.md }}>
                <IconTile icon="arrow-right" color={theme.colors.accent} />
                <Text style={[theme.typography.body, { color: theme.colors.textPrimary, flex: 1 }]}>{insight.recommendedAction}</Text>
              </GlassSurface>
            </Section>
          ) : null}

          <Section title="¿Te resultó útil?" subtitle="Tu respuesta ajusta qué patrones BrainIA prioriza en el futuro.">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              <Button label={feedback === 'accept' ? 'Marcado como útil' : 'Sí, es útil'} size="sm" variant={feedback === 'accept' ? 'primary' : 'secondary'} loading={pending === 'accept'} onPress={() => submitFeedback('accept')} disabled={Boolean(pending) || feedback === 'accept'} icon={<Feather name="thumbs-up" size={14} color={feedback === 'accept' ? theme.colors.onAccent : theme.colors.textPrimary} />} />
              <Button label={feedback === 'reject' ? 'Marcado como no útil' : 'No es útil'} size="sm" variant="ghost" loading={pending === 'reject'} onPress={() => submitFeedback('reject')} disabled={Boolean(pending) || feedback === 'reject'} icon={<Feather name="thumbs-down" size={14} color={theme.colors.textMuted} />} />
            </View>
            {feedback ? <Animated.View key={feedback} entering={FadeIn.duration(theme.motion.duration.quick)}><Tag label="Gracias. Esto ajusta las próximas señales." tone="positive" icon="check" /></Animated.View> : null}
          </Section>

          {shouldShowOperationalDetail(settings.dataVisibility) ? (
            <Section title="Detalles técnicos">
              <GlassSurface level="thin" padding="none">
              <Row title="Modelo" subtitle={insight.model ?? 'heuristic-v1'} accessory="none" />
              <Row title="Elementos de respaldo" subtitle={String(insight.relatedCount ?? 0)} accessory="none" />
              <Row title="Generada" subtitle={insight.timestamp ?? 'Desconocido'} accessory="none" style={{ borderBottomWidth: 0 }} />
              </GlassSurface>
            </Section>
          ) : null}

          <Section title="Más contexto">
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <View style={{ flex: 1 }}><Button label="Explorar" variant="secondary" onPress={() => router.push('/search')} /></View>
              <View style={{ flex: 1 }}><Button label="Hoy" variant="ghost" onPress={() => router.push('/')} /></View>
            </View>
          </Section>
        </>
      ) : null}
      {!loading && !error && !insight ? <StateView title="No hay perspectiva disponible" description="Todavía no hay una perspectiva para este elemento." /> : null}
    </Screen>
  );
}

function friendlyError(error: string) {
  return /network|fetch|connection|timeout|offline/i.test(error)
    ? 'Sin conexión con Brain IA. Revisa tu red e intenta de nuevo.'
    : 'No se pudieron cargar los datos. Intenta de nuevo.';
}
