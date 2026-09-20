import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { AppScreen, SectionHeader, TopBar } from '@/components/layout';
import { Button, ListRow, Surface } from '@/components/primitives';
import { EmptyState, LoadingSkeleton } from '@/components/states';
import { useBrainIAClient, useTheme } from '@/lib/app-state';
import { formatDate } from '@/lib/format';
import { useAsyncResource } from '@/lib/hooks';

export default function EmailDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useBrainIAClient();
  const theme = useTheme();
  const loader = useMemo(() => async () => {
    const event = await client.getEvent(id);
    return event.kind === 'email' ? event : undefined;
  }, [client, id]);
  const { data: email, loading, error, refresh } = useAsyncResource(loader, [loader]);

  return (
    <AppScreen refreshing={loading} onRefresh={refresh}>
      <TopBar showBack title={email?.title ?? 'Email details'} subtitle="The complete captured email record." />
      {loading && !email ? <LoadingSkeleton variant="detail" count={2} /> : null}
      {error ? <EmptyState title="Unable to load email" description={error} primaryActionLabel="Retry" onPrimaryAction={refresh} /> : null}
      {!loading && !error && !email ? <EmptyState title="Email unavailable" description="This activity is no longer available as an email record." /> : null}
      {email ? <>
        <SectionHeader title="Email record" />
        <Surface variant="raised" style={{ gap: theme.spacing.sm }}>
          <ListRow title={email.source} subtitle="Captured from" />
          <ListRow title={email.inferredKind ?? 'email'} subtitle="Interpreted as" />
          {email.receivedAt ? <ListRow title={formatDate(email.receivedAt)} subtitle="Received" /> : null}
        </Surface>
        <SectionHeader title="Email content" />
        <Surface variant="subtle"><Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{email.body ?? 'No email body is available.'}</Text></Surface>
        <View style={{ marginTop: theme.spacing.md }}><Button label="Discover related knowledge" onPress={() => router.push('/search')} /></View>
      </> : null}
    </AppScreen>
  );
}
