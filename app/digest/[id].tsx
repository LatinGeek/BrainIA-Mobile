import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

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
    <Screen title={digest?.title ?? 'Resumen'} overline={digest?.windowLabel ?? 'Digest'} subtitle={digest?.windowLabel ?? 'Resumen del período y próximo contexto útil.'} back refreshing={loading} onRefresh={refresh}>
      {error ? <StateView kind="error" title="No se pudo cargar el resumen" description={error} actionLabel="Reintentar" onAction={refresh} /> : null}
      {loading && !digest ? <StateView kind="loading" title="Loading" skeleton="detail" skeletonCount={2} /> : null}

      {digest ? (
        <>
          <SignalCard variant="block" origin="model" title={digest.title} summary={digest.summary} meta={digest.windowLabel} metrics={digest.metrics?.slice(0, 3).map((metric) => ({ label: metric.label, value: metric.value }))} />

          {digest.highlights?.length ? (
            <Section title="Highlights">
              {digest.highlights.map((highlight) => <Row key={highlight} title={highlight} leading={<IconTile icon="star" size="sm" color={theme.colors.accent} />} accessory="none" />)}
            </Section>
          ) : null}

          <Section title="Activity metrics">
            {digest.metrics?.length ? digest.metrics.map((metric) => (
              <Row key={metric.label} title={metric.label} subtitle={metric.value} accessory="none" />
            )) : <StateView title="Todavía no hay métricas" description="Aparecerán cuando exista suficiente actividad resumida." />}
          </Section>

          {digest.recommendedAction ? (
            <Section title="Next step">
              <GlassSurface level="thin" tone="accent" padding="md">
                <Row title={digest.recommendedAction} accessory="none" leading={<IconTile icon="arrow-right" color={theme.colors.accent} />} />
              </GlassSurface>
            </Section>
          ) : null}

          <Section title="Follow-up">
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Button label="Search" variant="secondary" onPress={() => router.push('/search')} /></View>
              <View style={{ flex: 1 }}><Button label="Money" variant="ghost" onPress={() => router.push('/financials')} /></View>
            </View>
          </Section>
        </>
      ) : <StateView title="No hay resumen disponible" description="Todavía no hay un resumen para este período." />}
    </Screen>
  );
}
