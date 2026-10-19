import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { GlassSurface } from '@/components/glass/GlassSurface';
import { SignalCard } from '@/components/data/SignalCard';
import { useTheme } from '@/lib/app-state';
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

export function ArtifactCard({ artifact }: { artifact: Artifact }) {
  const theme = useTheme();
  const title = artifact.content?.title ?? artifact.objective;
  const summary = artifact.content?.summary;
  const tone = artifact.status === 'ready' ? 'positive' : artifact.status === 'stale' ? 'warning' : artifact.status === 'failed' ? 'danger' : 'info';

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={() => router.push(`/intelligence/${artifact.id}`)}>
      <SignalCard
        variant="brief"
        origin="model"
        title={title}
        summary={summary}
        meta={artifact.kind === 'page' ? 'Knowledge' : artifact.kind === 'weekly' ? 'Your week' : artifact.kind === 'daily' ? 'Your day' : 'Answer'}
        footer={statusLabels[artifact.status] ?? artifact.status}
      />
      <GlassSurface level="thin" padding="none" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }} contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6 }}>
        <Text style={[theme.typography.overline, { color: tone === 'danger' ? theme.colors.danger : tone === 'warning' ? theme.colors.warning : tone === 'positive' ? theme.colors.success : theme.colors.model }]}>
          {statusLabels[artifact.status] ?? artifact.status}
        </Text>
        <Feather name="arrow-up-right" size={13} color={theme.colors.textMuted} style={{ marginLeft: 'auto' }} />
      </GlassSurface>
    </Pressable>
  );
}
