import { View } from 'react-native';

import { SkeletonBlock, SkeletonGroup, SkeletonLine } from '@/components/data/Skeleton';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { useTheme } from '@/lib/app-state';
import { SkeletonSection, SkeletonTitleLines } from './parts';

const BUTTON_HEIGHT = 48;
const ICON_TILE_LG = 48;
const GROUP_GAP = 22;
/*
 * The loading Screen has no title (an empty one leaves the header at the 44pt back button); a typical subject (<= ~60 chars,
 * 3 display lines) pushes the content down ~55pt (device-measured). One bar fills the top of that; the rest is breathing room.
 */
const TITLE_EXTRA_LINES = 1;
const TITLE_TRIM = -21;
const BODY_LINES = ['100%', '100%', '94%', '100%', '88%', '100%', '56%'] as const;

/** Correo: the sender card (large tile, "Recibido por", source, tag, date), the body and the related-search button. */
export function EmailDetailSkeleton() {
  const { spacing } = useTheme();
  return (
    <SkeletonGroup style={{ gap: GROUP_GAP }}>
      <SkeletonTitleLines lines={TITLE_EXTRA_LINES} gap={GROUP_GAP} trim={TITLE_TRIM} />
      <GlassSurface level="strong" padding="lg" contentStyle={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <SkeletonBlock width={ICON_TILE_LG} height={ICON_TILE_LG} radius={16} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <SkeletonLine width="38%" lineHeight={14} />
            <SkeletonLine width="64%" lineHeight={23} />
          </View>
          <SkeletonBlock width={72} height={24} radius={999} />
        </View>
        <SkeletonLine width="46%" lineHeight={16} />
      </GlassSurface>

      <SkeletonSection titleWidth={92} subtitle={false}>
        <GlassSurface level="thin" padding="md">
          {BODY_LINES.map((width, index) => <SkeletonLine key={index} width={width} lineHeight={21} />)}
        </GlassSurface>
      </SkeletonSection>

      <SkeletonBlock height={BUTTON_HEIGHT} radius={999} />
    </SkeletonGroup>
  );
}
