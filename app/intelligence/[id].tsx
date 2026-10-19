import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Button, Chip, Field } from '@/components/controls';
import { IconTile, Row } from '@/components/data/Row';
import { SignalCard } from '@/components/data/SignalCard';
import { StateView } from '@/components/data/StateView';
import { Timeline } from '@/components/data/Timeline';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { Screen, Section } from '@/components/layout/Screen';
import { statusLabels } from '@/components/intelligence';
import { useTheme } from '@/lib/app-state';
import { useIntelligenceClient, type Artifact } from '@/lib/intelligence';
import { recordInteraction } from '@/lib/interaction-telemetry';

export default function KnowledgeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useIntelligenceClient();
  const theme = useTheme();
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [noteDraft, setNoteDraft] = useState<{ id: string; text: string } | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const notes = noteDraft?.id === id ? noteDraft.text : artifact?.user_notes ?? '';
  const setNotes = (text: string) => setNoteDraft({ id, text });

  const load = useCallback((silent = false) => api.get(id).then((next) => { setArtifact(next); setError(''); }).catch((cause) => {
    if (!silent) setError(cause instanceof Error ? cause.message : 'No se pudo cargar.');
  }), [api, id]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!artifact || !['queued', 'running'].includes(artifact.status)) return;
    const timer = setInterval(() => void load(true), 6000);
    return () => clearInterval(timer);
  }, [artifact, load]);

  const action = async (name: string, body?: unknown) => {
    setBusy(true);
    try {
      await api.action(id, name, body);
      if (name === 'feedback') recordInteraction('intelligence', 'feedback', 'success');
      setNotice(name === 'feedback' ? 'Gracias. Tu valoración mejora las próximas perspectivas.' : 'Listo.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo completar.');
    } finally {
      setBusy(false);
    }
  };

  const ask = async () => {
    setBusy(true);
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
    setBusy(true);
    try {
      await api.save(id, { saved: true, userNotes: notes });
      setNotice('Guardado en tu conocimiento.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={artifact?.content?.title ?? 'Construyendo una perspectiva'} overline="Knowledge" subtitle={artifact ? statusLabels[artifact.status] : undefined} back onRefresh={() => void load()}>
      {error ? <StateView kind="error" title="No se pudo cargar" description={error} actionLabel="Reintentar" onAction={() => void load()} /> : null}
      {notice ? <Text accessibilityLiveRegion="polite" style={[theme.typography.caption, { color: theme.colors.success }]}>{notice}</Text> : null}

      {artifact && ['queued', 'running'].includes(artifact.status) ? (
        <GlassSurface level="regular" padding="lg" contentStyle={{ gap: 12, alignItems: 'center' }}>
          <ActivityIndicator color={theme.colors.accent} />
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary, textAlign: 'center' }]}>Buscando evidencia, conectando información y verificando conclusiones. Puedes salir y volver más tarde.</Text>
          <Button label="Cancelar análisis" variant="secondary" onPress={() => void action('cancel')} disabled={busy} />
        </GlassSurface>
      ) : null}
      {artifact && ['failed', 'stale', 'cancelled'].includes(artifact.status) ? <Button label="Actualizar análisis" onPress={() => void action('refresh')} disabled={busy} /> : null}

      {artifact?.content ? (
        <>
          <SignalCard variant="block" origin="model" title="Resumen generado" summary={artifact.content.summary} />

          {artifact.content.claims.map((claim) => (
            <GlassSurface key={claim.id} level="thin" padding="md" contentStyle={{ gap: 8 }}>
              <Text style={[theme.typography.overline, { color: claim.kind === 'inference' ? theme.colors.warning : theme.colors.accent }]}>
                {claim.kind === 'inference' ? 'Hipótesis' : claim.kind === 'calculation' ? 'Cálculo verificado' : 'Observación'}
              </Text>
              <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>{claim.text}</Text>
              {claim.kind === 'inference' && artifact.status === 'ready' ? (
                <Button
                  label={artifact.confirmedClaims?.includes(claim.id) ? 'Confirmado por ti · Deshacer' : 'Confirmar como conocimiento personal'}
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
                    title: source?.source ?? 'Source',
                    reason: citation.quote,
                    onPress: source?.eventIds[0] ? () => router.push(`/event/${source.eventIds[0]}`) : undefined,
                  };
                })} />
              ) : null}
            </GlassSurface>
          ))}

          {artifact.content.uncertainty.length ? (
            <Section title="Lo que aún no sabemos">
              {artifact.content.uncertainty.map((text, index) => <Row key={index} title={text} leading={<IconTile icon="help-circle" size="sm" />} accessory="none" />)}
            </Section>
          ) : null}

          {artifact.content.actions.length ? (
            <Section title="Posibles próximos pasos">
              {artifact.content.actions.map((text, index) => <Row key={index} title={text} leading={<IconTile icon="arrow-right" size="sm" color={theme.colors.accent} />} accessory="none" />)}
            </Section>
          ) : null}

          <Section title="¿Te sirvió?">
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {[['useful', 'Útil'], ['irrelevant', 'No relevante'], ['incorrect', 'Incorrecto'], ['known', 'Ya lo sabía']].map(([value, label]) => (
                <Chip key={value} label={label} onPress={() => void action('feedback', { value })} />
              ))}
            </View>
          </Section>

          <Section title="Tu perspectiva">
            <Field label="Notas personales" value={notes} onChangeText={setNotes} multiline />
            <Button label="Guardar conocimiento" onPress={() => void save()} disabled={busy} />
          </Section>

          <Section title="Profundiza">
            <Field label="Pregunta de seguimiento" value={question} onChangeText={setQuestion} />
            <Button label="Seguir explorando" onPress={() => void ask()} disabled={busy || question.trim().length < 3} />
          </Section>
        </>
      ) : null}
    </Screen>
  );
}
