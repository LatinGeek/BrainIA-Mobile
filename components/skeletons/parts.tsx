import { ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { ROW_METRICS, heroAmountLineHeight, tileAmountSize } from '@/components/data/Row';
import { SIGNAL_BRIEF_MIN_HEIGHT, signalCardWidth } from '@/components/data/SignalCard';
import { SkeletonBlock, SkeletonLine } from '@/components/data/Skeleton';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { useTheme } from '@/lib/app-state';
import { screenGutter } from '@/lib/screen-metrics';

/*
 * Pieces shared by the per-view skeletons. Each mirrors the real component it stands for (same surface level,
 * padding, gaps and line heights), so the content that replaces it lands on the same layout.
 * Line heights are the theme typography's: caption 16, body 21, bodyStrong 21, headline 23, overline 14.
 */

/** Section title block: headline over caption, with the action on the right. */
export function SkeletonSectionHeader({ subtitle = true, action = false, count = false, titleWidth = 120, subtitleWidth = '70%', subtitleLines = 1 }: {
  subtitle?: boolean;
  action?: boolean;
  /** The title carries a count tag (24pt tall, taller than the title line). */
  count?: boolean;
  titleWidth?: number;
  subtitleWidth?: `${number}%` | number;
  /** The subtitle wraps: full-width caption lines, the last one at `subtitleWidth`. */
  subtitleLines?: number;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1, gap: 3 }}>
        {count ? (
          <View style={{ minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <SkeletonLine width={titleWidth} lineHeight={23} />
            <SkeletonBlock width={30} height={24} radius={999} />
          </View>
        ) : <SkeletonLine width={titleWidth} lineHeight={23} />}
        {subtitle ? (
          <View>
            {Array.from({ length: subtitleLines }).map((_, index) => <SkeletonLine key={index} width={index === subtitleLines - 1 ? subtitleWidth : undefined} lineHeight={16} />)}
          </View>
        ) : null}
      </View>
      {action ? <View style={{ minHeight: 44, justifyContent: 'center' }}><SkeletonBlock width={86} height={14} radius={7} /></View> : null}
    </View>
  );
}

/** A Section: header, then children, at the Section's own gaps. */
export function SkeletonSection({ children, ...header }: { children: ReactNode } & Parameters<typeof SkeletonSectionHeader>[0]) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <SkeletonSectionHeader {...header} />
      <View style={{ gap: spacing.sm }}>{children}</View>
    </View>
  );
}

/**
 * A Row (icon tile, text lines, optional trailing amount) at the Row's own box. `titleLines` stacks body-height
 * lines for a title that wraps (the last one short), in place of the single title line.
 */
export function SkeletonRow({ lines = 2, titleLines = 1, leading = true, trailing = false }: { lines?: 1 | 2 | 3 | 4; titleLines?: 1 | 2 | 3 | 4; leading?: boolean; trailing?: boolean }) {
  return (
    <View style={styles.row}>
      {leading ? <SkeletonBlock width={38} height={38} radius={12} style={{ marginRight: 12 }} /> : null}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View>
          {Array.from({ length: titleLines }).map((_, index) => <SkeletonLine key={index} width={index === titleLines - 1 ? '62%' : undefined} lineHeight={21} />)}
        </View>
        {lines >= 2 ? <SkeletonLine width="44%" lineHeight={16} /> : null}
        {lines >= 3 ? <SkeletonLine width={lines >= 4 ? undefined : '76%'} lineHeight={16} /> : null}
        {lines >= 4 ? <SkeletonLine width="58%" lineHeight={16} /> : null}
      </View>
      {trailing ? (
        <View style={{ marginLeft: 12, alignItems: 'flex-end', gap: 0 }}>
          <SkeletonLine width={70} lineHeight={20} />
          <SkeletonLine width={28} lineHeight={14} />
        </View>
      ) : null}
    </View>
  );
}

/** Body-height text lines for a paragraph that wraps: full-width lines and a short last one. */
export function SkeletonParagraph({ lines, lastWidth = '62%' }: { lines: number; lastWidth?: `${number}%` }) {
  return (
    <View>
      {Array.from({ length: lines }).map((_, index) => <SkeletonLine key={index} width={index === lines - 1 ? lastWidth : undefined} lineHeight={21} />)}
    </View>
  );
}

/**
 * The title block a loaded screen wraps onto more display lines than its loading title has: reserves them below the
 * subtitle and cancels the group's gap so the content lands where it will once the title arrives. `trim` pulls the
 * content up further when the loaded subtitle is shorter than the loading one.
 */
export function SkeletonTitleLines({ lines, gap, trim = 0 }: { lines: number; gap: number; trim?: number }) {
  return (
    <View style={{ marginBottom: -(gap + trim) }}>
      {Array.from({ length: lines }).map((_, index) => <SkeletonLine key={index} width={index === lines - 1 ? '46%' : '88%'} lineHeight={34} />)}
    </View>
  );
}

/**
 * SignalCard: provenance tag, title, summary. `brief` is the 132pt-minimum card of rails and short lists.
 * A `card` standing for a loaded `block` (a detail screen's lead card) can say its real shape: `titleLines={1}` for
 * the fixed one-line block title and `summaryLines` for the wrapped summary.
 */
export function SkeletonSignalCard({ variant = 'brief', width, titleLines = 2, summaryLines }: { variant?: 'brief' | 'card'; width?: number; titleLines?: 1 | 2; summaryLines?: number }) {
  const dense = variant === 'brief';
  const summary = summaryLines ?? (dense ? 2 : 3);
  return (
    <GlassSurface
      level="regular"
      tone="model"
      padding={dense ? 'md' : 'lg'}
      style={width ? { width } : undefined}
      contentStyle={{ gap: dense ? 8 : 12, minHeight: dense ? SIGNAL_BRIEF_MIN_HEIGHT : undefined }}
    >
      <View style={styles.between}>
        <SkeletonBlock width={76} height={24} radius={999} />
        <SkeletonBlock width={dense ? 18 : 64} height={dense ? 14 : 16} radius={6} />
      </View>
      {titleLines === 1 ? (
        <SkeletonLine width="64%" lineHeight={dense ? 22 : 25} />
      ) : (
        <View style={{ gap: 0 }}>
          <SkeletonLine lineHeight={22} />
          <SkeletonLine width="72%" lineHeight={22} />
        </View>
      )}
      <View style={{ gap: 0 }}>
        {Array.from({ length: summary }).map((_, index) => (
          <SkeletonLine key={index} width={index === summary - 1 ? (dense ? '58%' : summary === 3 ? '46%' : '84%') : index === summary - 2 && !dense && summary === 3 ? '84%' : undefined} lineHeight={21} />
        ))}
      </View>
    </GlassSurface>
  );
}

/** The highlights rail: cards at the rail's width, the next one peeking off the screen edge. */
export function SkeletonSignalRail({ count = 2, titleLines }: { count?: number; titleLines?: 1 | 2 }) {
  const { width } = useWindowDimensions();
  const { spacing } = useTheme();
  const gutter = screenGutter(width);
  const cardWidth = count > 1 ? signalCardWidth(width, spacing.sm) : width - gutter * 2;
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, overflow: 'hidden', marginHorizontal: -gutter, paddingLeft: gutter }}>
      {Array.from({ length: count }).map((_, index) => <SkeletonSignalCard key={index} width={cardWidth} titleLines={titleLines} />)}
    </View>
  );
}

const TYPICAL_TILE_AMOUNT_LENGTH = 11;

/** StatTile in a StatGrid. */
export function SkeletonStatGrid({ count = 2 }: { count?: number }) {
  const { spacing } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  // A typical tile numeral ("$ 90.771,56") sets the amount line's height, as the real tile's own sizing does.
  const amountLineHeight = Math.round(tileAmountSize(width, fontScale >= 1.3, TYPICAL_TILE_AMOUNT_LENGTH) * 1.25);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={{ width: `${100 / 2 - 2}%`, flexGrow: 1 }}>
          <GlassSurface level="regular" padding="md" style={{ flex: 1 }} contentStyle={{ gap: 6 }}>
            <SkeletonLine width="50%" lineHeight={14} />
            <SkeletonLine width="74%" lineHeight={amountLineHeight} />
          </GlassSurface>
        </View>
      ))}
    </View>
  );
}

/** SegmentedControl track: 38pt segments in 4pt padding, or 28pt in 3pt for `mini`. */
export function SkeletonSegmented({ size = 'default', width = '100%' }: { size?: 'default' | 'mini'; width?: number | `${number}%` }) {
  const mini = size === 'mini';
  return <SkeletonBlock width={width} height={(mini ? 28 : 38) + (mini ? 6 : 8)} radius={999} />;
}

/** A row of Chips (34pt). */
export function SkeletonChips({ widths }: { widths: number[] }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, overflow: 'hidden' }}>
      {widths.map((chip, index) => <SkeletonBlock key={index} width={chip} height={34} radius={999} />)}
    </View>
  );
}

/** TrendChart card: title/action, legend, plot. */
export function SkeletonChartCard({ height = 180, legend = true, action = false }: { height?: number; legend?: boolean; action?: boolean }) {
  const { radius } = useTheme();
  return (
    <GlassSurface level="regular" padding="md" contentStyle={{ gap: 10 }}>
      <View style={styles.between}>
        <View style={{ flex: 1, gap: 2 }}>
          <SkeletonLine width="48%" lineHeight={23} />
          <SkeletonLine width="32%" lineHeight={16} />
        </View>
        {action ? <SkeletonSegmented size="mini" width={96} /> : null}
      </View>
      {legend ? (
        <View style={{ flexDirection: 'row', gap: 18 }}>
          {[0, 1].map((key) => (
            <View key={key} style={{ gap: 2 }}>
              <SkeletonLine width={56} lineHeight={16} />
              <SkeletonLine width={78} lineHeight={21} />
            </View>
          ))}
        </View>
      ) : null}
      <SkeletonBlock height={height} radius={radius.md} />
    </GlassSurface>
  );
}

/** The net-amount hero card of Hoy and Dinero: caption pair, amount and a footer slot. */
export function SkeletonHeroAmount() {
  const { width, fontScale } = useWindowDimensions();
  return <SkeletonLine width="58%" lineHeight={heroAmountLineHeight(width, fontScale >= 1.3)} />;
}

/** The dial's ring, in the MixCard's geometry (a 240 box, radius 92, 18 stroke), with centre text placeholders. */
export function SkeletonDial() {
  const theme = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const size = Math.round(Math.min(268, Math.max(204, width - (fontScale >= 1.3 ? 76 : 92))));
  const scale = size / 240;
  const r = 92 * scale;
  const circumference = 2 * Math.PI * r;
  const segments = 5;
  const gap = 7 * scale;
  const dash = circumference / segments - gap;
  const disc = size * 0.61;
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.glass.divider} strokeWidth={18 * scale} strokeLinecap="round" fill="none" strokeDasharray={`${dash} ${circumference / segments - dash}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        </Svg>
        <View style={{ width: disc, alignItems: 'center', gap: 4 }}>
          <SkeletonLine width="46%" lineHeight={14} />
          <SkeletonLine width="78%" lineHeight={29} />
          <SkeletonBlock width="60%" height={22} radius={999} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: ROW_METRICS.contentMinHeight + ROW_METRICS.paddingVertical * 2,
    paddingVertical: ROW_METRICS.paddingVertical,
    paddingHorizontal: ROW_METRICS.paddingHorizontal,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
  },
});
