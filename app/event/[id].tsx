import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text } from 'react-native';
import Animated, { FadeIn, LinearTransition, ReduceMotion } from 'react-native-reanimated';

import { Button, Tag } from '@/components/controls';
import { ProcessingProgress } from '@/components/data/ProcessingProgress';
import { ReprocessJobCard } from '@/components/data/ReprocessJobCard';
import { Row } from '@/components/data/Row';
import { SignalCard } from '@/components/data/SignalCard';
import { StateView } from '@/components/data/StateView';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { useToast } from '@/components/layout/Toast';
import { Screen, Section } from '@/components/layout/Screen';
import { EventDetailSkeleton } from '@/components/skeletons/EventDetailSkeleton';
import { useBrainIAClient, useTheme } from '@/lib/app-state';
import { useAsyncResource } from '@/lib/hooks';
import { formatDate } from '@/lib/format';
import { CorrectionPanel } from '@/components/intelligence/CorrectionPanel';
import { ReprocessSheet } from '@/components/intelligence/ReprocessSheet';
import {
  isActiveReprocessJob,
  type ReprocessJob,
  type ReprocessStage,
} from '@/lib/reprocess';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useBrainIAClient();
  const theme = useTheme();
  const toast = useToast();
  const showToast = toast.show;
  const [reprocessOpen, setReprocessOpen] = useState(false);
  const [reprocessSession, setReprocessSession] = useState(0);
  const [activeJob, setActiveJob] = useState<ReprocessJob | null>(null);
  const loader = useMemo(() => () => client.getEvent(id), [client, id]);
  const { data: event, loading, error, refresh } = useAsyncResource(loader, [loader]);
  const activeJobId = activeJob?.id;
  const eventId = event?.id;
  const transactionsLoader = useMemo(() => () => client.listTransactions(100), [client]);
  const { data: transactions, loading: transactionsLoading, error: transactionsError, refresh: refreshTransactions } = useAsyncResource(transactionsLoader, [transactionsLoader]);
  const linkedTransaction = transactions?.find((transaction) => transaction.eventIds?.includes(id));
  const categoryLabel = event?.primaryCategoryKey ? categoryDisplayLabel(event.primaryCategoryKey) : undefined;

  useEffect(() => {
    if (!activeJobId || !eventId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let failures = 0;

    const poll = async () => {
      try {
        const jobs = await client.listEventJobs(eventId);
        if (cancelled) return;
        const current = jobs.find((job) => job.id === activeJobId);
        if (!current) {
          setActiveJob(null);
          return;
        }
        failures = 0;
        setActiveJob(current);
        if (isActiveReprocessJob(current.status)) {
          timer = setTimeout(poll, 2500);
          return;
        }
        if (current.status === 'succeeded') {
          showToast('Reprocesamiento completado.', { tone: 'positive' });
        } else {
          showToast('No se pudo completar el reprocesamiento. Puedes intentarlo nuevamente.', { tone: 'danger' });
        }
        setActiveJob(null);
        void refresh();
      } catch {
        if (cancelled) return;
        failures += 1;
        if (failures >= 6) {
          setActiveJob(null);
          showToast('No pudimos seguir el estado del reprocesamiento. Abre la actividad nuevamente para actualizarla.', { tone: 'danger' });
          return;
        }
        timer = setTimeout(poll, 4000);
      }
    };

    timer = setTimeout(poll, 1000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [activeJobId, client, eventId, refresh, showToast]);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    void client.listEventJobs(eventId)
      .then((jobs) => {
        if (cancelled) return;
        const running = jobs.find((job) => isActiveReprocessJob(job.status));
        if (running) setActiveJob(running);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [client, eventId]);

  function openReprocess() {
    if (!event) return;
    setReprocessSession((session) => session + 1);
    setReprocessOpen(true);
    // Picks up an execution started from another screen or device.
    void client.listEventJobs(event.id)
      .then((jobs) => {
        const running = jobs.find((job) => isActiveReprocessJob(job.status));
        if (running) setActiveJob(running);
      })
      .catch(() => undefined);
  }

  async function submitReprocess(stages: ReprocessStage[]) {
    if (!event) throw new Error('event_not_loaded');
    const result = await client.reprocessEvent(event.id, { stages, execution: 'new' });
    if (result.mode === 'legacy') {
      setReprocessOpen(false);
      setTimeout(() => showToast('Reinterpretado con las reglas actuales.', { tone: 'positive' }), 450);
      await refresh();
      return;
    }

    setReprocessOpen(false);
    if (result.job && isActiveReprocessJob(result.job.status)) {
      setActiveJob(result.job);
      const message = result.disposition === 'coalesced'
        ? 'Ya había un reprocesamiento en curso. Lo estamos siguiendo.'
        : result.disposition === 'revived'
          ? 'Reintentando el reprocesamiento.'
          : 'Reprocesamiento en curso. Puedes salir de esta actividad.';
      setTimeout(() => showToast(message, { tone: 'positive' }), 450);
      return;
    }

    setTimeout(() => showToast('Ese reprocesamiento ya había terminado.', { tone: 'positive' }), 450);
    await refresh();
  }

  return (
    <Screen title={event?.title ?? ''} overline={event ? kindLabel(event.kind) : 'Actividad'} subtitle="La actividad capturada y cómo la entiende Brain IA." back refreshing={loading && Boolean(event)} onRefresh={refresh}>
      {loading && !event ? <EventDetailSkeleton /> : null}
      {error ? <StateView kind="error" title="No se pudo cargar la fuente" description={friendlyError(error)} actionLabel="Reintentar" onAction={refresh} /> : null}
      {!loading && !error && !event ? <StateView title="Fuente no disponible" description="La actividad puede haberse eliminado o no estar disponible en esta vista." /> : null}

      {event ? (
        <>
          <Section title="Interpretación">
            {event.description ? (
              <SignalCard variant="block" origin={event.interpretationSource === 'user' ? 'user' : 'model'} title={event.interpretationSource === 'user' ? 'Corregido por ti' : 'Interpretado por Brain IA'} summary={event.description} confidence={event.confidence} />
            ) : (
              <GlassSurface level="thin" tone="review" padding="md" contentStyle={{ gap: theme.spacing.xs }}>
                <Text style={[theme.typography.bodyStrong, { color: theme.colors.warning }]}>La interpretación aún no está disponible</Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>El original se conserva abajo. Puedes elegir qué volver a procesar cuando la IA esté disponible.</Text>
                <Button size="sm" variant="secondary" label={activeJob ? 'Reprocesamiento en curso' : 'Volver a interpretar'} onPress={openReprocess} disabled={Boolean(activeJob)} />
              </GlassSurface>
            )}
            <GlassSurface level="thin" padding="none">
              <Row title={formatSourceLabel(event.source)} subtitle="Fuente original" accessory="none" />
              {event.receivedAt ? <Row title={formatDate(event.receivedAt)} subtitle="Recibido" accessory="none" /> : null}
              <Row title={kindLabel(event.kind)} subtitle="Tipo original" accessory="none" />
              <Row title={kindLabel(event.inferredKind ?? event.kind)} subtitle="Interpretado como" accessory="none" style={!categoryLabel ? { borderBottomWidth: 0 } : undefined} />
              {categoryLabel ? <Row title={categoryLabel} subtitle="Categoría" description={event.taxonomyVersion ? `Taxonomía ${event.taxonomyVersion}` : undefined} accessory="none" style={{ borderBottomWidth: 0 }} /> : null}
            </GlassSurface>
            {event.facets?.length ? (
              <GlassSurface level="thin" padding="md" contentStyle={{ gap: theme.spacing.xs }}>
                <Text style={[theme.typography.overline, { color: theme.colors.textMuted }]}>Contexto</Text>
                <Text selectable style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{event.facets.map((facet) => `${facetLabel(facet.type)}: ${facet.value}`).join(' · ')}</Text>
              </GlassSurface>
            ) : null}
            <Animated.View entering={FadeIn.duration(theme.motion.duration.quick)} layout={LinearTransition.duration(theme.motion.duration.quick).reduceMotion(ReduceMotion.System)}>
              <CorrectionPanel eventId={id} onSaved={refresh} />
            </Animated.View>
          </Section>

          {event.progress || activeJob ? (
            <Section title="Procesamiento">
              {activeJob ? <ReprocessJobCard job={activeJob} /> : null}
              {event.progress ? <ProcessingProgress progress={event.progress} inferredKind={event.inferredKind} /> : null}
            </Section>
          ) : null}

          <Section title="Contenido original">
            <GlassSurface level="thin" padding="md" contentStyle={{ gap: theme.spacing.sm }}>
              <Tag label="Capturado" tone="neutral" kind="provenance" icon="inbox" />
              {event.rawTitle ? <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{event.rawTitle}</Text> : null}
              <Text selectable style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{event.body ?? 'Esta actividad no tiene contenido original disponible.'}</Text>
            </GlassSurface>
          </Section>

          <Section title="Acciones" subtitle="Elige el próximo paso según el tipo de actividad.">
            {event.inferredKind === 'expense' || event.inferredKind === 'income' ? (
              transactionsLoading ? <Button label="Buscando movimiento…" loading variant="secondary" onPress={refreshTransactions} disabled />
                : transactionsError ? <StateView kind="error" title="No se pudo buscar el movimiento" description={friendlyError(transactionsError)} actionLabel="Reintentar" onAction={refreshTransactions} />
                : linkedTransaction ? <Button label="Abrir movimiento vinculado" onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: linkedTransaction.id } })} />
                : <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Todavía no hay un movimiento vinculado.</Text>
            ) : null}
            {event.kind === 'email' ? <Button label="Ver correo" variant="secondary" onPress={() => router.push({ pathname: '/email/[id]' as never, params: { id: event.id } })} /> : null}
            <Button label={activeJob ? 'Reprocesamiento en curso' : 'Volver a interpretar'} onPress={openReprocess} disabled={Boolean(activeJob)} variant="secondary" />
          </Section>

          <ReprocessSheet
            key={reprocessSession}
            visible={reprocessOpen}
            event={event}
            activeJob={activeJob}
            onClose={() => setReprocessOpen(false)}
            onSubmit={submitReprocess}
          />
        </>
      ) : null}
    </Screen>
  );
}

const kindLabels: Record<string, string> = { note: 'Nota', email: 'Correo', notification: 'Notificación', transaction: 'Movimiento', wallet: 'Billetera', reminder: 'Recordatorio', task: 'Tarea', expense: 'Gasto', income: 'Ingreso', transfer: 'Transferencia' };
function kindLabel(kind: string) {
  return kindLabels[kind.toLowerCase()] ?? kind.replace(/[._-]+/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatSourceLabel(source?: string) {
  if (!source) return 'Fuente desconocida';
  const labels: Record<string, string> = { 'make.gmail': 'Gmail vía Make', 'make.outlook': 'Outlook vía Make', wallet: 'Captura de billetera', notification: 'Notificación del dispositivo' };
  return labels[source.toLowerCase()] ?? source.replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function friendlyError(error: string) {
  return /network|fetch|connection|timeout|offline/i.test(error)
    ? 'Sin conexión con Brain IA. Revisa tu red e intenta de nuevo.'
    : 'No se pudieron cargar los datos. Intenta de nuevo.';
}

function facetLabel(type: string) {
  return ({ merchant_name: 'Comercio', merchant: 'Comercio', person: 'Persona', person_name: 'Persona', place: 'Lugar', location: 'Lugar', project: 'Proyecto', topic: 'Tema', account: 'Cuenta', account_name: 'Cuenta', amount: 'Importe', currency: 'Moneda', date: 'Fecha', category: 'Categoría', payment_method: 'Medio de pago' } as Record<string, string>)[type] ?? 'Contexto';
}

function categoryDisplayLabel(key: string) {
  const labels: Record<string, string> = { food: 'Alimentación', groceries: 'Supermercado', restaurants: 'Restaurantes', dining: 'Restaurantes', transport: 'Transporte', transportation: 'Transporte', shopping: 'Compras', health: 'Salud', housing: 'Vivienda', entertainment: 'Entretenimiento', education: 'Educación', utilities: 'Servicios', travel: 'Viajes', income: 'Ingresos', salary: 'Salario', subscriptions: 'Suscripciones', uncategorized: 'Sin categoría', other: 'Otros' };
  return key.split('.').map((part) => labels[part] ?? part.replaceAll('_', ' ').replace(/^\w/u, (character) => character.toUpperCase())).join(' › ');
}
