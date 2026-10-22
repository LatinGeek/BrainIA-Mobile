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

const categoryLabels: Record<string, string> = {
  'food / delivery': 'Comida / Delivery', 'food / groceries': 'Comida / Supermercado', subscriptions: 'Suscripciones',
  'bills / utilities': 'Cuentas / Servicios', transport: 'Transporte', shopping: 'Compras', health: 'Salud', home: 'Hogar',
  entertainment: 'Entretenimiento', 'going out': 'Salidas', income: 'Ingresos', salary: 'Sueldo', 'freelance / client': 'Freelance / Clientes',
  business: 'Negocio', refund: 'Reembolso', investments: 'Inversiones', interest: 'Intereses', gift: 'Regalo', 'other income': 'Otros ingresos',
};

export function formatCategoryLabel(value?: string | null) {
  if (isUncategorizedLabel(value)) return 'Falta revisar la categoría';
  const cleaned = cleanDisplayText(value ?? '');
  return categoryLabels[cleaned.toLowerCase()] ?? cleaned;
}

export function formatCategoryInsight(label: string | undefined, amount: string) {
  if (isUncategorizedLabel(label)) {
    return `Un área de gasto necesita revisar su categoría y suma ${amount}.`;
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
  const code = currency.trim().toUpperCase();
  // Records without a usable currency show the amount with an explicit label instead of guessing a currency.
  if (!/^[A-Z]{3}$/.test(code) || code === 'UNKNOWN') {
    return `${new Intl.NumberFormat('es-UY', { maximumFractionDigits: 2 }).format(value)} · moneda sin definir`;
  }
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: code,
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

export function formatConvertedCurrency(value: number, currency: SupportedCurrency) {
  return `≈ ${formatCurrency(value, currency)} convertido a ${UYU_PER_USD.toFixed(4)} UYU/USD`;
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

const eventKindLabels: Record<string, string> = {
  notification: 'Notificación', email: 'Correo', note: 'Nota', task: 'Tarea', wallet: 'Billetera', event: 'Evento', other: 'Otro',
  expense: 'Gasto', income: 'Ingreso', transfer: 'Transferencia', newfinancialtransaction: 'Nueva transacción',
};

export function formatEventKind(kind?: string | null) {
  const key = (kind ?? '').toLowerCase().replace(/[\s_-]+/g, '');
  return eventKindLabels[key] ?? (kind ?? '').replace(/[._-]+/g, ' ');
}

export function accountTypeLabel(type?: string) {
  const labels: Record<string, string> = { bank: 'Banco', cash: 'Efectivo', card: 'Tarjeta', credit: 'Crédito', savings: 'Ahorro', crypto: 'Cripto', investment: 'Inversión', wallet: 'Billetera' };
  return labels[(type ?? '').toLowerCase()] ?? (type ?? '');
}
