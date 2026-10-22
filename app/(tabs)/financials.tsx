import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextProps, View } from 'react-native';
import Animated, { Easing, FadeInDown, FadeOut, FadeOutUp } from 'react-native-reanimated';

import { Button, Chip, Field, SegmentedControl, Tag } from '@/components/controls';
import { Amount, IconTile, Row, TransactionRow, useCountedAmount } from '@/components/data/Row';
import { MixCard } from '@/components/data/MixCard';
import { SignalCard } from '@/components/data/SignalCard';
import { StateView } from '@/components/data/StateView';
import { TrendChart } from '@/components/data/TrendChart';
import { GlassPressable } from '@/components/glass/GlassPressable';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { Screen, Section, StaggerGroup } from '@/components/layout/Screen';
import { BottomSheet } from '@/components/layout/BottomSheet';
import { useAppState, useTheme } from '@/lib/app-state';
import { currentFinancialPeriodRange, loadFinancialBundle } from '@/lib/api';
import { hasFinancialCurrencyConversion, summarizeFinancialTransactions } from '@/lib/financial-summary';
import { useAsyncResource, useReduceMotion } from '@/lib/hooks';
import { listLayout } from '@/lib/motion';
import { accountTypeLabel, convertCurrency, formatCategoryLabel, formatCurrency, isUncategorizedLabel, parseCurrency, FIXED_FX_LABEL, type SupportedCurrency } from '@/lib/format';
import type { FinancialAccount, PendingTransaction, TransactionSummary } from '@/lib/domain';
import { DEFAULT_FINANCIAL_ACCOUNT_COLOR, FINANCIAL_ACCOUNT_COLORS } from '@/lib/financial-accounts';

const views = [
  { value: 'overview', label: 'Resumen' },
  { value: 'accounts', label: 'Cuentas' },
  { value: 'activity', label: 'Movimientos' },
] as const;

const periods = [
  { value: 'month', label: 'Ciclo' },
  { value: 'year', label: 'Año' },
] as const;

const displayCurrencies = [
  { value: 'UYU', label: 'UYU' },
  { value: 'USD', label: 'USD' },
] as const;

const mixModes = [
  { value: 'category', label: '', icon: 'pie-chart' as const, accessibilityLabel: 'Category' },
  { value: 'merchant', label: '', icon: 'shopping-bag' as const, accessibilityLabel: 'Merchant' },
] as const;

type FinanceView = (typeof views)[number]['value'];
type FinancePeriod = (typeof periods)[number]['value'];
type MixMode = (typeof mixModes)[number]['value'];
type TrendMode = 'line' | 'bars';
type TransactionKindFilter = 'all' | 'expense' | 'income' | 'transfer';
type TransactionSort = 'recent' | 'oldest' | 'highest' | 'lowest';
type ManualEntryKind = 'expense' | 'income';

const TRANSACTION_CYCLE_LIMIT = 1000;

const transactionSortLabels: Record<TransactionSort, string> = {
  recent: 'Recientes',
  oldest: 'Más antiguos',
  highest: 'Mayor importe',
  lowest: 'Menor importe',
};

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
) {
  const currentStart = new Date(currentFinancialPeriodRange(financialPeriodStartDay).from);
  const points = Array.from({ length: monthCount }, (_, index) => {
    const start = new Date(currentStart.getFullYear(), currentStart.getMonth() - (monthCount - 1 - index), financialPeriodStartDay);
    const next = new Date(start.getFullYear(), start.getMonth() + 1, financialPeriodStartDay);
    const end = new Date(next.getTime() - 1);
    return {
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

  return points.map(({ label, periodLabel, income, spending }) => ({ label, periodLabel, income: Math.max(0, income), spending: Math.max(0, spending) }));
}

function groupTransactionsInCurrency(
  transactions: TransactionSummary[],
  field: 'category' | 'merchant',
  currency: SupportedCurrency,
) {
  const groups = new Map<string, TransactionSummary[]>();
  transactions.forEach((transaction) => {
    const label = field === 'category' ? transaction.category || 'Uncategorized' : transaction.displayMerchantLabel ?? transaction.merchantLabel;
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

export default function FinancialsScreen() {
  const { client, financialDataRevision, invalidateFinancialData, settings, theme } = useAppState();
  const [view, setView] = useState<FinanceView>('overview');
  const [period, setPeriod] = useState<FinancePeriod>('month');
  const [mixMode, setMixMode] = useState<MixMode>('category');
  const [trendMode, setTrendMode] = useState<TrendMode>('line');
  const [displayCurrency, setDisplayCurrency] = useState<SupportedCurrency>('UYU');
  const [selectedMixId, setSelectedMixId] = useState<string | null>(null);
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
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const financialPeriodRange = useMemo(() => currentFinancialPeriodRange(settings.financialPeriodStartDay), [settings.financialPeriodStartDay]);
  const cycleLabel = financialPeriodLabel(financialPeriodRange);
  const selectedTransactionCycleRange = useMemo(
    () => financialPeriodRangeAtOffset(settings.financialPeriodStartDay, transactionCycleOffset),
    [settings.financialPeriodStartDay, transactionCycleOffset],
  );
  const selectedTransactionCycleLabel = financialPeriodLabel(selectedTransactionCycleRange);
  const selectedTransactionCycleMonth = new Date(selectedTransactionCycleRange.to).toLocaleDateString(undefined, { month: 'short' });

  useEffect(() => {
    if (transactionCycleOffset === 0) return;
    let active = true;
    void client.listTransactions(TRANSACTION_CYCLE_LIMIT, selectedTransactionCycleRange)
      .then((items) => { if (active) setHistoricalTransactions(items); })
      .catch(() => { if (active) setHistoricalTransactions([]); })
      .finally(() => { if (active) setHistoricalTransactionsLoading(false); });
    return () => { active = false; };
  }, [client, financialDataRevision, selectedTransactionCycleRange, transactionCycleOffset]);

  const transactions = data?.transactions ?? [];
  const pendingTransactions = data?.pendingTransactions ?? [];
  const selectedCycleTransactions = transactionCycleOffset === 0 ? transactions : historicalTransactions;
  const selectedCycleTransactionsLoading = transactionCycleOffset > 0 && historicalTransactionsLoading;
  const filteredCycleTransactions = useMemo(() => {
    const filtered = transactionKindFilter === 'all' ? selectedCycleTransactions : selectedCycleTransactions.filter((transaction) => transaction.kind === transactionKindFilter);
    return filtered.slice().sort((left, right) => {
      const leftDate = new Date(left.observedAt ?? 0).getTime();
      const rightDate = new Date(right.observedAt ?? 0).getTime();
      if (transactionSort === 'recent') return rightDate - leftDate;
      if (transactionSort === 'oldest') return leftDate - rightDate;
      const amountDifference = displayAmount(left, displayCurrency) - displayAmount(right, displayCurrency);
      return transactionSort === 'highest' ? (amountDifference === 0 ? rightDate - leftDate : -amountDifference) : (amountDifference === 0 ? rightDate - leftDate : amountDifference);
    });
  }, [displayCurrency, selectedCycleTransactions, transactionKindFilter, transactionSort]);

  const accounts = data?.accounts ?? [];
  const selectedTransactions = useMemo(
    () => selectedTransactionIds.map((id) => selectedCycleTransactions.find((transaction) => transaction.id === id)).filter((transaction): transaction is TransactionSummary => Boolean(transaction)),
    [selectedCycleTransactions, selectedTransactionIds],
  );
  const transactionSelectionMode = selectedTransactionIds.length > 0;
  const insights = data?.insights ?? [];
  const financeInsights = insights.filter((insight) => insight.detectors?.some((detector) => ['spending_variation', 'recurrence_subscription'].includes(detector)));
  const reportTransactions = transactions.filter((transaction) => !transaction.excludedFromReports);
  const expenses = reportTransactions.filter((transaction) => transaction.kind === 'expense');
  const financialSummary = summarizeFinancialTransactions(transactions, displayCurrency);
  const periodMultiplier = period === 'year' ? 12 : 1;
  const periodSpend = financialSummary.expenses * periodMultiplier;
  const periodIncome = financialSummary.income * periodMultiplier;
  const periodNet = (financialSummary.income - financialSummary.expenses) * periodMultiplier;
  const categoryGroups = useMemo(() => groupTransactionsInCurrency(expenses, 'category', displayCurrency), [displayCurrency, expenses]);
  const merchantGroups = useMemo(() => groupTransactionsInCurrency(expenses, 'merchant', displayCurrency), [displayCurrency, expenses]);
  const mixGroups = mixMode === 'category' ? categoryGroups : merchantGroups;
  const monthlyCashFlow = useMemo(
    () => buildMonthlyCashFlow(data?.trendTransactions ?? [], settings.financialPeriodStartDay, displayCurrency),
    [data?.trendTransactions, displayCurrency, settings.financialPeriodStartDay],
  );
  const totalAccountBalance = accounts.reduce((total, account) => total + convertCurrency(parseCurrency(account.balance), account.currency ?? 'UYU', displayCurrency), 0);
  const hasCurrencyConversion = hasFinancialCurrencyConversion(transactions, displayCurrency) || accounts.some((account) => (account.currency ?? 'UYU') !== displayCurrency);
  const displayTotal = (value: number) => `${hasCurrencyConversion ? '≈ ' : ''}${formatCurrency(value, displayCurrency)}`;
  const portfolioSegments = accounts.map((account) => {
    const convertedBalance = convertCurrency(parseCurrency(account.balance), account.currency ?? 'UYU', displayCurrency);
    return { id: account.id, label: account.name, value: Math.abs(convertedBalance), displayValue: convertedBalance, color: account.color };
  });
  const mixSegments = mixGroups.length
    ? mixGroups.map((group) => ({ id: group.label, label: formatCategoryLabel(group.label), value: group.total * periodMultiplier }))
    : [];
  const selectedMixGroup = mixGroups.find((group) => group.label === selectedMixId);

  function openCreateAccount() {
    setEditingAccount(null);
    setAccountName('');
    setAccountMask('');
    setAccountCurrency(displayCurrency);
    setAccountColor(DEFAULT_FINANCIAL_ACCOUNT_COLOR);
    setAccountEditorOpen(true);
  }

  function openEditAccount(account: FinancialAccount) {
    setEditingAccount(account);
    setAccountName(account.name);
    setAccountMask(account.mask ?? '');
    setAccountCurrency(account.currency ?? 'UYU');
    setAccountColor(account.color ?? DEFAULT_FINANCIAL_ACCOUNT_COLOR);
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
      const baseInput = { title: entryTitle.trim(), kind: entryKind, amount, currency: entryCurrency, category: entryCategory.trim() || null, accountId: entryAccountId };
      if (editingPending) await client.updatePendingTransaction(editingPending.id, { ...baseInput, estimatedExecutionDate: entryDate });
      else if (entryIsPending) await client.createPendingTransaction({ ...baseInput, estimatedExecutionDate: entryDate });
      else await client.createManualTransaction({ ...baseInput, observedAt: localDateToIso(entryDate) });
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
    Alert.alert('¿Cancelar el pendiente?', message, [
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
      await client.updateTransactionContext(canonical.id, { category: consolidationCategory, accountId: consolidationAccountId });
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
      Alert.alert('No se pudo guardar la cuenta', saveError instanceof Error ? saveError.message : 'Inténtalo de nuevo.');
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
        Alert.alert('Cuenta eliminada', `${result.detachedTransactions} ${result.detachedTransactions === 1 ? 'transacción permanece' : 'transacciones permanecen'} en tu historial sin una cuenta asignada.`);
      }
    } catch (deleteError) {
      Alert.alert('No se pudo eliminar la cuenta', deleteError instanceof Error ? deleteError.message : 'Inténtalo de nuevo.');
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
    Alert.alert('¿Eliminar la cuenta?', message, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => void deleteAccount(account) },
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
      Alert.alert('Saldo inválido', 'Ingresa el saldo actual de la cuenta como número.');
      return;
    }
    setSaving(true);
    try {
      await client.createBalanceAdjustment(adjustingAccount.id, { targetBalance: parsedTarget, note: adjustmentNote.trim() || undefined });
      setAdjustingAccount(null);
      await refresh();
    } catch (saveError) {
      Alert.alert('No se pudo ajustar el saldo', saveError instanceof Error ? saveError.message : 'Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      title="Dinero"
      overline={cycleLabel}
      subtitle="Dónde se movió tu dinero y qué cambió."
      refreshing={loading}
      onRefresh={refresh}
      actions={<Tag label={loading ? 'Actualizando' : error ? 'Sin conexión' : 'Actual'} tone={error ? 'warning' : 'positive'} />}
    >
      {error ? <StateView kind="error" title="No se pudo cargar Dinero" description={error} actionLabel="Reintentar" onAction={refresh} /> : null}
      {loading && !data ? <StateView kind="loading" title="Cargando" skeleton="chart" skeletonCount={2} /> : null}

      {data ? (
        <>
          <View style={{ gap: 8 }}>
            <SegmentedControl items={views as unknown as typeof views} value={view} onChange={setView} scrollable />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              {hasCurrencyConversion ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted, flex: 1 }]}>{FIXED_FX_LABEL}</Text> : <View style={{ flex: 1 }} />}
              <SegmentedControl items={displayCurrencies as unknown as typeof displayCurrencies} value={displayCurrency} onChange={setDisplayCurrency} size="mini" accessibilityLabel="Display currency" />
            </View>
          </View>

          <StaggerGroup key={view}>
          {view === 'overview' ? (
            <>
              <MixCard
                overline={`Gastos · ${period === 'year' ? 'año proyectado' : cycleLabel}`}
                title="Distribución de gastos"
                action={<SegmentedControl items={mixModes as unknown as typeof mixModes} value={mixMode} onChange={setMixMode} size="mini" />}
                segments={mixSegments}
                centerValue={displayTotal(periodSpend)}
                centerAmount={periodSpend}
                currency={displayCurrency}
                centerLabel="Gasto total"
                selectedId={selectedMixId}
                onSelect={(segment) => setSelectedMixId(segment?.id ?? null)}
                formatValue={(value) => formatCurrency(value, displayCurrency)}
                delta={{ text: period === 'year' ? 'Proyectado desde este ciclo' : 'Ciclo actual', tone: 'neutral' }}
                percentageNoun="spend"
              />

              <GlassSurface level="strong" tone="finance" padding="lg" contentStyle={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[theme.typography.overline, { color: theme.colors.textMuted }]}>Movimiento neto</Text>
                    <Text style={[theme.typography.headline, { color: theme.colors.textSecondary, fontSize: 14 }]}>{period === 'year' ? 'Proyección anual basada en los datos del ciclo actual.' : cycleLabel}</Text>
                  </View>
                  <View style={{ flexShrink: 0 }}>
                    <SegmentedControl
                      role="radio"
                      items={periods.map((item) => ({ ...item, accessibilityLabel: `Período financiero: ${item.value === 'year' ? 'Año' : 'Ciclo'}` }))}
                      value={period}
                      onChange={setPeriod}
                      size="mini"
                    />
                  </View>
                </View>
                <Amount value={periodNet} currency={displayCurrency} tone={periodNet >= 0 ? 'positive' : 'expense'} size="hero" signed />
                <View style={{ flexDirection: 'row', gap: 18 }}>
                  <View style={{ gap: 2 }}>
                    <Text style={[theme.typography.overline, { color: theme.colors.textMuted }]}>Ingresos</Text>
                    <FinancialTotal value={periodIncome} currency={displayCurrency} approximate={hasCurrencyConversion} style={[theme.typography.bodyStrong, { color: theme.status.income, fontVariant: ['tabular-nums'] }]} />
                  </View>
                  <View style={{ gap: 2 }}>
                    <Text style={[theme.typography.overline, { color: theme.colors.textMuted }]}>Gastos</Text>
                    <FinancialTotal value={periodSpend} currency={displayCurrency} approximate={hasCurrencyConversion} style={[theme.typography.bodyStrong, { color: theme.status.expense, fontVariant: ['tabular-nums'] }]} />
                  </View>
                </View>
              </GlassSurface>

              <Section title="Cuentas" subtitle="Los saldos incluyen transferencias y ajustes." actionLabel="Gestionar" onActionPress={() => setView('accounts')} count={accounts.length}>
                <GlassSurface level="thin" padding="md" contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <IconTile icon="credit-card" color={theme.colors.accent} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[theme.typography.overline, { color: theme.colors.textMuted }]}>Total disponible</Text>
                    <FinancialTotal value={totalAccountBalance} currency={displayCurrency} approximate={hasCurrencyConversion} style={[theme.typography.headline, { color: totalAccountBalance >= 0 ? theme.colors.textPrimary : theme.status.expense }]} />
                  </View>
                  <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{accounts.length} {accounts.length === 1 ? 'cuenta' : 'cuentas'}</Text>
                </GlassSurface>
                {accounts.slice(0, 2).map((account) => (
                  <AccountRow
                    key={account.id}
                    account={account}
                    displayCurrency={displayCurrency}
                    expanded={false}
                    onToggle={() => { setView('accounts'); setExpandedAccountId(account.id); }}
                    onEdit={() => openEditAccount(account)}
                    onAdjust={() => openAdjustment(account)}
                    onDelete={() => confirmDeleteAccount(account)}
                    deleting={deletingAccountId === account.id}
                  />
                ))}
              </Section>

              <Section title="Flujo de caja" subtitle="Ingresos y gastos de los últimos seis ciclos.">
                <TrendChart
                  mode={trendMode}
                  title={trendMode === 'line' ? 'Ingresos y gastos' : 'Movimiento mensual'}
                  subtitle={cycleLabel}
                  labels={monthlyCashFlow.map((point) => point.label)}
                  series={[
                    { label: 'Ingresos', color: theme.status.income, data: monthlyCashFlow.map((point) => point.income) },
                    { label: 'Gastos', color: theme.status.expense, data: monthlyCashFlow.map((point) => point.spending) },
                  ]}
                  formatValue={(value) => formatCurrency(value, displayCurrency)}
                  action={<SegmentedControl items={[{ value: 'line', label: 'Línea' }, { value: 'bars', label: 'Barras' }] as const} value={trendMode} onChange={(value) => setTrendMode(value as TrendMode)} size="mini" />}
                />
              </Section>

              {selectedMixGroup ? (
                <Section title={selectedMixGroup.label} subtitle={`${selectedMixGroup.count} transactions in this group`} actionLabel="Clear" onActionPress={() => setSelectedMixId(null)}>
                  {selectedMixGroup.items.slice(0, 3).map((transaction) => (
                    <TransactionRow key={transaction.id} transaction={transaction} currency={displayCurrency} onPress={() => router.push(`/transaction/${transaction.id}`)} />
                  ))}
                </Section>
              ) : null}

              {financeInsights.length ? (
                <Section title="Señales" subtitle="Patrones que vale la pena notar este ciclo.">
                  {financeInsights.slice(0, 2).map((insight) => (
                    <SignalCard key={insight.id} variant="card" origin="model" title={insight.title} summary={insight.summary} confidence={insight.confidence} onPress={() => router.push(`/insight/${insight.id}`)} />
                  ))}
                </Section>
              ) : null}

              <Section title="Actividad reciente" subtitle="Tus últimos movimientos, con acceso directo a su evidencia." actionLabel="Ver todo" onActionPress={() => setView('activity')}>
                {transactions.length ? transactions.slice(0, 3).map((transaction) => (
                  <TransactionRow key={transaction.id} transaction={transaction} currency={displayCurrency} onPress={() => router.push(`/transaction/${transaction.id}`)} />
                )) : <StateView title="Sin actividad reciente" description="Aquí aparecerán tus notas, notificaciones, correos y movimientos." />}
              </Section>

              {pendingTransactions.length ? (
                <Section title="Pendientes" subtitle="Cobros y deudas previstos. No afectan tus saldos hasta ejecutarlos." count={pendingTransactions.length} actionLabel="Open" onActionPress={() => setView('activity')}>
                  {pendingTransactions.slice(0, 2).map((pending) => (
                    <PendingTransactionRow key={pending.id} pending={pending} onExecute={() => { setExecutionDate(localDateInputValue()); setExecutingPending(pending); }} onEdit={() => openPendingEditor(pending)} onCancel={() => confirmCancelPending(pending)} />
                  ))}
                </Section>
              ) : null}
            </>
          ) : null}

          {view === 'accounts' ? (
            <>
              <MixCard
                overline="Cartera · hoy"
                title="Distribución de la cartera"
                segments={portfolioSegments}
                centerValue={displayTotal(totalAccountBalance)}
                centerAmount={totalAccountBalance}
                currency={displayCurrency}
                centerLabel="Cartera neta"
                formatValue={(value) => formatCurrency(value, displayCurrency)}
                percentageNoun="portfolio"
                delta={{ text: 'Los saldos incluyen transferencias', tone: 'neutral' }}
              />
              <Button label="Crear cuenta" icon={<Feather name="plus" size={16} color={theme.colors.onAccent} />} onPress={openCreateAccount} full />
              <View style={{ gap: 22 }}>
              {accounts.length ? accounts.map((account) => (
                <AccountRow
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
              )) : <StateView title="Todavía no hay cuentas" description="Crea una cuenta y luego establece su saldo actual con un ajuste." actionLabel="Crear cuenta" onAction={openCreateAccount} />}
              </View>
            </>
          ) : null}

          {view === 'activity' ? (
            <>
              <GlassSurface level="thin" padding="sm" contentStyle={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <GlassPressable accessibilityRole="button" accessibilityLabel="Ver ciclo anterior" onPress={() => { setHistoricalTransactionsLoading(true); setTransactionCycleOffset((offset) => offset + 1); }} style={{ width: theme.layout.minTarget, height: theme.layout.minTarget, alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="chevron-left" size={18} color={theme.colors.textPrimary} />
                  </GlassPressable>
                  <Text style={[theme.typography.caption, { color: theme.colors.textPrimary, minWidth: 40, textAlign: 'center' }]}>{selectedTransactionCycleMonth}</Text>
                  <GlassPressable accessibilityRole="button" accessibilityLabel="Ver próximo ciclo" disabled={transactionCycleOffset === 0} onPress={() => { setHistoricalTransactionsLoading(transactionCycleOffset > 1); setTransactionCycleOffset((offset) => Math.max(0, offset - 1)); }} style={{ width: theme.layout.minTarget, height: theme.layout.minTarget, alignItems: 'center', justifyContent: 'center', opacity: transactionCycleOffset === 0 ? 0.35 : 1 }}>
                    <Feather name="chevron-right" size={18} color={theme.colors.textPrimary} />
                  </GlassPressable>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Chip label={transactionSortLabels[transactionSort]} icon="sliders" onPress={() => setTransactionFiltersOpen(true)} />
                  <Chip label={`${filteredCycleTransactions.length}`} static />
                </View>
              </GlassSurface>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted, flex: 1 }]}>{transactionSelectionMode ? 'Toca los registros que quieres comparar.' : selectedTransactionCycleLabel}</Text>
                {!transactionSelectionMode ? <Button label="Nuevo" size="sm" icon={<Feather name="plus" size={14} color={theme.colors.onAccent} />} onPress={() => openEntryEditor(false)} /> : null}
              </View>

              {selectedTransactionIds.length ? (
                <GlassSurface level="regular" tone="finance" padding="md" contentStyle={{ gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{`${selectedTransactionIds.length} de 2 seleccionados`}</Text>
                    <Chip label="Cancelar" onPress={() => setSelectedTransactionIds([])} />
                  </View>
                  {selectedTransactionIds.length === 2 ? <Button label="Revisar y consolidar" size="sm" onPress={openConsolidation} /> : <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Toca otro movimiento para compararlo.</Text>}
                </GlassSurface>
              ) : null}

              {selectedCycleTransactionsLoading ? <StateView kind="loading" title="Cargando" skeleton="list" skeletonCount={3} /> : null}
              {!selectedCycleTransactionsLoading && filteredCycleTransactions.length ? (
                <View>
                  {filteredCycleTransactions.map((transaction) => (
                    <TransactionRow
                      key={transaction.id}
                      transaction={transaction}
                      currency={displayCurrency}
                      selected={selectedTransactionIds.includes(transaction.id)}
                      selectionMode={transactionSelectionMode}
                      onLongPress={() => toggleTransactionSelection(transaction)}
                      onPress={() => transactionSelectionMode ? toggleTransactionSelection(transaction) : router.push(`/transaction/${transaction.id}`)}
                    />
                  ))}
                </View>
              ) : null}
              {!selectedCycleTransactionsLoading && !filteredCycleTransactions.length ? <StateView title="Sin movimientos coincidentes" description="Prueba otro período o cambia el filtro." /> : null}

              <Section title="Pendientes" subtitle="Cobros y deudas previstos. No afectan tus saldos hasta ejecutarlos." count={pendingTransactions.length}>
                <Button label="Nuevo pendiente" size="sm" variant="secondary" onPress={() => openEntryEditor(true)} />
                {pendingTransactions.length ? pendingTransactions.map((pending) => (
                  <PendingTransactionRow key={pending.id} pending={pending} onExecute={() => { setExecutionDate(localDateInputValue()); setExecutingPending(pending); }} onEdit={() => openPendingEditor(pending)} onCancel={() => confirmCancelPending(pending)} />
                )) : <StateView title="No hay pendientes" description="Anota un cobro o una deuda futura para tenerla presente sin alterar tu balance." actionLabel="Crear pendiente" onAction={() => openEntryEditor(true)} />}
              </Section>
            </>
          ) : null}
          </StaggerGroup>
        </>
      ) : null}

      <BottomSheet visible={consolidationOpen} title="Consolidar movimientos" onClose={() => !consolidating && setConsolidationOpen(false)}>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Se conservará un único movimiento y las fuentes del otro quedarán adjuntas como evidencia. Elige qué información representa el pago real.</Text>
        <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Monto y movimiento principal</Text>
        {selectedTransactions.map((transaction) => (
          <Row key={transaction.id} title={`${transaction.displayMerchantLabel ?? transaction.merchantLabel} · ${formatCurrency(parseCurrency(transaction.amount), transaction.currency)}`} subtitle={transaction.observedAt} trailing={<Text style={{ color: canonicalTransactionId === transaction.id ? theme.colors.success : theme.colors.textMuted }}>{canonicalTransactionId === transaction.id ? 'Conservar' : 'Usar'}</Text>} onPress={() => setCanonicalTransactionId(transaction.id)} />
        ))}
        <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Categoría</Text>
        {Array.from(new Set(selectedTransactions.map((transaction) => transaction.category).filter((category): category is string => Boolean(category)))).map((category) => (
          <Chip key={category} label={formatCategoryLabel(category)} selected={consolidationCategory === category} onPress={() => setConsolidationCategory(category)} />
        ))}
        {!consolidationCategory ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Ninguno tiene categoría: el movimiento quedará sin categorizar.</Text> : null}
        <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Cuenta o método de pago</Text>
        {Array.from(new Set(selectedTransactions.map((transaction) => transaction.accountId).filter((accountId): accountId is string => Boolean(accountId)))).map((accountId) => {
          const account = accounts.find((candidate) => candidate.id === accountId);
          return <Row key={accountId} title={account?.name ?? 'Cuenta vinculada'} subtitle={account?.currency ?? ''} trailing={<Text style={{ color: consolidationAccountId === accountId ? theme.colors.success : theme.colors.textMuted }}>{consolidationAccountId === accountId ? 'Conservar' : 'Usar'}</Text>} onPress={() => setConsolidationAccountId(accountId)} />;
        })}
        {!consolidationAccountId ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Ninguno tiene una cuenta asociada.</Text> : null}
        {consolidationError ? <Text style={{ color: theme.colors.danger }}>{consolidationError}</Text> : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button label="Consolidar" loading={consolidating} disabled={!canonicalTransactionId || selectedTransactions.length !== 2} onPress={consolidateSelectedTransactions} />
          <Button label="Cancelar" variant="secondary" disabled={consolidating} onPress={() => setConsolidationOpen(false)} />
        </View>
      </BottomSheet>

      <BottomSheet visible={accountEditorOpen} title={editingAccount ? 'Editar cuenta' : 'Crear cuenta'} onClose={() => setAccountEditorOpen(false)} footer={<Button label={editingAccount ? 'Guardar cambios' : 'Crear cuenta'} onPress={saveAccount} loading={saving} disabled={!accountName.trim()} full />}>
        <Field label="Nombre de la cuenta" value={accountName} onChangeText={setAccountName} placeholder="Cuenta bancaria principal" autoCapitalize="words" />
        <Field label="Últimos dígitos (opcional)" value={accountMask} onChangeText={setAccountMask} placeholder="•••• 5343" />
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Moneda</Text>
        <SegmentedControl items={displayCurrencies as unknown as typeof displayCurrencies} value={accountCurrency} onChange={(value) => setAccountCurrency(value as SupportedCurrency)} />
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Color de la cuenta</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {FINANCIAL_ACCOUNT_COLORS.map((option) => (
            <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ selected: accountColor === option.value }} onPress={() => setAccountColor(option.value)} style={{ width: theme.layout.minTarget, height: theme.layout.minTarget, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: option.value, borderWidth: accountColor === option.value ? 3 : 0, borderColor: theme.colors.textPrimary }}>
              {accountColor === option.value ? <Feather name="check" size={18} color={theme.colors.onAccent} /> : null}
            </Pressable>
          ))}
        </View>
      </BottomSheet>

      <BottomSheet visible={Boolean(adjustingAccount)} title="Ajustar saldo de la cuenta" onClose={() => setAdjustingAccount(null)}>
        {adjustingAccount ? (
          <>
            <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Establece el saldo real de {adjustingAccount.name}. Brain IA creará un ingreso o gasto excluido por la diferencia.</Text>
            <Field label={`Saldo actual (${adjustingAccount.currency ?? 'UYU'})`} value={targetBalance} onChangeText={setTargetBalance} keyboardType="decimal-pad" placeholder="0.00" />
            <Field label="Nota (opcional)" value={adjustmentNote} onChangeText={setAdjustmentNote} placeholder="Conciliación de saldo" />
            <Button label="Ajustar saldo" onPress={saveAdjustment} loading={saving} />
          </>
        ) : null}
      </BottomSheet>

      <BottomSheet visible={entryEditorOpen} title={editingPending ? 'Editar pendiente' : entryIsPending ? 'Nuevo pendiente' : 'Nuevo movimiento'} onClose={() => !entrySaving && setEntryEditorOpen(false)} footer={<Button label={editingPending ? 'Guardar cambios' : entryIsPending ? 'Guardar pendiente' : 'Guardar movimiento'} onPress={saveEntry} loading={entrySaving} disabled={!entryTitle.trim() || !entryAmount.trim()} full />}>
        {!editingPending ? (
          <>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Registro</Text>
            <SegmentedControl items={[{ value: 'posted', label: 'Movimiento' }, { value: 'pending', label: 'Pendiente' }]} value={entryIsPending ? 'pending' : 'posted'} onChange={(value) => setEntryIsPending(value === 'pending')} />
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{entryIsPending ? 'No afectará tus saldos hasta que lo marques como ejecutado.' : 'Afectará tus saldos e informes al guardarlo.'}</Text>
          </>
        ) : null}
        <Field label="Título" value={entryTitle} onChangeText={setEntryTitle} placeholder="Ej. Cobro de cliente" />
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Tipo</Text>
        <SegmentedControl items={[{ value: 'expense', label: 'Gasto' }, { value: 'income', label: 'Ingreso' }]} value={entryKind} onChange={(value) => setEntryKind(value as ManualEntryKind)} />
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Moneda</Text>
        <SegmentedControl items={displayCurrencies as unknown as typeof displayCurrencies} value={entryCurrency} onChange={(value) => { setEntryCurrency(value as SupportedCurrency); setEntryAccountId(null); }} />
        <Field label={`Monto (${entryCurrency})`} value={entryAmount} onChangeText={setEntryAmount} keyboardType="decimal-pad" placeholder="0.00" variant="amount" />
        <Field label="Categoría (opcional)" value={entryCategory} onChangeText={setEntryCategory} placeholder={entryKind === 'income' ? 'Ej. Sueldo' : 'Ej. Servicios'} />
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Cuenta (opcional)</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Chip label="Sin cuenta" selected={!entryAccountId} onPress={() => setEntryAccountId(null)} />
          {accounts.filter((account) => (account.currency ?? 'UYU') === entryCurrency).map((account) => (
            <Chip key={account.id} label={account.name} selected={entryAccountId === account.id} onPress={() => setEntryAccountId(account.id)} />
          ))}
        </View>
        <Field label={entryIsPending ? 'Fecha estimada de ejecución' : 'Fecha del movimiento'} value={entryDate} onChangeText={setEntryDate} placeholder="AAAA-MM-DD" autoCapitalize="none" />
      </BottomSheet>

      <BottomSheet visible={Boolean(executingPending)} title="Marcar como ejecutado" onClose={() => !entrySaving && setExecutingPending(null)}>
        {executingPending ? (
          <>
            <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>“{executingPending.title}” pasará a Movimientos y empezará a afectar tus saldos e informes.</Text>
            <Field label="Fecha real de ejecución" value={executionDate} onChangeText={setExecutionDate} placeholder="AAAA-MM-DD" autoCapitalize="none" />
            <Button label="Confirmar ejecución" onPress={executePending} loading={entrySaving} />
          </>
        ) : null}
      </BottomSheet>

      <BottomSheet visible={transactionFiltersOpen} title="Filtrar movimientos" onClose={() => setTransactionFiltersOpen(false)}>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Tipo</Text>
        <SegmentedControl scrollable items={[{ value: 'all', label: 'Todos' }, { value: 'expense', label: 'Gastos' }, { value: 'income', label: 'Ingresos' }, { value: 'transfer', label: 'Transferencias' }]} value={transactionKindFilter} onChange={setTransactionKindFilter} />
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Ordenar</Text>
        <SegmentedControl scrollable items={[{ value: 'recent', label: 'Recientes' }, { value: 'oldest', label: 'Más antiguos' }, { value: 'highest', label: 'Mayor importe' }, { value: 'lowest', label: 'Menor importe' }]} value={transactionSort} onChange={setTransactionSort} />
        <Button label="Listo" onPress={() => setTransactionFiltersOpen(false)} />
      </BottomSheet>
    </Screen>
  );
}

function FinancialTotal({ value, currency, approximate, style }: { value: number; currency: SupportedCurrency; approximate: boolean; style: TextProps['style'] }) {
  const display = useCountedAmount(value);
  const format = (amount: number) => `${approximate ? '≈ ' : ''}${formatCurrency(amount, currency)}`;
  return <Text accessibilityLabel={format(value)} style={style}>{format(display)}</Text>;
}

function AccountRow({
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
  const reduceMotion = useReduceMotion();
  const nativeCurrency = account.currency ?? 'UYU';
  const nativeBalance = parseCurrency(account.balance);
  const convertedBalance = convertCurrency(nativeBalance, nativeCurrency, displayCurrency);
  const accountColor = account.color ?? DEFAULT_FINANCIAL_ACCOUNT_COLOR;

  return (
    <Animated.View layout={reduceMotion ? undefined : listLayout} exiting={reduceMotion ? undefined : FadeOut.duration(theme.motion.duration.quick).easing(Easing.bezier(...theme.motion.easing.in))}>
      <GlassSurface level={expanded ? 'regular' : 'thin'} padding="none" style={{ borderColor: expanded ? `${accountColor}55` : theme.glass.divider }}>
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: accountColor, zIndex: 2 }} />
        <GlassPressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${account.name}, ${nativeCurrency !== displayCurrency ? 'aproximadamente ' : ''}${formatCurrency(convertedBalance, displayCurrency)}. ${expanded ? 'Collapse account options' : 'Expand account options'}`}
          onPress={onToggle}
          scaleTo={0.99}
          style={{ minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingLeft: 15, paddingRight: 10, paddingVertical: 8, gap: 10 }}
        >
          <IconTile icon="credit-card" size="lg" color={accountColor} tint={`${accountColor}22`} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text numberOfLines={1} style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{account.name}</Text>
            <Text numberOfLines={1} style={[theme.typography.caption, { color: theme.colors.textSecondary, textTransform: 'capitalize' }]}>{accountTypeLabel(account.type)} · {nativeCurrency}{account.mask ? ` · ${account.mask}` : ''}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={[theme.typography.bodyStrong, { color: convertedBalance >= 0 ? theme.colors.textPrimary : theme.status.expense, fontVariant: ['tabular-nums'], maxWidth: 130 }]}>{nativeCurrency !== displayCurrency ? '≈ ' : ''}{formatCurrency(convertedBalance, displayCurrency)}</Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{nativeCurrency !== displayCurrency ? formatCurrency(nativeBalance, nativeCurrency) : 'Available'}</Text>
          </View>
          <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={theme.colors.textMuted} />
        </GlassPressable>
        {expanded ? (
          <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(theme.motion.duration.quick)} exiting={reduceMotion ? undefined : FadeOutUp.duration(theme.motion.duration.press)} style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.glass.divider }} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <GlassSurface level="thin" padding="sm" radius="md" style={{ flex: 1 }} contentStyle={{ gap: 2 }}>
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Saldo original</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary, fontVariant: ['tabular-nums'] }]}>{formatCurrency(nativeBalance, nativeCurrency)}</Text>
              </GlassSurface>
              <GlassSurface level="thin" padding="sm" radius="md" style={{ flex: 1 }} contentStyle={{ gap: 2 }}>
                <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: `${accountColor}14` }]} />
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Valor en cartera</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit style={[theme.typography.bodyStrong, { color: accountColor, fontVariant: ['tabular-nums'] }]}>{nativeCurrency !== displayCurrency ? '≈ ' : ''}{formatCurrency(convertedBalance, displayCurrency)}</Text>
              </GlassSurface>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Button label="Editar" variant="secondary" size="sm" onPress={onEdit} icon={<Feather name="edit-2" size={13} color={theme.colors.textPrimary} />} /></View>
              <View style={{ flex: 1 }}><Button label="Ajustar" variant="secondary" size="sm" onPress={onAdjust} icon={<Feather name="sliders" size={13} color={theme.colors.textPrimary} />} /></View>
            </View>
            <Button label={deleting ? 'Deleting account...' : 'Delete account'} variant="danger" size="sm" loading={deleting} onPress={onDelete} icon={<Feather name="trash-2" size={13} color={theme.colors.onAccent} />} />
          </Animated.View>
        ) : null}
      </GlassSurface>
    </Animated.View>
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
    <GlassSurface level="thin" padding="md" contentStyle={{ gap: 8 }}>
      <Row
        title={pending.title}
        subtitle={`${isIncome ? 'Ingreso previsto' : 'Gasto previsto'}${pending.category ? ` · ${formatCategoryLabel(pending.category)}` : ''}${pending.account ? ` · ${pending.account}` : ''}`}
        description={`Estimado: ${formatEstimatedExecutionDate(pending.estimatedExecutionDate)}`}
        leading={<IconTile icon={isIncome ? 'arrow-down-left' : 'arrow-up-right'} color={amountColor} />}
        trailing={<Amount value={pending.amount} currency={pending.currency} tone={isIncome ? 'income' : 'expense'} size="row" animated={false} />}
        accessory="none"
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Button label="Ejecutar" size="sm" onPress={onExecute} /></View>
        <Button label="Editar" size="sm" variant="secondary" onPress={onEdit} />
        <Button label="Cancelar" size="sm" variant="ghost" onPress={onCancel} accessibilityLabel={`Cancelar pendiente ${pending.title}`} />
      </View>
    </GlassSurface>
  );
}
