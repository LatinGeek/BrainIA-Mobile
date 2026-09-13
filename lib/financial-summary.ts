import type { TransactionSummary } from './domain';
import { convertCurrency, parseCurrency, type SupportedCurrency } from './format';

/**
 * The canonical current-cycle calculation used by both Today and Money.
 * Transfers and balance adjustments do not represent income or spending.
 */
export function summarizeFinancialTransactions(
  transactions: TransactionSummary[],
  currency: SupportedCurrency,
) {
  return transactions.reduce(
    (summary, transaction) => {
      if (transaction.excludedFromReports) return summary;

      const amount = convertCurrency(parseCurrency(transaction.amount), transaction.currency, currency);
      if (transaction.kind === 'income') summary.income += amount;
      if (transaction.kind === 'expense') summary.expenses += amount;
      return summary;
    },
    { income: 0, expenses: 0 },
  );
}

export function hasFinancialCurrencyConversion(
  transactions: TransactionSummary[],
  currency: SupportedCurrency,
) {
  return transactions.some((transaction) => transaction.currency !== currency);
}
