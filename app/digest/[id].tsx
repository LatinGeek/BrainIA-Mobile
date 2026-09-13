import { useLocalSearchParams, router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { AppScreen, SectionHeader, TopBar } from '@/components/layout';
import { ListRow, Surface } from '@/components/primitives';
import { GeneratedTextBlock } from '@/components/trust';
import { EmptyState, LoadingSkeleton } from '@/components/states';
import { useBrainIAClient } from '@/lib/app-state';
import { loadDigestBundle } from '@/lib/api';
import { useAsyncResource } from '@/lib/hooks';

export default function DigestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useBrainIAClient();
  const loader = useMemo(() => () => loadDigestBundle(client, id), [client, id]);
  const { data, loading, error, refresh } = useAsyncResource(loader, [loader]);

  const digest = data?.digest;

  return (
    <AppScreen refreshing={loading} onRefresh={refresh}>
      <TopBar showBack title={digest?.title ?? 'Digest'} subtitle={digest?.windowLabel ?? 'Time-window summary and next useful context.'} />

      {error ? <EmptyState title="Unable to load digest" description={error} primaryActionLabel="Retry" onPrimaryAction={refresh} /> : null}

      {loading && !digest ? (
        <LoadingSkeleton variant="detail" count={2} />
      ) : digest ? (
        <>
          <GeneratedTextBlock title="Model digest" body={digest.summary} />
          {digest.highlights?.length ? (
            <>
              <SectionHeader title="Highlights" />
              <View style={{ gap: 8 }}>
                {digest.highlights.map((highlight) => <ListRow key={highlight} title={highlight} />)}
              </View>
            </>
          ) : null}

          <SectionHeader title="Activity metrics" />
          <View style={{ gap: 8 }}>
            {digest.metrics?.length ? digest.metrics.map((metric) => (
              <ListRow key={metric.label} title={metric.label} subtitle={metric.value} />
            )) : <EmptyState title="No metrics yet" description="Metrics will appear once enough activity is summarized." />}
          </View>

          {digest.recommendedAction ? (
            <>
              <SectionHeader title="Next step" />
              <Surface variant="subtle">
                <ListRow title={digest.recommendedAction} />
              </Surface>
            </>
          ) : null}

          <SectionHeader title="Follow up" />
          <EmptyState
            title="Review related activity"
            description="Open search or the finance dashboard for deeper context."
            primaryActionLabel="Search"
            onPrimaryAction={() => router.push('/search')}
            secondaryActionLabel="Money"
            onSecondaryAction={() => router.push('/financials')}
          />
        </>
      ) : (
        <EmptyState title="No digest available" description="No summary is available for this time window yet." />
      )}
    </AppScreen>
  );
}
