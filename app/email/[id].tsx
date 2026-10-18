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
      <TopBar showBack title={email?.title ?? 'Detalle del correo'} subtitle="El correo original completo." />
      {loading && !email ? <LoadingSkeleton variant="detail" count={2} /> : null}
      {error ? <EmptyState title="No se pudo cargar el correo" description={error} primaryActionLabel="Reintentar" onPrimaryAction={refresh} /> : null}
      {!loading && !error && !email ? <EmptyState title="Correo no disponible" description="Esta actividad ya no está disponible como registro de correo." /> : null}
      {email ? <>
        <SectionHeader title="Correo capturado" />
        <Surface variant="raised" style={{ gap: theme.spacing.sm }}>
          <ListRow title={email.source} subtitle="Capturado desde" />
          <ListRow title={email.inferredKind ?? 'email'} subtitle="Interpretado como" />
          {email.receivedAt ? <ListRow title={formatDate(email.receivedAt)} subtitle="Recibido" /> : null}
        </Surface>
        <SectionHeader title="Contenido del correo" />
        <Surface variant="subtle"><Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{email.body ?? 'No email body is available.'}</Text></Surface>
        <View style={{ marginTop: theme.spacing.md }}><Button label="Descubrir conocimiento relacionado" onPress={() => router.push('/search')} /></View>
      </> : null}
    </AppScreen>
  );
}
