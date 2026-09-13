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
      <TopBar showBack title={insight?.title ?? 'Insight'} subtitle={insight?.timestamp ? `Generated ${insight.timestamp}` : 'Readable conclusion with supporting context.'} />

      {error ? <EmptyState title="Unable to load insight" description={error} primaryActionLabel="Retry" onPrimaryAction={refresh} /> : null}

      {loading && !insight ? (
        <LoadingSkeleton variant="detail" count={2} />
      ) : insight ? (
        <>
          <GeneratedTextBlock title="Model insight" body={insight.summary} confidence={insight.confidence} />
          {insight.whyItMatters ? (
            <>
              <SectionHeader title="Why it matters" />
              <Surface variant="subtle">
                <ListRow title={insight.whyItMatters} />
              </Surface>
            </>
          ) : null}

          <SectionHeader title="Key takeaways" />
          <View style={{ gap: 8 }}>
            {insight.takeaways.length ? insight.takeaways.map((takeaway) => (
              <ListRow key={takeaway} title={takeaway} />
            )) : <EmptyState title="No takeaways yet" description="There are no actionable takeaways for this insight." />}
          </View>

          {insight.supportingReferences?.length ? (
            <>
              <SectionHeader title="Evidence trail" subtitle="Only references returned with this insight are shown." />
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
              <SectionHeader title="Next step" />
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
              <SectionHeader title="Technical details" />
              <View style={{ gap: 8 }}>
                <ListRow title="Model" subtitle={insight.model ?? 'heuristic-v1'} />
                <ListRow title="Supporting items" subtitle={String(insight.relatedCount ?? 0)} />
                <ListRow title="Generated at" subtitle={insight.timestamp ?? 'Unknown timestamp'} />
              </View>
            </>
          ) : null}

          <SectionHeader title="Actions" />
          <EmptyState
            title="Need more context?"
            description="Open the graph or search around the current target."
            primaryActionLabel="Search"
            onPrimaryAction={() => router.push('/search')}
            secondaryActionLabel="Home"
            onSecondaryAction={() => router.push('/')}
          />
        </>
      ) : (
        <EmptyState title="No insight available" description="No insight is available for this item yet." />
      )}
    </AppScreen>
  );
}
