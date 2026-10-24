import { router } from 'expo-router';

import { Chip, Tag } from '@/components/controls';
import { GlassPressable } from '@/components/glass/GlassPressable';
import { SignalCard } from '@/components/data/SignalCard';
import { type Artifact } from '@/lib/intelligence';

export const statusLabels: Record<string, string> = {
  queued: 'En espera',
  running: 'Analizando tus fuentes',
  ready: 'Con evidencia',
  insufficient: 'Información insuficiente',
  failed: 'Análisis interrumpido',
  cancelled: 'Cancelado',
  stale: 'Hay información nueva',
};

/** Single-choice chips keep their selected appearance without a dismiss icon. */
export function ChoiceChip({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <GlassPressable accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ selected, checked: selected, disabled }} disabled={disabled} haptic="selection" scaleTo={0.94} hitSlop={5} onPress={onPress} style={{ maxWidth: '100%', opacity: disabled ? 0.5 : 1 }}>
      <Chip label={label} selected={selected} static />
    </GlassPressable>
  );
}

export function ArtifactCard({ artifact }: { artifact: Artifact }) {
  const title = artifact.content?.title ?? artifact.objective;
  const tone = artifact.status === 'ready' ? 'positive' : artifact.status === 'stale' ? 'warning' : artifact.status === 'failed' ? 'danger' : ['queued', 'running'].includes(artifact.status) ? 'info' : 'neutral';

  return (
    <SignalCard
      variant="brief"
      origin="model"
      title={title}
      summary={artifact.content?.summary}
      meta={artifact.kind === 'page' ? 'Página' : artifact.kind === 'weekly' ? 'Tu semana' : artifact.kind === 'daily' ? 'Tu día' : 'Respuesta'}
      action={<Tag label={statusLabels[artifact.status] ?? artifact.status} tone={tone} />}
      onPress={() => router.push(`/intelligence/${artifact.id}`)}
    />
  );
}
