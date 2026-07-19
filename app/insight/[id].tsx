import { useLocalSearchParams, router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { InsightCard } from '@/components/cards';
import { AppScreen, SectionHeader, TopBar } from '@/components/layout';
import { ListRow, Surface } from '@/components/primitives';
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

  const insight = data?.insight;

  return (
    <AppScreen refreshing={loading} onRefresh={refresh}>
      <TopBar showBack title={insight?.title ?? 'Insight'} subtitle={insight?.timestamp ? `Generated ${insight.timestamp}` : 'Readable conclusion with supporting context.'} />

      {error ? <EmptyState title="Unable to load insight" description={error} primaryActionLabel="Retry" onPrimaryAction={refresh} /> : null}

      {loading && !insight ? (
        <LoadingSkeleton variant="detail" count={2} />
      ) : insight ? (
        <>
          <InsightCard insight={insight} />
          <SectionHeader title="Summary" />
          <Surface variant="subtle">
            <ListRow title={insight.summary} subtitle="Why it matters" />
          </Surface>

          <SectionHeader title="Key takeaways" />
          <View style={{ gap: 8 }}>
            {insight.takeaways.length ? insight.takeaways.map((takeaway) => (
              <ListRow key={takeaway} title={takeaway} />
            )) : <EmptyState title="No takeaways yet" description="There are no actionable takeaways for this insight." />}
          </View>

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
