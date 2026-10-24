import { View } from 'react-native';

import { SkeletonBlock, SkeletonGroup, SkeletonLine } from '@/components/data/Skeleton';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { useTheme } from '@/lib/app-state';

/*
 * The swipe card of a decision while the queue loads: kind tag and confidence over the topic, the question
 * (22/28 headline), the impact line, three answer tiles and the two action buttons, in the DecisionCard's box.
 * It fills its parent like the live card does; the screen gives it the same cardArea (flex and max height).
 */

/** Answer tile and action button heights are the theme's: answerTarget (52) for both, as in DecisionCard. */
export function ReviewSessionSkeleton() {
  const { layout, radius, spacing } = useTheme();
  return (
    <SkeletonGroup containerStyle={{ flex: 1 }} style={{ flex: 1 }}>
      <GlassSurface level="strong" tone="review" padding="lg" style={{ flex: 1 }} contentStyle={{ gap: 14, flexGrow: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <SkeletonBlock width={72} height={24} radius={999} />
            <SkeletonBlock width={44} height={18} radius={9} />
          </View>
          <SkeletonLine width={64} lineHeight={14} />
        </View>

        <View>
          <SkeletonLine lineHeight={28} />
          <SkeletonLine width="68%" lineHeight={28} />
        </View>
        <SkeletonLine width="56%" lineHeight={16} />

        <View style={{ gap: 8 }}>
          {[0, 1, 2].map((key) => <SkeletonBlock key={key} height={layout.answerTarget} radius={radius.md} />)}
        </View>

        <View style={{ flex: 1, minHeight: 0 }} />
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
          <View style={{ flex: 1 }}><SkeletonBlock height={layout.answerTarget} radius={999} /></View>
          <View style={{ flex: 1 }}><SkeletonBlock height={layout.answerTarget} radius={999} /></View>
        </View>
      </GlassSurface>
    </SkeletonGroup>
  );
}
