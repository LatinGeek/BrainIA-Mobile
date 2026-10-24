import { StyleSheet, View } from 'react-native';

import { ROW_METRICS } from '@/components/data/Row';
import { SkeletonBlock, SkeletonGroup, SkeletonLine } from '@/components/data/Skeleton';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { useTheme } from '@/lib/app-state';

/** Connection status line (caption, 16): shown in place of "Comprobando conexión…" in Avanzado. */
export function SettingsHealthSkeleton() {
  return (
    <SkeletonGroup label="Comprobando conexión">
      <SkeletonLine width="46%" lineHeight={16} />
    </SkeletonGroup>
  );
}

/**
 * The notification-capture card before the bridge reports. It models the "access disabled" state measured on the
 * user's device: access row (tile, title over a two-line status beside the tag), a ONE-line consent caption, the
 * one-line last-read caption and the four small buttons wrapping as they do live. The "comprobadas por última vez"
 * caption only appears after a manual check, so it is left out.
 * Connected-state numbers (for reference, not modelled): status two lines because it carries a date, consent caption
 * two lines at 390dp (a second line at width 38% instead of the single 92% line), last-read one line. That state is
 * 16dp taller than this skeleton.
 */
export function SettingsBridgeSkeleton() {
  const { layout, spacing } = useTheme();
  return (
    <SkeletonGroup label="Comprobando el acceso a notificaciones">
      <GlassSurface level="thin" padding="md" contentStyle={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <SkeletonBlock width={38} height={38} radius={12} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <SkeletonLine width="56%" lineHeight={21} />
            <View>
              <SkeletonLine lineHeight={16} />
              <SkeletonLine width="64%" lineHeight={16} />
            </View>
          </View>
          <SkeletonBlock width={84} height={24} radius={999} />
        </View>
        <SkeletonLine width="92%" lineHeight={16} />
        <SkeletonLine width="86%" lineHeight={16} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {[138, 112, 142, 148].map((width, index) => <SkeletonBlock key={index} width={width} height={layout.minTarget} radius={999} />)}
        </View>
      </GlassSurface>
    </SkeletonGroup>
  );
}

/** The installed-apps list of the capture sheet: rows of name over package, with the switch. */
export function SettingsAppsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <SkeletonGroup label="Buscando aplicaciones instaladas">
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={[styles.row, { minHeight: 76 }]}>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <SkeletonLine width={index % 2 ? '44%' : '58%'} lineHeight={21} />
            <SkeletonLine width={index % 2 ? '62%' : '70%'} lineHeight={16} />
          </View>
          <SkeletonBlock width={36} height={22} radius={11} style={{ marginLeft: 12 }} />
        </View>
      ))}
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: ROW_METRICS.contentMinHeight + ROW_METRICS.paddingVertical * 2,
    paddingVertical: ROW_METRICS.paddingVertical,
    paddingHorizontal: ROW_METRICS.paddingHorizontal,
  },
});
