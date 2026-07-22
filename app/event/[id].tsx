import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { AppScreen, SectionHeader, TopBar } from '@/components/layout';
import { Button, ListRow, Surface } from '@/components/primitives';
import { EmptyState, LoadingSkeleton } from '@/components/states';
import { useBrainIAClient, useTheme } from '@/lib/app-state';
import { useAsyncResource } from '@/lib/hooks';
import { formatDate } from '@/lib/format';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useBrainIAClient();
  const theme = useTheme();
  const [reprocessing, setReprocessing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const loader = useMemo(() => async () => (await client.listEvents()).find((event) => event.id === id), [client, id]);
  const { data: event, loading, error, refresh } = useAsyncResource(loader, [loader]);
  const transactionsLoader = useMemo(() => () => client.listTransactions(100), [client]);
  const { data: transactions } = useAsyncResource(transactionsLoader, [transactionsLoader]);
  const linkedTransaction = transactions?.find((transaction) => transaction.eventIds?.includes(id));

  async function reprocess() {
    if (!event) return;
    setReprocessing(true);
    setStatus(null);
    try {
      await client.reprocessEvent(event.id);
      setStatus('Reprocessed with the current extraction rules.');
      await refresh();
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : 'Could not reprocess this activity.');
    } finally {
      setReprocessing(false);
    }
  }

  return (
    <AppScreen refreshing={loading} onRefresh={refresh}>
      <TopBar showBack title={event?.title ?? 'Activity detail'} subtitle="Captured activity, its interpretation, and the next useful action." />
      {loading && !event ? <LoadingSkeleton variant="detail" count={2} /> : null}
      {error ? <EmptyState title="Unable to load source event" description={error} primaryActionLabel="Retry" onPrimaryAction={refresh} /> : null}
      {!loading && !error && !event ? <EmptyState title="Source event unavailable" description="This linked event may have been removed or is not included in the current activity feed." /> : null}
      {event ? (
        <>
          <SectionHeader title="Captured event" />
          <Surface variant="raised" style={{ gap: theme.spacing.md }}>
            {event.description ? (
              <View style={{ gap: 4 }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>BrainIA interpretation</Text>
                <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>{event.description}</Text>
              </View>
            ) : (
              <View style={{ gap: 4 }}>
                <Text style={[theme.typography.bodyStrong, { color: theme.colors.warning }]}>Interpretation not available yet</Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>The original event is preserved below. Reprocess it when model-assisted interpretation is available.</Text>
              </View>
            )}
            <View style={{ gap: 4 }}>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Source</Text>
              <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>{event.source}</Text>
            </View>
            <ListRow title={event.kind} subtitle="Captured type" />
            <ListRow title={event.inferredKind ?? event.kind} subtitle="Interpreted as" />
            {event.receivedAt ? <ListRow title={formatDate(event.receivedAt)} subtitle="Received" /> : null}
          </Surface>
          <SectionHeader title="Original content" />
          <Surface variant="subtle" style={{ gap: theme.spacing.sm }}>
            {event.rawTitle ? <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{event.rawTitle}</Text> : null}
            <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{event.body ?? 'No source body is available for this event.'}</Text>
          </Surface>
          <SectionHeader title="Actions" subtitle="Choose the next step based on this activity type." />
          <Surface variant="raised" style={{ gap: theme.spacing.sm }}>
            {event.inferredKind === 'expense' || event.inferredKind === 'income' ? <Button label={linkedTransaction ? 'Open linked transaction' : 'Transaction is still being linked'} disabled={!linkedTransaction} onPress={() => linkedTransaction && router.push({ pathname: '/transaction/[id]', params: { id: linkedTransaction.id } })} /> : null}
            {event.kind === 'email' ? <Button label="Open email details" onPress={() => router.push({ pathname: '/email/[id]' as never, params: { id: event.id } })} /> : null}
            {event.kind === 'notification' && event.inferredKind !== 'expense' && event.inferredKind !== 'income' ? <Button label="Inspect notification" onPress={() => refresh()} /> : null}
            <Button label="Reprocess activity" onPress={reprocess} loading={reprocessing} variant="secondary" />
            {status ? <Text style={[theme.typography.caption, { color: status.startsWith('Could not') ? theme.colors.danger : theme.colors.success }]}>{status}</Text> : null}
          </Surface>
        </>
      ) : null}
    </AppScreen>
  );
}
