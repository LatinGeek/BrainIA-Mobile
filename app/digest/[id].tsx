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
      <TopBar showBack title={digest?.title ?? 'Resumen'} subtitle={digest?.windowLabel ?? 'Resumen del período y próximo contexto útil.'} />

      {error ? <EmptyState title="No se pudo cargar el resumen" description={error} primaryActionLabel="Reintentar" onPrimaryAction={refresh} /> : null}

      {loading && !digest ? (
        <LoadingSkeleton variant="detail" count={2} />
      ) : digest ? (
        <>
          <GeneratedTextBlock title="Resumen asistido" body={digest.summary} />
          {digest.highlights?.length ? (
            <>
              <SectionHeader title="Lo más importante" />
              <View style={{ gap: 8 }}>
                {digest.highlights.map((highlight) => <ListRow key={highlight} title={highlight} />)}
              </View>
            </>
          ) : null}

          <SectionHeader title="Métricas de actividad" />
          <View style={{ gap: 8 }}>
            {digest.metrics?.length ? digest.metrics.map((metric) => (
              <ListRow key={metric.label} title={metric.label} subtitle={metric.value} />
            )) : <EmptyState title="Todavía no hay métricas" description="Aparecerán cuando exista suficiente actividad resumida." />}
          </View>

          {digest.recommendedAction ? (
            <>
              <SectionHeader title="Próximo paso" />
              <Surface variant="subtle">
                <ListRow title={digest.recommendedAction} />
              </Surface>
            </>
          ) : null}

          <SectionHeader title="Seguimiento" />
          <EmptyState
            title="Revisar actividad relacionada"
            description="Abre Explorar o Dinero para obtener más contexto."
            primaryActionLabel="Buscar"
            onPrimaryAction={() => router.push('/search')}
            secondaryActionLabel="Dinero"
            onSecondaryAction={() => router.push('/financials')}
          />
        </>
      ) : (
        <EmptyState title="No hay resumen disponible" description="Todavía no hay un resumen para este período." />
      )}
    </AppScreen>
  );
}
