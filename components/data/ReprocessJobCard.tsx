import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Tag } from '@/components/controls';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { useTheme } from '@/lib/app-state';
import {
  isActiveReprocessJob,
  REPROCESS_JOB_STATUS_LABEL,
  reprocessJobTone,
  reprocessStagesSummary,
  type ReprocessJob,
} from '@/lib/reprocess';

export function ReprocessJobCard({ job }: { job: ReprocessJob }) {
  const theme = useTheme();
  const active = isActiveReprocessJob(job.status);
  const label = REPROCESS_JOB_STATUS_LABEL[job.status];
  const detail = active
    ? job.status === 'queued'
      ? 'Esperando un worker. Puedes salir de esta actividad.'
      : job.status === 'retry_scheduled'
        ? 'El intento falló; se reintentará automáticamente.'
        : 'Trabajando en las etapas seleccionadas.'
    : job.status === 'succeeded'
      ? 'Las etapas seleccionadas terminaron.'
      : 'No se pudo completar. Puedes intentarlo nuevamente.';

  return (
    <GlassSurface level="thin" padding="md" contentStyle={{ gap: theme.spacing.sm }}>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Reprocesamiento</Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            {reprocessStagesSummary(job.stages)}
          </Text>
        </View>
        <Tag label={label} tone={reprocessJobTone(job.status)} live={active} />
      </View>
      <View style={styles.statusRow}>
        {active ? <ActivityIndicator size="small" color={theme.colors.accent} /> : null}
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted, flex: 1 }]}>{detail}</Text>
        {job.attemptCount > 0 && job.maxAttempts > 0 ? (
          <Text style={[theme.typography.mono, { color: theme.colors.textMuted }]}>
            {job.attemptCount}/{job.maxAttempts}
          </Text>
        ) : null}
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
