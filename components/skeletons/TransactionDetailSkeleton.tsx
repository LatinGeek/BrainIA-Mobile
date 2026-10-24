import { View, useWindowDimensions } from 'react-native';

import { heroAmountLineHeight } from '@/components/data/Row';
import { SkeletonBlock, SkeletonGroup, SkeletonLine } from '@/components/data/Skeleton';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { useTheme } from '@/lib/app-state';
import { SkeletonRow, SkeletonSection } from './parts';

/** Default Button height (the real one is minHeight 48). */
const BUTTON_HEIGHT = 48;
const FACT_COUNT = 4;

/** Movimiento: the hero card (tag, amount, facts), then Origen, Contexto, Explicación and Fuentes. */
export function TransactionDetailSkeleton() {
  const { layout } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  return (
    <SkeletonGroup style={{ gap: 22 }}>
      <GlassSurface level="strong" padding="lg" contentStyle={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <SkeletonBlock width={104} height={24} radius={999} />
          <SkeletonBlock width={layout.minTarget} height={layout.minTarget} radius={layout.minTarget / 2} />
        </View>
        <SkeletonLine width="58%" lineHeight={heroAmountLineHeight(width, fontScale >= 1.3)} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {Array.from({ length: FACT_COUNT }).map((_, index) => (
            <GlassSurface key={index} level="thin" padding="sm" radius="md" style={{ width: '48%', flexGrow: 1 }} contentStyle={{ gap: 2 }}>
              <SkeletonLine width="42%" lineHeight={14} />
              <SkeletonLine width="68%" lineHeight={16} />
            </GlassSurface>
          ))}
        </View>
      </GlassSurface>

      <SkeletonSection titleWidth={72} subtitleWidth="78%">
        <GlassSurface level="thin" padding="md" contentStyle={{ gap: 8 }}>
          <SkeletonRow lines={3} />
        </GlassSurface>
      </SkeletonSection>

      <SkeletonSection titleWidth={88} subtitleLines={2} subtitleWidth="36%">
        <SkeletonBlock height={BUTTON_HEIGHT} radius={999} />
      </SkeletonSection>

      <SkeletonSection titleWidth={96} subtitle={false}>
        <GlassSurface level="thin" padding="md" contentStyle={{ gap: 6 }}>
          <SkeletonLine width="64%" lineHeight={21} />
          <SkeletonLine lineHeight={16} />
          <SkeletonLine width="70%" lineHeight={16} />
        </GlassSurface>
      </SkeletonSection>

      <SkeletonSection titleWidth={72} subtitleWidth="46%">
        <SkeletonRow lines={3} />
        <SkeletonRow lines={3} />
      </SkeletonSection>
    </SkeletonGroup>
  );
}
