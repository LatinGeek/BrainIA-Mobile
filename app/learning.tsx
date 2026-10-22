import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { Feather } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { Button } from '@/components/controls';
import { GlassPressable } from '@/components/glass/GlassPressable';
import { StateView } from '@/components/data/StateView';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { Screen, Section } from '@/components/layout/Screen';
import { useIntelligenceClient } from '@/lib/intelligence';
import { useTheme } from '@/lib/app-state';
import { useToast } from '@/components/layout/Toast';
import { formatEventKind } from '@/lib/format';
import { useReduceMotion } from '@/lib/hooks';
import { listLayout } from '@/lib/motion';

type Correction = { id: string; event_id: string; field: string; value: string };
type Preview = { id: string; changes: { eventId: string; title?: string; field: string; value: string }[] };

export default function LearningScreen() {
  const api = useIntelligenceClient();
  const theme = useTheme();
  const toast = useToast();
  const reduceMotion = useReduceMotion();
  const [items, setItems] = useState<Correction[]>([]);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const operationActive = useRef(false);
  const busy = pending !== null;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [applied, setApplied] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const result = await api.request<{ corrections: Correction[] }>('/classification/corrections');
      setItems(result.corrections);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [api]);
  const initialize = useCallback(async (isActive: () => boolean = () => true) => {
    try {
      const capability = await api.request<{ learning: boolean }>('/intelligence/capabilities');
      if (!isActive()) return;
      setEnabled(capability.learning);
      if (capability.learning) {
        const result = await api.request<{ corrections: Correction[] }>('/classification/corrections');
        if (isActive()) setItems(result.corrections);
      }
    } catch {
      if (isActive()) setLoadError(true);
    } finally {
      if (isActive()) setLoading(false);
    }
  }, [api]);
  useEffect(() => {
    let active = true;
    void api.request<{ learning: boolean }>('/intelligence/capabilities').then(async (capability) => {
      if (!active) return;
      setEnabled(capability.learning);
      if (capability.learning) {
        const result = await api.request<{ corrections: Correction[] }>('/classification/corrections');
        if (active) setItems(result.corrections);
      }
    }).catch(() => { if (active) setLoadError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api]);

  async function prepare(id: string) {
    if (operationActive.current) return;
    operationActive.current = true;
    setPending(`prepare:${id}`);
    try {
      const next = await api.request<Preview>(`/classification/corrections/${id}/preview`, 'POST');
      if (!next.changes.length) {
        setPreview(null);
        setStatus('No hay eventos anteriores para actualizar.');
        return;
      }
      setPreview(next);
      setSelected([]);
      setStatus('Selecciona los eventos que quieres actualizar.');
    } catch {
      setStatus('No se pudo preparar la vista previa. Intenta de nuevo.');
    } finally {
      setPending(null);
      operationActive.current = false;
    }
  }

  async function apply() {
    if (!preview || operationActive.current || !selected.length) return;
    operationActive.current = true;
    setPending('apply');
    try {
      await api.request(`/classification/reclassification/${preview.id}/apply`, 'POST', { eventIds: selected });
      setApplied(preview.id);
      setPreview(null);
      setStatus('Historial actualizado. Puedes deshacer este cambio.');
      const appliedId = preview.id;
      toast.show('Historial actualizado', { tone: 'positive', duration: 8000, action: { label: 'Deshacer', onPress: () => void undo(appliedId, true) } });
    } catch {
      setStatus('No se pudieron actualizar los eventos. Intenta de nuevo.');
    } finally {
      setPending(null);
      operationActive.current = false;
    }
  }

  async function undo(id: string, run = false) {
    if (operationActive.current) return;
    operationActive.current = true;
    setPending(`undo:${id}`);
    try {
      await api.request(`/classification/${run ? 'reclassification' : 'corrections'}/${id}/undo`, 'POST');
      setStatus('Cambio deshecho.');
      if (run) setApplied('');
      await load();
    } catch {
      setStatus('No se pudo deshacer el cambio. Intenta de nuevo.');
    } finally {
      setPending(null);
      operationActive.current = false;
    }
  }

  return (
    <Screen title="Lo que Brain IA aprendió" overline="Aprendizaje" subtitle="Tus correcciones guían eventos futuros. Tú decides cuándo actualizar el pasado." back refreshing={loading} onRefresh={enabled ? () => void load() : undefined}>
      {loading ? <StateView kind="loading" skeleton="card" skeletonCount={3} title="Cargando" /> : loadError ? <StateView kind="error" title="No se pudo cargar" description="No se pudieron cargar las correcciones. Revisa la conexión e intenta de nuevo." actionLabel="Reintentar" onAction={() => { setLoading(true); setLoadError(false); void initialize(); }} /> : enabled === false ? <StateView title="Aprendizaje no habilitado" description="El aprendizaje confirmado todavía no está habilitado en este servicio." /> : null}
      {status ? <Text accessibilityLiveRegion="polite" style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{status}</Text> : null}
      {applied ? <Animated.View entering={FadeIn.duration(reduceMotion ? theme.motion.duration.reduced : theme.motion.duration.quick).reduceMotion(ReduceMotion.Never)} exiting={FadeOut.duration(reduceMotion ? theme.motion.duration.reduced : theme.motion.duration.press).reduceMotion(ReduceMotion.Never)} layout={reduceMotion ? undefined : listLayout}><Button label="Deshacer actualización" variant="secondary" disabled={busy} loading={pending === `undo:${applied}`} onPress={() => void undo(applied, true)} /></Animated.View> : null}

      {preview ? (
        <Animated.View entering={reduceMotion ? FadeIn.duration(theme.motion.duration.reduced).reduceMotion(ReduceMotion.Never) : FadeInDown.duration(theme.motion.duration.quick)} exiting={FadeOut.duration(reduceMotion ? theme.motion.duration.reduced : theme.motion.duration.press).reduceMotion(ReduceMotion.Never)} layout={reduceMotion ? undefined : listLayout}>
        <GlassSurface level="regular" padding="lg" contentStyle={{ gap: theme.spacing.md }}>
          <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>{preview.changes.length} {preview.changes.length === 1 ? 'evento equivalente' : 'eventos equivalentes'}</Text>
          <View style={{ gap: theme.spacing.sm }}>
            {preview.changes.map((change, index) => {
              const checked = selected.includes(change.eventId);
              const label = `${change.title || `Evento ${index + 1}`} → ${change.value}`;
              return <GlassPressable key={change.eventId} accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked, disabled: busy }} disabled={busy} onPress={() => setSelected((current) => current.includes(change.eventId) ? current.filter((id) => id !== change.eventId) : [...current, change.eventId])} style={{ minHeight: theme.layout.minTarget, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, padding: theme.spacing.sm, borderRadius: theme.radius.md, backgroundColor: checked ? theme.glass.selected : theme.glass.inner }}>
                <Feather name={checked ? 'check-square' : 'square'} size={18} color={checked ? theme.glass.onSelected : theme.colors.textSecondary} />
                <Text numberOfLines={2} style={[theme.typography.caption, { flex: 1, minWidth: 0, color: checked ? theme.glass.onSelected : theme.colors.textSecondary }]}>{label}</Text>
              </GlassPressable>;
            })}
          </View>
          <Button label={`Aplicar a ${selected.length} ${selected.length === 1 ? 'evento' : 'eventos'}`} loading={pending === 'apply'} disabled={busy || !selected.length} onPress={() => void apply()} />
          <Button label="Cerrar vista previa" variant="ghost" disabled={busy} onPress={() => setPreview(null)} />
        </GlassSurface>
        </Animated.View>
      ) : null}

      {enabled && !loading && !loadError && !items.length ? <StateView title="Todavía no hay correcciones" description="Las correcciones confirmadas aparecerán aquí." /> : null}

      {enabled && !loading && !loadError && items.length ? <Section title="Correcciones" count={items.length}>
        {items.map((item) => (
          <GlassSurface key={item.id} level="thin" padding="md" contentStyle={{ gap: theme.spacing.sm }}>
            <Text style={[theme.typography.overline, { color: theme.colors.accent }]}>{item.field === 'merchant' ? 'Comercio' : item.field === 'category' ? 'Categoría' : 'Tipo de evento'}</Text>
            <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>{item.field === 'merchant' || item.field === 'category' ? item.value : formatEventKind(item.value)}</Text>
            <View style={{ gap: theme.spacing.sm }}>
              <Button label="Revisar historial" variant="secondary" size="sm" onPress={() => void prepare(item.id)} disabled={busy} loading={pending === `prepare:${item.id}`} />
              <Button label="Deshacer aprendizaje" variant="ghost" size="sm" onPress={() => void undo(item.id)} disabled={busy} loading={pending === `undo:${item.id}`} />
            </View>
          </GlassSurface>
        ))}
      </Section> : null}
    </Screen>
  );
}
