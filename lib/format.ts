export function formatDate(value?: string) {
  if (!value) {
    return 'Fecha desconocida';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('es-UY', {
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
  return isUncategorizedLabel(value) ? 'Sin categoría' : cleanDisplayText(value ?? '');
}

export function formatCategoryInsight(label: string | undefined, amount: string) {
  if (isUncategorizedLabel(label)) {
    return `Un área de gasto necesita revisión de categoría y suma ${amount}.`;
  }

  return `${formatCategoryLabel(label)} es el área de mayor gasto con ${amount}.`;
}

export function formatMonthLabel(value?: string) {
  if (!value) {
    return 'Actividad reciente';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('es-UY', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function formatCurrency(value: number, currency = 'USD') {
  // Hermes throws "Malformed currency code" for empty or unknown codes.
  // Keep the formatter defensive because API payloads may omit currency.
  const normalized = /^[A-Za-z]{3}$/.test((currency ?? '').trim())
    ? currency.trim().toUpperCase()
    : 'UYU';
  // One format app-wide: ISO code, Spanish separators, up to two decimals.
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: normalized,
    currencyDisplay: 'code',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export type SupportedCurrency = 'UYU' | 'USD';

/**
 * Temporary user-configured reference rate for Money summaries. Individual
 * transactions always retain their captured currency and amount.
 */
export const UYU_PER_USD = 40;

export const FIXED_FX_LABEL = `${UYU_PER_USD.toFixed(4)} UYU/USD · referencia fija de la app`;

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
