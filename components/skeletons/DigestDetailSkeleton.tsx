import { View } from 'react-native';

import { SkeletonBlock, SkeletonGroup } from '@/components/data/Skeleton';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { useTheme } from '@/lib/app-state';
import { SkeletonParagraph, SkeletonRow, SkeletonSection, SkeletonSignalCard, SkeletonTitleLines } from './parts';

const BUTTON_HEIGHT = 48;
const METRIC_ROWS = 3;
const GROUP_GAP = 22;

/*
 * Typical wraps at 390dp, from what the backend generates (DIGEST_JSON_PROMPT in BrainIA-Backend/src/storage/generated-content.ts):
 * title <= 60 chars (~19 per display line -> 3 lines, two more than the loading title), summary <= 160 (~38 per body
 * line -> 4), 1-3 highlights <= 120 (~35 per bodyStrong line -> 3, 3, 3) plus the short "<source> was the most active
 * source..." line normalizeDigest (lib/api.ts) appends (2), recommendedAction <= 120 (3).
 */
const TITLE_EXTRA_LINES = 2;
const SUMMARY_LINES = 4;
const HIGHLIGHT_LINES = [3, 3, 3, 2] as const;
const ACTION_LINES = 3;

/** Resumen: the block signal card, Destacados, Métricas de actividad, Próximo paso and the explore buttons. */
export function DigestDetailSkeleton() {
  const { spacing } = useTheme();
  return (
    <SkeletonGroup label="Cargando resumen" style={{ gap: GROUP_GAP }}>
      <SkeletonTitleLines lines={TITLE_EXTRA_LINES} gap={GROUP_GAP} />
      <SkeletonSignalCard variant="card" titleLines={1} summaryLines={SUMMARY_LINES} />

      <SkeletonSection titleWidth={92} subtitle={false}>
        <GlassSurface level="thin" padding="none">
          {HIGHLIGHT_LINES.map((titleLines, index) => <SkeletonRow key={index} lines={1} titleLines={titleLines} />)}
        </GlassSurface>
      </SkeletonSection>

      <SkeletonSection titleWidth={148} subtitle={false}>
        <GlassSurface level="thin" padding="none">
          {Array.from({ length: METRIC_ROWS }).map((_, index) => <SkeletonRow key={index} lines={1} leading={false} trailing />)}
        </GlassSurface>
      </SkeletonSection>

      <SkeletonSection titleWidth={96} subtitle={false}>
        <GlassSurface level="thin" tone="accent" padding="md" contentStyle={{ flexDirection: 'row', gap: spacing.md }}>
          <SkeletonBlock width={38} height={38} radius={12} />
          <View style={{ flex: 1 }}><SkeletonParagraph lines={ACTION_LINES} /></View>
        </GlassSurface>
      </SkeletonSection>

      <SkeletonSection titleWidth={124} subtitle={false}>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}><SkeletonBlock height={BUTTON_HEIGHT} radius={999} /></View>
          <View style={{ flex: 1 }}><SkeletonBlock height={BUTTON_HEIGHT} radius={999} /></View>
        </View>
      </SkeletonSection>
    </SkeletonGroup>
  );
}
