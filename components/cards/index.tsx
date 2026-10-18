import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Surface } from '@/components/primitives';
import { ConfidenceTier, ProvenanceMark } from '@/components/trust';
import { useTheme } from '@/lib/app-state';
import { DigestSummary, InsightSummary, SummaryMetric } from '@/lib/domain';
import { cleanDisplayText } from '@/lib/format';

export function MetricCard({ metric, onPress }: { metric: SummaryMetric; onPress?: () => void }) {
  const theme = useTheme();
  const toneColor = metric.tone === 'positive' ? theme.colors.success : metric.tone === 'warning' ? theme.colors.warning : metric.tone === 'danger' ? theme.colors.danger : theme.colors.textMuted;

  return (
    <Pressable accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={onPress ? metric.label : undefined} onPress={onPress} style={{ flex: 1 }}>
      <Surface variant="raised" style={{ minHeight: 92, justifyContent: 'space-between', borderColor: toneColor + '33' }}>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{cleanDisplayText(metric.label)}</Text>
        <Text style={[theme.typography.numeral, { color: theme.colors.textPrimary, fontSize: 24, lineHeight: 30 }]}>{cleanDisplayText(metric.value)}</Text>
        {metric.delta ? <Text style={[theme.typography.caption, { color: toneColor }]}>{cleanDisplayText(metric.delta)}</Text> : null}
      </Surface>
    </Pressable>
  );
}

export const MoneyMetric = MetricCard;

export function InsightCard({ insight, onPress }: { insight: InsightSummary; onPress?: () => void }) {
  const theme = useTheme();
  const title = cleanDisplayText(insight.title);
  const summary = cleanDisplayText(insight.summary);
  const repeatsTitle = summary.toLocaleLowerCase() === title.toLocaleLowerCase();
  const takeaways = Array.from(
    new Set(
      insight.takeaways
        .map((takeaway) => cleanDisplayText(takeaway))
        .filter((takeaway) => Boolean(takeaway) && takeaway !== cleanDisplayText(insight.summary) && takeaway !== cleanDisplayText(insight.title))
    )
  );

  return (
    <Pressable accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={onPress ? insight.title : undefined} onPress={onPress} style={{ marginBottom: theme.spacing.sm }}>
      <Surface variant="raised" style={{ gap: theme.spacing.sm, borderLeftWidth: 2, borderLeftColor: theme.colors.model }}>
        <View style={styles.rowBetween}>
          <ProvenanceMark origin="model" label="Perspectiva" />
          <ConfidenceTier confidence={insight.confidence} />
        </View>
        <View style={styles.rowBetween}>
          <Text style={[theme.typography.headline, { color: theme.colors.textPrimary, flex: 1 }]}>{title}</Text>
          <Feather name="arrow-up-right" size={16} color={theme.colors.accentStrong} />
        </View>
        {!repeatsTitle ? <Text numberOfLines={3} style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{summary}</Text> : null}
        {takeaways[0] ? <Text numberOfLines={2} style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{takeaways[0]}</Text> : null}
      </Surface>
    </Pressable>
  );
}

export const InsightArticleCard = InsightCard;

export function DigestCard({ digest, onPress }: { digest: DigestSummary; onPress?: () => void }) {
  const theme = useTheme();

  return (
    <Pressable accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={onPress ? digest.title : undefined} onPress={onPress} style={{ marginBottom: theme.spacing.sm }}>
      <Surface variant="raised" style={{ gap: theme.spacing.sm, borderLeftWidth: 2, borderLeftColor: theme.colors.model }}>
        <ProvenanceMark origin="model" label="Resumen" />
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{cleanDisplayText(digest.windowLabel)}</Text>
            <Text style={[theme.typography.headline, { color: theme.colors.textPrimary, marginTop: 4 }]}>{cleanDisplayText(digest.title)}</Text>
          </View>
          <Feather name="calendar" size={16} color={theme.colors.accentStrong} />
        </View>
        <Text numberOfLines={3} style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{cleanDisplayText(digest.summary)}</Text>
        {digest.metrics?.length ? <Text style={[theme.typography.mono, { color: theme.colors.textMuted }]}>{digest.metrics.slice(0, 3).map((metric) => `${cleanDisplayText(metric.label)} ${cleanDisplayText(metric.value)}`).join('  ·  ')}</Text> : null}
      </Surface>
    </Pressable>
  );
}

export const DigestSummaryCard = DigestCard;

function MiniBarChart({ values }: { values: number[] }) {
  const theme = useTheme();
  const visibleValues = values.slice(-8);
  const normalizedValues = visibleValues.map((value) => Math.abs(value));
  const max = Math.max(...normalizedValues, 1);

  return (
    <View style={[styles.row, { alignItems: 'flex-end', gap: 5, height: 46 }]}>
      {normalizedValues.map((value, index) => (
        <View key={`${index}-${value}`} style={{ flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' }}>
          <View
            style={{
              width: '54%',
              height: `${Math.max(12, (value / max) * 100)}%`,
              backgroundColor: visibleValues[index] < 0 ? theme.status.expense : index === visibleValues.length - 1 ? theme.colors.accent : theme.colors.surfaceSubtle,
              borderRadius: 7,
            }}
          />
        </View>
      ))}
    </View>
  );
}

export function FinancialSnapshotCard({
  title,
  periodLabel,
  amount,
  amountTone = 'accent',
  chartValues,
  onPress,
  onBadgePress,
}: {
  title: string;
  periodLabel: string;
  amount?: string;
  amountTone?: 'accent' | 'income' | 'expense' | 'neutral';
  chartValues?: number[];
  onPress?: () => void;
  onBadgePress?: () => void;
}) {
  const theme = useTheme();
  const amountColor =
    amountTone === 'income'
      ? theme.status.income
      : amountTone === 'expense'
        ? theme.status.expense
        : amountTone === 'neutral'
          ? theme.colors.textPrimary
          : amount?.includes('-')
            ? theme.status.expense
            : theme.colors.accent;
  const content = (
    <Surface variant="raised" style={{ borderColor: theme.colors.accent + '44', gap: theme.spacing.md }}>
      <View style={styles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{cleanDisplayText(periodLabel)}</Text>
          <Text style={[theme.typography.headline, { color: theme.colors.textPrimary, marginTop: 4, fontSize: 22, lineHeight: 28 }]}>{cleanDisplayText(title)}</Text>
        </View>
        {onBadgePress ? <Pressable accessibilityRole="button" accessibilityLabel="Ver explicación del cálculo" onPress={onBadgePress}><Feather name="info" size={18} color={theme.colors.textMuted} /></Pressable> : null}
      </View>
      {amount ? (
        <Text style={[theme.typography.numeral, { color: amountColor }]}>
          {cleanDisplayText(amount)}
        </Text>
      ) : null}
      {chartValues && chartValues.length > 1 ? (
        <View style={{ paddingTop: theme.spacing.xs }}>
          <MiniBarChart values={chartValues} />
        </View>
      ) : null}
    </Surface>
  );

  if (!onPress) {
    return <View style={{ marginBottom: theme.spacing.sm }}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${periodLabel}: ${amount ? `${amount}, ` : ''}${title}`}
      onPress={onPress}
      style={{ marginBottom: theme.spacing.sm }}
    >
      {content}
    </Pressable>
  );
}

export const FinanceOverview = FinancialSnapshotCard;

export function TodayFinanceSnapshot({
  income,
  expenses,
  net,
  onPress,
}: {
  income: string;
  expenses: string;
  net: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const netIsPositive = !net.trim().startsWith('-');

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Money this month. Net ${net}.`} onPress={onPress} style={{ marginBottom: theme.spacing.sm }}>
      <Surface variant="raised" style={{ borderColor: theme.colors.accent + '55', gap: theme.spacing.sm }}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Dinero en este ciclo</Text>
            <Text style={[theme.typography.numeral, { color: netIsPositive ? theme.colors.accent : theme.status.expense, marginTop: 3 }]}>{cleanDisplayText(net)}</Text>
          </View>
          <Feather name="arrow-up-right" size={18} color={theme.colors.accentStrong} />
        </View>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <View style={[styles.financeMetric, { borderColor: theme.status.income + '33', backgroundColor: theme.status.income + '0d' }]}>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Ingresos</Text>
            <Text style={[theme.typography.bodyStrong, { color: theme.status.income, marginTop: 3, fontVariant: ['tabular-nums'] }]}>{cleanDisplayText(income)}</Text>
          </View>
          <View style={[styles.financeMetric, { borderColor: theme.status.expense + '33', backgroundColor: theme.status.expense + '0d' }]}>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Gastado</Text>
            <Text style={[theme.typography.bodyStrong, { color: theme.status.expense, marginTop: 3, fontVariant: ['tabular-nums'] }]}>{cleanDisplayText(expenses)}</Text>
          </View>
        </View>
      </Surface>
    </Pressable>
  );
}

export function SummaryGrid({ metrics }: { metrics: SummaryMetric[] }) {
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.rowWrap}>
        {metrics.slice(0, 4).map((metric) => (
          <View key={metric.label} style={{ minWidth: '47%', flex: 1 }}>
            <MetricCard metric={metric} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  cardSignal: {
    width: 28,
    height: 3,
    borderRadius: 999,
    marginBottom: 12,
  },
  financeGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 999,
    right: -82,
    top: -72,
  },
  financeMetric: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
});
