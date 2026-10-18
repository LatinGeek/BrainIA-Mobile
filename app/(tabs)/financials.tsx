import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutUp,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import {
  InsightCard,
} from '@/components/cards';
import { MonthlyCashFlowBar, MonthlyCashFlowLine, SpendingRadial, type MonthlyCashFlowPoint } from '@/components/charts';
import { TransactionRow } from '@/components/finance';
import { AccountIcon } from '@/components/finance/AccountIcon';
import { AppScreen, Section, TopBar } from '@/components/layout';
import { AnimatedPressable, BottomSheet, Button, FilterChip, Input, ListRow, Panel, SegmentedControl, StatusBadge, Surface } from '@/components/primitives';
import { EmptyState, LoadingSkeleton } from '@/components/states';
import { FxStamp } from '@/components/trust';
import { useAppState, useTheme } from '@/lib/app-state';
import { currentFinancialPeriodRange, loadFinancialBundle } from '@/lib/api';
import { hasFinancialCurrencyConversion, summarizeFinancialTransactions } from '@/lib/financial-summary';
import { useAsyncResource } from '@/lib/hooks';
import { convertCurrency, formatCategoryLabel, formatCurrency, isUncategorizedLabel, parseCurrency, SupportedCurrency } from '@/lib/format';
import type { TransactionGroup } from '@/lib/grouping';
import type { FinancialAccount, PendingTransaction, TransactionSummary } from '@/lib/domain';
import { DEFAULT_FINANCIAL_ACCOUNT_COLOR, FINANCIAL_ACCOUNT_COLORS } from '@/lib/financial-accounts';

const views = [
  { value: 'overview', label: 'Resumen' },
  { value: 'trends', label: 'Tendencias' },
  { value: 'accounts', label: 'Cuentas' },
  { value: 'transactions', label: 'Movimientos' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'insights', label: 'Perspectivas' },
] as const;

const periods = [
  { value: 'month', label: 'Ciclo' },
  { value: 'year', label: 'Año' },
] as const;

type FinanceView = (typeof views)[number]['value'];
type FinancePeriod = (typeof periods)[number]['value'];
type TrendChartMode = 'line' | 'bars';
type TransactionKindFilter = 'all' | 'expense' | 'income' | 'transfer';
type TransactionSort = 'recent' | 'oldest' | 'highest' | 'lowest';
type ManualEntryKind = 'expense' | 'income';

const displayCurrencies = [
  { value: 'UYU', label: 'UYU' },
  { value: 'USD', label: 'USD' },
] as const;

const TRANSACTION_CYCLE_LIMIT = 1000;

const transactionSortLabels: Record<TransactionSort, string> = {
  recent: 'Recientes',
  oldest: 'Más antiguos',
  highest: 'Mayor importe',
  lowest: 'Menor importe',
};

function CompactFinanceSwitch<T extends string>({
  value,
  onChange,
  options,
  accessibilityLabel,
  minOptionWidth = 40,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  accessibilityLabel: string;
  minOptionWidth?: number;
}) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="radiogroup"
      style={{
        flexDirection: 'row',
        padding: 3,
        borderRadius: 999,
        backgroundColor: theme.colors.surfaceSubtle,
        borderWidth: 1,
        borderColor: theme.colors.border,
        gap: 2,
      }}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <AnimatedPressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={`${accessibilityLabel}: ${option.label}`}
            onPress={() => onChange(option.value)}
            scaleTo={0.96}
            style={{
              minWidth: minOptionWidth,
              height: 28,
              paddingHorizontal: 8,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? theme.colors.accentSoft : 'transparent',
              borderWidth: 1,
              borderColor: selected ? theme.colors.accentStrong + '99' : 'transparent',
            }}
          >
            <Text style={[theme.typography.caption, { color: selected ? theme.colors.accentStrong : theme.colors.textMuted, fontWeight: '700' }]}>{option.label}</Text>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

function CompactCurrencySwitch({ value, onChange }: { value: SupportedCurrency; onChange: (value: SupportedCurrency) => void }) {
  return <CompactFinanceSwitch value={value} onChange={onChange} options={displayCurrencies} accessibilityLabel="Moneda de visualización" />;
}

function CompactPeriodSwitch({ value, onChange }: { value: FinancePeriod; onChange: (value: FinancePeriod) => void }) {
  return <CompactFinanceSwitch value={value} onChange={onChange} options={periods} accessibilityLabel="Período financiero" minOptionWidth={48} />;
}

function displayAmount(transaction: { amount: string; currency: string }, currency: SupportedCurrency) {
  return convertCurrency(parseCurrency(transaction.amount), transaction.currency, currency);
}

function financialPeriodLabel(range: { from: string; to: string }) {
  const from = new Date(range.from);
  const through = new Date(range.to);
  const format = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${format(from)} – ${format(through)}`;
}

function financialPeriodRangeAtOffset(financialPeriodStartDay: number, cycleOffset: number) {
  const current = currentFinancialPeriodRange(financialPeriodStartDay);
  const from = new Date(current.from);
  from.setMonth(from.getMonth() - Math.max(0, cycleOffset));
  const nextBoundary = new Date(from.getFullYear(), from.getMonth() + 1, from.getDate());
  return { from: from.toISOString(), to: new Date(nextBoundary.getTime() - 1).toISOString() };
}

function localDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function localDateToIso(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12).toISOString();
}

function formatEstimatedExecutionDate(value: string) {
  if (!isCalendarDate(value)) return value;
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('es-UY', { dateStyle: 'medium' }).format(new Date(year, month - 1, day, 12));
}

function buildMonthlyCashFlow(
  transactions: TransactionSummary[],
  financialPeriodStartDay: number,
  currency: SupportedCurrency,
  monthCount = 6,
): MonthlyCashFlowPoint[] {
  const currentStart = new Date(currentFinancialPeriodRange(financialPeriodStartDay).from);
  const points = Array.from({ length: monthCount }, (_, index) => {
    const start = new Date(currentStart.getFullYear(), currentStart.getMonth() - (monthCount - 1 - index), financialPeriodStartDay);
    const next = new Date(start.getFullYear(), start.getMonth() + 1, financialPeriodStartDay);
    const end = new Date(next.getTime() - 1);
    return {
      // A cycle that starts on the 28th carries the following month's cash flow
      // (for example, 28 Aug–27 Sept is shown as "Sept").
      label: end.toLocaleDateString(undefined, { month: 'short' }),
      periodLabel: financialPeriodLabel({ from: start.toISOString(), to: end.toISOString() }),
      income: 0,
      spending: 0,
      start: start.getTime(),
      end: end.getTime(),
    };
  });

  transactions.forEach((transaction) => {
    if (transaction.excludedFromReports || (transaction.kind !== 'income' && transaction.kind !== 'expense')) return;
    const observedAt = transaction.observedAt ? new Date(transaction.observedAt).getTime() : Number.NaN;
    if (!Number.isFinite(observedAt)) return;
    const point = points.find((candidate) => observedAt >= candidate.start && observedAt <= candidate.end);
    if (!point) return;
    const value = displayAmount(transaction, currency);
    if (transaction.kind === 'income') point.income += value;
    else point.spending += value;
  });

  return points.map(({ label, periodLabel, income, spending }) => ({
    label,
    periodLabel,
    income: Math.max(0, income),
    spending: Math.max(0, spending),
  }));
}

function groupTransactionsInCurrency(
  transactions: import('@/lib/domain').TransactionSummary[],
  field: 'category' | 'account',
  currency: SupportedCurrency,
): TransactionGroup[] {
  const groups = new Map<string, import('@/lib/domain').TransactionSummary[]>();
  transactions.forEach((transaction) => {
    const label = transaction[field] || 'Uncategorized';
    groups.set(label, [...(groups.get(label) ?? []), transaction]);
  });
  return Array.from(groups.entries())
    .map(([label, items]) => ({
      label,
      count: items.length,
      items,
      total: items.reduce((total, transaction) => total + (transaction.kind === 'expense' ? displayAmount(transaction, currency) : 0), 0),
    }))
    .sort((a, b) => b.total - a.total || b.count - a.count || a.label.localeCompare(b.label));
}

function AccountListItem({
  account,
  displayCurrency,
  expanded,
  onToggle,
  onEdit,
  onAdjust,
  onDelete,
  deleting,
}: {
  account: FinancialAccount;
  displayCurrency: SupportedCurrency;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onAdjust: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const theme = useTheme();
  const expansion = useSharedValue(expanded ? 1 : 0);
  const nativeCurrency = account.currency ?? 'UYU';
  const nativeBalance = parseCurrency(account.balance);
  const convertedBalance = convertCurrency(nativeBalance, nativeCurrency, displayCurrency);
  const accountColor = account.color ?? DEFAULT_FINANCIAL_ACCOUNT_COLOR;

  useEffect(() => {
    expansion.value = withSpring(expanded ? 1 : 0, { damping: 17, stiffness: 190, mass: 0.7 });
  }, [expanded, expansion]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${expansion.value * 180}deg` }],
  }));

  return (
    <Animated.View layout={LinearTransition.springify().damping(18).stiffness(180)}>
      <Surface
        variant={expanded ? 'raised' : 'subtle'}
        padding="none"
        style={{
          overflow: 'hidden',
          borderColor: expanded ? `${accountColor}66` : theme.depth.hairline,
          shadowColor: expanded ? accountColor : undefined,
        }}
      >
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: accountColor }} />
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${account.name}, ${nativeCurrency !== displayCurrency ? 'approximately ' : ''}${formatCurrency(convertedBalance, displayCurrency)}. ${expanded ? 'Collapse account options' : 'Expand account options'}`}
          onPress={onToggle}
          scaleTo={0.993}
          style={{
            minHeight: 72,
            flexDirection: 'row',
            alignItems: 'center',
            paddingLeft: theme.spacing.md + 3,
            paddingRight: theme.spacing.sm,
            paddingVertical: theme.spacing.sm,
            gap: theme.spacing.sm,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: `${accountColor}1F`,
              borderWidth: 1,
              borderColor: `${accountColor}38`,
            }}
          >
            <AccountIcon color={accountColor} size={36} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text numberOfLines={1} style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{account.name}</Text>
            <Text numberOfLines={1} style={[theme.typography.caption, { color: theme.colors.textSecondary, textTransform: 'capitalize' }]}>
              {account.type} · {nativeCurrency}{account.mask ? ` · ${account.mask}` : ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', minWidth: 84, gap: 2 }}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
              style={[
                theme.typography.bodyStrong,
                {
                  color: convertedBalance >= 0 ? theme.colors.textPrimary : theme.status.expense,
                  fontVariant: ['tabular-nums'],
                  maxWidth: 128,
                },
              ]}
            >
              {nativeCurrency !== displayCurrency ? '≈ ' : ''}{formatCurrency(convertedBalance, displayCurrency)}
            </Text>
            {nativeCurrency !== displayCurrency ? (
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted, fontVariant: ['tabular-nums'] }]}>{formatCurrency(nativeBalance, nativeCurrency)}</Text>
            ) : (
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Saldo disponible</Text>
            )}
          </View>
          <Animated.View style={[{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: expanded ? `${accountColor}20` : theme.colors.surface }, chevronStyle]}>
            <Feather name="chevron-down" size={17} color={expanded ? accountColor : theme.colors.textMuted} />
          </Animated.View>
        </AnimatedPressable>

        {expanded ? (
          <Animated.View
            entering={FadeInDown.duration(220)}
            exiting={FadeOutUp.duration(150)}
            style={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md, paddingLeft: theme.spacing.md + 3 }}
          >
            <View style={{ height: 1, backgroundColor: theme.colors.border, marginBottom: theme.spacing.md }} />
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
              <View style={{ flex: 1, padding: theme.spacing.sm, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceSubtle, gap: 3 }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Saldo en moneda original</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary, fontVariant: ['tabular-nums'] }]}>{formatCurrency(nativeBalance, nativeCurrency)}</Text>
              </View>
              <View style={{ flex: 1, padding: theme.spacing.sm, borderRadius: theme.radius.md, backgroundColor: `${accountColor}12`, gap: 3 }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Valor de tus cuentas</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit style={[theme.typography.bodyStrong, { color: accountColor, fontVariant: ['tabular-nums'] }]}>{nativeCurrency !== displayCurrency ? '≈ ' : ''}{formatCurrency(convertedBalance, displayCurrency)}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button label="Editar cuenta" variant="secondary" size="sm" onPress={onEdit} icon={<Feather name="edit-2" size={14} color={theme.colors.textPrimary} />} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Ajustar saldo" variant="secondary" size="sm" onPress={onAdjust} icon={<Feather name="sliders" size={14} color={theme.colors.textPrimary} />} />
              </View>
            </View>
            <View style={{ marginTop: theme.spacing.sm }}>
              <Button
                label={deleting ? 'Deleting account...' : 'Delete account'}
                variant="danger"
                size="sm"
                loading={deleting}
                onPress={onDelete}
                icon={<Feather name="trash-2" size={14} color={theme.colors.onAccent} />}
              />
            </View>
          </Animated.View>
        ) : null}
      </Surface>
    </Animated.View>
  );
}

export default function FinancialsScreen() {
  const { client, financialDataRevision, invalidateFinancialData, settings, theme } = useAppState();
  const [view, setView] = useState<FinanceView>('overview');
  const [period, setPeriod] = useState<FinancePeriod>('month');
  const [trendChartMode, setTrendChartMode] = useState<TrendChartMode>('line');
  const [displayCurrency, setDisplayCurrency] = useState<SupportedCurrency>('UYU');
  const [accountEditorOpen, setAccountEditorOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);
  const [accountName, setAccountName] = useState('');
  const [accountMask, setAccountMask] = useState('');
  const [accountCurrency, setAccountCurrency] = useState<SupportedCurrency>('UYU');
  const [accountColor, setAccountColor] = useState(DEFAULT_FINANCIAL_ACCOUNT_COLOR);
  const [adjustingAccount, setAdjustingAccount] = useState<FinancialAccount | null>(null);
  const [targetBalance, setTargetBalance] = useState('');
  const [adjustmentNote, setAdjustmentNote] = useState('');
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [transactionCycleOffset, setTransactionCycleOffset] = useState(0);
  const [transactionKindFilter, setTransactionKindFilter] = useState<TransactionKindFilter>('all');
  const [transactionSort, setTransactionSort] = useState<TransactionSort>('recent');
  const [transactionFiltersOpen, setTransactionFiltersOpen] = useState(false);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
  const [consolidationOpen, setConsolidationOpen] = useState(false);
  const [canonicalTransactionId, setCanonicalTransactionId] = useState<string | null>(null);
  const [consolidationCategory, setConsolidationCategory] = useState<string | null>(null);
  const [consolidationAccountId, setConsolidationAccountId] = useState<string | null>(null);
  const [consolidating, setConsolidating] = useState(false);
  const [consolidationError, setConsolidationError] = useState<string | null>(null);
  const [historicalTransactions, setHistoricalTransactions] = useState<TransactionSummary[]>([]);
  const [historicalTransactionsLoading, setHistoricalTransactionsLoading] = useState(false);
  const [entryEditorOpen, setEntryEditorOpen] = useState(false);
  const [editingPending, setEditingPending] = useState<PendingTransaction | null>(null);
  const [entryIsPending, setEntryIsPending] = useState(false);
  const [entryTitle, setEntryTitle] = useState('');
  const [entryKind, setEntryKind] = useState<ManualEntryKind>('expense');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryCurrency, setEntryCurrency] = useState<SupportedCurrency>('UYU');
  const [entryCategory, setEntryCategory] = useState('');
  const [entryAccountId, setEntryAccountId] = useState<string | null>(null);
  const [entryDate, setEntryDate] = useState(localDateInputValue());
  const [entrySaving, setEntrySaving] = useState(false);
  const [executingPending, setExecutingPending] = useState<PendingTransaction | null>(null);
  const [executionDate, setExecutionDate] = useState(localDateInputValue());
  const loader = useMemo(
    () => () => loadFinancialBundle(client, settings.financialPeriodStartDay),
    [client, settings.financialPeriodStartDay],
  );
  const { data, loading, error, refresh } = useAsyncResource(loader, [financialDataRevision, loader]);
  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));
  const financialPeriodRange = useMemo(
    () => currentFinancialPeriodRange(settings.financialPeriodStartDay),
    [settings.financialPeriodStartDay],
  );
  const cycleLabel = financialPeriodLabel(financialPeriodRange);
  const selectedTransactionCycleRange = useMemo(
    () => financialPeriodRangeAtOffset(settings.financialPeriodStartDay, transactionCycleOffset),
    [settings.financialPeriodStartDay, transactionCycleOffset],
  );
  const selectedTransactionCycleLabel = financialPeriodLabel(selectedTransactionCycleRange);
  const selectedTransactionCycleMonth = new Date(selectedTransactionCycleRange.to).toLocaleDateString(undefined, { month: 'short' });

  useEffect(() => {
    if (transactionCycleOffset === 0) {
      return;
    }

    let active = true;
    void client.listTransactions(TRANSACTION_CYCLE_LIMIT, selectedTransactionCycleRange)
      .then((items) => {
        if (active) setHistoricalTransactions(items);
      })
      .catch(() => {
        if (active) setHistoricalTransactions([]);
      })
      .finally(() => {
        if (active) setHistoricalTransactionsLoading(false);
      });
    return () => { active = false; };
  }, [client, financialDataRevision, selectedTransactionCycleRange, transactionCycleOffset]);

  const transactions = data?.transactions ?? [];
  const pendingTransactions = data?.pendingTransactions ?? [];
  const selectedCycleTransactions = transactionCycleOffset === 0 ? transactions : historicalTransactions;
  const selectedCycleTransactionsLoading = transactionCycleOffset > 0 && historicalTransactionsLoading;
  const filteredCycleTransactions = useMemo(() => {
    const filtered = transactionKindFilter === 'all'
      ? selectedCycleTransactions
      : selectedCycleTransactions.filter((transaction) => transaction.kind === transactionKindFilter);
    return filtered.slice().sort((left, right) => {
      const leftDate = new Date(left.observedAt ?? 0).getTime();
      const rightDate = new Date(right.observedAt ?? 0).getTime();
      if (transactionSort === 'recent') return rightDate - leftDate;
      if (transactionSort === 'oldest') return leftDate - rightDate;
      const amountDifference = displayAmount(left, displayCurrency) - displayAmount(right, displayCurrency);
      return transactionSort === 'highest'
        ? amountDifference === 0 ? rightDate - leftDate : -amountDifference
        : amountDifference === 0 ? rightDate - leftDate : amountDifference;
    });
  }, [displayCurrency, selectedCycleTransactions, transactionKindFilter, transactionSort]);
  const accounts = data?.accounts ?? [];
  const selectedTransactions = useMemo(
    () => selectedTransactionIds.map((id) => selectedCycleTransactions.find((transaction) => transaction.id === id)).filter((transaction): transaction is TransactionSummary => Boolean(transaction)),
    [selectedCycleTransactions, selectedTransactionIds],
  );
  const transactionSelectionMode = selectedTransactionIds.length > 0;
  const insights = data?.insights ?? [];
  const financeInsights = insights.filter((insight) => insight.detectors?.some((detector) => [
    'spending_variation',
    'recurrence_subscription',
  ].includes(detector)));
  const reportTransactions = transactions.filter((transaction) => !transaction.excludedFromReports);
  const expenses = reportTransactions.filter((transaction) => transaction.kind === 'expense');
  const categoryGroups = groupTransactionsInCurrency(expenses, 'category', displayCurrency);
  const financialSummary = summarizeFinancialTransactions(transactions, displayCurrency);
  const monthlySpend = financialSummary.expenses;
  const totalIncome = financialSummary.income;
  const netMovement = totalIncome - monthlySpend;
  const periodMultiplier = period === 'year' ? 12 : 1;
  const periodSpend = monthlySpend * periodMultiplier;
  const periodIncome = totalIncome * periodMultiplier;
  const periodNet = netMovement * periodMultiplier;
  const monthlyCashFlow = useMemo(
    () => buildMonthlyCashFlow(data?.trendTransactions ?? [], settings.financialPeriodStartDay, displayCurrency),
    [data?.trendTransactions, displayCurrency, settings.financialPeriodStartDay],
  );
  const merchantGroups = Array.from(expenses.reduce((groups, transaction) => {
    const label = transaction.displayMerchantLabel ?? transaction.merchantLabel;
    groups.set(label, (groups.get(label) ?? 0) + displayAmount(transaction, displayCurrency));
    return groups;
  }, new Map<string, number>()).entries()).map(([label, total]) => ({ label, total }));
  const topCategory = categoryGroups[0];
  const topMerchant = expenses[0];
  const totalAccountBalance = accounts.reduce(
    (total, account) => total + convertCurrency(parseCurrency(account.balance), account.currency ?? 'UYU', displayCurrency),
    0,
  );
  const hasCurrencyConversion = hasFinancialCurrencyConversion(transactions, displayCurrency)
    || accounts.some((account) => (account.currency ?? 'UYU') !== displayCurrency);
  const displayTotal = (value: number) => `${hasCurrencyConversion ? '≈ ' : ''}${formatCurrency(value, displayCurrency)}`;
  const displaySummaryTotal = (value: number) => formatCurrency(value, displayCurrency);
  const portfolioSegments = accounts.map((account) => {
    const convertedBalance = convertCurrency(parseCurrency(account.balance), account.currency ?? 'UYU', displayCurrency);
    return {
      label: account.name,
      value: Math.abs(convertedBalance),
      displayValue: convertedBalance,
      color: account.color,
    };
  });
  const radialSegments = categoryGroups.length
    ? categoryGroups.map((group) => ({
        id: group.label,
        label: formatCategoryLabel(group.label),
        value: group.total * periodMultiplier,
      }))
    : [
        {
          label: 'Sin gastos',
          value: 1,
        },
      ];

  function openCreateAccount() {
    setEditingAccount(null);
    setAccountName('');
    setAccountMask('');
    setAccountCurrency(displayCurrency);
    setAccountColor(DEFAULT_FINANCIAL_ACCOUNT_COLOR);
    setAccountEditorOpen(true);
  }

  function openEntryEditor(pending = false) {
    setEditingPending(null);
    setEntryIsPending(pending);
    setEntryTitle('');
    setEntryKind('expense');
    setEntryAmount('');
    setEntryCurrency(displayCurrency);
    setEntryCategory('');
    setEntryAccountId(null);
    setEntryDate(localDateInputValue());
    setEntryEditorOpen(true);
  }

  function openPendingEditor(pending: PendingTransaction) {
    setEditingPending(pending);
    setEntryIsPending(true);
    setEntryTitle(pending.title);
    setEntryKind(pending.kind);
    setEntryAmount(pending.amount);
    setEntryCurrency(pending.currency);
    setEntryCategory(pending.category ?? '');
    setEntryAccountId(pending.accountId ?? null);
    setEntryDate(pending.estimatedExecutionDate);
    setEntryEditorOpen(true);
  }

  async function saveEntry() {
    const amount = Number(entryAmount.replace(',', '.'));
    if (!entryTitle.trim()) {
      Alert.alert('Falta un título', 'Agrega una descripción para reconocer este movimiento.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un importe mayor a cero.');
      return;
    }
    if (!isCalendarDate(entryDate)) {
      Alert.alert('Fecha inválida', 'Usa el formato AAAA-MM-DD.');
      return;
    }

    setEntrySaving(true);
    try {
      const baseInput = {
        title: entryTitle.trim(),
        kind: entryKind,
        amount,
        currency: entryCurrency,
        category: entryCategory.trim() || null,
        accountId: entryAccountId,
      };
      if (editingPending) {
        await client.updatePendingTransaction(editingPending.id, { ...baseInput, estimatedExecutionDate: entryDate });
      } else if (entryIsPending) {
        await client.createPendingTransaction({ ...baseInput, estimatedExecutionDate: entryDate });
      } else {
        await client.createManualTransaction({ ...baseInput, observedAt: localDateToIso(entryDate) });
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEntryEditorOpen(false);
      invalidateFinancialData();
      await refresh();
    } catch (error) {
      Alert.alert('No se pudo guardar', error instanceof Error ? error.message : 'Inténtalo de nuevo.');
    } finally {
      setEntrySaving(false);
    }
  }

  async function executePending() {
    if (!executingPending) return;
    if (!isCalendarDate(executionDate)) {
      Alert.alert('Fecha inválida', 'Usa el formato AAAA-MM-DD.');
      return;
    }
    setEntrySaving(true);
    try {
      await client.executePendingTransaction(executingPending.id, { executedAt: localDateToIso(executionDate) });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setExecutingPending(null);
      invalidateFinancialData();
      await refresh();
    } catch (error) {
      Alert.alert('No se pudo ejecutar', error instanceof Error ? error.message : 'Inténtalo de nuevo.');
    } finally {
      setEntrySaving(false);
    }
  }

  async function cancelPending(pending: PendingTransaction) {
    try {
      await client.cancelPendingTransaction(pending.id);
      invalidateFinancialData();
      await refresh();
    } catch (error) {
      Alert.alert('No se pudo cancelar', error instanceof Error ? error.message : 'Inténtalo de nuevo.');
    }
  }

  function confirmCancelPending(pending: PendingTransaction) {
    const message = `Se cancelará “${pending.title}”. No afectará tus saldos ni informes.`;
    if (Platform.OS === 'web') {
      if (globalThis.confirm(`Cancelar pendiente?\n\n${message}`)) void cancelPending(pending);
      return;
    }
    Alert.alert('Cancelar pendiente?', message, [
      { text: 'Volver', style: 'cancel' },
      { text: 'Cancelar pendiente', style: 'destructive', onPress: () => void cancelPending(pending) },
    ]);
  }

  function toggleTransactionSelection(transaction: TransactionSummary) {
    setSelectedTransactionIds((current) => {
      if (current.includes(transaction.id)) {
        void Haptics.selectionAsync();
        return current.filter((id) => id !== transaction.id);
      }
      if (current.length === 2) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return current;
      }
      void Haptics.selectionAsync();
      return [...current, transaction.id];
    });
  }

  function openConsolidation() {
    if (selectedTransactions.length !== 2) return;
    const [first, second] = selectedTransactions;
    setCanonicalTransactionId(first.id);
    setConsolidationCategory([first, second].map((transaction) => transaction.category).find((category): category is string => Boolean(category && !isUncategorizedLabel(category))) ?? first.category ?? second.category ?? null);
    setConsolidationAccountId([first, second].map((transaction) => transaction.accountId).find((accountId): accountId is string => Boolean(accountId)) ?? null);
    setConsolidationError(null);
    setConsolidationOpen(true);
  }

  async function consolidateSelectedTransactions() {
    const canonical = selectedTransactions.find((transaction) => transaction.id === canonicalTransactionId);
    const duplicate = selectedTransactions.find((transaction) => transaction.id !== canonicalTransactionId);
    if (!canonical || !duplicate) return;
    setConsolidating(true);
    setConsolidationError(null);
    try {
      await client.updateTransactionContext(canonical.id, {
        category: consolidationCategory,
        accountId: consolidationAccountId,
      });
      await client.mergeTransactions(canonical.id, duplicate.id);
      invalidateFinancialData();
      setSelectedTransactionIds([]);
      setConsolidationOpen(false);
      await refresh();
    } catch (consolidationFailure) {
      setConsolidationError(consolidationFailure instanceof Error ? consolidationFailure.message : 'No se pudieron consolidar los movimientos.');
    } finally {
      setConsolidating(false);
    }
  }

  function openEditAccount(account: FinancialAccount) {
    setEditingAccount(account);
    setAccountName(account.name);
    setAccountMask(account.mask ?? '');
    setAccountCurrency(account.currency ?? 'UYU');
    setAccountColor(account.color ?? DEFAULT_FINANCIAL_ACCOUNT_COLOR);
    setAccountEditorOpen(true);
  }

  async function saveAccount() {
    if (!accountName.trim()) return;
    setSaving(true);
    try {
      const input = { name: accountName.trim(), mask: accountMask.trim() || undefined, currency: accountCurrency, color: accountColor, type: editingAccount?.type || 'bank' };
      if (editingAccount) await client.updateFinancialAccount(editingAccount.id, input);
      else await client.createFinancialAccount(input);
      setAccountEditorOpen(false);
      await refresh();
    } catch (saveError) {
      Alert.alert('Unable to save account', saveError instanceof Error ? saveError.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount(account: FinancialAccount) {
    setDeletingAccountId(account.id);
    try {
      const result = await client.deleteFinancialAccount(account.id);
      setExpandedAccountId((current) => current === account.id ? null : current);
      await refresh();
      if (result.detachedTransactions > 0) {
        Alert.alert(
          'Cuenta eliminada',
          `${result.detachedTransactions} ${result.detachedTransactions === 1 ? 'transacción permanece' : 'transacciones permanecen'} en tu historial sin una cuenta asignada.`,
        );
      }
    } catch (deleteError) {
      Alert.alert('Unable to delete account', deleteError instanceof Error ? deleteError.message : 'Try again.');
    } finally {
      setDeletingAccountId(null);
    }
  }

  function confirmDeleteAccount(account: FinancialAccount) {
    const message = `Se eliminará ${account.name}. Las transacciones existentes se conservarán sin una cuenta asignada.`;
    if (Platform.OS === 'web') {
      if (globalThis.confirm(`Delete account?\n\n${message}`)) void deleteAccount(account);
      return;
    }
    Alert.alert('Delete account?', message, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void deleteAccount(account) },
    ]);
  }

  function openAdjustment(account: FinancialAccount) {
    setAdjustingAccount(account);
    setTargetBalance(Number(account.balance).toFixed(2));
    setAdjustmentNote('');
  }

  async function saveAdjustment() {
    if (!adjustingAccount) return;
    const parsedTarget = Number(targetBalance.replace(',', '.'));
    if (!Number.isFinite(parsedTarget)) {
      Alert.alert('Invalid balance', 'Enter the current account balance as a number.');
      return;
    }
    setSaving(true);
    try {
      await client.createBalanceAdjustment(adjustingAccount.id, { targetBalance: parsedTarget, note: adjustmentNote.trim() || undefined });
      setAdjustingAccount(null);
      await refresh();
    } catch (saveError) {
      Alert.alert('Unable to adjust balance', saveError instanceof Error ? saveError.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppScreen refreshing={loading} onRefresh={refresh}>
      <TopBar
        title="Dinero"
        subtitle="Dónde se movió tu dinero y qué cambió."
        secondaryAction={<StatusBadge label={loading ? 'Actualizando' : error ? 'Sin conexión' : 'Current'} tone={error ? 'warning' : 'positive'} />}
      />

      {error ? <EmptyState title="No se pudo cargar Dinero" description={error} primaryActionLabel="Reintentar" onPrimaryAction={refresh} /> : null}
      {loading && !data ? <LoadingSkeleton variant="chart" count={2} /> : null}

      {data ? (
        <>
          <SegmentedControl
            scrollable
            value={view}
            onChange={setView}
            options={views.map((item) => ({
              ...item,
              count: item.value === 'transactions' ? transactions.length : item.value === 'pending' ? pendingTransactions.length : undefined,
            }))}
          />
          {hasCurrencyConversion ? <FxStamp /> : null}

          {view === 'overview' ? (
            <>
              <Panel tone="finance" style={{ gap: theme.spacing.lg, paddingTop: theme.spacing.lg }}>
                <View style={{ gap: theme.spacing.sm }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.md }}>
                    <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{period === 'year' ? 'Movimiento neto proyectado' : 'Movimiento neto'}</Text>
                    <CompactPeriodSwitch value={period} onChange={setPeriod} />
                  </View>
                  <Text style={[theme.typography.numeral, { color: periodNet >= 0 ? theme.colors.accent : theme.status.expense }]}>
                    {displaySummaryTotal(periodNet)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                  <MoneyTile label="Ingresos" value={displaySummaryTotal(periodIncome)} tone="positive" compact />
                  <MoneyTile label="Gastos" value={displaySummaryTotal(periodSpend)} tone="danger" compact />
                </View>
              </Panel>
              <SpendingRadial
                title="Distribución de gastos"
                subtitle={period === 'year' ? 'Participación proyectada por categoría' : `Participación por categoría · ${cycleLabel}`}
                amount={displayTotal(periodSpend)}
                segments={radialSegments}
                formatValue={(value) => formatCurrency(value, displayCurrency)}
                headerAction={<CompactCurrencySwitch value={displayCurrency} onChange={setDisplayCurrency} />}
                drilldown={{
                  getItems: (segment) => categoryGroups.find((group) => group.label === segment.id)?.items
                    .slice()
                    .sort((left, right) => new Date(right.observedAt ?? 0).getTime() - new Date(left.observedAt ?? 0).getTime()) ?? [],
                  renderItem: (item) => {
                    const transaction = expenses.find((candidate) => candidate.id === item.id);
                    return transaction ? <TransactionRow transaction={transaction} onPress={() => router.push(`/transaction/${transaction.id}`)} /> : null;
                  },
                }}
              />
              <Section title="De un vistazo" subtitle={period === 'year' ? 'Proyección anual basada en los datos del ciclo actual.' : `Las señales principales de ${cycleLabel}.`}>
                <ListRow title={topCategory ? formatCategoryLabel(topCategory.label) : 'Todavía no hay categorías'} subtitle="Principal grupo de gastos" description={topCategory ? `${topCategory.count} transacciones` : 'Las categorías agrupadas aparecerán después de sincronizar.'} />
                <ListRow title={topMerchant ? topMerchant.displayMerchantLabel ?? topMerchant.merchantLabel : 'Todavía no hay comercios'} subtitle="Comercio destacado" description={topMerchant?.amount ?? 'Esperando datos de transacciones.'} />
              </Section>
            </>
          ) : null}

          {view === 'trends' ? (
            <Section title="Tendencias" subtitle="Evolución de los últimos movimientos.">
              <SegmentedControl value={trendChartMode} onChange={(value) => setTrendChartMode(value as TrendChartMode)} options={[{ value: 'line', label: 'Línea' }, { value: 'bars', label: 'Barras' }]} />
              {trendChartMode === 'line' ? <MonthlyCashFlowLine
                points={monthlyCashFlow}
                subtitle="Ingresos y gastos de los últimos seis ciclos financieros."
                formatValue={(value) => formatCurrency(value, displayCurrency)}
                headerAction={<CompactCurrencySwitch value={displayCurrency} onChange={setDisplayCurrency} />}
              /> : <MonthlyCashFlowBar points={monthlyCashFlow} subtitle="Ingresos y gastos de los últimos seis ciclos financieros." formatValue={(value) => formatCurrency(value, displayCurrency)} headerAction={<CompactCurrencySwitch value={displayCurrency} onChange={setDisplayCurrency} />} />}
              <SpendingRadial
                title="Movimiento de dinero"
                subtitle={period === 'year' ? 'Participación proyectada por comercio' : `Participación por comercio · ${cycleLabel}`}
                amount={displayTotal(periodSpend)}
                segments={merchantGroups.map((group) => ({ id: group.label, label: group.label, value: group.total * periodMultiplier }))}
                formatValue={(value) => formatCurrency(value, displayCurrency)}
                itemNoun="comercio"
                percentageNoun="gasto"
                emptyLabel="Sin comercios"
                headerAction={<CompactCurrencySwitch value={displayCurrency} onChange={setDisplayCurrency} />}
                drilldown={{
                  getItems: (segment) => expenses.filter((transaction) => (transaction.displayMerchantLabel ?? transaction.merchantLabel) === segment.id),
                  renderItem: (item) => {
                    const transaction = expenses.find((candidate) => candidate.id === item.id);
                    return transaction ? <TransactionRow transaction={transaction} onPress={() => router.push(`/transaction/${transaction.id}`)} /> : null;
                  },
                }}
              />
            </Section>
          ) : null}

          {view === 'accounts' ? (
            <Section title="Cuentas" subtitle="Tu dinero en las cuentas vinculadas." count={accounts.length}>
              <SpendingRadial
                title="Resumen de cuentas"
                subtitle="Valor neto distribuido entre tus cuentas. Los saldos negativos se ponderan por su magnitud."
                amount={displayTotal(totalAccountBalance)}
                segments={portfolioSegments}
                formatValue={(value) => formatCurrency(value, displayCurrency)}
                totalLabel="Total de cuentas"
                itemNoun="cuenta"
                percentageNoun="cartera"
                emptyLabel="Sin cuentas"
                headerAction={<CompactCurrencySwitch value={displayCurrency} onChange={setDisplayCurrency} />}
              />
              <Panel tone="finance" style={{ gap: theme.spacing.md }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Total disponible en {displayCurrency}</Text>
                <Text style={[theme.typography.numeral, { color: totalAccountBalance >= 0 ? theme.colors.accent : theme.status.expense }]}>
                  {displayTotal(totalAccountBalance)}
                </Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Los saldos incluyen transferencias y ajustes. Los ajustes no afectan los informes de Dinero.</Text>
                <Button label="Crear cuenta" onPress={openCreateAccount} icon={<Feather name="plus" size={16} color={theme.colors.onAccent} />} />
              </Panel>
              {accounts.length ? accounts.map((account) => (
                <AccountListItem
                  key={account.id}
                  account={account}
                  displayCurrency={displayCurrency}
                  expanded={expandedAccountId === account.id}
                  onToggle={() => setExpandedAccountId((current) => current === account.id ? null : account.id)}
                  onEdit={() => openEditAccount(account)}
                  onAdjust={() => openAdjustment(account)}
                  onDelete={() => confirmDeleteAccount(account)}
                  deleting={deletingAccountId === account.id}
                />
              )) : <EmptyState title="Todavía no hay cuentas" description="Crea una cuenta y luego establece su saldo actual con un ajuste." />}
            </Section>
          ) : null}

          {view === 'transactions' ? (
            <Section title="Movimientos" subtitle={transactionSelectionMode ? 'Tocá los registros que querés comparar.' : `Registros financieros · ${selectedTransactionCycleLabel} · Mantené presionado para consolidar`} count={filteredCycleTransactions.length}>
              {!transactionSelectionMode ? <Button label="Nuevo movimiento" size="sm" onPress={() => openEntryEditor(false)} icon={<Feather name="plus" size={15} color={theme.colors.onAccent} />} /> : null}
              {selectedTransactionIds.length ? (
                <Panel tone="finance" style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{`${selectedTransactionIds.length} de 2 seleccionados`}</Text>
                      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{selectedTransactionIds.length === 1 ? 'Tocá otro movimiento para compararlo.' : 'Revisá los datos que vas a conservar.'}</Text>
                    </View>
                    <Button label="Cancelar" size="sm" variant="secondary" onPress={() => setSelectedTransactionIds([])} />
                  </View>
                  {selectedTransactionIds.length === 2 ? <Button label="Revisar y consolidar" size="sm" onPress={openConsolidation} /> : null}
                </Panel>
              ) : null}
              <Panel tone="finance" style={{ padding: theme.spacing.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceSubtle, borderWidth: 1, borderColor: theme.colors.border }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Ver ciclo anterior"
                    onPress={() => {
                      setHistoricalTransactionsLoading(true);
                      setTransactionCycleOffset((offset) => offset + 1);
                    }}
                    style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Feather name="chevron-left" size={18} color={theme.colors.textPrimary} />
                  </Pressable>
                  <View style={{ minWidth: 42, alignItems: 'center' }}>
                    <Text style={[theme.typography.caption, { color: theme.colors.textPrimary, fontWeight: '700' }]}>{selectedTransactionCycleMonth}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Ver próximo ciclo"
                    accessibilityState={{ disabled: transactionCycleOffset === 0 }}
                    disabled={transactionCycleOffset === 0}
                    onPress={() => {
                      setHistoricalTransactionsLoading(transactionCycleOffset > 1);
                      setTransactionCycleOffset((offset) => Math.max(0, offset - 1));
                    }}
                    style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center', opacity: transactionCycleOffset === 0 ? 0.4 : 1 }}
                  >
                    <Feather name="chevron-right" size={18} color={theme.colors.textPrimary} />
                  </Pressable>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Filtrar y ordenar movimientos. Orden actual: ${transactionSortLabels[transactionSort]}`}
                    onPress={() => setTransactionFiltersOpen(true)}
                    style={{ height: 34, paddingHorizontal: theme.spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: theme.radius.md, backgroundColor: theme.colors.accentSoft, borderWidth: 1, borderColor: theme.colors.accentStrong + '66' }}
                  >
                    <Feather name="sliders" size={14} color={theme.colors.accentStrong} />
                    <Text style={[theme.typography.caption, { color: theme.colors.accentStrong, fontWeight: '700' }]}>{transactionSortLabels[transactionSort]}</Text>
                  </Pressable>
                </View>
              </Panel>
              {selectedCycleTransactionsLoading ? <LoadingSkeleton variant="list" count={3} /> : null}
              {!selectedCycleTransactionsLoading && filteredCycleTransactions.length ? (
                filteredCycleTransactions.map((transaction) => (
                  <TransactionRow
                    key={transaction.id}
                    transaction={transaction}
                    selected={selectedTransactionIds.includes(transaction.id)}
                    selectionMode={transactionSelectionMode}
                    onLongPress={() => toggleTransactionSelection(transaction)}
                    onPress={() => transactionSelectionMode ? toggleTransactionSelection(transaction) : router.push(`/transaction/${transaction.id}`)}
                  />
                ))
              ) : (
                <EmptyState title="Sin movimientos coincidentes" description="Prueba otro período o cambia el filtro." />
              )}
            </Section>
          ) : null}

          {view === 'pending' ? (
            <Section title="Pendientes" subtitle="Cobros y deudas previstos. No afectan tus saldos hasta ejecutarlos." count={pendingTransactions.length}>
              <Button label="Nuevo pendiente" size="sm" onPress={() => openEntryEditor(true)} icon={<Feather name="plus" size={15} color={theme.colors.onAccent} />} />
              {pendingTransactions.length ? pendingTransactions.map((pending) => (
                <PendingTransactionRow
                  key={pending.id}
                  pending={pending}
                  onExecute={() => {
                    setExecutionDate(localDateInputValue());
                    setExecutingPending(pending);
                  }}
                  onEdit={() => openPendingEditor(pending)}
                  onCancel={() => confirmCancelPending(pending)}
                />
              )) : <EmptyState title="No hay pendientes" description="Anota un cobro o una deuda futura para tenerla presente sin alterar tu balance." primaryActionLabel="Crear pendiente" onPrimaryAction={() => openEntryEditor(true)} />}
            </Section>
          ) : null}

          {view === 'insights' ? (
            <Section title="Perspectivas financieras" subtitle="Patrones que merecen atención.">
              {financeInsights.length ? (
                financeInsights.map((insight) => <InsightCard key={insight.id} insight={insight} onPress={() => router.push(`/insight/${insight.id}`)} />)
              ) : (
                <EmptyState title="Todavía no hay perspectivas financieras" description="Aquí aparecerán recurrencias, cambios importantes y tendencias." />
              )}
            </Section>
          ) : null}
        </>
      ) : null}

      <BottomSheet visible={consolidationOpen} title="Consolidar movimientos" onClose={() => !consolidating && setConsolidationOpen(false)}>
        <View style={{ gap: theme.spacing.md }}>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Se conservará un único movimiento y las fuentes del otro quedarán adjuntas como evidencia. Elegí qué información representa el pago real.</Text>

          <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Monto y movimiento principal</Text>
          {selectedTransactions.map((transaction) => (
            <ListRow
              key={transaction.id}
              title={`${transaction.displayMerchantLabel ?? transaction.merchantLabel} · ${formatCurrency(parseCurrency(transaction.amount), transaction.currency)}`}
              subtitle={transaction.observedAt}
              trailing={<Text style={{ color: canonicalTransactionId === transaction.id ? theme.colors.success : theme.colors.textMuted }}>{canonicalTransactionId === transaction.id ? 'Conservar' : 'Usar'}</Text>}
              onPress={() => setCanonicalTransactionId(transaction.id)}
            />
          ))}

          <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Categoría</Text>
          {Array.from(new Set(selectedTransactions.map((transaction) => transaction.category).filter((category): category is string => Boolean(category)))).map((category) => (
            <FilterChip key={category} label={formatCategoryLabel(category)} selected={consolidationCategory === category} onPress={() => setConsolidationCategory(category)} />
          ))}
          {!consolidationCategory ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Ninguno tiene categoría: el movimiento quedará sin categorizar.</Text> : null}

          <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Cuenta o método de pago</Text>
          {Array.from(new Set(selectedTransactions.map((transaction) => transaction.accountId).filter((accountId): accountId is string => Boolean(accountId)))).map((accountId) => {
            const account = accounts.find((candidate) => candidate.id === accountId);
            return <ListRow key={accountId} title={account?.name ?? 'Cuenta vinculada'} subtitle={account?.currency ?? ''} trailing={<Text style={{ color: consolidationAccountId === accountId ? theme.colors.success : theme.colors.textMuted }}>{consolidationAccountId === accountId ? 'Conservar' : 'Usar'}</Text>} onPress={() => setConsolidationAccountId(accountId)} />;
          })}
          {!consolidationAccountId ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Ninguno tiene una cuenta asociada.</Text> : null}

          {consolidationError ? <Text style={{ color: theme.colors.danger }}>{consolidationError}</Text> : null}
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Button label="Consolidar" loading={consolidating} disabled={!canonicalTransactionId || selectedTransactions.length !== 2} onPress={consolidateSelectedTransactions} />
            <Button label="Cancelar" variant="secondary" disabled={consolidating} onPress={() => setConsolidationOpen(false)} />
          </View>
        </View>
      </BottomSheet>

      <BottomSheet visible={accountEditorOpen} title={editingAccount ? 'Editar cuenta' : 'Crear cuenta'} onClose={() => setAccountEditorOpen(false)}>
        <Input label="Nombre de la cuenta" value={accountName} onChangeText={setAccountName} placeholder="Cuenta bancaria principal" autoCapitalize="words" />
        <Input label="Últimos dígitos (opcional)" value={accountMask} onChangeText={setAccountMask} placeholder="•••• 5343" />
        <View style={{ gap: theme.spacing.xs }}>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Moneda</Text>
          <SegmentedControl value={accountCurrency} onChange={(value) => setAccountCurrency(value as SupportedCurrency)} options={displayCurrencies} />
        </View>
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Color de la cuenta</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {FINANCIAL_ACCOUNT_COLORS.map((option) => (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                accessibilityState={{ selected: accountColor === option.value }}
                onPress={() => setAccountColor(option.value)}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: option.value,
                  borderWidth: accountColor === option.value ? 3 : 0,
                  borderColor: theme.colors.textPrimary,
                }}
              >
                {accountColor === option.value ? <Feather name="check" size={18} color="#FFFFFF" /> : null}
              </Pressable>
            ))}
          </View>
        </View>
        <Button label={editingAccount ? 'Guardar cambios' : 'Crear cuenta'} onPress={saveAccount} loading={saving} disabled={!accountName.trim()} />
      </BottomSheet>

      <BottomSheet visible={Boolean(adjustingAccount)} title="Ajustar saldo de la cuenta" onClose={() => setAdjustingAccount(null)}>
        {adjustingAccount ? (
          <>
            <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Establece el saldo real de {adjustingAccount.name}. Brain IA creará un ingreso o gasto excluido por la diferencia.</Text>
            <Input label={`Saldo actual (${adjustingAccount.currency ?? 'UYU'})`} value={targetBalance} onChangeText={setTargetBalance} keyboardType="decimal-pad" placeholder="0.00" />
            <Input label="Nota (opcional)" value={adjustmentNote} onChangeText={setAdjustmentNote} placeholder="Conciliación de saldo" />
            <Button label="Ajustar saldo" onPress={saveAdjustment} loading={saving} />
          </>
        ) : null}
      </BottomSheet>

      <BottomSheet
        visible={entryEditorOpen}
        title={editingPending ? 'Editar pendiente' : entryIsPending ? 'Nuevo pendiente' : 'Nuevo movimiento'}
        onClose={() => !entrySaving && setEntryEditorOpen(false)}
      >
        <View style={{ gap: theme.spacing.md }}>
          {!editingPending ? (
            <View style={{ gap: theme.spacing.xs }}>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Registro</Text>
              <SegmentedControl
                value={entryIsPending ? 'pending' : 'posted'}
                onChange={(value) => setEntryIsPending(value === 'pending')}
                options={[{ value: 'posted', label: 'Movimiento' }, { value: 'pending', label: 'Pendiente' }]}
              />
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                {entryIsPending ? 'No afectará tus saldos hasta que lo marques como ejecutado.' : 'Afectará tus saldos e informes al guardarlo.'}
              </Text>
            </View>
          ) : null}

          <Input label="Título" value={entryTitle} onChangeText={setEntryTitle} placeholder="Ej. Cobro de cliente" autoCapitalize="sentences" />
          <View style={{ gap: theme.spacing.xs }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Tipo</Text>
            <SegmentedControl
              value={entryKind}
              onChange={(value) => setEntryKind(value as ManualEntryKind)}
              options={[{ value: 'expense', label: 'Gasto' }, { value: 'income', label: 'Ingreso' }]}
            />
          </View>
          <View style={{ gap: theme.spacing.xs }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Moneda</Text>
            <SegmentedControl
              value={entryCurrency}
              onChange={(value) => {
                setEntryCurrency(value as SupportedCurrency);
                setEntryAccountId(null);
              }}
              options={displayCurrencies}
            />
          </View>
          <Input label={`Monto (${entryCurrency})`} value={entryAmount} onChangeText={setEntryAmount} keyboardType="decimal-pad" placeholder="0.00" />
          <Input label="Categoría (opcional)" value={entryCategory} onChangeText={setEntryCategory} placeholder={entryKind === 'income' ? 'Ej. Sueldo' : 'Ej. Servicios'} />

          <View style={{ gap: theme.spacing.xs }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Cuenta (opcional)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
              <FilterChip label="Sin cuenta" selected={!entryAccountId} onPress={() => setEntryAccountId(null)} />
              {accounts.filter((account) => (account.currency ?? 'UYU') === entryCurrency).map((account) => (
                <FilterChip key={account.id} label={account.name} selected={entryAccountId === account.id} onPress={() => setEntryAccountId(account.id)} />
              ))}
            </View>
          </View>

          <Input
            label={entryIsPending ? 'Fecha estimada de ejecución' : 'Fecha del movimiento'}
            value={entryDate}
            onChangeText={setEntryDate}
            placeholder="AAAA-MM-DD"
            autoCapitalize="none"
            accessibilityHint="Usa el formato año, mes y día."
          />
          <Button label={editingPending ? 'Guardar cambios' : entryIsPending ? 'Guardar pendiente' : 'Guardar movimiento'} onPress={saveEntry} loading={entrySaving} disabled={!entryTitle.trim() || !entryAmount.trim()} />
        </View>
      </BottomSheet>

      <BottomSheet visible={Boolean(executingPending)} title="Marcar como ejecutado" onClose={() => !entrySaving && setExecutingPending(null)}>
        {executingPending ? (
          <View style={{ gap: theme.spacing.md }}>
            <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>“{executingPending.title}” pasará a Movimientos y empezará a afectar tus saldos e informes.</Text>
            <Input label="Fecha real de ejecución" value={executionDate} onChangeText={setExecutionDate} placeholder="AAAA-MM-DD" autoCapitalize="none" />
            <Button label="Confirmar ejecución" onPress={executePending} loading={entrySaving} />
          </View>
        ) : null}
      </BottomSheet>

      <BottomSheet visible={transactionFiltersOpen} title="Filtrar movimientos" onClose={() => setTransactionFiltersOpen(false)}>
        <View style={{ gap: theme.spacing.xs }}>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Tipo</Text>
          <SegmentedControl
            scrollable
            value={transactionKindFilter}
            onChange={setTransactionKindFilter}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'expense', label: 'Gastos' },
              { value: 'income', label: 'Ingresos' },
              { value: 'transfer', label: 'Transferencias' },
            ]}
          />
        </View>
        <View style={{ gap: theme.spacing.xs }}>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Ordenar</Text>
          <SegmentedControl
            scrollable
            value={transactionSort}
            onChange={setTransactionSort}
            options={[
              { value: 'recent', label: 'Recientes' },
              { value: 'oldest', label: 'Más antiguos' },
              { value: 'highest', label: 'Mayor importe' },
              { value: 'lowest', label: 'Menor importe' },
            ]}
          />
        </View>
        <Button label="Listo" onPress={() => setTransactionFiltersOpen(false)} />
      </BottomSheet>
    </AppScreen>
  );
}

function PendingTransactionRow({
  pending,
  onExecute,
  onEdit,
  onCancel,
}: {
  pending: PendingTransaction;
  onExecute: () => void;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const isIncome = pending.kind === 'income';
  const amountColor = isIncome ? theme.status.income : theme.status.expense;
  return (
    <Surface variant="subtle" padding="md" style={{ gap: theme.spacing.sm, borderColor: `${amountColor}44` }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm }}>
        <View style={{ width: 36, height: 36, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: `${amountColor}1A` }}>
          <Feather name={isIncome ? 'arrow-down-left' : 'arrow-up-right'} size={17} color={amountColor} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text numberOfLines={2} style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{pending.title}</Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            {isIncome ? 'Ingreso previsto' : 'Gasto previsto'}{pending.category ? ` · ${formatCategoryLabel(pending.category)}` : ''}{pending.account ? ` · ${pending.account}` : ''}
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.warning }]}>{`Estimado: ${formatEstimatedExecutionDate(pending.estimatedExecutionDate)}`}</Text>
        </View>
        <Text style={[theme.typography.bodyStrong, { color: amountColor, fontVariant: ['tabular-nums'] }]}>{formatCurrency(parseCurrency(pending.amount), pending.currency)}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
        <View style={{ flex: 1 }}><Button label="Ejecutar" size="sm" onPress={onExecute} /></View>
        <Button label="Editar" size="sm" variant="secondary" onPress={onEdit} />
        <Pressable accessibilityRole="button" accessibilityLabel={`Cancelar pendiente ${pending.title}`} onPress={onCancel} hitSlop={8} style={{ width: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.md, backgroundColor: theme.colors.surface }}>
          <Feather name="x" size={17} color={theme.colors.danger} />
        </Pressable>
      </View>
    </Surface>
  );
}

function MoneyTile({ label, value, tone, compact = false }: { label: string; value: string; tone: 'neutral' | 'positive' | 'warning' | 'danger'; compact?: boolean }) {
  const theme = useTheme();
  const color = tone === 'positive' ? theme.colors.success : tone === 'warning' ? theme.colors.warning : tone === 'danger' ? theme.colors.danger : theme.colors.textPrimary;
  const directionIcon = tone === 'positive' ? 'arrow-up-right' : tone === 'warning' || tone === 'danger' ? 'arrow-down-right' : null;

  return (
    <Surface variant="subtle" padding={compact ? 'sm' : 'md'} style={{ flex: 1, minWidth: compact ? 0 : '47%', gap: 4, borderColor: color + '33' }}>
      <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {directionIcon ? <Feather name={directionIcon} size={compact ? 14 : 16} color={color} /> : null}
        <Text style={[theme.typography.numeral, { color, fontSize: compact ? 17 : 18, lineHeight: compact ? 22 : 24 }]}>{value}</Text>
      </View>
    </Surface>
  );
}
