import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { NativeEventEmitter, NativeModules, Platform, Text, View } from 'react-native';

import { CategoryPicker } from '@/components/review';
import { BottomSheet, Button, DisclosureSection, FilterChip, IconButton, Input, ListRow, SegmentedControl } from '@/components/primitives';
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
  const api = useIntelligenceClient(); const client = useBrainIAClient(); const theme = useTheme();
  const [enabled, setEnabled] = useState(false); const [mode, setMode] = useState<LearningMode>('event'); const [kind, setKind] = useState('notification');
  const [financialCategory, setFinancialCategory] = useState(''); const [eventCategory, setEventCategory] = useState(''); const [explanation, setExplanation] = useState('');
  const [categories, setCategories] = useState<FinancialCategories>({ expense: [], income: [] }); const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [busy, setBusy] = useState(false); const [recording, setRecording] = useState(false); const [status, setStatus] = useState('');
  const categoryOptions = useMemo(() => Array.from(new Set(kind === 'income' ? categories.income : categories.expense)).sort((a, b) => a.localeCompare(b)), [categories, kind]);

  useEffect(() => { let active = true; api.request<{ learning: boolean }>('/intelligence/capabilities').then((result) => { if (active) setEnabled(result.learning); }).catch(() => {}); return () => { active = false; }; }, [api]);
  useEffect(() => { if (enabled) void client.listFinancialCategories().then(setCategories).catch(() => {}); }, [client, enabled]);
  useEffect(() => {
    if (!voiceModule) return; const emitter = new NativeEventEmitter(voiceModule);
    const transcript = emitter.addListener('BrainIAVoiceTranscript', ({ text, final }: { text?: string; final?: boolean }) => { if (!final || !text?.trim()) return; setExplanation((current) => current.trim() ? `${current.trimEnd()} ${text.trim()}` : text.trim()); setRecording(false); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); });
    const state = emitter.addListener('BrainIAVoiceState', ({ state }: { state?: string }) => { if (state === 'idle' || state === 'error') setRecording(false); });
    return () => { transcript.remove(); state.remove(); };
  }, []);

  function chooseMode(next: LearningMode) { setMode(next); setKind(next === 'transaction' ? 'expense' : 'notification'); setFinancialCategory(''); setEventCategory(''); setStatus(''); }
  async function toggleVoice() { if (!voiceModule) return; if (recording) { await voiceModule.stop(); return; } setRecording(await voiceModule.start()); }
  async function teach() {
    setBusy(true); setStatus('');
    try {
      await api.request('/classification/teach', 'POST', { eventId, kind, ...(mode === 'transaction' && financialCategory ? { financialCategory } : {}), ...(mode === 'event' && eventCategory.trim() ? { eventCategory: eventCategory.trim() } : {}), ...(explanation.trim() ? { explanation: explanation.trim() } : {}) });
      setStatus('Listo. Esta decisión ya guía las próximas interpretaciones equivalentes.'); recordInteraction('detail', 'correct', 'success'); onSaved();
    } catch { setStatus('No se pudo guardar el aprendizaje. Intentá nuevamente.'); } finally { setBusy(false); }
  }
  if (!enabled) return null;
  return <>
    <DisclosureSection title="Corregir y aprender" subtitle="Decidí qué es y BrainIA aprenderá de tu criterio.">
      <View style={{ gap: theme.spacing.md }}>
        <SegmentedControl value={mode} onChange={(value) => chooseMode(value as LearningMode)} options={[{ value: 'event', label: 'Evento o notificación', icon: <Feather name="bell" size={15} color={theme.colors.accentStrong} /> }, { value: 'transaction', label: 'Transacción', icon: <Feather name="dollar-sign" size={15} color={theme.colors.accentStrong} /> }]} />
        {mode === 'transaction' ? <>
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Qué movimiento es</Text><SegmentedControl value={kind} onChange={setKind} options={financialKinds} />
          {kind !== 'transfer' ? <ListRow title={financialCategory || 'Elegir categoría financiera'} subtitle="Categoría de la transacción" description="Se usa para gastos e ingresos, no para eventos." leading={<Feather name="tag" size={19} color={theme.colors.accentStrong} />} trailing={<Feather name="chevron-right" size={18} color={theme.colors.textMuted} />} onPress={() => setCategorySheetOpen(true)} /> : null}
        </> : <>
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Qué tipo de evento es</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>{eventKinds.map((item) => <FilterChip key={item.value} label={item.label} selected={kind === item.value} onPress={() => setKind(item.value)} />)}</View>
          <Input label="Categoría del evento" value={eventCategory} onChangeText={setEventCategory} placeholder="Ej. Automatización del hogar" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>{eventCategorySuggestions.map((item) => <FilterChip key={item} label={item} selected={eventCategory === item} onPress={() => setEventCategory(item)} />)}</View>
        </>}
        <View style={{ gap: theme.spacing.xs }}><Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Contale a BrainIA de qué se trata <Text style={{ color: theme.colors.textMuted, fontWeight: '400' }}>(opcional)</Text></Text><View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-end' }}><View style={{ flex: 1 }}><Input value={explanation} onChangeText={setExplanation} multiline placeholder="Ej. Aviso de movimiento detectado por el sensor del living." style={{ minHeight: 88, textAlignVertical: 'top' }} /></View>{voiceModule ? <IconButton icon={<Feather name={recording ? 'square' : 'mic'} size={19} color={recording ? theme.colors.danger : theme.colors.accentStrong} />} label={recording ? 'Detener dictado' : 'Dictar explicación'} onPress={() => { void toggleVoice(); }} /> : null}</View>{recording ? <Text accessibilityLiveRegion="polite" style={[theme.typography.caption, { color: theme.colors.accentStrong }]}>Escuchando… tocá el micrófono para terminar.</Text> : null}</View>
        <Button label={busy ? 'Guardando aprendizaje…' : 'Guardar y enseñar a BrainIA'} onPress={() => void teach()} loading={busy} disabled={busy} />
        {status ? <Text accessibilityLiveRegion="polite" style={[theme.typography.caption, { color: status.startsWith('No se pudo') ? theme.colors.danger : theme.colors.success }]}>{status}</Text> : null}
      </View>
    </DisclosureSection>
    <BottomSheet visible={categorySheetOpen} title="Categoría financiera" onClose={() => setCategorySheetOpen(false)}><CategoryPicker categories={categoryOptions} selectedCategory={financialCategory} onSelect={(value) => { setFinancialCategory(value); setCategorySheetOpen(false); }} onCreate={(value) => { setFinancialCategory(value); setCategorySheetOpen(false); void client.createFinancialCategory({ kind: kind === 'income' ? 'income' : 'expense', name: value }); }} /></BottomSheet>
  </>;
}
