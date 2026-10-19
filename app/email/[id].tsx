import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { Button, Tag } from '@/components/controls';
import { IconTile, Row } from '@/components/data/Row';
import { StateView } from '@/components/data/StateView';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { Screen, Section } from '@/components/layout/Screen';
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
    <Screen title={email?.title ?? 'Detalle del correo'} overline="Email" subtitle="El correo original completo." back refreshing={loading} onRefresh={refresh}>
      {loading && !email ? <StateView kind="loading" title="Loading" skeleton="detail" skeletonCount={2} /> : null}
      {error ? <StateView kind="error" title="No se pudo cargar el correo" description={error} actionLabel="Reintentar" onAction={refresh} /> : null}
      {!loading && !error && !email ? <StateView title="Correo no disponible" description="Esta actividad ya no está disponible como registro de correo." /> : null}

      {email ? (
        <>
          <Section title="Captured email">
            <GlassSurface level="strong" padding="lg" contentStyle={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <IconTile icon="mail" size="lg" color={theme.colors.model} tint={`${theme.colors.model}1F`} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[theme.typography.overline, { color: theme.colors.textMuted }]}>From</Text>
                  <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>{formatSource(email.source)}</Text>
                </View>
                <Tag label={email.inferredKind ?? 'email'} tone="info" />
              </View>
              {email.receivedAt ? <Row title={formatDate(email.receivedAt)} subtitle="Received" accessory="none" /> : null}
            </GlassSurface>
          </Section>

          <Section title="Email body">
            <GlassSurface level="thin" padding="md">
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary, lineHeight: 23 }]}>{email.body ?? 'No email body is available.'}</Text>
            </GlassSurface>
          </Section>

          <Button label="Descubrir conocimiento relacionado" onPress={() => router.push('/search')} />
        </>
      ) : null}
    </Screen>
  );
}

function formatSource(source: string) {
  const labels: Record<string, string> = { 'make.gmail': 'Gmail via Make', 'make.outlook': 'Outlook via Make' };
  return labels[source.toLowerCase()] ?? source.replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
