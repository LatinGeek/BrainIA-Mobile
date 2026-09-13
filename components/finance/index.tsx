import { Feather } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { AccountBreakdown, CategoryBreakdown, ChartCard, TrendChart } from '@/components/charts';
import { FinanceOverview, FinancialSnapshotCard, InsightCard, MetricCard, MoneyMetric } from '@/components/cards';
import { MoneyAmount, ProvenanceMark } from '@/components/trust';
import { useAppState, useTheme } from '@/lib/app-state';
import { TransactionSummary } from '@/lib/domain';
import { cleanDisplayText, joinDisplayParts } from '@/lib/format';
import { presentEvidenceReason, presentObservedAt, presentTransactionSubtitle } from '@/lib/presentation';

export { AccountBreakdown, CategoryBreakdown, ChartCard, FinanceOverview, FinancialSnapshotCard, InsightCard as FinanceInsightCard, MetricCard, MoneyMetric, TrendChart };

export function TransactionRow({ transaction, onPress }: { transaction: TransactionSummary; onPress?: () => void }) {
  const theme = useTheme();
  const { settings } = useAppState();
  const subtitle = presentTransactionSubtitle(transaction, settings.dataVisibility);
  const merchantLabel = transaction.displayMerchantLabel ?? transaction.merchantLabel;
  const amountTone = transaction.kind === 'income' ? 'income' : 'expense';
  const initials = merchantLabel.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'TX';

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? merchantLabel : undefined}
      onPress={onPress}
      style={{ minHeight: 64, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingVertical: theme.spacing.sm }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <View style={{ width: 36, height: 36, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceSubtle, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={[theme.typography.mono, { color: theme.colors.textSecondary }]}>{initials}</Text>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{cleanDisplayText(merchantLabel)}</Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{subtitle}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 3 }}>
          <MoneyAmount amount={transaction.amount} currency={transaction.currency} tone={amountTone} compact />
          {transaction.kind === 'transfer' && transaction.destinationAmount && transaction.destinationCurrency ? <MoneyAmount amount={transaction.destinationAmount} currency={transaction.destinationCurrency} tone="income" compact /> : null}
          {settings.dataVisibility !== 'essential' && transaction.evidenceCount ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{`${transaction.evidenceCount} source${transaction.evidenceCount === 1 ? '' : 's'}`}</Text> : null}
        </View>
        {onPress ? <Feather name="chevron-right" size={16} color={theme.colors.textMuted} /> : null}
      </View>
    </Pressable>
  );
}

export const TransactionListItem = TransactionRow;

export function EvidenceRow({ source, kind, amount, merchantLabel, observedAt, matchReason, onPress }: { source: string; kind: string; amount?: string; merchantLabel?: string; observedAt?: string; matchReason?: string; onPress?: () => void }) {
  const theme = useTheme();
  const { settings } = useAppState();
  const displayedSource = settings.dataVisibility === 'essential' ? source.replace(/event|notification|email|wallet/gi, 'source') : source;
  const displayedObservedAt = presentObservedAt(observedAt, settings.dataVisibility);
  const displayedReason = presentEvidenceReason(matchReason, settings.dataVisibility);
  const content = (
    <View style={{ minHeight: 64, paddingVertical: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing.md }}>
        <View style={{ gap: 5 }}><Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{cleanDisplayText(displayedSource)}</Text><ProvenanceMark origin="captured" /></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{cleanDisplayText(kind)}</Text>{onPress ? <Feather name="arrow-up-right" size={15} color={theme.colors.accentStrong} /> : null}</View>
      </View>
      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 5 }]}>{joinDisplayParts([merchantLabel || 'Merchant', amount])}</Text>
      {displayedObservedAt ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 3 }]}>{cleanDisplayText(displayedObservedAt)}</Text> : null}
      {displayedReason ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginTop: 3 }]}>{cleanDisplayText(displayedReason)}</Text> : null}
    </View>
  );
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={`Open source event from ${displayedSource}`} onPress={onPress}>{content}</Pressable> : content;
}

export const TransactionEvidenceTimeline = EvidenceRow;
