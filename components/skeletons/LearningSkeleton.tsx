import { SkeletonBlock, SkeletonGroup, SkeletonLine } from '@/components/data/Skeleton';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { useTheme } from '@/lib/app-state';
import { SkeletonSection } from './parts';

/** Small buttons are the theme's minTarget tall (44), stacked at the card's own gap. */
function LearningCorrectionSkeleton() {
  const { layout, spacing } = useTheme();
  return (
    <GlassSurface level="thin" padding="md" contentStyle={{ gap: spacing.sm }}>
      <SkeletonLine width={92} lineHeight={14} />
      <SkeletonLine width="54%" lineHeight={23} />
      <SkeletonBlock height={layout.minTarget} radius={999} />
      <SkeletonBlock height={layout.minTarget} radius={999} />
    </GlassSurface>
  );
}

/** Aprendizaje's first load: the "Correcciones" section with its cards. */
export function LearningSkeleton() {
  return (
    <SkeletonGroup>
      <SkeletonSection titleWidth={120} subtitle={false}>
        {[0, 1, 2].map((key) => <LearningCorrectionSkeleton key={key} />)}
      </SkeletonSection>
    </SkeletonGroup>
  );
}
