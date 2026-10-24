import { View } from 'react-native';

import { SkeletonBlock, SkeletonGroup, SkeletonLine } from '@/components/data/Skeleton';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { useTheme } from '@/lib/app-state';
import { SkeletonHeroAmount, SkeletonRow, SkeletonSection, SkeletonSignalRail, SkeletonStatGrid } from './parts';

/** Hoy while its first load runs: net hero card with the four quick actions, highlights rail, stats, recent activity. */
export function TodaySkeleton() {
  const { radius } = useTheme();
  return (
    <SkeletonGroup style={{ gap: 22 }}>
      <GlassSurface level="strong" tone="finance" padding="lg" contentStyle={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ gap: 2 }}>
            <SkeletonLine width={72} lineHeight={14} />
            <SkeletonLine width={116} lineHeight={23} />
          </View>
          <SkeletonBlock width={92} height={24} radius={999} />
        </View>
        <SkeletonHeroAmount />
        <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 14 }}>
          <SkeletonLine width={116} lineHeight={16} />
          <SkeletonLine width={108} lineHeight={16} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[0, 1, 2, 3].map((key) => <SkeletonBlock key={key} width="auto" height={58} radius={radius.md} style={{ flex: 1 }} />)}
        </View>
      </GlassSurface>

      <SkeletonSection action count subtitleWidth="46%">
        <SkeletonSignalRail titleLines={1} />
      </SkeletonSection>

      <SkeletonSection action titleWidth={84} subtitleWidth="62%">
        <SkeletonStatGrid />
      </SkeletonSection>

      <SkeletonSection action titleWidth={132} subtitleWidth="86%">
        {[0, 1, 2].map((key) => <SkeletonRow key={key} trailing />)}
      </SkeletonSection>
    </SkeletonGroup>
  );
}
