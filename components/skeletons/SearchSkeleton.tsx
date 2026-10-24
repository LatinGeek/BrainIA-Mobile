import { View } from 'react-native';

import { SkeletonBlock, SkeletonGroup, SkeletonLine } from '@/components/data/Skeleton';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { GRAPH_MAP_HEIGHT } from '@/components/knowledge/GraphExplorer';
import { useTheme } from '@/lib/app-state';
import { SkeletonChips, SkeletonRow, SkeletonSignalCard } from './parts';

/*
 * Explorar loads in independent pieces under a search field and chips that are always on screen, so the
 * skeletons here are per section rather than one for the whole view.
 */

/** "Tus conexiones": the interactive map card with its toggles, canvas and community chips. */
export function SearchMapSkeleton() {
  const { radius } = useTheme();
  return (
    <SkeletonGroup>
      <GlassSurface level="regular" tone="accent" padding="md" contentStyle={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <SkeletonLine width="42%" lineHeight={21} />
            <SkeletonLine lineHeight={16} />
            <SkeletonLine lineHeight={16} />
            <SkeletonLine width="48%" lineHeight={16} />
          </View>
          <SkeletonBlock width={64} height={24} radius={999} />
        </View>
        <SkeletonChips widths={[148, 92]} />
        <View style={{ gap: 8 }}>
          <View>
            <SkeletonLine lineHeight={16} />
            <SkeletonLine lineHeight={16} />
            <SkeletonLine width="30%" lineHeight={16} />
          </View>
          <SkeletonBlock height={GRAPH_MAP_HEIGHT} radius={radius.lg} />
          <SkeletonLine width="80%" lineHeight={16} style={{ alignSelf: 'center' }} />
          <SkeletonChips widths={[96, 120, 84]} />
        </View>
        <SkeletonBlock height={44} radius={999} />
      </GlassSurface>
    </SkeletonGroup>
  );
}

/** "Actividad reciente": two signal cards and three movements. */
export function SearchRecentSkeleton() {
  return (
    <SkeletonGroup style={{ gap: 10 }}>
      <SkeletonSignalCard />
      <SkeletonSignalCard />
      {[0, 1, 2].map((key) => <SkeletonRow key={key} trailing />)}
    </SkeletonGroup>
  );
}

/** "Mejor coincidencia": the accent result card. */
export function SearchTopMatchSkeleton() {
  return (
    <SkeletonGroup>
      <GlassSurface level="regular" tone="accent" padding="lg" contentStyle={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <SkeletonLine width="60%" lineHeight={23} />
            <SkeletonLine width="72%" lineHeight={21} />
          </View>
          <SkeletonBlock width={84} height={24} radius={999} />
        </View>
        <SkeletonLine width="82%" lineHeight={16} />
        <SkeletonBlock height={48} radius={999} />
      </GlassSurface>
    </SkeletonGroup>
  );
}

/** "Resultados agrupados": a cluster card with its first rows. */
export function SearchClustersSkeleton() {
  return (
    <SkeletonGroup>
      <GlassSurface level="thin" padding="md" contentStyle={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <SkeletonLine width="48%" lineHeight={21} />
            <SkeletonLine width="66%" lineHeight={16} />
          </View>
          <SkeletonBlock width={30} height={24} radius={999} />
        </View>
        {[0, 1, 2].map((key) => <SkeletonRow key={key} lines={3} />)}
      </GlassSurface>
    </SkeletonGroup>
  );
}
