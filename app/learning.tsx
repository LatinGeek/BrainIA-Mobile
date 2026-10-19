import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Chip } from '@/components/controls';
import { StateView } from '@/components/data/StateView';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { Screen, Section } from '@/components/layout/Screen';
import { useIntelligenceClient } from '@/lib/intelligence';
import { useTheme } from '@/lib/app-state';

type Correction = { id: string; event_id: string; field: string; value: string };
type Preview = { id: string; changes: { eventId: string; title?: string; field: string; value: string }[] };

export default function LearningScreen() {
  const api = useIntelligenceClient();
  const theme = useTheme();
  const [items, setItems] = useState<Correction[]>([]);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState('');

  const load = useCallback(() => api.request<{ corrections: Correction[] }>('/classification/corrections').then((result) => setItems(result.corrections)).catch((error) => setStatus(error.message)), [api]);
  useEffect(() => {
    let active = true;
    api.request<{ learning: boolean }>('/intelligence/capabilities').then((result) => {
      if (!active) return;
      setEnabled(result.learning);
      if (result.learning) void load();
    }).catch(() => { if (active) setEnabled(false); });
    return () => { active = false; };
  }, [api, load]);

  async function prepare(id: string) {
    setBusy(true);
    try {
      const next = await api.request<Preview>(`/classification/corrections/${id}/preview`, 'POST');
      setPreview(next);
      setSelected([]);
      setStatus('Selecciona los eventos que quieres actualizar.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No se pudo preparar.');
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!preview) return;
    setBusy(true);
    try {
      await api.request(`/classification/reclassification/${preview.id}/apply`, 'POST', { eventIds: selected });
      setApplied(preview.id);
      setPreview(null);
      setStatus('Historial actualizado. Puedes deshacer este cambio.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No se pudo aplicar.');
    } finally {
      setBusy(false);
    }
  }

  async function undo(id: string, run = false) {
    setBusy(true);
    try {
      await api.request(`/classification/${run ? 'reclassification' : 'corrections'}/${id}/undo`, 'POST');
      setStatus('Cambio deshecho.');
      if (run) setApplied('');
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No se pudo deshacer.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Lo que Brain IA aprendió" overline="Learning" subtitle="Tus correcciones guían eventos futuros. Tú decides cuándo actualizar el pasado." back onRefresh={() => void load()}>
      {enabled === false ? <StateView title="Aprendizaje no habilitado" description="El aprendizaje confirmado todavía no está habilitado en este backend." /> : null}
      {status ? <Text accessibilityLiveRegion="polite" style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{status}</Text> : null}
      {applied ? <Button label="Deshacer actualización del historial" disabled={busy} onPress={() => void undo(applied, true)} /> : null}

      {preview ? (
        <GlassSurface level="regular" padding="lg" contentStyle={{ gap: 10 }}>
          <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>{preview.changes.length} eventos equivalentes</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {preview.changes.map((change, index) => (
              <Chip key={change.eventId} label={`${change.title || `Evento ${index + 1}`} → ${change.value}`} selected={selected.includes(change.eventId)} onPress={() => setSelected((current) => current.includes(change.eventId) ? current.filter((id) => id !== change.eventId) : [...current, change.eventId])} />
            ))}
          </View>
          <Button label={`Aplicar a ${selected.length} eventos`} disabled={busy || !selected.length} onPress={() => void apply()} />
          <Button label="Cerrar vista previa" variant="ghost" onPress={() => setPreview(null)} />
        </GlassSurface>
      ) : null}

      {enabled && !items.length ? <StateView title="Todavía no hay correcciones" description="Las correcciones confirmadas aparecerán aquí." /> : null}

      <Section title="Corrections">
        {items.map((item) => (
          <GlassSurface key={item.id} level="thin" padding="md" contentStyle={{ gap: 8 }}>
            <Text style={[theme.typography.overline, { color: theme.colors.accent }]}>{item.field === 'merchant' ? 'Comercio' : item.field === 'category' ? 'Categoría' : 'Tipo de evento'}</Text>
            <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>{item.value}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Button label="Revisar historial equivalente" variant="secondary" size="sm" onPress={() => void prepare(item.id)} disabled={busy} />
              <Button label="Deshacer aprendizaje" variant="ghost" size="sm" onPress={() => void undo(item.id)} disabled={busy} />
            </View>
          </GlassSurface>
        ))}
      </Section>
    </Screen>
  );
}
