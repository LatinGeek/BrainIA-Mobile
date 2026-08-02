import { Feather } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { AccountBreakdown, CategoryBreakdown, ChartCard, TrendChart } from '@/components/charts';
import { FinanceOverview, FinancialSnapshotCard, InsightCard, MetricCard, MoneyMetric } from '@/components/cards';
import { Surface } from '@/components/primitives';
import { useAppState, useTheme } from '@/lib/app-state';
import { TransactionSummary } from '@/lib/domain';
import { cleanDisplayText, formatCurrency, joinDisplayParts, parseCurrency } from '@/lib/format';
import { presentEvidenceReason, presentObservedAt, presentTransactionSubtitle } from '@/lib/presentation';

export { AccountBreakdown, CategoryBreakdown, ChartCard, FinanceOverview, FinancialSnapshotCard, InsightCard as FinanceInsightCard, MetricCard, MoneyMetric, TrendChart };

export function TransactionRow({ transaction, onPress }: { transaction: TransactionSummary; onPress?: () => void }) {
  const theme = useTheme();
  const { settings } = useAppState();
  const subtitle = presentTransactionSubtitle(transaction, settings.dataVisibility);
  const merchantLabel = transaction.displayMerchantLabel ?? transaction.merchantLabel;

  const amountColor = transaction.kind === 'income' ? theme.status.income : transaction.kind === 'transfer' ? theme.status.transfer : theme.status.expense;

  return (
    <Pressable accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={onPress ? merchantLabel : undefined} onPress={onPress} style={{ marginBottom: theme.spacing.sm }}>
      <Surface variant="raised" padding="sm" style={{ borderColor: amountColor + '33' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md }}>
          <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: amountColor + '22', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: amountColor }} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{cleanDisplayText(merchantLabel)}</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 4 }]}>{subtitle}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[theme.typography.bodyStrong, { color: amountColor, fontVariant: ['tabular-nums'] }]}>{transaction.kind === 'transfer' ? '− ' : ''}{formatCurrency(parseCurrency(transaction.amount), transaction.currency)}</Text>
            {transaction.kind === 'transfer' && transaction.destinationAmount && transaction.destinationCurrency ? (
              <Text style={[theme.typography.caption, { color: theme.status.income, fontVariant: ['tabular-nums'] }]}>+ {formatCurrency(parseCurrency(transaction.destinationAmount), transaction.destinationCurrency)}</Text>
            ) : <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{transaction.currency}</Text>}
            {settings.dataVisibility !== 'essential' && transaction.evidenceCount ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{`${transaction.evidenceCount} source${transaction.evidenceCount === 1 ? '' : 's'}`}</Text> : null}
          </View>
          {onPress ? <Feather name="chevron-right" size={18} color={theme.colors.textMuted} /> : null}
        </View>
        {onPress ? <Text style={[theme.typography.caption, { color: theme.colors.accentStrong, marginTop: 8 }]}>Tap to inspect details</Text> : null}
      </Surface>
    </Pressable>
  );
}

export const TransactionListItem = TransactionRow;

export function EvidenceRow({
  source,
  kind,
  amount,
  merchantLabel,
  observedAt,
  matchReason,
  onPress,
}: {
  source: string;
  kind: string;
  amount?: string;
  merchantLabel?: string;
  observedAt?: string;
  matchReason?: string;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const { settings } = useAppState();
  const displayedSource = settings.dataVisibility === 'essential' ? source.replace(/event|notification|email|wallet/gi, 'source') : source;
  const displayedObservedAt = presentObservedAt(observedAt, settings.dataVisibility);
  const displayedReason = presentEvidenceReason(matchReason, settings.dataVisibility);

  const content = (
    <Surface variant="subtle" style={{ marginBottom: theme.spacing.sm, borderColor: onPress ? theme.colors.accent + '44' : undefined }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing.md }}>
        <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{cleanDisplayText(displayedSource)}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{cleanDisplayText(kind)}</Text>
          {onPress ? <Feather name="arrow-up-right" size={15} color={theme.colors.accentStrong} /> : null}
        </View>
      </View>
      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 4 }]}>{joinDisplayParts([merchantLabel || 'Merchant', amount])}</Text>
      {displayedObservedAt ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>{cleanDisplayText(displayedObservedAt)}</Text> : null}
      {displayedReason ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>{cleanDisplayText(displayedReason)}</Text> : null}
    </Surface>
  );

  if (!onPress) return content;

  return <Pressable accessibilityRole="button" accessibilityLabel={`Open source event from ${displayedSource}`} onPress={onPress}>{content}</Pressable>;
}

export const TransactionEvidenceTimeline = EvidenceRow;
