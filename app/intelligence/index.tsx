import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Button, Chip, Field, SegmentedControl } from '@/components/controls';
import { StateView } from '@/components/data/StateView';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { Screen, Section } from '@/components/layout/Screen';
import { ArtifactCard } from '@/components/intelligence';
import { useTheme } from '@/lib/app-state';
import { useIntelligenceClient, type Artifact } from '@/lib/intelligence';
import { recordInteraction } from '@/lib/interaction-telemetry';

export default function IntelligenceScreen() {
  const theme = useTheme();
  const api = useIntelligenceClient();
  const [question, setQuestion] = useState('');
  const questionInput = useRef<TextInput>(null);
  const [kind, setKind] = useState<'answer' | 'page'>('answer');
  const [items, setItems] = useState<Artifact[]>([]);
  const [listError, setListError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.list().then((result) => { setItems(result.artifacts); setListError(''); }).catch((cause) => setListError(cause instanceof Error ? cause.message : 'No se pudo cargar tu biblioteca.')).finally(() => setLoaded(true)), [api]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const pull = () => { setRefreshing(true); void load().finally(() => setRefreshing(false)); };

  const active = items.filter((artifact) => artifact.status === 'queued' || artifact.status === 'running');
  const submit = async () => {
    if (question.trim().length < 3) return;
    setBusy(true);
    setSubmitError('');
    try {
      const artifact = await api.create({ kind, objective: question.trim() });
      recordInteraction('intelligence', 'ask', 'success');
      router.push(`/intelligence/${artifact.id}`);
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : 'No se pudo iniciar el análisis.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Tu conocimiento, conectado" overline="Conocimiento" subtitle="Pregunta, descubre y conserva lo que importa. Siempre con tus fuentes." back refreshing={refreshing} onRefresh={pull}>
      <GlassSurface level="regular" padding="lg" contentStyle={{ gap: theme.spacing.md }}>
        <SegmentedControl items={[{ value: 'answer', label: 'Preguntar' }, { value: 'page', label: 'Crear página' }]} value={kind} onChange={setKind} />
        <Field inputRef={questionInput} label={kind === 'page' ? 'Tema que quieres comprender' : '¿Qué quieres entender?'} value={question} onChangeText={(text) => { setQuestion(text); setSubmitError(''); }} error={submitError} multiline style={{ minHeight: theme.layout.minTarget * 2, textAlignVertical: 'top' }} placeholder="¿Qué cambió en mis gastos y compromisos esta semana?" />
        <Button label={busy ? 'Preparando análisis…' : kind === 'page' ? 'Crear conocimiento' : 'Analizar con mis fuentes'} loading={busy} disabled={busy || question.trim().length < 3} onPress={() => void submit()} />
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Análisis profundo. Las conclusiones incluyen evidencia y distinguen lo observado de las hipótesis.</Text>
      </GlassSurface>

      {listError ? <StateView kind="error" title="No se pudo cargar tu biblioteca" description={listError} actionLabel="Reintentar" onAction={() => void load()} /> : null}

      <Section title="Explora una pregunta">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {['¿Qué merece mi atención hoy?', '¿Qué compras o servicios se repiten?', '¿Qué compromisos explícitos siguen abiertos?'].map((prompt) => (
          <Chip key={prompt} label={prompt} onPress={() => { setQuestion(prompt); questionInput.current?.focus(); }} />
        ))}
        </View>
      </Section>

      {active.length ? (
        <Section title="En curso" count={active.length}>
          {active.map((artifact) => <ArtifactCard key={artifact.id} artifact={artifact} />)}
        </Section>
      ) : null}
      <Section title="Tu biblioteca" subtitle="Respuestas, páginas y perspectivas que puedes volver a consultar.">
        {!loaded ? <StateView kind="loading" title="Cargando" skeleton="card" skeletonCount={2} /> : null}
        {items.filter((artifact) => !active.some((activeArtifact) => activeArtifact.id === artifact.id)).map((artifact) => <ArtifactCard key={artifact.id} artifact={artifact} />)}
        {loaded && !listError && !items.length ? <StateView title="Tu primera pregunta es el comienzo" description="Conecta lo que sabes y explora preguntas, cambios y decisiones con tus propias fuentes." actionLabel="Preguntar" onAction={() => setQuestion('¿Qué merece mi atención hoy?')} /> : null}
      </Section>
    </Screen>
  );
}
