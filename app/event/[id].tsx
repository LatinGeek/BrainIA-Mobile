import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { AppScreen, SectionHeader, TopBar } from '@/components/layout';
import { Button, ListRow, Surface } from '@/components/primitives';
import { GeneratedTextBlock, ProvenanceMark } from '@/components/trust';
import { EmptyState, LoadingSkeleton } from '@/components/states';
import { useBrainIAClient, useTheme } from '@/lib/app-state';
import { useAsyncResource } from '@/lib/hooks';
import { formatDate } from '@/lib/format';
import { CorrectionPanel } from '@/components/intelligence/CorrectionPanel';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useBrainIAClient();
  const theme = useTheme();
  const [reprocessing, setReprocessing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const loader = useMemo(() => () => client.getEvent(id), [client, id]);
  const { data: event, loading, error, refresh } = useAsyncResource(loader, [loader]);
  const transactionsLoader = useMemo(() => () => client.listTransactions(100), [client]);
  const { data: transactions } = useAsyncResource(transactionsLoader, [transactionsLoader]);
  const linkedTransaction = transactions?.find((transaction) => transaction.eventIds?.includes(id));
  const categoryLabel = event?.primaryCategoryKey?.split('.').map((part) => part.replaceAll('_', ' ').replace(/^\w/u, (character) => character.toUpperCase())).join(' › ');

  function reprocessMessage(cause: unknown) {
    const message = cause instanceof Error ? cause.message : '';
    if (/unexpected token|json/i.test(message)) {
      return 'No pudimos leer algunos datos técnicos de esta notificación. Conservamos el original y podés intentarlo nuevamente.';
    }
    return 'No se pudo volver a interpretar esta actividad. Revisá tu conexión e intentá nuevamente.';
  }

  async function reprocess() {
    if (!event) return;
    setReprocessing(true);
    setStatus(null);
    try {
      await client.reprocessEvent(event.id);
      setStatus('Reprocessed with the current extraction rules.');
      await refresh();
    } catch (cause) {
      setStatus(reprocessMessage(cause));
    } finally {
      setReprocessing(false);
    }
  }

  return (
    <AppScreen refreshing={loading} onRefresh={refresh}>
      <TopBar showBack title={event?.title ?? 'Detalle de actividad'} subtitle="La actividad capturada y cómo la entiende Brain IA." />
      {loading && !event ? <LoadingSkeleton variant="detail" count={2} /> : null}
      {error ? <EmptyState title="No se pudo cargar la fuente" description={error} primaryActionLabel="Reintentar" onPrimaryAction={refresh} /> : null}
      {!loading && !error && !event ? <EmptyState title="Fuente no disponible" description="La actividad puede haberse eliminado o no estar disponible en esta vista." /> : null}
      {event ? (
        <>
          <SectionHeader title="Interpretación" />
          <CorrectionPanel eventId={id} onSaved={refresh}/>
          <Surface variant="raised" style={{ gap: theme.spacing.md }}>
            {event.description ? (
              <GeneratedTextBlock
                title={event.interpretationSource ? `Interpreted by ${event.interpretationSource}` : 'Machine interpretation'}
                body={event.description}
                confidence={event.confidence}
                origin={event.interpretationSource === 'user' ? 'user' : 'model'}
              />
            ) : (
              <View style={{ gap: 4 }}>
                <Text style={[theme.typography.bodyStrong, { color: theme.colors.warning }]}>La interpretación aún no está disponible</Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>El original se conserva abajo. Puedes volver a interpretarlo cuando la IA esté disponible.</Text>
              </View>
            )}
            <View style={{ gap: 4 }}>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Fuente</Text>
              <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>{event.source}</Text>
            </View>
            <ListRow title={event.kind} subtitle="Tipo original" />
            <ListRow title={event.inferredKind ?? event.kind} subtitle="Interpretado como" />
            {categoryLabel ? <ListRow title={categoryLabel} subtitle="Categoría de conocimiento" description={event.taxonomyVersion ? `Taxonomy ${event.taxonomyVersion}` : undefined} /> : null}
            {event.facets?.length ? <View style={{ gap: 4 }}>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Contexto</Text>
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{event.facets.map((facet) => `${facet.type.replaceAll('_', ' ')}: ${facet.value}`).join(' · ')}</Text>
            </View> : null}
            {event.receivedAt ? <ListRow title={formatDate(event.receivedAt)} subtitle="Recibido" /> : null}
          </Surface>
          <SectionHeader title="Contenido original" />
          <Surface variant="subtle" style={{ gap: theme.spacing.sm }}>
            <ProvenanceMark origin="captured" label="Fuente original" />
            {event.rawTitle ? <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{event.rawTitle}</Text> : null}
            <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{event.body ?? 'No source body is available for this event.'}</Text>
          </Surface>
          <SectionHeader title="Acciones" subtitle="Elige el próximo paso según el tipo de actividad." />
          <Surface variant="raised" style={{ gap: theme.spacing.sm }}>
            {event.inferredKind === 'expense' || event.inferredKind === 'income' ? <Button label={linkedTransaction ? 'Open linked transaction' : 'Transaction is still being linked'} disabled={!linkedTransaction} onPress={() => linkedTransaction && router.push({ pathname: '/transaction/[id]', params: { id: linkedTransaction.id } })} /> : null}
            {event.kind === 'email' ? <Button label="Ver correo" onPress={() => router.push({ pathname: '/email/[id]' as never, params: { id: event.id } })} /> : null}
            {event.kind === 'notification' && event.inferredKind !== 'expense' && event.inferredKind !== 'income' ? <Button label="Ver notificación" onPress={() => refresh()} /> : null}
            <Button label="Volver a interpretar" onPress={reprocess} loading={reprocessing} variant="secondary" />
            {status ? <Text style={[theme.typography.caption, { color: status.startsWith('No se pudo') || status.startsWith('No pudimos') ? theme.colors.danger : theme.colors.success }]}>{status}</Text> : null}
          </Surface>
        </>
      ) : null}
    </AppScreen>
  );
}
