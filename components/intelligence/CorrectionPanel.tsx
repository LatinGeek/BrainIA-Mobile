import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { NativeEventEmitter, NativeModules, Platform, Text, View } from 'react-native';

import { Button, Chip, Field, SegmentedControl } from '@/components/controls';
import { GlassPressable } from '@/components/glass/GlassPressable';
import { BottomSheet } from '@/components/layout/BottomSheet';
import { Section } from '@/components/layout/Screen';
import { useBrainIAClient, useTheme } from '@/lib/app-state';
import { useIntelligenceClient } from '@/lib/intelligence';
import { recordInteraction } from '@/lib/interaction-telemetry';
import type { FinancialCategories } from '@/lib/domain';

type LearningMode = 'transaction' | 'event';
type VoiceModule = { start: () => Promise<boolean>; stop: () => Promise<boolean>; addListener: (name: string) => void; removeListeners: (count: number) => void };
const voiceModule = Platform.OS === 'android' ? NativeModules.BrainIAVoiceNote as VoiceModule | undefined : undefined;
const financialKinds = [{ value: 'expense', label: 'Gasto' }, { value: 'income', label: 'Ingreso' }, { value: 'transfer', label: 'Transferir' }] as const;
const eventKinds = [{ value: 'notification', label: 'Notificación' }, { value: 'task', label: 'Tarea' }, { value: 'note', label: 'Nota' }, { value: 'email', label: 'Correo' }, { value: 'other', label: 'Otro' }] as const;
const eventCategorySuggestions = ['Automatización del hogar', 'Seguridad', 'Promoción', 'Entrega o pedido', 'Recordatorio', 'Estado de servicio', 'Comunicación'];

export function CorrectionPanel({ eventId, onSaved }: { eventId: string; onSaved: () => void }) {
  const api = useIntelligenceClient();
  const client = useBrainIAClient();
  const theme = useTheme();
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<LearningMode>('event');
  const [kind, setKind] = useState('notification');
  const [financialCategory, setFinancialCategory] = useState('');
  const [eventCategory, setEventCategory] = useState('');
  const [explanation, setExplanation] = useState('');
  const [categories, setCategories] = useState<FinancialCategories>({ expense: [], income: [] });
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState('');
  const categoryOptions = useMemo(() => Array.from(new Set(kind === 'income' ? categories.income : categories.expense)).sort((a, b) => a.localeCompare(b)), [categories, kind]);

  useEffect(() => { let active = true; api.request<{ learning: boolean }>('/intelligence/capabilities').then((result) => { if (active) setEnabled(result.learning); }).catch(() => {}); return () => { active = false; }; }, [api]);
  useEffect(() => { if (enabled) void client.listFinancialCategories().then(setCategories).catch(() => {}); }, [client, enabled]);
  useEffect(() => {
    if (!voiceModule) return;
    const emitter = new NativeEventEmitter(voiceModule);
    const transcript = emitter.addListener('BrainIAVoiceTranscript', ({ text, final }: { text?: string; final?: boolean }) => { if (!final || !text?.trim()) return; setExplanation((current) => current.trim() ? `${current.trimEnd()} ${text.trim()}` : text.trim()); setRecording(false); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); });
    const state = emitter.addListener('BrainIAVoiceState', ({ state: voiceState }: { state?: string }) => { if (voiceState === 'idle' || voiceState === 'error') setRecording(false); });
    return () => { transcript.remove(); state.remove(); };
  }, []);

  function chooseMode(next: LearningMode) {
    setMode(next);
    setKind(next === 'transaction' ? 'expense' : 'notification');
    setFinancialCategory('');
    setEventCategory('');
    setStatus('');
  }

  async function toggleVoice() {
    if (!voiceModule) return;
    if (recording) { await voiceModule.stop(); return; }
    setRecording(await voiceModule.start());
  }

  async function teach() {
    setBusy(true);
    setStatus('');
    try {
      await api.request('/classification/teach', 'POST', { eventId, kind, ...(mode === 'transaction' && financialCategory ? { financialCategory } : {}), ...(mode === 'event' && eventCategory.trim() ? { eventCategory: eventCategory.trim() } : {}), ...(explanation.trim() ? { explanation: explanation.trim() } : {}) });
      setStatus('Listo. Esta decisión ya guía las próximas interpretaciones equivalentes.');
      recordInteraction('detail', 'correct', 'success');
      onSaved();
    } catch {
      setStatus('No se pudo guardar el aprendizaje. Intentá nuevamente.');
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) return null;

  return (
    <>
      <Section title="Corregir y aprender" subtitle="Decidí qué es y BrainIA aprenderá de tu criterio." collapsible defaultOpen={false}>
        <SegmentedControl
          items={[{ value: 'event', label: 'Evento o notificación', icon: 'bell' }, { value: 'transaction', label: 'Transacción', icon: 'dollar-sign' }]}
          value={mode}
          onChange={(value) => chooseMode(value as LearningMode)}
        />
        {mode === 'transaction' ? (
          <>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Qué movimiento es</Text>
            <SegmentedControl items={financialKinds as unknown as typeof financialKinds} value={kind} onChange={setKind} />
            {kind !== 'transfer' ? <Chip label={financialCategory || 'Elegir categoría financiera'} icon="tag" onPress={() => setCategorySheetOpen(true)} /> : null}
          </>
        ) : (
          <>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Qué tipo de evento es</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {eventKinds.map((item) => <Chip key={item.value} label={item.label} selected={kind === item.value} onPress={() => setKind(item.value)} />)}
            </View>
            <Field label="Categoría del evento" value={eventCategory} onChangeText={setEventCategory} placeholder="Ej. Automatización del hogar" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {eventCategorySuggestions.map((item) => <Chip key={item} label={item} selected={eventCategory === item} onPress={() => setEventCategory(item)} />)}
            </View>
          </>
        )}
        <Field label="Contale a BrainIA de qué se trata (opcional)" value={explanation} onChangeText={setExplanation} multiline placeholder="Ej. Aviso de movimiento detectado por el sensor del living." style={{ minHeight: 88, textAlignVertical: 'top' }} />
        {voiceModule ? (
          <GlassPressable accessibilityRole="button" accessibilityLabel={recording ? 'Detener dictado' : 'Dictar explicación'} onPress={() => { void toggleVoice(); }} hitSlop={8} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.glass.inner }}>
            <Feather name={recording ? 'square' : 'mic'} size={19} color={recording ? theme.colors.danger : theme.colors.accentStrong} />
          </GlassPressable>
        ) : null}
        {recording ? <Text accessibilityLiveRegion="polite" style={[theme.typography.caption, { color: theme.colors.accentStrong }]}>Escuchando… tocá el micrófono para terminar.</Text> : null}
        <Button label={busy ? 'Guardando aprendizaje…' : 'Guardar y enseñar a BrainIA'} onPress={() => void teach()} loading={busy} disabled={busy} />
        {status ? <Text accessibilityLiveRegion="polite" style={[theme.typography.caption, { color: status.startsWith('No se pudo') ? theme.colors.danger : theme.colors.success }]}>{status}</Text> : null}
      </Section>
      <BottomSheet visible={categorySheetOpen} title="Categoría financiera" onClose={() => setCategorySheetOpen(false)}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {categoryOptions.map((option) => <Chip key={option} label={option} selected={financialCategory === option} onPress={() => { setFinancialCategory(option); setCategorySheetOpen(false); }} />)}
        </View>
        <Field label="Nueva categoría" placeholder="Comida / Viandas" onSubmitEditing={(event) => {
          const value = event.nativeEvent.text.trim();
          if (!value) return;
          setFinancialCategory(value);
          setCategorySheetOpen(false);
          void client.createFinancialCategory({ kind: kind === 'income' ? 'income' : 'expense', name: value });
        }} />
      </BottomSheet>
    </>
  );
}
