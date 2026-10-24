import { View } from 'react-native';

import { SkeletonBlock, SkeletonGroup, SkeletonLine } from '@/components/data/Skeleton';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { SkeletonChartCard, SkeletonDial, SkeletonHeroAmount, SkeletonRow, SkeletonSection, SkeletonSegmented } from './parts';

/** Dinero (Resumen) while its first load runs: view and currency switches, spending dial, net card, accounts, cash flow, activity. */
export function FinancialsSkeleton() {
  return (
    <SkeletonGroup style={{ gap: 22 }}>
      <View style={{ gap: 8 }}>
        <SkeletonSegmented />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <View style={{ flex: 1 }} />
          <SkeletonSegmented size="mini" width={104} />
        </View>
      </View>

      <GlassSurface level="regular" padding="lg" contentStyle={{ gap: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <SkeletonLine width="52%" lineHeight={14} />
            <SkeletonLine width="68%" lineHeight={23} />
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <SkeletonSegmented size="mini" width={72} />
            <SkeletonLine width={54} lineHeight={16} />
          </View>
        </View>
        <SkeletonDial />
        <View style={{ gap: 2, marginHorizontal: -8 }}>
          {[0, 1, 2, 3].map((key) => (
            <View key={key} style={{ minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6, paddingHorizontal: 8 }}>
              <SkeletonBlock width={6} height={26} radius={3} />
              <View style={{ flex: 1, gap: 4 }}>
                <SkeletonLine width="44%" lineHeight={16} />
                <SkeletonBlock height={5} radius={3} width={`${86 - key * 16}%`} />
              </View>
              <SkeletonLine width={64} lineHeight={20} />
            </View>
          ))}
        </View>
      </GlassSurface>

      <GlassSurface level="strong" tone="finance" padding="lg" contentStyle={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <SkeletonLine width="48%" lineHeight={14} />
            <SkeletonLine width="62%" lineHeight={23} />
          </View>
          <SkeletonSegmented size="mini" width={96} />
        </View>
        <SkeletonHeroAmount />
        <View style={{ flexDirection: 'row', gap: 18 }}>
          {[0, 1].map((key) => (
            <View key={key} style={{ gap: 2 }}>
              <SkeletonLine width={58} lineHeight={14} />
              <SkeletonLine width={88} lineHeight={21} />
            </View>
          ))}
        </View>
      </GlassSurface>

      <SkeletonSection action titleWidth={72} subtitleWidth="74%">
        <GlassSurface level="thin" padding="md" contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <SkeletonBlock width={38} height={38} radius={12} />
          <View style={{ flex: 1, gap: 2 }}>
            <SkeletonLine width="42%" lineHeight={14} />
            <SkeletonLine width="58%" lineHeight={23} />
          </View>
          <SkeletonLine width={52} lineHeight={16} />
        </GlassSurface>
        {[0, 1].map((key) => (
          <GlassSurface key={key} level="thin" padding="none" contentStyle={{ minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingLeft: 15, paddingRight: 10, paddingVertical: 8, gap: 10 }}>
            <SkeletonBlock width={48} height={48} radius={15} />
            <View style={{ flex: 1, gap: 2 }}>
              <SkeletonLine width="56%" lineHeight={21} />
              <SkeletonLine width="70%" lineHeight={16} />
            </View>
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <SkeletonLine width={84} lineHeight={21} />
              <SkeletonLine width={52} lineHeight={16} />
            </View>
          </GlassSurface>
        ))}
      </SkeletonSection>

      <SkeletonSection titleWidth={104} subtitleWidth="72%">
        <SkeletonChartCard action />
      </SkeletonSection>

      <SkeletonSection action titleWidth={132} subtitleWidth="86%">
        {[0, 1, 2].map((key) => <SkeletonRow key={key} trailing />)}
      </SkeletonSection>
    </SkeletonGroup>
  );
}
