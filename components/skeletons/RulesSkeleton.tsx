import { StyleSheet, View } from 'react-native';

import { ROW_METRICS } from '@/components/data/Row';
import { SkeletonBlock, SkeletonGroup, SkeletonLine } from '@/components/data/Skeleton';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { useTheme } from '@/lib/app-state';
import { SkeletonChips, SkeletonParagraph } from './parts';

export const RULE_SWITCH_SIZE = { width: 36, height: 22 } as const;

/*
 * A rule's condition line ("Si viene de PedidosYa y la moneda es incierta", describeConditions) wraps beside the tile and
 * switch at 390dp: a source-only rule fits one bodyStrong line (the row then sits at its minimum height), a rule with a
 * second condition takes two and a third condition three. The result line is one caption. A typical list is four rules
 * of 1, 2, 1 and 2 lines (measured on a real list), so the rows cycle through that mix instead of repeating the average (the one-line row's
 * minimum height and the three-line row do not cancel out at two lines each).
 */
const RULE_TITLE_LINES = [1, 2, 1, 2] as const;
// Measured on a real list: the result line wraps to a second caption only on the category rule with the long name.
const RULE_RESULT_LINES = [1, 2, 1, 1] as const;
const RULE_COUNT = RULE_TITLE_LINES.length;

/** A rule row: action tile, condition over its result, and the on/off switch. */
function RuleRowSkeleton({ titleLines, resultLines }: { titleLines: number; resultLines: number }) {
  return (
    <View style={styles.row}>
      <SkeletonBlock width={38} height={38} radius={12} style={{ marginRight: 12 }} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <SkeletonParagraph lines={titleLines} lastWidth="78%" />
        <View>
          {Array.from({ length: resultLines }).map((_, index) => <SkeletonLine key={index} width={index === resultLines - 1 ? '48%' : undefined} lineHeight={16} />)}
        </View>
      </View>
      <SkeletonBlock width={RULE_SWITCH_SIZE.width} height={RULE_SWITCH_SIZE.height} radius={RULE_SWITCH_SIZE.height / 2} style={{ marginLeft: 12 }} />
    </View>
  );
}

/** "Tus reglas" while the on-device rules load: the card of rows, in the list's own padding and gaps. */
export function RulesListSkeleton({ count = RULE_COUNT }: { count?: number }) {
  const { spacing } = useTheme();
  return (
    <SkeletonGroup label="Cargando tus reglas">
      <GlassSurface level="thin" padding="sm" contentStyle={{ gap: spacing.xs }}>
        {Array.from({ length: count }).map((_, index) => <RuleRowSkeleton key={index} titleLines={RULE_TITLE_LINES[index % RULE_TITLE_LINES.length]} resultLines={RULE_RESULT_LINES[index % RULE_RESULT_LINES.length]} />)}
      </GlassSurface>
    </SkeletonGroup>
  );
}

/** The account picker's chips while the accounts load in the editor sheet. */
export function RulesAccountsSkeleton() {
  return (
    <SkeletonGroup label="Cargando tus cuentas">
      <View style={{ gap: 8 }}>
        <SkeletonChips widths={[96, 128, 88]} />
        <SkeletonChips widths={[124, 108, 92]} />
        <SkeletonChips widths={[92, 132, 100]} />
        <SkeletonChips widths={[116, 100]} />
      </View>
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: ROW_METRICS.contentMinHeight + ROW_METRICS.paddingVertical * 2 + StyleSheet.hairlineWidth,
    paddingVertical: ROW_METRICS.paddingVertical,
    paddingHorizontal: ROW_METRICS.paddingHorizontal,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
  },
});
