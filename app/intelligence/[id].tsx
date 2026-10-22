import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Button, Field } from '@/components/controls';
import { IconTile, Row } from '@/components/data/Row';
import { SignalCard } from '@/components/data/SignalCard';
import { StateView } from '@/components/data/StateView';
import { Timeline } from '@/components/data/Timeline';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { Screen, Section } from '@/components/layout/Screen';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useToast } from '@/components/layout/Toast';
import { ChoiceChip, statusLabels } from '@/components/intelligence';
import { useTheme } from '@/lib/app-state';
import { useIntelligenceClient, type Artifact } from '@/lib/intelligence';
import { recordInteraction } from '@/lib/interaction-telemetry';

export default function KnowledgeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useIntelligenceClient();
  const theme = useTheme();
  const toast = useToast();
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [noteDraft, setNoteDraft] = useState<{ id: string; text: string } | null>(null);
  const [feedbackValue, setFeedbackValue] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const notes = noteDraft?.id === id ? noteDraft.text : artifact?.user_notes ?? '';
  const setNotes = (text: string) => setNoteDraft({ id, text });

  const load = useCallback((silent = false) => api.get(id).then((next) => { setArtifact(next); setError(''); }).catch((cause) => {
    if (!silent) setError(cause instanceof Error ? cause.message : 'No se pudo cargar.');
  }), [api, id]);
  useEffect(() => { void load(); }, [load]);
  const artifactStatus = artifact?.status;
  useFocusEffect(useCallback(() => {
    if (!artifactStatus || !['queued', 'running'].includes(artifactStatus)) return;
    const timer = setInterval(() => void load(true), 6000);
    return () => clearInterval(timer);
  }, [artifactStatus, load]));
  const pull = () => { setRefreshing(true); void load().finally(() => setRefreshing(false)); };

  const action = async (name: string, body?: unknown) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api.action(id, name, body);
      if (name === 'feedback') recordInteraction('intelligence', 'feedback', 'success');
      if (name === 'feedback') setFeedbackValue((body as { value: string }).value);
      toast.show(name === 'feedback' ? 'Gracias. Tu valoración mejora las próximas perspectivas.' : 'Listo.', { tone: 'positive' });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo completar.');
    } finally {
      setBusy(false);
    }
  };

  const ask = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const next = await api.create({ kind: 'answer', objective: question, parentId: artifact?.conversation_id ? id : undefined, conversationId: artifact?.conversation_id ?? undefined });
      router.push(`/intelligence/${next.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo iniciar.');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api.save(id, { saved: true, userNotes: notes });
      toast.show('Guardado en tu conocimiento.', { tone: 'positive' });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={artifact?.content?.title ?? (artifact ? 'Construyendo una perspectiva' : 'Conocimiento')} overline="Conocimiento" subtitle={artifact ? statusLabels[artifact.status] : undefined} back refreshing={refreshing} onRefresh={pull}>
      {error ? <StateView kind="error" title="No se pudo cargar" description={error} actionLabel="Reintentar" onAction={() => void load()} /> : null}
      {!artifact && !error ? <StateView kind="loading" skeleton="detail" skeletonCount={3} title="Cargando" /> : null}

      {artifact && ['queued', 'running'].includes(artifact.status) ? (
        <GlassSurface level="regular" padding="lg" contentStyle={{ gap: theme.spacing.md, alignItems: 'center' }}>
          <ActivityIndicator color={theme.colors.accent} />
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary, textAlign: 'center' }]}>Buscando evidencia, conectando información y verificando conclusiones. Puedes salir y volver más tarde.</Text>
          <Button label="Cancelar análisis" variant="secondary" size="sm" style={{ alignSelf: 'center' }} onPress={() => void action('cancel')} disabled={busy} />
        </GlassSurface>
      ) : null}
      {artifact && ['failed', 'stale', 'cancelled', 'insufficient'].includes(artifact.status) ? (
        <StateView kind="error" title={statusLabels[artifact.status]} description={{
          failed: 'No se pudo completar el análisis. Intenta de nuevo con tus fuentes.',
          stale: 'Tus fuentes tienen información nueva. Actualiza el análisis para incluirla.',
          cancelled: 'Cancelaste este análisis. Puedes iniciarlo de nuevo cuando quieras.',
          insufficient: 'No encontramos evidencia suficiente en tus fuentes.',
        }[artifact.status as 'failed' | 'stale' | 'cancelled' | 'insufficient']} actionLabel={busy ? 'Actualizando…' : 'Actualizar análisis'} onAction={busy ? undefined : () => void action('refresh')} />
      ) : null}

      {artifact?.content ? (
        <Animated.View key={artifact.status} entering={FadeIn.duration(theme.motion.duration.enter)} style={{ gap: theme.spacing.xl }}>
          <SignalCard variant="block" origin="model" title="Resumen generado" summary={artifact.content.summary} />

          <Section title="Conclusiones" count={artifact.content.claims.length}>
          {artifact.content.claims.map((claim) => (
            <GlassSurface key={claim.id} level="thin" padding="md" contentStyle={{ gap: theme.spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <Feather name={claim.kind === 'inference' ? 'alert-circle' : 'check-circle'} size={16} color={claim.kind === 'inference' ? theme.colors.warning : theme.colors.accent} />
              <Text style={[theme.typography.overline, { color: claim.kind === 'inference' ? theme.colors.warning : theme.colors.accent }]}>
                {claim.kind === 'inference' ? 'Hipótesis' : claim.kind === 'calculation' ? 'Cálculo verificado' : 'Observación'}
              </Text>
              </View>
              <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>{claim.text}</Text>
              {claim.kind === 'inference' && artifact.status === 'ready' ? (
                <Button
                  label={artifact.confirmedClaims?.includes(claim.id) ? 'Confirmado · Deshacer' : 'Confirmar'}
                  size="sm"
                  style={{ alignSelf: 'flex-start' }}
                  variant="secondary"
                  disabled={busy}
                  onPress={() => void action('confirm', { claimId: claim.id, revision: artifact.revision, confirmed: !artifact.confirmedClaims?.includes(claim.id) })}
                />
              ) : null}
              {claim.citations.length ? (
                <Timeline items={claim.citations.map((citation, index) => {
                  const source = artifact.evidence.find((entry) => entry.id === citation.evidenceId);
                  return {
                    id: `${citation.evidenceId}-${index}`,
                    icon: 'link-2',
                    title: source?.source ?? 'Fuente',
                    reason: citation.quote,
                    onPress: source?.eventIds[0] ? () => router.push(`/event/${source.eventIds[0]}`) : undefined,
                  };
                })} />
              ) : null}
            </GlassSurface>
          ))}
          </Section>

          {artifact.content.uncertainty.length ? (
            <Section title="Lo que aún no sabemos">
              <GlassSurface level="thin" padding="none" contentStyle={{ gap: 0 }}>
              {artifact.content.uncertainty.map((text, index, rows) => <Row key={text} title={text} titleLines={0} style={{ borderRadius: theme.radius.md, borderBottomWidth: index === rows.length - 1 ? 0 : undefined }} leading={<IconTile icon="help-circle" size="sm" />} accessory="none" />)}
              </GlassSurface>
            </Section>
          ) : null}

          {artifact.content.actions.length ? (
            <Section title="Posibles próximos pasos">
              <GlassSurface level="thin" padding="none" contentStyle={{ gap: 0 }}>
              {artifact.content.actions.map((text, index, rows) => <Row key={text} title={text} titleLines={0} style={{ borderRadius: theme.radius.md, borderBottomWidth: index === rows.length - 1 ? 0 : undefined }} leading={<IconTile icon="arrow-right" size="sm" color={theme.colors.accent} />} accessory="none" />)}
              </GlassSurface>
            </Section>
          ) : null}

          <Section title="¿Te sirvió?">
            <View accessibilityRole="radiogroup" accessibilityLabel="Valoración de la perspectiva" style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
              {[['useful', 'Útil'], ['irrelevant', 'No relevante'], ['incorrect', 'Incorrecto'], ['known', 'Ya lo sabía']].map(([value, label]) => (
                <ChoiceChip key={value} label={label} selected={feedbackValue === value} disabled={busy} onPress={() => void action('feedback', { value })} />
              ))}
            </View>
          </Section>

          <Section title="Tu perspectiva">
            <Field label="Notas personales" value={notes} onChangeText={setNotes} multiline style={{ minHeight: theme.layout.minTarget * 2, textAlignVertical: 'top' }} />
            <Button label="Guardar conocimiento" onPress={() => void save()} disabled={busy} />
          </Section>

          <Section title="Profundiza">
            <Field label="Pregunta de seguimiento" value={question} onChangeText={setQuestion} />
            <Button label="Seguir explorando" onPress={() => void ask()} disabled={busy || question.trim().length < 3} />
          </Section>
        </Animated.View>
      ) : null}
    </Screen>
  );
}
