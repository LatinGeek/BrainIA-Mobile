import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { Button, Tag } from '@/components/controls';
import { IconTile } from '@/components/data/Row';
import { StateView } from '@/components/data/StateView';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { Screen, Section } from '@/components/layout/Screen';
import { useBrainIAClient, useTheme } from '@/lib/app-state';
import { cleanDisplayText, formatDate } from '@/lib/format';
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
    <Screen title={email?.title ?? ''} overline="Correo" subtitle="El correo original completo." back refreshing={loading && Boolean(email)} onRefresh={refresh}>
      {loading && !email ? <StateView kind="loading" title="Cargando" skeleton="detail" skeletonCount={2} /> : null}
      {error ? <StateView kind="error" title="No se pudo cargar el correo" description={friendlyError(error)} actionLabel="Reintentar" onAction={refresh} /> : null}
      {!loading && !error && !email ? <StateView title="Correo no disponible" description="Esta actividad ya no está disponible como registro de correo." actionLabel="Ver actividad" onAction={() => router.replace({ pathname: '/event/[id]', params: { id } })} secondaryActionLabel="Volver" onSecondaryAction={() => router.back()} /> : null}

      {email ? (
        <>
          <GlassSurface level="strong" padding="lg" contentStyle={{ gap: theme.spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <IconTile icon="mail" size="lg" color={theme.colors.model} tint={`${theme.colors.model}1F`} />
              <View style={{ flex: 1, gap: theme.spacing.xs }}>
                <Text style={[theme.typography.overline, { color: theme.colors.textMuted }]}>Recibido por</Text>
                <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>{formatSource(email.source)}</Text>
              </View>
              <Tag label={kindLabel(email.inferredKind ?? 'email')} tone="info" />
            </View>
            {email.receivedAt ? <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Recibido · {formatDate(email.receivedAt)}</Text> : null}
          </GlassSurface>

          <Section title="Contenido">
            <GlassSurface level="thin" padding="md">
              <Text selectable style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{cleanDisplayText(email.body) || 'Este correo no tiene contenido disponible.'}</Text>
            </GlassSurface>
          </Section>

          <Button label="Buscar relacionados" variant="secondary" onPress={() => router.push({ pathname: '/search', params: { q: email.title } })} />
        </>
      ) : null}
    </Screen>
  );
}

function formatSource(source: string) {
  const labels: Record<string, string> = { 'make.gmail': 'Gmail via Make', 'make.outlook': 'Outlook via Make' };
  return labels[source.toLowerCase()] ?? source.replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function friendlyError(error: string) {
  return /network|fetch|connection|timeout|offline/i.test(error)
    ? 'Sin conexión con Brain IA. Revisa tu red e intenta de nuevo.'
    : 'No se pudieron cargar los datos. Intenta de nuevo.';
}

function kindLabel(kind: string) {
  return ({ expense: 'Gasto', income: 'Ingreso', transfer: 'Transferencia', email: 'Correo', notification: 'Notificación', note: 'Nota', transaction: 'Movimiento', reminder: 'Recordatorio', task: 'Tarea' } as Record<string, string>)[kind] ?? 'Actividad';
}
