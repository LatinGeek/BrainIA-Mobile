import { useLocalSearchParams, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { AppScreen, SectionHeader, TopBar } from '@/components/layout';
import { Button, ListRow, Surface } from '@/components/primitives';
import { EvidenceTrail, GeneratedTextBlock } from '@/components/trust';
import { EmptyState, LoadingSkeleton } from '@/components/states';
import { useAppState, useBrainIAClient } from '@/lib/app-state';
import { loadInsightBundle } from '@/lib/api';
import { useAsyncResource } from '@/lib/hooks';
import { shouldShowOperationalDetail } from '@/lib/presentation';

export default function InsightDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useBrainIAClient();
  const { settings } = useAppState();
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
    <AppScreen refreshing={loading} onRefresh={refresh}>
      <TopBar showBack title={insight?.title ?? 'Perspectiva'} subtitle={insight?.timestamp ? `Generada ${insight.timestamp}` : 'Conclusión clara con contexto de respaldo.'} />

      {error ? <EmptyState title="No se pudo cargar la perspectiva" description={error} primaryActionLabel="Reintentar" onPrimaryAction={refresh} /> : null}

      {loading && !insight ? (
        <LoadingSkeleton variant="detail" count={2} />
      ) : insight ? (
        <>
          <GeneratedTextBlock title="Perspectiva asistida" body={insight.summary} confidence={insight.confidence} />
          {insight.whyItMatters ? (
            <>
              <SectionHeader title="Por qué importa" />
              <Surface variant="subtle">
                <ListRow title={insight.whyItMatters} />
              </Surface>
            </>
          ) : null}

          <SectionHeader title="Conclusiones principales" />
          <View style={{ gap: 8 }}>
            {insight.takeaways.length ? insight.takeaways.map((takeaway) => (
              <ListRow key={takeaway} title={takeaway} />
            )) : <EmptyState title="Todavía no hay conclusiones" description="No hay acciones concretas que recomendar por ahora." />}
          </View>

          {insight.supportingReferences?.length ? (
            <>
              <SectionHeader title="Fuentes de respaldo" subtitle="Se muestran las referencias que respaldan esta perspectiva." />
              <EvidenceTrail items={insight.supportingReferences.map((reference) => ({
                id: `${reference.kind}-${reference.id}`,
                title: reference.label,
                subtitle: reference.kind,
                detail: reference.description,
                onPress: reference.route ? () => router.push(reference.route as never) : undefined,
              }))} />
            </>
          ) : null}

          {insight.recommendedAction ? (
            <>
              <SectionHeader title="Próximo paso" />
              <Surface variant="subtle">
                <ListRow title={insight.recommendedAction} />
              </Surface>
            </>
          ) : null}

          <SectionHeader title="¿Te resultó útil?" subtitle="Tu respuesta ajusta qué patrones BrainIA prioriza en el futuro." />
          <Surface variant="subtle" style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Button label={feedback === 'accept' ? 'Marcado como útil' : 'Sí, es útil'} size="sm" variant={feedback === 'accept' ? 'primary' : 'secondary'} loading={savingFeedback && feedback !== 'reject'} onPress={() => submitFeedback('accept')} disabled={savingFeedback || feedback === 'accept'} />
              <Button label={feedback === 'reject' ? 'Marcado como no útil' : 'No es útil'} size="sm" variant="ghost" loading={savingFeedback && feedback !== 'accept'} onPress={() => submitFeedback('reject')} disabled={savingFeedback || feedback === 'reject'} />
            </View>
          </Surface>

          {shouldShowOperationalDetail(settings.dataVisibility) ? (
            <>
              <SectionHeader title="Detalles técnicos" />
              <View style={{ gap: 8 }}>
                <ListRow title="IA" subtitle={insight.model ?? 'heuristic-v1'} />
                <ListRow title="Elementos de respaldo" subtitle={String(insight.relatedCount ?? 0)} />
                <ListRow title="Generado el" subtitle={insight.timestamp ?? 'Fecha desconocida'} />
              </View>
            </>
          ) : null}

          <SectionHeader title="Acciones" />
          <EmptyState
            title="¿Necesitas más contexto?"
            description="Abre el mapa o busca alrededor del elemento actual."
            primaryActionLabel="Buscar"
            onPrimaryAction={() => router.push('/search')}
            secondaryActionLabel="Inicio"
            onSecondaryAction={() => router.push('/')}
          />
        </>
      ) : (
        <EmptyState title="No hay perspectiva disponible" description="Todavía no hay una perspectiva para este elemento." />
      )}
    </AppScreen>
  );
}
