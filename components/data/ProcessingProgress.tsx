import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { GlassSurface } from '@/components/glass/GlassSurface';
import { useTheme } from '@/lib/app-state';
import type { EventProgress, ProgressStatus } from '@/lib/domain';
import { PROGRESS_STAGE_ORDER, progressHeadline, stageDetail, stageLabel, stageShortLabel } from '@/lib/event-progress';
import { useReduceMotion } from '@/lib/hooks';

/**
 * A compact view of an event's processing: one segment per stage, filled by its status, a
 * "done / applicable" counter, and a headline in plain words. Tapping it opens the per-stage
 * detail (attempts, what is waiting). Stages that do not apply to the event stay faint.
 */
export function ProcessingProgress({ progress, inferredKind }: { progress: EventProgress; inferredKind?: string }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const stages = PROGRESS_STAGE_ORDER.map((key) => ({ key, ...progress.stages[key] }));
  const applicable = stages.filter((stage) => stage.status !== 'not_applicable');
  const done = applicable.filter((stage) => stage.status === 'completed').length;
  const headline = progressHeadline(progress, inferredKind);

  const colorOf = (status: ProgressStatus) => {
    switch (status) {
      case 'completed': return theme.status.income;
      case 'running': return theme.colors.accent;
      case 'awaiting_review': return theme.status.review;
      case 'recoverable_failure': return theme.colors.warning;
      case 'terminal_failure': return theme.colors.danger;
      default: return theme.colors.textMuted;
    }
  };
  const summaryColor = colorOf(progress.summary.status);

  return (
    <GlassSurface level="thin" padding="md" contentStyle={{ gap: theme.spacing.sm }}>
      <Pressable
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${headline} ${stages.map((stage) => `${stageLabel[stage.key]}: ${stageDetail(stage)}.`).join(' ')}`}
        accessibilityHint={open ? 'Oculta el detalle por etapa' : 'Muestra el detalle por etapa'}
        style={{ gap: theme.spacing.sm }}
      >
        <View style={styles.headerRow}>
          <Text style={[theme.typography.bodyStrong, styles.headline, { color: theme.colors.textPrimary }]}>{headline}</Text>
          <View style={styles.counter}>
            <Text style={[theme.typography.mono, { color: summaryColor }]}>{done}/{applicable.length}</Text>
            <Feather name={open ? 'chevron-up' : 'chevron-down'} size={14} color={theme.colors.textMuted} />
          </View>
        </View>

        <View style={styles.bar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {stages.map((stage) => (
            <Segment key={stage.key} color={colorOf(stage.status)} status={stage.status} />
          ))}
        </View>
        <View style={styles.labels} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {stages.map((stage) => (
            <Text
              key={stage.key}
              numberOfLines={1}
              style={[styles.label, { color: stage.status === 'pending' || stage.status === 'not_applicable' ? theme.colors.textMuted : colorOf(stage.status), opacity: stage.status === 'not_applicable' ? 0.5 : 1 }]}
            >
              {stageShortLabel[stage.key]}
            </Text>
          ))}
        </View>
      </Pressable>

      {open ? (
        <View style={[styles.detail, { borderTopColor: theme.glass.divider }]}>
          {stages.map((stage) => (
            <View key={stage.key} style={styles.detailRow}>
              <View style={[styles.dot, { backgroundColor: colorOf(stage.status), opacity: stage.status === 'not_applicable' ? 0.35 : 1 }]} />
              <Text style={[theme.typography.caption, styles.detailText, { color: theme.colors.textSecondary }]}>
                <Text style={{ color: theme.colors.textPrimary }}>{stageLabel[stage.key]}</Text>
                {' · '}
                {stageDetail(stage)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </GlassSurface>
  );
}

/** One stage's slice of the bar. A running stage breathes; everything else is still. */
function Segment({ color, status }: { color: string; status: ProgressStatus }) {
  const reduceMotion = useReduceMotion();
  const pulse = useSharedValue(1);
  const running = status === 'running' && !reduceMotion;
  useEffect(() => {
    if (running) {
      pulse.set(withRepeat(withSequence(withTiming(0.4, { duration: 800 }), withTiming(1, { duration: 800 })), -1));
    } else {
      cancelAnimation(pulse);
      pulse.set(1);
    }
    return () => cancelAnimation(pulse);
  }, [running, pulse]);
  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));
  // Pending is a faint track, not applicable fainter still; the other states are solid.
  const track = status === 'pending' ? 0.28 : status === 'not_applicable' ? 0.12 : 1;
  return (
    <Animated.View style={[styles.segment, animated]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity: track }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headline: { flex: 1 },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bar: { flexDirection: 'row', gap: 5, height: 6 },
  segment: { flex: 1, height: 6, borderRadius: 999, overflow: 'hidden' },
  labels: { flexDirection: 'row', gap: 5 },
  label: { flex: 1, fontSize: 10.5, lineHeight: 14, letterSpacing: 0.2, fontFamily: 'Inter_500Medium' },
  detail: { gap: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  detailText: { flex: 1 },
});
