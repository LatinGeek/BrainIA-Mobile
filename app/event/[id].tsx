import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text } from 'react-native';

import { Button, Tag } from '@/components/controls';
import { IconTile, Row } from '@/components/data/Row';
import { SignalCard } from '@/components/data/SignalCard';
import { StateView } from '@/components/data/StateView';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { Screen, Section } from '@/components/layout/Screen';
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
    if (/unexpected token|json/i.test(message)) return 'No pudimos leer algunos datos técnicos de esta notificación. Conservamos el original y podés intentarlo nuevamente.';
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
    <Screen title={event?.title ?? 'Detalle de actividad'} overline={event?.kind ?? 'Activity'} subtitle="La actividad capturada y cómo la entiende Brain IA." back refreshing={loading} onRefresh={refresh}>
      {loading && !event ? <StateView kind="loading" title="Loading" skeleton="detail" skeletonCount={2} /> : null}
      {error ? <StateView kind="error" title="No se pudo cargar la fuente" description={error} actionLabel="Reintentar" onAction={refresh} /> : null}
      {!loading && !error && !event ? <StateView title="Fuente no disponible" description="La actividad puede haberse eliminado o no estar disponible en esta vista." /> : null}

      {event ? (
        <>
          <Section title="Interpretation">
            <CorrectionPanel eventId={id} onSaved={refresh} />
            {event.description ? (
              <SignalCard variant="block" origin={event.interpretationSource === 'user' ? 'user' : 'model'} title={event.interpretationSource ? `Interpreted by ${event.interpretationSource}` : 'Machine interpretation'} summary={event.description} confidence={event.confidence} />
            ) : (
              <GlassSurface level="thin" tone="danger" padding="md" contentStyle={{ gap: 4 }}>
                <Text style={[theme.typography.bodyStrong, { color: theme.colors.warning }]}>La interpretación aún no está disponible</Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>El original se conserva abajo. Puedes volver a interpretarlo cuando la IA esté disponible.</Text>
              </GlassSurface>
            )}
            <Row title={formatSourceLabel(event.source)} subtitle="Original source" leading={<IconTile icon={event.kind === 'email' ? 'mail' : event.kind === 'notification' ? 'bell' : 'inbox'} />} accessory="none" />
            <Row title={event.kind} subtitle="Original type" accessory="none" />
            <Row title={event.inferredKind ?? event.kind} subtitle="Interpreted as" accessory="none" />
            {categoryLabel ? <Row title={categoryLabel} subtitle="Knowledge category" description={event.taxonomyVersion ? `Taxonomy ${event.taxonomyVersion}` : undefined} accessory="none" /> : null}
            {event.facets?.length ? (
              <GlassSurface level="thin" padding="md" contentStyle={{ gap: 4 }}>
                <Text style={[theme.typography.overline, { color: theme.colors.textMuted }]}>Context</Text>
                <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{event.facets.map((facet) => `${facet.type.replaceAll('_', ' ')}: ${facet.value}`).join(' · ')}</Text>
              </GlassSurface>
            ) : null}
            {event.receivedAt ? <Row title={formatDate(event.receivedAt)} subtitle="Received" accessory="none" /> : null}
          </Section>

          <Section title="Original content">
            <GlassSurface level="thin" padding="md" contentStyle={{ gap: 8 }}>
              <Tag label="Captured" tone="neutral" kind="provenance" icon="inbox" />
              {event.rawTitle ? <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{event.rawTitle}</Text> : null}
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{event.body ?? 'No source body is available for this event.'}</Text>
            </GlassSurface>
          </Section>

          <Section title="Actions" subtitle="Elige el próximo paso según el tipo de actividad.">
            {event.inferredKind === 'expense' || event.inferredKind === 'income' ? (
              <Button label={linkedTransaction ? 'Open linked transaction' : 'Transaction is still being linked'} disabled={!linkedTransaction} onPress={() => linkedTransaction && router.push({ pathname: '/transaction/[id]', params: { id: linkedTransaction.id } })} />
            ) : null}
            {event.kind === 'email' ? <Button label="Ver correo" variant="secondary" onPress={() => router.push({ pathname: '/email/[id]' as never, params: { id: event.id } })} /> : null}
            <Button label="Volver a interpretar" onPress={reprocess} loading={reprocessing} variant="secondary" />
            {status ? <Text style={[theme.typography.caption, { color: status.startsWith('No se pudo') || status.startsWith('No pudimos') ? theme.colors.danger : theme.colors.success }]}>{status}</Text> : null}
          </Section>
        </>
      ) : null}
    </Screen>
  );
}

function formatSourceLabel(source?: string) {
  if (!source) return 'Fuente desconocida';
  const labels: Record<string, string> = { 'make.gmail': 'Gmail via Make', 'make.outlook': 'Outlook via Make', wallet: 'Wallet capture', notification: 'Device notification' };
  return labels[source.toLowerCase()] ?? source.replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
