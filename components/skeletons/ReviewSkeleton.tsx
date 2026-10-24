import { View } from 'react-native';

import { SkeletonBlock, SkeletonGroup, SkeletonLine } from '@/components/data/Skeleton';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { useTheme } from '@/lib/app-state';
import { SkeletonRow, SkeletonSection, SkeletonStatGrid } from './parts';

/** Revisar while its first load runs: progress card with its button, topic chips, totals, the queue preview. */
export function ReviewSkeleton() {
  const { radius } = useTheme();
  return (
    <SkeletonGroup style={{ gap: 22 }}>
      <GlassSurface level="strong" tone="review" padding="lg" contentStyle={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <SkeletonBlock width={92} height={92} radius={46} />
          <View style={{ flex: 1, gap: 4 }}>
            <SkeletonLine width="70%" lineHeight={14} />
            <SkeletonLine width="56%" lineHeight={27} />
            <View>
              <SkeletonLine lineHeight={16} />
              <SkeletonLine lineHeight={16} />
              <SkeletonLine width="64%" lineHeight={16} />
            </View>
          </View>
        </View>
        <SkeletonBlock height={48} radius={999} />
      </GlassSurface>

      <SkeletonSection titleWidth={140} subtitleWidth="78%">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[133, 131].map((width, index) => <SkeletonBlock key={index} width={width} height={50} radius={radius.md} />)}
        </View>
      </SkeletonSection>

      <SkeletonSection titleWidth={76} subtitle={false}>
        <SkeletonStatGrid />
      </SkeletonSection>

      <SkeletonSection titleWidth={148} subtitleWidth="70%">
        {[0, 1, 2].map((key) => <SkeletonRow key={key} titleLines={2} lines={4} />)}
      </SkeletonSection>
    </SkeletonGroup>
  );
}
