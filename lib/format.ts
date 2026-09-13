export function formatDate(value?: string) {
  if (!value) {
    return 'Unknown date';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function cleanDisplayText(value?: string) {
  if (!value) {
    return '';
  }

  return value
    .replace(/\r\n/g, '\n')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '- ')
    .replace(/[*_`]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function joinDisplayParts(parts: Array<string | undefined | null>, separator = ' | ') {
  return parts.map((part) => cleanDisplayText(part ?? '')).filter(Boolean).join(separator);
}

export function isUncategorizedLabel(value?: string | null) {
  const normalized = cleanDisplayText(value ?? '').toLowerCase();
  return !normalized || normalized === 'uncategorized' || normalized === 'unknown' || normalized === 'other';
}

export function formatCategoryLabel(value?: string | null) {
  return isUncategorizedLabel(value) ? 'Needs category review' : cleanDisplayText(value ?? '');
}

export function formatCategoryInsight(label: string | undefined, amount: string) {
  if (isUncategorizedLabel(label)) {
    return `A spending area needs category review and currently totals ${amount}.`;
  }

  return `${formatCategoryLabel(label)} is the largest spending area at ${amount}.`;
}

export function formatMonthLabel(value?: string) {
  if (!value) {
    return 'Recent activity';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function formatCurrency(value: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export type SupportedCurrency = 'UYU' | 'USD';

/**
 * Temporary user-configured reference rate for Money summaries. Individual
 * transactions always retain their captured currency and amount.
 */
export const UYU_PER_USD = 40;

export const FIXED_FX_LABEL = `${UYU_PER_USD.toFixed(4)} UYU/USD · fixed app reference`;

export function formatConvertedCurrency(value: number, currency: SupportedCurrency) {
  return `≈ ${formatCurrency(value, currency)} converted at ${UYU_PER_USD.toFixed(4)} UYU/USD`;
}

export function convertCurrency(value: number, fromCurrency: string, toCurrency: SupportedCurrency) {
  const source = fromCurrency.trim().toUpperCase();
  if (source === toCurrency) return value;
  if (source === 'USD' && toCurrency === 'UYU') return value * UYU_PER_USD;
  if (source === 'UYU' && toCurrency === 'USD') return value / UYU_PER_USD;
  return value;
}

export function parseCurrency(value: string) {
  const normalized = value.replace(/[^0-9.-]/g, '');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}
