import { View } from 'react-native';

import { SkeletonBlock, SkeletonGroup, SkeletonLine } from '@/components/data/Skeleton';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { useTheme } from '@/lib/app-state';
import { SkeletonParagraph, SkeletonSection, SkeletonSignalCard, SkeletonTitleLines } from './parts';

/** The library's artifact cards (brief signal cards) while the list loads; the ask card above stays live. */
export function IntelligenceLibrarySkeleton({ count = 2 }: { count?: number }) {
  const { spacing } = useTheme();
  return (
    <SkeletonGroup label="Cargando tu biblioteca" style={{ gap: spacing.sm }}>
      {Array.from({ length: count }).map((_, index) => (
        <GlassSurface key={index} level="regular" tone="model" padding="md" contentStyle={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <SkeletonBlock width={76} height={28} radius={999} />
            <SkeletonBlock width={150} height={28} radius={999} />
          </View>
          <View>
            <SkeletonLine lineHeight={24} />
            <SkeletonLine lineHeight={24} />
            <SkeletonLine width="64%" lineHeight={24} />
          </View>
        </GlassSurface>
      ))}
    </SkeletonGroup>
  );
}

/*
 * Typical content of a generated artifact, from the backend's schema (intelligenceContentSchema in
 * BrainIA-Backend/src/domain/intelligence.ts): title <= 88 chars (about three display lines at 390dp), summary <= 420,
 * at most 3 claims of <= 420 chars (~150-200 typical, ~43 per body line -> 4), and every claim has at least one citation
 * (`citations.min(1)`), so each claim card ends with its citation row.
 */
const TITLE_EXTRA_LINES = 2;
const SUMMARY_LINES = 4;
const CLAIM_COUNT = 3;
const CLAIM_LINES = 3;
const CITATION_ROW_HEIGHT = 80;

/**
 * The perspective's loaded layout: summary card, conclusions, the pending steps and the feedback chips.
 * The loaded header wraps the title onto more display lines than the loading title has (the screen supplies the
 * subtitle line itself while loading), so the first child reserves those lines to keep the content from jumping
 * down when the title arrives.
 */
export function IntelligenceDetailSkeleton() {
  const { spacing } = useTheme();
  return (
    <SkeletonGroup style={{ gap: spacing.xl }}>
      <SkeletonTitleLines lines={TITLE_EXTRA_LINES} gap={spacing.xl} />
      <SkeletonSignalCard variant="card" titleLines={1} summaryLines={SUMMARY_LINES} />

      <SkeletonSection titleWidth={116} subtitle={false}>
        {Array.from({ length: CLAIM_COUNT }).map((_, key) => (
          <GlassSurface key={key} level="thin" padding="md" contentStyle={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <SkeletonBlock width={16} height={16} radius={8} />
              <SkeletonLine width={104} lineHeight={14} />
            </View>
            <SkeletonParagraph lines={CLAIM_LINES} />
            {/* Every claim cites at least one source; a typical quote wraps to two caption lines (~80pt row). */}
            <View style={{ minHeight: CITATION_ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <SkeletonBlock width={30} height={30} radius={10} />
              <View style={{ flex: 1 }}>
                <SkeletonLine width="48%" lineHeight={23} />
                <SkeletonLine lineHeight={16} />
                <SkeletonLine width="52%" lineHeight={16} />
              </View>
            </View>
          </GlassSurface>
        ))}
      </SkeletonSection>

      <SkeletonSection titleWidth={140} subtitle={false}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {[64, 112, 96, 108].map((width, index) => <SkeletonBlock key={index} width={width} height={34} radius={999} />)}
        </View>
      </SkeletonSection>
    </SkeletonGroup>
  );
}
