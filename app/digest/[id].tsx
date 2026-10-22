import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/controls';
import { IconTile, Row } from '@/components/data/Row';
import { SignalCard } from '@/components/data/SignalCard';
import { StateView } from '@/components/data/StateView';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { Screen, Section } from '@/components/layout/Screen';
import { useBrainIAClient, useTheme } from '@/lib/app-state';
import { loadDigestBundle } from '@/lib/api';
import { useAsyncResource } from '@/lib/hooks';

export default function DigestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useBrainIAClient();
  const theme = useTheme();
  const loader = useMemo(() => () => loadDigestBundle(client, id), [client, id]);
  const { data, loading, error, refresh } = useAsyncResource(loader, [loader]);
  const digest = data?.digest;

  return (
    <Screen title={digest?.title ?? 'Resumen'} overline="Resumen" subtitle={digest?.windowLabel ?? 'Resumen del período y próximo contexto útil.'} back refreshing={loading && Boolean(digest)} onRefresh={refresh}>
      {error ? <StateView kind="error" title="No se pudo cargar el resumen" description={friendlyError(error)} actionLabel="Reintentar" onAction={refresh} /> : null}
      {loading && !digest ? <StateView kind="loading" title="Cargando resumen" skeleton="detail" skeletonCount={2} /> : null}

      {digest ? (
        <>
          <SignalCard variant="block" origin="model" title="Resumen del período" summary={digest.summary} />

          {digest.highlights?.length ? (
            <Section title="Destacados">
              <GlassSurface level="thin" padding="none">{digest.highlights.map((highlight, index, highlights) => <Row style={index === highlights.length - 1 ? { borderBottomWidth: 0 } : undefined} key={highlight} title={highlight} titleLines={0} leading={<IconTile icon="star" size="sm" color={theme.colors.accent} />} accessory="none" />)}</GlassSurface>
            </Section>
          ) : null}

          <Section title="Métricas de actividad">
            {digest.metrics?.length ? <GlassSurface level="thin" padding="none">{digest.metrics.map((metric, index, metrics) => (
              <Row key={metric.label} title={metric.label} trailing={<Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary, fontVariant: ['tabular-nums'] }]}>{metric.value}</Text>} style={index === metrics.length - 1 ? { borderBottomWidth: 0 } : undefined} accessory="none" />
            ))}</GlassSurface> : <StateView title="Todavía no hay métricas" description="Aparecerán cuando exista suficiente actividad resumida." />}
          </Section>

          {digest.recommendedAction ? (
            <Section title="Próximo paso">
              <GlassSurface level="thin" tone="accent" padding="md" contentStyle={{ flexDirection: 'row', gap: theme.spacing.md }}>
                <IconTile icon="arrow-right" color={theme.colors.accent} />
                <Text style={[theme.typography.body, { color: theme.colors.textPrimary, flex: 1 }]}>{digest.recommendedAction}</Text>
              </GlassSurface>
            </Section>
          ) : null}

          <Section title="Seguir explorando">
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <View style={{ flex: 1 }}><Button label="Explorar" variant="secondary" onPress={() => router.push('/search')} /></View>
              <View style={{ flex: 1 }}><Button label="Dinero" variant="ghost" onPress={() => router.push('/financials')} /></View>
            </View>
          </Section>
        </>
      ) : null}
      {!loading && !error && !digest ? <StateView title="No hay resumen disponible" description="Todavía no hay un resumen para este período." /> : null}
    </Screen>
  );
}

function friendlyError(error: string) {
  return /network|fetch|connection|timeout|offline/i.test(error)
    ? 'Sin conexión con Brain IA. Revisa tu red e intenta de nuevo.'
    : 'No se pudieron cargar los datos. Intenta de nuevo.';
}
