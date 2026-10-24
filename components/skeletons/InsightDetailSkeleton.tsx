import { View } from 'react-native';

import { SkeletonBlock, SkeletonGroup } from '@/components/data/Skeleton';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { useTheme } from '@/lib/app-state';
import { SkeletonParagraph, SkeletonRow, SkeletonSection, SkeletonSignalCard, SkeletonTitleLines } from './parts';

const BUTTON_HEIGHT = 44;
const GROUP_GAP = 22;

/*
 * Typical wraps at 390dp, from what the backend generates (INSIGHT_JSON_PROMPT in BrainIA-Backend/src/storage/generated-content.ts):
 * title <= 60 chars (~19 per display line -> 3 lines), summary <= 160 (~38 per body line -> 3-4), whyItMatters <= 160 (4),
 * 1-3 takeaways <= 120 (~35 per bodyStrong line -> 3 each), recommendedAction <= 120 (3).
 */
const TITLE_EXTRA_LINES = 2;
/* The loading subtitle wraps to two lines; the loaded one ("Generada hoy") is one body line (21dp) shorter. */
const SUBTITLE_TRIM = 21;
const SUMMARY_LINES = 3;
const WHY_LINES = 4;
const TAKEAWAY_LINES = [3, 3, 3] as const;
const ACTION_LINES = 3;

/** Perspectiva: the block signal card, Por qué importa, Conclusiones, Próximo paso and the feedback buttons. */
export function InsightDetailSkeleton() {
  const { spacing } = useTheme();
  return (
    <SkeletonGroup label="Cargando perspectiva" style={{ gap: GROUP_GAP }}>
      <SkeletonTitleLines lines={TITLE_EXTRA_LINES} gap={GROUP_GAP} trim={SUBTITLE_TRIM} />
      <SkeletonSignalCard variant="card" titleLines={1} summaryLines={SUMMARY_LINES} />

      <SkeletonSection titleWidth={112} subtitle={false}>
        <GlassSurface level="thin" padding="md" contentStyle={{ flexDirection: 'row', gap: spacing.md }}>
          <SkeletonBlock width={38} height={38} radius={12} />
          <View style={{ flex: 1 }}><SkeletonParagraph lines={WHY_LINES} /></View>
        </GlassSurface>
      </SkeletonSection>

      <SkeletonSection titleWidth={104} subtitle={false}>
        <GlassSurface level="thin" padding="none">
          {TAKEAWAY_LINES.map((titleLines, index) => <SkeletonRow key={index} lines={1} titleLines={titleLines} />)}
        </GlassSurface>
      </SkeletonSection>

      <SkeletonSection titleWidth={96} subtitle={false}>
        <GlassSurface level="thin" tone="accent" padding="md" contentStyle={{ flexDirection: 'row', gap: spacing.md }}>
          <SkeletonBlock width={38} height={38} radius={12} />
          <View style={{ flex: 1 }}><SkeletonParagraph lines={ACTION_LINES} /></View>
        </GlassSurface>
      </SkeletonSection>

      <SkeletonSection titleWidth={128} subtitleWidth="88%">
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <SkeletonBlock width={116} height={BUTTON_HEIGHT} radius={999} />
          <SkeletonBlock width={104} height={BUTTON_HEIGHT} radius={999} />
        </View>
      </SkeletonSection>
    </SkeletonGroup>
  );
}
