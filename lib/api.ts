import { cleanDisplayText } from './format';
import { parseEventProgress } from './event-progress';
import {
  isReprocessStage,
  REPROCESS_STAGES,
  type ReprocessDisposition,
  type ReprocessExecution,
  type ReprocessJob,
  type ReprocessJobStatus,
  type ReprocessResult,
  type ReprocessStage,
} from './reprocess';
import { createV2Transport, type V2Transport } from '../contracts/brain-ai/2.0.0/mobile/transport.cjs';
import {
  BriefCard,
  DigestSummary,
  EntityDetail,
  EntityRole, EntitySemanticProfile, EntityTag,
  ExploreGraph,
  EntitySuggestion,
  FinancialAccount,
  DEFAULT_FINANCIAL_CATEGORIES,
  FinancialCategories,
  PendingTransaction,
  EntityLink,
  EventSummary,
  GraphRelation,
  InsightSummary,
  ReviewItem,
  SemanticActionKind,
  SemanticCandidate,
  SemanticEndpoint,
  SemanticEndpointKind,
  SemanticEvidence,
  SemanticVerificationStatus,
  SearchResultItem,
  SummaryMetric,
  TransactionDetail,
  TransactionSummary,
  V2QueuedRevision,
} from './domain';
import { recordDiagnostic } from './diagnostics';
import { readV2AccessToken, V2_ACCESS_TOKEN_KEY } from './storage';

export { V2_ACCESS_TOKEN_KEY };

type ClientConfig = {
  baseUrl: string;
  /** Provisioned v2 bearer credential; legacy API keys cannot authenticate v2. */
  accessToken?: string;
  apiKey?: string;
  clientId?: string;
};

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
};

function trimSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeNarrativeText(value: unknown, fallback = '') {
  const text = cleanDisplayText(asString(value, fallback));
  if (!text) {
    return fallback;
  }

  const normalized = text.toLowerCase();
  const technicalPatterns = [
    'not found',
    'no matching',
    'no results',
    'invalid',
    'unable to',
    'fallback',
    'current knowledge base',
    'could not load',
    'no data',
  ];

  if (technicalPatterns.some((pattern) => normalized.includes(pattern))) {
    return fallback;
  }

  return text;
}

function uniqueStrings(values: Array<string | undefined>, limit = 3) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim().length > 0)))).slice(0, limit);
}

function compactNarrative(value: unknown, fallback = '', maxLength = 320) {
  const text = normalizeNarrativeText(value, fallback)
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLength) return text;
  const clipped = text.slice(0, maxLength + 1);
  const punctuation = Math.max(clipped.lastIndexOf('.'), clipped.lastIndexOf('!'), clipped.lastIndexOf('?'));
  const sentence = punctuation >= Math.min(40, Math.floor(maxLength / 2)) ? clipped.slice(0, punctuation + 1).trim() : '';
  return sentence || `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function friendlyWindow(from: unknown, to: unknown) {
  const start = new Date(asString(from));
  const end = new Date(asString(to));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '';
  const format = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return start.toDateString() === end.toDateString() ? format(end) : `${format(start)} – ${format(end)}`;
}

function buildCacheKey(baseUrl: string, namespace: string) {
  return `${trimSlash(baseUrl)}:${namespace}`.replace(/[^a-zA-Z0-9._:-]+/g, '_');
}

type PreviewState = 'normal' | 'empty' | 'error' | 'edge' | 'loading';

function getBrowserLocation() {
  if (typeof window === 'undefined' || !window.location) {
    return null;
  }

  const origin = typeof window.location.origin === 'string' ? window.location.origin : '';
  const search = typeof window.location.search === 'string' ? window.location.search : '';

  if (!origin) {
    return null;
  }

  return { origin, search };
}

function isLocalWebPreview() {
  const location = getBrowserLocation();
  return Boolean(location && /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(location.origin));
}

function getLocalPreviewState(): PreviewState {
  const location = getBrowserLocation();
  if (!location || !isLocalWebPreview()) {
    return 'normal';
  }

  const value = new URLSearchParams(location.search).get('ux');
  return value === 'empty' || value === 'error' || value === 'edge' || value === 'loading' ? value : 'normal';
}

function throwPreviewError(label: string): never {
  throw new Error(`${label} could not refresh right now. Check the connection and try again.`);
}

function waitForPreviewLoading(): Promise<never> {
  return new Promise(() => {});
}

/** HTTP failure with the backend's stable error code and structured details. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: Record<string, unknown>;

  constructor(message: string, status: number, code?: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function safeFetchJson(baseUrl: string, path: string, options: RequestOptions = {}) {
  if (
    typeof window !== 'undefined' &&
    /^https:\/\/brain-ia-six\.vercel\.app\/?$/i.test(trimSlash(baseUrl)) &&
    isLocalWebPreview()
  ) {
    throw new Error('Conecta un backend local en Ajustes para cargar tus datos.');
  }

  const startedAt = Date.now();
  const hasBody = options.body !== undefined;
  const response = await fetch(`${trimSlash(baseUrl)}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(hasBody ? { 'content-type': 'application/json' } : {}),
      ...(options.headers ?? {}),
    },
    body: hasBody ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { message: text };
    }
  }

  if (!response.ok) {
    const message = isRecord(json) && asString(json.message) ? asString(json.message) : `HTTP ${response.status}`;
    const code = isRecord(json) && asString(json.error) ? asString(json.error) : undefined;
    void recordDiagnostic({
      type: 'error',
      label: `fetch ${path}`,
      detail: `${response.status} in ${Date.now() - startedAt}ms`,
    });
    throw new ApiRequestError(message, response.status, code, isRecord(json) ? json : undefined);
  }

  void recordDiagnostic({
    type: 'request',
    label: `fetch ${path}`,
    detail: `ok in ${Date.now() - startedAt}ms`,
  });

  return json;
}

async function resolveBundle<T>(
  cacheKey: string,
  loader: () => Promise<T>,
  _fallback: T,
  _preferCache = false,
  label = cacheKey
): Promise<{ value: T; source: 'live' | 'cache'; cachedAt?: string }> {
  try {
    const value = await loader();
    return { value, source: 'live' };
  } catch (error) {
    void recordDiagnostic({
      type: 'error',
      label,
      detail: error instanceof Error ? error.message : 'bundle load failed',
    });
    throw error;
  }
}

const demoMetrics: SummaryMetric[] = [
  { label: 'Today', value: '4 items', delta: 'ready to review', tone: 'neutral' },
  { label: 'Money', value: '$82.40', delta: 'this month', tone: 'warning' },
  { label: 'Review', value: '2', delta: 'decisions', tone: 'warning' },
  { label: 'Insights', value: '3', delta: 'new patterns', tone: 'positive' },
];

const demoInsights: InsightSummary[] = [
  {
    id: 'insight_finance',
    title: 'Food delivery is the biggest flexible spend',
    summary: 'Food delivery is outpacing other discretionary categories this period.',
    takeaways: ['Review recurring delivery merchants', 'Compare with groceries before next digest'],
    confidence: 0.88,
    timestamp: 'Today',
    relatedCount: 4,
  },
  {
    id: 'insight_spotify',
    title: 'Spotify appears as a recurring charge',
    summary: 'Spotify has repeated enough to treat it as a recurring subscription.',
    takeaways: ['Keep it under Subscriptions', 'Search merchant history for earlier charges'],
    confidence: 0.79,
    supportingReferences: [{ id: 'entity_spotify', label: 'Spotify', description: 'merchant', route: '/entity/entity_spotify', kind: 'entity' }],
    timestamp: 'This week',
    relatedCount: 2,
  },
];

const demoDigests: DigestSummary[] = [
  {
    id: 'digest_week',
    title: 'Weekly personal digest',
    summary: 'Spending, notes, and review decisions are ready for a quick weekly pass.',
    windowLabel: 'This week',
    eventCount: 12,
    relatedInsightCount: 2,
    metrics: [
      { label: 'Activity', value: '12 items' },
      { label: 'Money', value: '$82.40' },
      { label: 'Review', value: '2 decisions' },
    ],
  },
];

const demoTransactions: TransactionSummary[] = [
  { id: 'tx_spotify', merchantLabel: 'Spotify', amount: '$10.99', currency: 'USD', kind: 'expense', category: 'Subscriptions', account: 'Card 1234', evidenceCount: 2, observedAt: 'Today' },
  { id: 'tx_groceries', merchantLabel: 'Fresh Market', amount: '$48.30', currency: 'USD', kind: 'expense', category: 'Groceries', account: 'Card 1234', evidenceCount: 1, observedAt: 'Yesterday' },
  { id: 'tx_coffee', merchantLabel: 'Cafe Central', amount: '$6.20', currency: 'USD', kind: 'expense', category: 'Food', account: 'Wallet', evidenceCount: 1, observedAt: 'Jul 14' },
  { id: 'tx_income', merchantLabel: 'Client payment', amount: '$540.00', currency: 'USD', kind: 'income', category: 'Income', account: 'Bank', evidenceCount: 1, observedAt: 'This week' },
];

const edgeTransactions: TransactionSummary[] = [
  {
    id: 'tx_long_category',
    merchantLabel: 'International Grocery Cooperative Downtown Branch',
    amount: '$1,248.77',
    currency: 'USD',
    kind: 'expense',
    category: 'Groceries and household essentials with a very long label',
    account: 'Primary checking account ending 9876',
    evidenceCount: 4,
    observedAt: 'Today',
  },
  {
    id: 'tx_zero_adjustment',
    merchantLabel: 'Zero value statement adjustment',
    amount: '$0.00',
    currency: 'USD',
    kind: 'expense',
    category: 'Adjustments',
    account: 'Card 0000',
    evidenceCount: 1,
    observedAt: 'Yesterday',
  },
  {
    id: 'tx_refund',
    merchantLabel: 'Refund from delivery marketplace',
    amount: '-$18.40',
    currency: 'USD',
    kind: 'expense',
    category: 'Food delivery refunds and credits',
    account: 'Wallet',
    evidenceCount: 2,
    observedAt: 'Jul 14',
  },
  {
    id: 'tx_income_edge',
    merchantLabel: 'Quarterly client settlement with long payer name',
    amount: '$9,840.00',
    currency: 'USD',
    kind: 'income',
    category: 'Income',
    account: 'Business bank account ending 4321',
    evidenceCount: 3,
    observedAt: 'This month',
  },
];

const edgeMetrics: SummaryMetric[] = [
  { label: 'Today', value: '18 items', delta: 'long-content pass', tone: 'neutral' },
  { label: 'Money', value: '$1,248.77', delta: 'large values', tone: 'warning' },
  { label: 'Review', value: '7', delta: 'mixed decisions', tone: 'warning' },
  { label: 'Insights', value: '5', delta: 'dense copy', tone: 'positive' },
];

const emptyDashboard = {
  metrics: [],
  insights: [],
  digests: [],
  transactions: [],
};

const demoReviews: ReviewItem[] = [
  {
    id: 'review_spotify',
    alias: 'SPOTIFY*P1234',
    categoryPath: ['Subscriptions'],
    reason: 'merchant name',
    normalizedValue: 'Spotify',
    status: 'pending',
  },
  {
    id: 'review_delivery',
    alias: 'DELIVERY APP',
    categoryPath: ['Food', 'Delivery'],
    reason: 'category suggestion',
    normalizedValue: 'Food delivery',
    status: 'pending',
  },
];

// Keep the local Review preview representative of the real curation flow. These
// labels mirror the governed taxonomy returned by the API, including the business
// types that matter when an entity is a merchant rather than an expense category.
const demoEntityTags: EntityTag[] = [
  { key: 'entrepreneurship', label: 'Emprendimiento', description: 'Negocios y actividades comerciales.', parentKey: null, level: 0, kind: 'family' },
  { key: 'entrepreneurship.businesses', label: 'Negocios', description: 'Empresas, comercios y locales.', parentKey: 'entrepreneurship', level: 1, kind: 'domain' },
  { key: 'entrepreneurship.businesses.food', label: 'Local de comida', description: 'Restaurantes, cafeterías y comida preparada.', parentKey: 'entrepreneurship.businesses', level: 2, kind: 'subtype' },
  { key: 'entrepreneurship.businesses.hardware', label: 'Ferretería', description: 'Herramientas, materiales y mejoras del hogar.', parentKey: 'entrepreneurship.businesses', level: 2, kind: 'subtype' },
  { key: 'entrepreneurship.businesses.electronics', label: 'Tienda de electrónica', description: 'Tecnología, dispositivos y accesorios.', parentKey: 'entrepreneurship.businesses', level: 2, kind: 'subtype' },
  { key: 'entrepreneurship.businesses.pharmacy', label: 'Farmacia', description: 'Medicamentos, salud y cuidado personal.', parentKey: 'entrepreneurship.businesses', level: 2, kind: 'subtype' },
  { key: 'entrepreneurship.businesses.fuel', label: 'Gasolinera', description: 'Combustible y servicios para vehículos.', parentKey: 'entrepreneurship.businesses', level: 2, kind: 'subtype' },
  { key: 'entrepreneurship.businesses.grocery', label: 'Supermercado', description: 'Alimentos y compras de consumo diario.', parentKey: 'entrepreneurship.businesses', level: 2, kind: 'subtype' },
  { key: 'finances', label: 'Finanzas', description: 'Herramientas y servicios financieros.', parentKey: null, level: 0, kind: 'family' },
  { key: 'finances.payment_methods', label: 'Métodos de pago', description: 'Formas de pagar y cobrar.', parentKey: 'finances', level: 1, kind: 'domain' },
  { key: 'finances.payment_methods.digital_wallets', label: 'Billetera digital', description: 'Apps y servicios de pagos digitales.', parentKey: 'finances.payment_methods', level: 2, kind: 'subtype' },
  { key: 'technology', label: 'Tecnología', description: 'Productos, plataformas y servicios digitales.', parentKey: null, level: 0, kind: 'family' },
  { key: 'technology.apps', label: 'Aplicaciones', description: 'Software y servicios de aplicación.', parentKey: 'technology', level: 1, kind: 'domain' },
];

function demoEntity(id: string): EntityDetail {
  return {
    id,
    title: id.includes('spotify') ? 'Spotify' : 'Knowledge item',
    type: id.includes('spotify') ? 'merchant' : 'topic',
    canonical: true,
    summary: 'A known item connected to recent activity, money movement, and review decisions.',
    aliases: id.includes('spotify') ? ['Spotify', 'SPOTIFY*P1234'] : ['Knowledge item'],
    relatedEvents: ['activity_recent_1', 'activity_recent_2'],
    relatedEntities: [
      { id: 'subscriptions', label: 'Subscriptions', type: 'category', canonical: true },
      { id: 'music', label: 'Music', type: 'topic' },
    ],
    relations: [
      { id: 'rel_1', label: 'Recurring charge', description: 'This merchant appears more than once in money activity.', direction: 'bidirectional' },
      { id: 'rel_2', label: 'Category match', description: 'This item is usually grouped under Subscriptions.', direction: 'outgoing' },
    ],
  };
}

function demoTransactionDetail(id: string): TransactionDetail {
  const transaction = [...demoTransactions, ...edgeTransactions].find((item) => item.id === id) ?? demoTransactions[0];
  return {
    ...transaction,
    observedWindow: 'Recent activity',
    evidence: [
      {
        id: `${transaction.id}_evidence_1`,
        source: 'Wallet',
        kind: transaction.kind,
        amount: transaction.amount,
        currency: transaction.currency,
        merchantLabel: transaction.merchantLabel,
        observedAt: transaction.observedAt,
        matchReason: 'Coincide el comercio y el monto.',
      },
      {
        id: `${transaction.id}_evidence_2`,
        source: 'Notification',
        kind: 'confirmation',
        merchantLabel: transaction.merchantLabel,
        observedAt: transaction.observedAt,
        matchReason: 'Confirmado por una notificación relacionada.',
      },
    ],
  };
}

function normalizeMetrics(input: unknown): SummaryMetric[] {
  if (Array.isArray(input)) {
    return input.map((item, index) => ({
      label: asString((item as Record<string, unknown>).label, `Metric ${index + 1}`),
      value: asString((item as Record<string, unknown>).value, '0'),
      delta: asString((item as Record<string, unknown>).delta) || undefined,
      tone: (item as Record<string, unknown>).tone as SummaryMetric['tone'] | undefined,
    }));
  }

  if (isRecord(input)) {
    return Object.entries(input).map(([label, value]) => ({
      label,
      value: String(value),
    }));
  }

  return [];
}

function isPlaceholderInsightText(value?: string) {
  const normalized = cleanDisplayText(value ?? '').toLowerCase();
  return !normalized || /^insight\s+\d+$/.test(normalized) || normalized === 'insight';
}

function normalizeContentCards(value: unknown, fallback: BriefCard[], limit: number): BriefCard[] {
  const cards = asArray<Record<string, any>>(value)
    .map((card) => ({
      title: compactNarrative(card.title, '', 90),
      summary: compactNarrative(card.summary, '', 240),
      recommendedAction: compactNarrative(card.recommendedAction, '', 180) || undefined,
    }))
    .filter((card) => card.title && card.summary);
  return cards.length ? cards.slice(0, limit) : fallback.slice(0, limit);
}

function normalizeInsight(item: unknown, index = 0): InsightSummary {
  const record = (isRecord(item) ? item : {}) as Record<string, any>;
  const response = isRecord(record.response) ? record.response as Record<string, any> : {};
  const content = isRecord(response.content) ? response.content as Record<string, any> : isRecord(record.content) ? record.content as Record<string, any> : {};
  const candidates = asArray<Record<string, any>>(response.candidates ?? record.evidence);
  const primary = isRecord(candidates[0]) ? candidates[0] : {};
  const rawTitle = compactNarrative(content.title ?? record.title ?? primary.title ?? record.query, '', 90);
  const rawSummary = compactNarrative(content.summary ?? primary.explanation ?? record.summary, '', 320);
  const title = isPlaceholderInsightText(rawTitle) && !isPlaceholderInsightText(rawSummary) ? rawSummary : rawTitle;
  const summary = isPlaceholderInsightText(rawSummary) ? title : rawSummary;
  const takeaways = uniqueStrings(
    [...asArray<string>(content.takeaways ?? record.takeaways), ...candidates.map((candidate) => asString(candidate.title))]
      .map((takeaway) => compactNarrative(takeaway, '', 180))
      .filter((takeaway) => takeaway !== title && takeaway !== summary)
  );
  const cards = normalizeContentCards(
    content.cards,
    candidates.map((candidate) => ({
      title: compactNarrative(candidate.title, '', 90),
      summary: compactNarrative(candidate.explanation, '', 240),
      recommendedAction: compactNarrative(candidate.suggestedAction, '', 180) || undefined,
    })).filter((card) => card.title && card.summary),
    3,
  );
  const supportingEntities = asArray<Record<string, any>>(record.supportingEntities ?? response.supportingEntities);
  const supportingRelations = asArray<Record<string, any>>(record.supportingRelations ?? response.supportingRelations);
  const supportingReferences = [
    ...supportingEntities.map((entity) => ({
      id: asString(entity.id),
      label: asString(entity.value ?? entity.label),
      description: asString(entity.type) || undefined,
      route: asString(entity.id) ? `/entity/${asString(entity.id)}` : undefined,
      kind: 'entity' as const,
    })),
    ...supportingRelations.map((relation) => ({
      id: asString(relation.id),
      label: asString(relation.label ?? relation.relationType),
      description: asString(relation.description) || undefined,
      kind: 'relation' as const,
    })),
  ].filter((reference) => reference.id && reference.label);

  return {
    id: asString(record.id, `insight_${index + 1}`),
    title,
    summary,
    takeaways,
    whyItMatters: compactNarrative(content.whyItMatters, '', 240) || undefined,
    recommendedAction: compactNarrative(content.recommendedAction ?? record.suggestedAction ?? primary.suggestedAction, '', 180) || undefined,
    confidence: asNumber(record.confidence, 0) || undefined,
    cards,
    detectors: uniqueStrings(candidates.map((candidate) => asString(candidate.detector)), 10),
    model: asString(record.model) || undefined,
    timestamp: asString(record.createdAt ?? record.timestamp) || undefined,
    relatedCount: asNumber(record.relatedCount ?? record.supportingCount, 0) || undefined,
    supportingReferences: supportingReferences.length ? supportingReferences : undefined,
  };
}

function isUsefulInsight(insight: InsightSummary) {
  const routineOnly = insight.detectors?.length && insight.detectors.every((detector) => [
    'source_activity_change',
    'category_activity_change',
    'cross_domain_temporal_correlation',
    'high_confidence_graph_change',
  ].includes(detector));
  return !routineOnly && (!isPlaceholderInsightText(insight.title) || !isPlaceholderInsightText(insight.summary) || insight.takeaways.length > 0);
}

function normalizeDigest(item: unknown, index = 0): DigestSummary {
  const record = (isRecord(item) ? item : {}) as Record<string, any>;
  const response = isRecord(record.response) ? record.response as Record<string, any> : record;
  const content = isRecord(response.content) ? response.content as Record<string, any> : {};
  const rawMetrics = response.metrics ?? record.metrics;
  const aggregateMetrics = isRecord(rawMetrics) ? rawMetrics as Record<string, any> : {};
  const eventCount = asNumber(record.eventCount ?? record.totalEvents ?? aggregateMetrics.totalEvents, 0);
  const sourceRows = asArray<Record<string, any>>(aggregateMetrics.eventsBySource);
  const kindRows = asArray<Record<string, any>>(aggregateMetrics.eventsByInferredKind ?? aggregateMetrics.eventsByKind);
  const topSource = sourceRows[0];
  const topKind = kindRows[0];
  const metrics = Array.isArray(rawMetrics)
    ? normalizeMetrics(rawMetrics)
    : eventCount || sourceRows.length || kindRows.length
      ? [
          { label: 'Captured', value: String(eventCount) },
          ...(topSource ? [{ label: 'Top source', value: `${asString(topSource.source)} · ${asNumber(topSource.count)}` }] : []),
          ...(topKind ? [{ label: 'Top activity', value: `${asString(topKind.kind)} · ${asNumber(topKind.count)}` }] : []),
        ]
      : asRecordMetrics(rawMetrics);
  const legacyHighlights = [
    topSource ? `${asString(topSource.source)} was the most active source with ${asNumber(topSource.count)} items.` : '',
    topKind ? `${asString(topKind.kind)} was the most common activity type.` : '',
  ];
  const highlights = uniqueStrings(
    [...asArray<string>(content.highlights), ...legacyHighlights].map((value) => compactNarrative(value, '', 180)),
    4,
  );
  const fallbackSummary = eventCount
    ? `${eventCount} ${eventCount === 1 ? 'item was' : 'items were'} captured in this period${topSource ? `, led by ${asString(topSource.source)}` : ''}.`
    : 'No new activity was captured in this period.';
  const cards = normalizeContentCards(
    content.cards,
    highlights.map((summary, index) => ({
      title: index === 0 ? 'Activity at a glance' : 'Worth noticing',
      summary,
    })),
    4,
  );

  return {
    id: asString(record.id, `digest_${index + 1}`),
    title: compactNarrative(content.title ?? record.title, 'Your activity digest', 90),
    summary: compactNarrative(content.summary, fallbackSummary, 320),
    windowLabel: compactNarrative(record.windowLabel, '', 80) || friendlyWindow(record.windowFrom ?? response.window?.from, record.windowTo ?? response.window?.to) || 'Recent activity',
    eventCount: eventCount || undefined,
    relatedInsightCount: asNumber(record.relatedInsightCount ?? record.relatedInsightsCount ?? response.relatedInsights?.length, 0) || undefined,
    metrics,
    highlights,
    recommendedAction: compactNarrative(content.recommendedAction, '', 180) || undefined,
    cards,
  };
}

function asRecordMetrics(value: unknown): SummaryMetric[] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return Object.entries(value).map(([label, rawValue]) => ({
    label,
    value: String(rawValue),
  }));
}

function normalizeTransaction(item: unknown, index = 0): TransactionSummary {
  const record = (isRecord(item) ? item : {}) as Record<string, any>;
  const rawCurrency = asString(record.currency, 'UNKNOWN').toUpperCase();

  return {
    id: asString(record.id, `transaction_${index + 1}`),
    merchantLabel: normalizeNarrativeText(record.merchantLabel ?? record.normalizedMerchant ?? record.merchant, `Transaction ${index + 1}`),
    displayMerchantLabel: asString(record.displayMerchantLabel) ? normalizeNarrativeText(record.displayMerchantLabel, '') : undefined,
    amount: asString(record.amount, '$0.00'),
    currency: rawCurrency,
    kind: asString(record.kind, 'expense'),
    observedAt: asString(record.observedAt ?? record.timestamp) || undefined,
    category: asString(record.category) || undefined,
    account: asString(record.account) || undefined,
    accountId: asString(record.accountId) || undefined,
    destinationAccount: asString(record.destinationAccount) || undefined,
    destinationAccountId: asString(record.destinationAccountId) || undefined,
    destinationAmount: asString(record.destinationAmount) || undefined,
    destinationCurrency: asString(record.destinationCurrency) || undefined,
    merchantEntityId: asString(record.merchantEntityId ?? record.merchant_entity_id) || undefined,
    status: asString(record.status) || undefined,
    primarySource: asString(record.primarySource ?? record.primary_source ?? record.source) || undefined,
    eventIds: asArray<unknown>(record.evidence).map((evidence) => asString(isRecord(evidence) ? evidence.rawEventId ?? evidence.raw_event_id : '')).filter(Boolean),
    evidenceCount: asNumber(record.evidenceCount ?? record.evidence?.length, 0) || undefined,
    hints: asArray<unknown>(record.evidence).flatMap((evidence) => (isRecord(evidence) ? [asString(evidence.source), asString(evidence.merchantLabel)] : [])).filter(Boolean),
    excludedFromReports: Boolean(record.excludedFromReports ?? record.excluded_from_reports),
    adjustmentTargetBalance: asString(record.adjustmentTargetBalance ?? record.adjustment_target_balance) || undefined,
  };
}

function normalizePendingTransaction(item: unknown, index = 0): PendingTransaction {
  const record = (isRecord(item) ? item : {}) as Record<string, any>;
  const rawCurrency = asString(record.currency, 'UYU').toUpperCase();
  return {
    id: asString(record.id, `pending_${index + 1}`),
    title: normalizeNarrativeText(record.title ?? record.merchantLabel, `Pendiente ${index + 1}`),
    kind: asString(record.kind, 'expense') === 'income' ? 'income' : 'expense',
    amount: asString(record.amount, '0.00'),
    currency: rawCurrency === 'USD' ? 'USD' : 'UYU',
    category: asString(record.category) || undefined,
    account: asString(record.account) || undefined,
    accountId: asString(record.accountId ?? record.account_id) || undefined,
    estimatedExecutionDate: asString(record.estimatedExecutionDate ?? record.estimated_execution_date),
    createdAt: asString(record.createdAt ?? record.created_at) || undefined,
    updatedAt: asString(record.updatedAt ?? record.updated_at) || undefined,
  };
}

function normalizeFinancialAccount(item: unknown, fallback?: { name: string; currency: 'UYU' | 'USD'; type?: string }) : FinancialAccount {
  const record = (isRecord(item) ? item : {}) as Record<string, any>;
  const rawCurrency = asString(record.currency, fallback?.currency).toUpperCase();
  const currency: 'UYU' | 'USD' | undefined = rawCurrency === 'UYU' || rawCurrency === 'USD' ? rawCurrency : undefined;
  return {
    id: asString(record.id),
    name: asString(record.name, fallback?.name || 'Financial account'),
    type: asString(record.type, fallback?.type || 'bank'),
    mask: asString(record.mask) || undefined,
    currency,
    color: asString(record.color) || undefined,
    balance: asString(record.balance, '0.00'),
  };
}

function normalizeSearchResults(input: unknown): SearchResultItem[] {
  const record = (isRecord(input) ? input : {}) as Record<string, any>;
  const entities = asArray<unknown>(record.entities).map((item, index) => {
    const entity = isRecord(item) ? item : {};
    return {
      id: asString(entity.id, `entity_${index + 1}`),
      title: asString(entity.value ?? entity.label, `Entity ${index + 1}`),
      subtitle: asString(entity.type, 'Elemento'),
      description: asString(entity.description, 'Resultado de entidad canónica'),
      type: 'entity' as const,
      route: `/entity/${asString(entity.id, `entity_${index + 1}`)}`,
      relevance: asNumber((entity.matchHint as Record<string, unknown> | undefined)?.relevanceScore, 0) || undefined,
      hint: localizeMatchHint(asString((entity.matchHint as Record<string, unknown> | undefined)?.explanation)),
    };
  });

  const events = asArray<unknown>(record.events).map((item, index) => {
    const event = isRecord(item) ? item : {};
    return {
      id: asString(event.id, `event_${index + 1}`),
      title: asString(event.title, `Event ${index + 1}`),
      subtitle: asString(event.kind, 'Evento'),
      description: asString(event.body, 'Evento guardado'),
      type: 'event' as const,
      route: `/event/${encodeURIComponent(asString(event.id, `event_${index + 1}`))}`,
      relevance: asNumber((event.matchHint as Record<string, unknown> | undefined)?.relevanceScore, 0) || undefined,
      hint: localizeMatchHint(asString((event.matchHint as Record<string, unknown> | undefined)?.explanation)),
    };
  });

  const relations = asArray<unknown>(record.relations).map((item, index) => {
    const relation = isRecord(item) ? item : {};
    return {
      id: asString(relation.id, `relation_${index + 1}`),
      title: asString(relation.label, `Relation ${index + 1}`),
      subtitle: asString(relation.relationType, 'Relación'),
      description: asString(relation.description, 'Relación del mapa de conocimiento'),
      type: 'relation' as const,
      route: `/entity/${asString(relation.sourceEntityId ?? relation.targetEntityId, 'entity_spotify')}`,
      relevance: asNumber((relation.matchHint as Record<string, unknown> | undefined)?.relevanceScore, 0) || undefined,
      hint: localizeMatchHint(asString((relation.matchHint as Record<string, unknown> | undefined)?.explanation)),
    };
  });

  const combined = [...entities, ...events, ...relations];
  return combined;
}

function normalizeReviews(input: unknown): ReviewItem[] {
  const items = asArray<unknown>(input).map((item, index) => {
    const review = (isRecord(item) ? item : {}) as Record<string, any>;
    const originalValue = asString(review.originalValue ?? review.original_value) || undefined;
    const normalizedValue = asString(review.normalizedValue ?? review.normalized_value) || undefined;

    return {
      id: asString(review.id, `alias_${index + 1}`),
      entityId: asString(review.entityId ?? review.entity_id) || undefined,
      entityType: asString(review.entityType ?? review.entity_type) || undefined,
      alias: asString(review.alias ?? review.suggestedAlias ?? review.suggested_alias ?? originalValue ?? normalizedValue, `Alias ${index + 1}`),
      categoryPath: asArray<string>(review.categoryPath ?? review.suggestedCategoryPath ?? review.suggested_category_path),
      reason: asString(review.reason, 'Requiere revisión'),
      source: asString(review.source) || undefined,
      eventId: asString(review.eventId ?? review.event_id) || undefined,
      financialKind: (asString(review.financialKind ?? review.financial_kind) as ReviewItem['financialKind']) || undefined,
      originalValue,
      normalizedValue,
      status: (asString(review.status, 'pending') as ReviewItem['status']) || 'pending',
    };
  });

  return items;
}

const SEMANTIC_ACTION_KINDS: SemanticActionKind[] = ['assign_existing_category', 'create_category', 'merge_identities', 'associate_entities', 'place_entity'];
const SEMANTIC_ENDPOINT_KINDS: SemanticEndpointKind[] = ['event', 'concept', 'identity', 'category'];
const SEMANTIC_VERIFICATION_STATUSES: SemanticVerificationStatus[] = ['verified', 'rejected', 'unavailable', 'not_required'];

/** Backend sends camelCase; snake_case is accepted too so older proxies keep working. */
function pickRecordValue(record: Record<string, unknown>, camel: string, snake: string) {
  return record[camel] ?? record[snake];
}

function normalizeSemanticEndpoint(value: unknown): SemanticEndpoint | undefined {
  if (!isRecord(value)) return undefined;
  const kind = asString(value.kind) as SemanticEndpointKind;
  const endpoint: SemanticEndpoint = {
    id: asString(value.id) || undefined,
    type: asString(value.type) || undefined,
    label: asString(value.label) || undefined,
    canonicalId: asString(value.canonicalId ?? value.canonical_id) || undefined,
    kind: SEMANTIC_ENDPOINT_KINDS.includes(kind) ? kind : undefined,
  };
  return Object.values(endpoint).some(Boolean) ? endpoint : undefined;
}

function normalizeSemanticEvidence(value: unknown): SemanticEvidence[] {
  return asArray<unknown>(value)
    .map((item) => {
      if (!isRecord(item)) return null;
      const evidence: SemanticEvidence = {
        eventId: asString(item.eventId ?? item.event_id) || undefined,
        source: asString(item.source) || undefined,
        title: asString(item.title) || undefined,
        excerpt: asString(item.excerpt) || undefined,
        occurredAt: asString(item.occurredAt ?? item.occurred_at) || undefined,
        field: asString(item.field) || undefined,
        kind: asString(item.kind) || undefined,
      };
      return Object.values(evidence).some(Boolean) ? evidence : null;
    })
    .filter((item): item is SemanticEvidence => item !== null);
}

function normalizeSemanticCandidate(record: Record<string, unknown>): SemanticCandidate {
  const actionKindValue = asString(pickRecordValue(record, 'actionKind', 'action_kind')) as SemanticActionKind;
  const verificationStatusValue = asString(pickRecordValue(record, 'verificationStatus', 'verification_status')) as SemanticVerificationStatus;
  const rawCount = pickRecordValue(record, 'verifiedEventCount', 'verified_event_count');
  const rawRuleEligible = pickRecordValue(record, 'ruleEligible', 'rule_eligible');
  const endpointsValue = record.endpoints;
  const subject = isRecord(endpointsValue) ? normalizeSemanticEndpoint(endpointsValue.subject) : undefined;
  const target = isRecord(endpointsValue) ? normalizeSemanticEndpoint(endpointsValue.target) : undefined;
  const evidence = normalizeSemanticEvidence(record.evidence);

  return {
    id: asString(record.id), eventId: asString(record.eventId) || undefined,
    subjectEntityId: asString(record.subjectEntityId) || undefined,
    subjectValue: asString(record.subjectValue) || undefined,
    subjectType: asString(record.subjectType) || undefined,
    relationType: asString(record.relationType, 'related_to'), targetType: asString(record.targetType, 'concept'),
    targetValue: asString(record.targetValue, 'Concept'), parentTargetValue: asString(record.parentTargetValue) || undefined,
    confidence: asNumber(record.confidence, 0), rationale: asString(record.rationale) || undefined,
    extractor: asString(record.extractor) || undefined, decisionKind: asString(record.decisionKind) || undefined,
    domainValue: asString(record.domainValue) || undefined,
    anchorRole: (asString(record.anchorRole) || undefined) as SemanticCandidate['anchorRole'],
    proposedPath: asArray<string>(record.proposedPath),
    alternatives: asArray<unknown>(record.alternatives).map((alternative) => {
      const value = isRecord(alternative) ? alternative : {};
      return { parent: asString(value.parent) || undefined, value: asString(value.value), confidence: asNumber(value.confidence, 0) };
    }).filter((alternative) => alternative.value),
    recurrenceCount: asNumber(record.recurrenceCount, 0) || undefined,
    governanceVersion: asString(record.governanceVersion) || undefined, model: asString(record.model) || undefined,
    status: asString(record.status, 'pending') as SemanticCandidate['status'],
    actionKind: SEMANTIC_ACTION_KINDS.includes(actionKindValue) ? actionKindValue : undefined,
    endpoints: subject || target ? { subject, target } : undefined,
    evidence: evidence.length ? evidence : undefined,
    verifiedEventCount: typeof rawCount === 'number' && Number.isFinite(rawCount) ? Math.max(0, Math.round(rawCount)) : undefined,
    verificationStatus: SEMANTIC_VERIFICATION_STATUSES.includes(verificationStatusValue) ? verificationStatusValue : undefined,
    changeExplanation: asString(pickRecordValue(record, 'changeExplanation', 'change_explanation')) || undefined,
    ruleEligible: typeof rawRuleEligible === 'boolean' ? rawRuleEligible : undefined,
    policyVersion: asString(record.policyVersion ?? record.policy_version) || undefined,
  };
}

function normalizeEntity(input: unknown): EntityDetail {
  const record = (isRecord(input) ? input : {}) as Record<string, any>;

  if (isRecord(record.rootEntity)) {
    return normalizeEntity(record.rootEntity);
  }

  if (!isRecord(input)) {
    return {
      id: 'entity_unknown',
      title: 'Unknown entity',
      type: 'entity',
      canonical: false,
      summary: 'No item details are available yet.',
      aliases: [],
      relatedEvents: [],
      relatedEntities: [],
      relations: [],
    };
  }

  return {
    id: asString(record.id, 'entity_unknown'),
    title: normalizeNarrativeText(record.value ?? record.label ?? record.title, 'Unknown entity'),
    type: asString(record.type, 'entity'),
    canonical: record.canonical === true || record.isCanonical === true,
    summary: normalizeNarrativeText(record.description ?? record.summary, 'Sin descripción disponible'),
    aliases: asArray<string>(record.aliases),
    relatedEvents: asArray<string>(record.relatedEvents),
    relatedEntities: asArray<unknown>(record.relatedEntities).length > 0
      ? asArray<unknown>(record.relatedEntities).map((item, index) => {
          const entity = (isRecord(item) ? item : {}) as Record<string, any>;
          return {
            id: asString(entity.id, `related_entity_${index + 1}`),
            label: asString(entity.label ?? entity.value, `Related entity ${index + 1}`),
            type: asString(entity.type, 'entity'),
            canonical: entity.canonical === true || entity.isCanonical === true,
            confidence: asNumber(entity.confidence, 0) || undefined,
          };
        })
      : [],
    relations: asArray<unknown>(input.relations).length > 0
      ? asArray<unknown>(input.relations).map((item, index) => {
          const relation = isRecord(item) ? item : {};
          return {
            id: asString(relation.id, `relation_${index + 1}`),
            relationType: asString(relation.relationType) || undefined,
            label: asString(relation.label, `Relation ${index + 1}`),
            description: asString(relation.description, 'Relación del mapa'),
            direction: (asString(relation.direction, 'incoming') as GraphRelation['direction']) || 'incoming',
            depth: asNumber(relation.depth, 1) || undefined,
            importanceScore: asNumber(relation.importanceScore, 0) || undefined,
          };
        })
      : [],
  };
}

function normalizeTransactionDetail(input: unknown): TransactionDetail {
  if (!isRecord(input)) {
    return {
      id: 'transaction_unknown',
      merchantLabel: 'Unknown transaction',
      amount: '$0.00',
      currency: 'USD',
      kind: 'expense',
      observedWindow: undefined,
      evidence: [],
    };
  }

  const record = (isRecord(input) ? input : {}) as Record<string, any>;
  const transaction = normalizeTransaction(input);

  return {
    ...transaction,
    observedWindow: asString(record.observedWindow) || undefined,
    evidence: asArray<unknown>(record.evidence).length > 0
      ? asArray<unknown>(record.evidence).map((item, index) => {
          const evidence = (isRecord(item) ? item : {}) as Record<string, any>;
          return {
            id: asString(evidence.id, `evidence_${index + 1}`),
            rawEventId: asString(evidence.rawEventId ?? evidence.raw_event_id) || undefined,
            source: asString(evidence.source, 'source'),
            kind: asString(evidence.kind, transaction.kind),
            amount: asString(evidence.amount) || undefined,
            currency: asString(evidence.currency, transaction.currency),
            merchantLabel: asString(evidence.merchantLabel) || undefined,
            observedAt: asString(evidence.observedAt) || undefined,
            matchReason: asString(evidence.matchReason) || undefined,
          };
        })
      : [],
  };
}

function normalizeEntityLinks(input: unknown): EntityLink[] {
  return asArray<unknown>(input)
    .map((item, index) => {
      const entity = (isRecord(item) ? item : {}) as Record<string, any>;
      return {
        id: asString(entity.id, `node_${index + 1}`),
        label: asString(entity.label ?? entity.value, `Node ${index + 1}`),
        type: asString(entity.type, 'entity'),
        description: asString(entity.description),
        canonical: entity.canonical === true || entity.isCanonical === true,
        confidence: asNumber(entity.confidence, 0) || undefined,
      };
    })
    .filter(Boolean);
}

function normalizeEvent(input: unknown, index: number): EventSummary {
  const event = (isRecord(input) ? input : {}) as Record<string, any>;
  const protectedContent = event.privacyStatus === 'private' || event.privacyStatus === 'hidden';
  const rawTitle = asString(event.title, 'Evento sin título');
  return {
    id: asString(event.id, `event_${index + 1}`),
    source: asString(event.source, 'unknown'),
    privacyStatus: asString(event.privacyStatus) || undefined,
    kind: asString(event.kind, asString(event.inferredKind, 'event')),
    title: protectedContent ? 'Actividad protegida' : asString(event.displayTitle, rawTitle),
    rawTitle: protectedContent ? undefined : rawTitle,
    description: protectedContent ? undefined : asString(event.displayDescription) || undefined,
    // List entries from the paginated history carry `bodyPreview`/`ingestedAt`; detail and legacy records carry `body`/`rawEventCreatedAt`.
    body: protectedContent ? undefined : asString(event.body, asString(event.bodyPreview)) || undefined,
    receivedAt: asString(event.rawEventCreatedAt, asString(event.ingestedAt, asString(event.timestamp))) || undefined,
    inferredKind: asString(event.inferredKind) || undefined,
    confidence: asNumber(event.confidence, 0) || undefined,
    interpretationStatus: asString(event.interpretationStatus) || undefined,
    interpretationSource: asString(event.interpretationSource) || undefined,
    interpretationFailureReason: asString(event.interpretationFailureReason) || undefined,
    taxonomyVersion: asString(event.taxonomyVersion) || undefined,
    primaryCategoryKey: protectedContent ? undefined : asString(event.primaryCategoryKey) || undefined,
    secondaryCategoryKeys: asArray<string>(event.secondaryCategoryKeys),
    facets: asArray<unknown>(protectedContent ? [] : event.facets).map((item) => {
      const facet = (isRecord(item) ? item : {}) as Record<string, any>;
      return { type: asString(facet.type), value: asString(facet.value), confidence: asNumber(facet.confidence, 0) };
    }).filter((facet) => facet.type && facet.value),
    progress: parseEventProgress(event.progress),
  };
}

async function requestWithFallback<T>(baseUrl: string, path: string, fallback: T, options: RequestOptions = {}) {
  void fallback;
  const json = await safeFetchJson(baseUrl, path, options);
  return json as T;
}

const REPROCESS_JOB_STATUSES: readonly ReprocessJobStatus[] = [
  'queued', 'running', 'retry_scheduled', 'succeeded', 'dead_letter', 'cancelled',
];

function normalizeStageList(input: unknown): ReprocessStage[] {
  const raw = asArray<string>(input).filter(isReprocessStage);
  return REPROCESS_STAGES.filter((stage) => raw.includes(stage));
}

function normalizeReprocessJob(input: unknown, index: number): ReprocessJob | null {
  if (!isRecord(input)) return null;
  const status = asString(input.status) as ReprocessJobStatus;
  if (!REPROCESS_JOB_STATUSES.includes(status)) return null;
  return {
    id: asString(input.id, `reprocess_${index + 1}`),
    jobType: asString(input.jobType, 'event_reprocess'),
    status,
    stages: normalizeStageList(input.stages),
    attemptCount: Math.max(0, asNumber(input.attemptCount, 0)),
    maxAttempts: Math.max(0, asNumber(input.maxAttempts, 0)),
    runAfter: asString(input.runAfter) || undefined,
    createdAt: asString(input.createdAt) || undefined,
    completedAt: asString(input.completedAt) || null,
  };
}

function normalizeReprocessResult(json: unknown, requestedStages: ReprocessStage[]): ReprocessResult {
  if (isRecord(json) && json.accepted === true && isRecord(json.job)) {
    const job = normalizeReprocessJob(json.job, 0);
    if (job) {
      const disposition = ['queued', 'coalesced', 'already_completed', 'revived'].includes(asString(json.disposition))
        ? asString(json.disposition) as ReprocessDisposition
        : 'queued';
      const requested = normalizeStageList(json.requestedStages);
      if (!job.stages.length) job.stages = requested.length ? requested : requestedStages;
      return {
        mode: 'queued',
        disposition,
        requestedStages: requested.length ? requested : requestedStages,
        job,
      };
    }
  }
  // Older backend: the response is the synchronously reprocessed event.
  return { mode: 'legacy', requestedStages };
}

export type BrainIAClient = {
  baseUrl: string;
  v2: V2Transport;
  health: () => Promise<{ ok: boolean }>;
  metrics: () => Promise<SummaryMetric[]>;
  listEvents: (limit?: number) => Promise<EventSummary[]>;
  getEvent: (id: string) => Promise<EventSummary>;
  listEntities: (limit?: number) => Promise<EntitySuggestion[]>;
  getExploreGraph: (limit?: number, options?: { includeEventEvidence?: boolean; includeIdentities?: boolean; projection?: 'network' | 'taxonomy'; root?: string; depth?: number }) => Promise<ExploreGraph>;
  listInsights: (limit?: number) => Promise<InsightSummary[]>;
  getInsightRun: (id: string) => Promise<InsightSummary>;
  listDigests: (limit?: number) => Promise<DigestSummary[]>;
  getDigestRun: (id: string) => Promise<DigestSummary>;
  listTransactions: (limit?: number, range?: { from?: string; to?: string }) => Promise<TransactionSummary[]>;
  createManualTransaction: (input: { title: string; kind: 'expense' | 'income'; amount: number; currency: 'UYU' | 'USD'; category?: string | null; accountId?: string | null; observedAt: string }) => Promise<TransactionDetail>;
  listPendingTransactions: () => Promise<PendingTransaction[]>;
  createPendingTransaction: (input: { title: string; kind: 'expense' | 'income'; amount: number; currency: 'UYU' | 'USD'; category?: string | null; accountId?: string | null; estimatedExecutionDate: string }) => Promise<PendingTransaction>;
  updatePendingTransaction: (id: string, input: Partial<{ title: string; kind: 'expense' | 'income'; amount: number; currency: 'UYU' | 'USD'; category: string | null; accountId: string | null; estimatedExecutionDate: string }>) => Promise<PendingTransaction>;
  executePendingTransaction: (id: string, input: { executedAt: string }) => Promise<TransactionDetail>;
  cancelPendingTransaction: (id: string) => Promise<void>;
  getTransaction: (id: string) => Promise<TransactionDetail>;
  listFinancialAccounts: () => Promise<FinancialAccount[]>;
  listFinancialCategories: () => Promise<FinancialCategories>;
  listEntityTags: () => Promise<EntityTag[]>;
  getEntitySemanticProfile: (entityId: string) => Promise<EntitySemanticProfile | null>;
  saveEntitySemanticProfile: (entityId: string, input: Omit<EntitySemanticProfile, 'entityId' | 'updatedAt' | 'relations'> & { relations: Array<{ relationType: EntitySemanticProfile['relations'][number]['relationType']; targetEntityId: string }> }) => Promise<EntitySemanticProfile>;
  createFinancialCategory: (input: { kind: 'expense' | 'income'; name: string }) => Promise<{ kind: 'expense' | 'income'; name: string }>;
  createFinancialAccount: (input: { name: string; currency: 'UYU' | 'USD'; type?: string; mask?: string; color?: string }) => Promise<FinancialAccount>;
  updateFinancialAccount: (id: string, input: { name: string; currency: 'UYU' | 'USD'; type?: string; mask?: string; color?: string }) => Promise<FinancialAccount>;
  deleteFinancialAccount: (id: string) => Promise<{ deleted: boolean; detachedTransactions: number }>;
  createBalanceAdjustment: (accountId: string, input: { targetBalance: number; note?: string }) => Promise<TransactionDetail>;
    updateTransactionContext: (id: string, input: { title?: string; category?: string | null; amount?: number; accountId?: string | null; destinationAccountId?: string | null; destinationAmount?: number | null; destinationCurrency?: 'UYU' | 'USD' | null; currency?: 'UYU' | 'USD'; kind?: 'expense' | 'income' | 'transfer' }) => Promise<TransactionDetail>;
  mergeTransactions: (canonicalId: string, duplicateId: string) => Promise<TransactionDetail>;
  deleteTransaction: (id: string) => Promise<void>;
  markTransactionFalsePositive: (id: string) => Promise<void>;
  listEntityAliases: (entityId?: string) => Promise<string[]>;
  createEntityAlias: (input: { entityId: string; alias: string }) => Promise<{ id: string; alias: string }>;
  search: (query: string, filters?: { source?: string; kind?: string; from?: string; to?: string }) => Promise<SearchResultItem[]>;
  listReviews: (status?: 'pending' | 'resolved' | 'ignored') => Promise<ReviewItem[]>;
  getEntity: (id: string) => Promise<EntityDetail>;
  getEntityGraph: (id: string, depth?: number) => Promise<{ rootEntity: EntityDetail; nodes: EntityLink[]; relations: GraphRelation[] }>;
  inspectInsight: (idOrQuery: { id?: string; q?: string }) => Promise<InsightSummary>;
  recordKnowledgeFeedback: (input: { action: 'accept' | 'reject'; targetType: 'insight'; targetId: string }) => Promise<{ ok: boolean }>;
  capture: (kind: 'note' | 'email' | 'notification' | 'wallet' | 'event', payload: Record<string, unknown>) => Promise<{ ok: boolean }>;
  mergeEntity: (payload: { aliasEntityId: string; canonicalEntityId: string; reason: string; confidence: number }) => Promise<{ ok: boolean }>;
  findEntityMatches: (query: string) => Promise<EntitySuggestion[]>;
  resolveAlias: (aliasId: string, payload: { alias: string; categoryPath: string[]; notes?: string; targetEntityId?: string }) => Promise<{ ok: boolean }>;
  ignoreAlias: (aliasId: string) => Promise<{ ok: boolean }>;
  reprocessEvent: (eventId: string, options: { stages: ReprocessStage[]; execution?: ReprocessExecution }) => Promise<ReprocessResult>;
  listEventJobs: (eventId: string) => Promise<ReprocessJob[]>;
  listSemanticCandidates: () => Promise<SemanticCandidate[]>;
  resolveSemanticCandidate: (id: string, input: { action: 'approve' | 'reject'; targetEntityId?: string; createRule?: boolean }) => Promise<{ ok: boolean }>;
};

/**
 * M01 condition C1: a transient network failure during GET /capabilities is a
 * retryable PENDING/offline state, not a HELD "unsupported server". The sealed
 * transport keeps its own contract semantics, so the reclassification happens
 * here, before the queue persists the revision. The transport still never
 * attempts the observation POST while capabilities are unavailable.
 */
function createV2TransportWithOfflineClassification(
  baseUrl: string,
  accessToken: string | (() => string | null | Promise<string | null>),
) {
  const network = { failures: 0 };
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      return await fetch(input, init);
    } catch {
      network.failures += 1;
      const error = new Error('v2 network unavailable') as Error & { code?: string };
      error.code = 'network_offline';
      throw error;
    }
  };
  const transport = createV2Transport(baseUrl, accessToken, fetcher);
  return {
    request: transport.request,
    async deliverRevision(revision: V2QueuedRevision): Promise<V2QueuedRevision> {
      const before = network.failures;
      const result = await transport.deliverRevision(revision);
      if (network.failures <= before) return result;
      if (result.state === 'HELD' && result.reason === 'unsupported_or_unavailable_capabilities') {
        return { ...result, state: 'PENDING', reason: 'offline_capabilities' };
      }
      if (result.state === 'PENDING' && (result.reason === 'invalid_or_missing_acknowledgement' || result.reason === 'network_offline')) {
        return { ...result, reason: 'offline' };
      }
      return result;
    },
  };
}

const relationLabels: Record<string, string> = {
  part_of: 'Parte de', produced_by_app: 'Generado por la app', spent_at: 'Gastado en', paid_for: 'Pagado por',
  belongs_to_domain: 'Pertenece a', received_via: 'Recibido por', sent_by: 'Enviado por', uses_service: 'Usa el servicio',
};

/** Relation types come from the backend as identifiers and English labels; show them in Spanish. */
function relationLabel(type: string | undefined, label: string) {
  return (type && relationLabels[type]) || label;
}

const matchFieldLabels: Record<string, string> = {
  title: 'título', body: 'contenido', value: 'valor', normalizedValue: 'valor normalizado', name: 'nombre', alias: 'alias',
  merchant: 'comercio', category: 'categoría', description: 'descripción', subject: 'asunto', sender: 'remitente',
};

/** The backend explains a match with internal field names; show them in plain Spanish. */
function localizeMatchHint(hint: string): string | undefined {
  if (!hint) return undefined;
  const match = hint.match(/^Matched fields?:\s*(.+)$/i);
  if (!match) return hint;
  const fields = match[1].split(',').map((field) => field.trim()).filter(Boolean).map((field) => matchFieldLabels[field] ?? field);
  return fields.length ? `Coincide en: ${[...new Set(fields)].join(', ')}` : undefined;
}

export function createBrainIAClient(config: ClientConfig): BrainIAClient {
  const baseUrl = config.baseUrl || '';
  let metricsForbidden = false;
  const headers = {
    ...(config.apiKey ? { 'x-brainia-api-key': config.apiKey } : {}),
    ...(config.clientId ? { 'x-brainia-client-id': config.clientId } : {}),
  };

  const client: BrainIAClient = {
    baseUrl,
    v2: createV2TransportWithOfflineClassification(baseUrl, config.accessToken ?? (() => readV2AccessToken())),
    async health() {
      return requestWithFallback(baseUrl, '/health', { ok: false }, { headers });
    },
    async metrics() {
      // Metrics are admin-only: an owner key gets 403 every time. Remember it for this client
      // instead of repeating a request that cannot succeed on every Today load.
      if (metricsForbidden) return [];
      try {
        const json = await requestWithFallback(baseUrl, '/api/v1/metrics', [], { headers });
        return normalizeMetrics(json);
      } catch (error) {
        if (error instanceof Error && /403|forbidden|insufficient/i.test(error.message)) metricsForbidden = true;
        throw error;
      }
    },
    async listEvents(limit = 50) {
      // Paginated history (summaries, newest ingested first). Older backends ignore the
      // query and return the legacy full array, which the code below also accepts.
      const pageSize = Math.max(1, Math.min(limit, 100));
      const json = await requestWithFallback(baseUrl, `/api/v1/events?limit=${pageSize}&order=desc&dateField=ingestedAt`, [], { headers });
      const events = asArray<unknown>(isRecord(json) ? json.events ?? json.items ?? json : json)
        .map(normalizeEvent)
        .filter((event) => event.id);
      return events
        .sort((left, right) => Date.parse(right.receivedAt ?? '') - Date.parse(left.receivedAt ?? ''))
        .slice(0, limit);
    },
    async getEvent(id: string) {
      const json = await requestWithFallback(baseUrl, `/api/v1/events/${encodeURIComponent(id)}`, {}, { headers });
      return normalizeEvent(json, 0);
    },
    async listEntities(limit = 24) {
      const json = await requestWithFallback(baseUrl, '/api/v1/entities', [], { headers });
      return asArray<unknown>(json)
        .map((item) => {
          const entity = (isRecord(item) ? item : {}) as Record<string, any>;
          return {
            id: asString(entity.canonicalEntityId, asString(entity.id)),
            name: asString(entity.value, asString(entity.normalizedValue, 'Elemento sin nombre')),
            type: asString(entity.type, 'entity'),
            aliasCount: asNumber(entity.aliasCount, 0) || undefined,
            canonical: entity.isCanonical !== false,
          };
        })
        .filter((entity) => entity.id && entity.name)
        .filter((entity, index, all) => all.findIndex((candidate) => candidate.id === entity.id) === index)
        .slice(0, limit);
    },
    async getExploreGraph(limit = 80, options = {}) {
      const includeEventEvidence = options.includeEventEvidence === true;
      const params = new URLSearchParams({
        limit: String(limit),
        includeEventEvidence: String(includeEventEvidence),
        includeIdentities: String(options.includeIdentities === true),
        projection: options.projection ?? 'network',
        depth: String(options.depth ?? 2),
      });
      if (options.root) params.set('root', options.root);
      const json = await requestWithFallback(baseUrl, `/api/v1/graph?${params}`, { communities: [], nodes: [], relations: [], stats: {} }, { headers });
      const record = (isRecord(json) ? json : {}) as Record<string, any>;
      const nodes = asArray<unknown>(record.nodes).map((item) => {
        const node = (isRecord(item) ? item : {}) as Record<string, any>;
        return {
          id: asString(node.id),
          name: asString(node.value, 'Elemento sin nombre'),
          type: asString(node.type, 'entity'),
          description: asString(node.description),
          importanceScore: asNumber(node.importanceScore, 0),
          communityId: asString(node.communityId, asString(node.id)),
          hierarchyDepth: asNumber(node.hierarchyDepth, node.type === 'domain' ? 0 : 1),
          eventId: asString(node.eventId) || undefined,
          nodeKind: (asString(node.nodeKind) || undefined) as ExploreGraph['nodes'][number]['nodeKind'],
          taxonomyKey: asString(node.taxonomyKey) || undefined,
          parentEntityId: asString(node.parentEntityId) || undefined,
          breadcrumb: asArray<string>(node.breadcrumb),
          childCount: asNumber(node.childCount, 0),
          evidenceCount: asNumber(node.evidenceCount, 0),
          hasMore: Boolean(node.hasMore),
        };
      }).filter((node) => node.id);
      const relations = asArray<unknown>(record.relations).map((item, index) => {
        const relation = (isRecord(item) ? item : {}) as Record<string, any>;
        return {
          id: asString(relation.id, `explore_relation_${index + 1}`),
          sourceEntityId: asString(relation.sourceEntityId),
          targetEntityId: asString(relation.targetEntityId),
          relationType: asString(relation.relationType, 'related_to'),
          label: asString(relation.label, 'related to'),
          description: asString(relation.description, 'Relación del mapa de conocimiento'),
          confidence: asNumber(relation.confidence, 0),
          importanceScore: asNumber(relation.importanceScore, 0),
        };
      }).filter((relation) => relation.sourceEntityId && relation.targetEntityId);
      const serverCommunities = asArray<unknown>(record.communities).map((item) => {
        const community = (isRecord(item) ? item : {}) as Record<string, any>;
        return { id: asString(community.id), label: asString(community.label, 'Grupo conectado'), nodeCount: asNumber(community.nodeCount, 0), leaderEntityId: asString(community.leaderEntityId) };
      }).filter((community) => community.id);
      const nodeById = new Map(nodes.map((node) => [node.id, node]));
      const hierarchyParents = new Map<string, string[]>();
      for (const relation of relations) {
        if (relation.relationType !== 'part_of' && relation.relationType !== 'belongs_to_domain') continue;
        hierarchyParents.set(relation.sourceEntityId, [...(hierarchyParents.get(relation.sourceEntityId) ?? []), relation.targetEntityId]);
      }
      const resolveDomain = (entityId: string, seen = new Set<string>()): string | null => {
        if (seen.has(entityId)) return null;
        seen.add(entityId);
        const entity = nodeById.get(entityId);
        if (entity?.type === 'domain') return entity.id;
        for (const parentId of hierarchyParents.get(entityId) ?? []) {
          const domainId = resolveDomain(parentId, seen);
          if (domainId) return domainId;
        }
        return null;
      };
      // The API may have been deployed before the semantic community logic.
      // Prefer explicit domain links over the server's generic graph cluster so
      // a hierarchy such as Home → Home automation → Xiaomi Home remains one
      // coherent visual island on every supported backend version.
      const normalizedNodes = nodes.map((node) => ({ ...node, communityId: resolveDomain(node.id) ?? node.communityId }));
      const groups = new Map<string, typeof normalizedNodes>();
      for (const node of normalizedNodes) groups.set(node.communityId, [...(groups.get(node.communityId) ?? []), node]);
      const serverCommunityById = new Map(serverCommunities.map((community) => [community.id, community]));
      const communities = [...groups.entries()].map(([id, members]) => {
        const domain = nodeById.get(id);
        const serverCommunity = serverCommunityById.get(id);
        const leader = members.find((member) => member.id === id)
          ?? members.reduce((current, member) => member.importanceScore > current.importanceScore ? member : current);
        return {
          id,
          label: domain?.type === 'domain' ? domain.name : serverCommunity?.label ?? `${leader.type} · ${leader.name}`,
          nodeCount: members.length,
          leaderEntityId: domain?.type === 'domain' ? domain.id : serverCommunity?.leaderEntityId || leader.id,
        };
      });
      return { communities, nodes: normalizedNodes, relations, stats: { nodesCount: asNumber(record.stats?.nodesCount, normalizedNodes.length), relationsCount: asNumber(record.stats?.relationsCount, relations.length), truncated: Boolean(record.stats?.truncated) } };
    },
    async listInsights(limit = 5) {
      const json = await requestWithFallback(baseUrl, `/api/v1/insights/history?limit=${limit}`, { runs: [] }, { headers });
      if (isRecord(json) && Array.isArray(json.runs)) {
        return json.runs.map(normalizeInsight).filter(isUsefulInsight).slice(0, limit);
      }

      if (Array.isArray(json)) {
        return json.map(normalizeInsight).filter(isUsefulInsight).slice(0, limit);
      }

      return [];
    },
    async getInsightRun(id: string) {
      const json = await requestWithFallback(baseUrl, `/api/v1/insights/history/${encodeURIComponent(id)}`, { id }, { headers });
      return normalizeInsight(json);
    },
    async listDigests(limit = 4) {
      const json = await requestWithFallback(baseUrl, `/api/v1/digests/history?limit=${limit}`, { runs: [] }, { headers });
      if (isRecord(json) && Array.isArray(json.runs)) {
        return json.runs.map(normalizeDigest).slice(0, limit);
      }

      if (Array.isArray(json)) {
        return json.map(normalizeDigest).slice(0, limit);
      }

      return [];
    },
    async getDigestRun(id: string) {
      const json = await requestWithFallback(baseUrl, `/api/v1/digests/history/${encodeURIComponent(id)}`, { id }, { headers });
      return normalizeDigest(json);
    },
    async listTransactions(limit = 8, range = {}) {
      const params = new URLSearchParams({ limit: String(limit) });
      if (range.from) params.set('from', range.from);
      if (range.to) params.set('to', range.to);
      const json = await requestWithFallback(baseUrl, `/api/v1/financial/transactions?${params.toString()}`, [], { headers });
      const items = asArray<unknown>(isRecord(json) ? json.transactions ?? json.items ?? json : json).map(normalizeTransaction);
      return items.slice(0, limit);
    },
    async createManualTransaction(input) {
      const json = await safeFetchJson(baseUrl, '/api/v1/financial/transactions', { method: 'POST', body: input, headers });
      return normalizeTransactionDetail(json);
    },
    async listPendingTransactions() {
      const json = await requestWithFallback(baseUrl, '/api/v1/financial/pending-transactions', { items: [] }, { headers });
      const items = isRecord(json) ? json.items : json;
      return asArray<unknown>(items).map(normalizePendingTransaction).filter((item) => item.id);
    },
    async createPendingTransaction(input) {
      const json = await safeFetchJson(baseUrl, '/api/v1/financial/pending-transactions', { method: 'POST', body: input, headers });
      return normalizePendingTransaction(json);
    },
    async updatePendingTransaction(id, input) {
      const json = await safeFetchJson(baseUrl, `/api/v1/financial/pending-transactions/${encodeURIComponent(id)}`, { method: 'PATCH', body: input, headers });
      return normalizePendingTransaction(json);
    },
    async executePendingTransaction(id, input) {
      const json = await safeFetchJson(baseUrl, `/api/v1/financial/pending-transactions/${encodeURIComponent(id)}/execute`, { method: 'POST', body: input, headers });
      return normalizeTransactionDetail(json);
    },
    async cancelPendingTransaction(id) {
      await safeFetchJson(baseUrl, `/api/v1/financial/pending-transactions/${encodeURIComponent(id)}`, { method: 'DELETE', headers });
    },
    async getTransaction(id: string) {
      const json = await requestWithFallback(baseUrl, `/api/v1/financial/transactions/${encodeURIComponent(id)}`, { id }, { headers });
      return normalizeTransactionDetail(json);
    },
    async listFinancialAccounts() {
      const json = await requestWithFallback(baseUrl, '/api/v1/financial/accounts', { accounts: [] }, { headers });
      const items = isRecord(json) ? json.accounts : json;
      return asArray<unknown>(items).map((item) => normalizeFinancialAccount(item)).filter((item) => item.id);
    },
    async listFinancialCategories() {
      try {
        const json = await safeFetchJson(baseUrl, '/api/v1/financial/categories', { headers });
        const categories: Record<string, unknown> = isRecord(json) && isRecord(json.categories) ? json.categories : {};
        return {
          expense: asArray<unknown>(categories.expense).map((value) => asString(value)).filter(Boolean),
          income: asArray<unknown>(categories.income).map((value) => asString(value)).filter(Boolean),
        };
      } catch {
        // Core categories must remain usable if fetching optional custom
        // categories is temporarily unavailable.
        return { expense: [...DEFAULT_FINANCIAL_CATEGORIES.expense], income: [...DEFAULT_FINANCIAL_CATEGORIES.income] };
      }
    },
    async listEntityTags() {
      if (getLocalPreviewState() === 'edge') {
        return demoEntityTags;
      }
      const json = await requestWithFallback(baseUrl, '/api/v1/semantic/taxonomy', { categories: [] }, { headers });
      const categories = isRecord(json) ? asArray<unknown>(json.categories) : [];
      return categories.map((item) => {
        const category = isRecord(item) ? item : {};
        return {
          key: asString(category.key),
          label: asString(category.label),
          description: asString(category.description),
          parentKey: asString(category.parentKey) || null,
          level: asNumber(category.level, 0),
          kind: asString(category.kind, 'family') as EntityTag['kind'],
        };
      }).filter((category) => category.key && category.label);
    },
    async getEntitySemanticProfile(entityId) {
      try {
        const json = await safeFetchJson(baseUrl, `/api/v1/entities/${encodeURIComponent(entityId)}/profile`, { headers });
        const profile = isRecord(json) ? json : {};
        return {
          entityId: asString(profile.entityId),
          taxonomyKeys: asArray<unknown>(profile.taxonomyKeys).map((value) => asString(value)).filter(Boolean),
          roles: asArray<unknown>(profile.roles).map((value) => asString(value) as EntityRole).filter(Boolean),
          notes: asString(profile.notes) || null,
          relations: asArray<unknown>(profile.relations).map((value) => {
            const relation = isRecord(value) ? value : {};
            return {
              relationType: asString(relation.relationType, 'related_to') as EntitySemanticProfile['relations'][number]['relationType'],
              targetEntityId: asString(relation.targetEntityId),
              targetLabel: asString(relation.targetLabel),
            };
          }).filter((relation) => relation.targetEntityId),
          updatedAt: asString(profile.updatedAt) || null,
        };
      } catch {
        return null;
      }
    },
    async saveEntitySemanticProfile(entityId, input) {
      const json = await safeFetchJson(baseUrl, `/api/v1/entities/${encodeURIComponent(entityId)}/profile`, { method: 'PUT', body: input, headers });
      const profile = isRecord(json) ? json : {};
      return {
        entityId: asString(profile.entityId, entityId),
        taxonomyKeys: asArray<unknown>(profile.taxonomyKeys).map((value) => asString(value)).filter(Boolean),
        roles: asArray<unknown>(profile.roles).map((value) => asString(value) as EntityRole).filter(Boolean),
        notes: asString(profile.notes) || null,
        relations: asArray<unknown>(profile.relations).map((value) => {
          const relation = isRecord(value) ? value : {};
          return { relationType: asString(relation.relationType, 'related_to') as EntitySemanticProfile['relations'][number]['relationType'], targetEntityId: asString(relation.targetEntityId), targetLabel: asString(relation.targetLabel) };
        }).filter((relation) => relation.targetEntityId),
        updatedAt: asString(profile.updatedAt) || null,
      };
    },
    async createFinancialCategory(input) {
      const json = await safeFetchJson(baseUrl, '/api/v1/financial/categories', { method: 'POST', body: input, headers });
      const category: Record<string, unknown> = isRecord(json) && isRecord(json.category)
        ? json.category
        : isRecord(json)
          ? json
          : {};
      return {
        kind: asString(category.kind, input.kind) as 'expense' | 'income',
        name: asString(category.name, input.name),
      };
    },
    async createFinancialAccount(input) {
      const json = await safeFetchJson(baseUrl, '/api/v1/financial/accounts', { method: 'POST', body: input, headers });
      return normalizeFinancialAccount(json, input);
    },
    async updateFinancialAccount(id, input) {
      const json = await safeFetchJson(baseUrl, `/api/v1/financial/accounts/${encodeURIComponent(id)}`, { method: 'PATCH', body: input, headers });
      return normalizeFinancialAccount(json, input);
    },
    async deleteFinancialAccount(id) {
      const json = await safeFetchJson(baseUrl, `/api/v1/financial/accounts/${encodeURIComponent(id)}`, { method: 'DELETE', headers });
      return {
        deleted: isRecord(json) ? json.deleted === true : false,
        detachedTransactions: isRecord(json) ? asNumber(json.detachedTransactions, 0) : 0,
      };
    },
    async createBalanceAdjustment(accountId, input) {
      const json = await safeFetchJson(baseUrl, `/api/v1/financial/accounts/${encodeURIComponent(accountId)}/adjustments`, { method: 'POST', body: input, headers });
      return normalizeTransactionDetail(json);
    },
    async updateTransactionContext(id, input) {
      const json = await safeFetchJson(baseUrl, `/api/v1/financial/transactions/${encodeURIComponent(id)}`, { method: 'PATCH', body: input, headers });
      return normalizeTransactionDetail(json);
    },
    async mergeTransactions(canonicalId, duplicateId) {
      const json = await safeFetchJson(baseUrl, `/api/v1/financial/transactions/${encodeURIComponent(canonicalId)}/merge`, { method: 'POST', body: { duplicateId }, headers });
      return normalizeTransactionDetail(json);
    },
    async deleteTransaction(id) {
      await safeFetchJson(baseUrl, `/api/v1/financial/transactions/${encodeURIComponent(id)}`, { method: 'DELETE', headers });
    },
    async markTransactionFalsePositive(id) {
      await safeFetchJson(baseUrl, `/api/v1/financial/transactions/${encodeURIComponent(id)}/false-positive`, { method: 'POST', body: {}, headers });
    },
    async listEntityAliases(entityId) {
      const suffix = entityId ? `?entityId=${encodeURIComponent(entityId)}` : '';
      const json = await safeFetchJson(baseUrl, `/api/v1/aliases${suffix}`, { headers });
      const aliases = isRecord(json) && Array.isArray(json.aliases) ? json.aliases : [];
      return aliases
        .map((item) => asString(isRecord(item) ? item.alias : item))
        .filter(Boolean);
    },
    async createEntityAlias(input) {
      const json = await safeFetchJson(baseUrl, '/api/v1/aliases', { method: 'POST', body: input, headers });
      const record = (isRecord(json) ? json : {}) as Record<string, any>;
      return { id: asString(record.id), alias: asString(record.alias, input.alias) };
    },
    async search(query: string, filters = {}) {
      const params = new URLSearchParams();
      params.set('q', query);
      if (filters.source) params.set('source', filters.source);
      if (filters.kind) params.set('kind', filters.kind);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);

      const json = await requestWithFallback(baseUrl, `/api/v1/search?${params.toString()}`, { events: [], entities: [], relations: [] }, { headers });
      return normalizeSearchResults(json);
    },
    async listReviews(status = 'pending') {
      const json = await requestWithFallback(baseUrl, `/api/v1/review/aliases?status=${status}`, [], { headers });
      if (isRecord(json) && Array.isArray(json.items)) {
        return normalizeReviews(json.items);
      }

      return normalizeReviews(json);
    },
    async listSemanticCandidates() {
      const json = await requestWithFallback(baseUrl, '/api/v1/semantic/candidates?status=pending', { items: [] }, { headers });
      const items = isRecord(json) && Array.isArray(json.items) ? json.items : [];
      return items.map((item) => normalizeSemanticCandidate((isRecord(item) ? item : {}) as Record<string, unknown>))
        .filter((item) => item.id);
    },
    async resolveSemanticCandidate(id, input) {
      await safeFetchJson(baseUrl, `/api/v1/semantic/candidates/${encodeURIComponent(id)}/resolve`, { method: 'POST', body: input, headers });
      return { ok: true };
    },
    async findEntityMatches(query: string) {
      const term = query.trim();
      if (!term) return [];
      const json = await requestWithFallback(baseUrl, `/api/v1/entities/resolve?q=${encodeURIComponent(term)}`, { matches: [] }, { headers });
      const matches = isRecord(json) && Array.isArray(json.matches) ? json.matches : [];
      return matches.map((match) => {
        const record = (isRecord(match) ? match : {}) as Record<string, any>;
        return {
          id: asString(record.id),
          name: asString(record.value, asString(record.normalizedValue, 'Entidad existente')),
          type: asString(record.type, 'entity'),
          aliasCount: asNumber(record.aliasCount, 0) || undefined,
          canonical: record.isCanonical === true,
        };
      }).filter((match) => match.id && match.name);
    },
    async getEntity(id: string) {
      const resolveJson = await requestWithFallback(baseUrl, `/api/v1/entities/resolve?id=${encodeURIComponent(id)}`, { matches: [] }, { headers });
      const resolveRecord = isRecord(resolveJson) ? (resolveJson as Record<string, any>) : {};
      const matches = Array.isArray(resolveRecord.matches) ? (resolveRecord.matches as Array<Record<string, any>>) : [];
      const canonicalId = matches[0]?.canonicalEntityId
        ? String(matches[0].canonicalEntityId)
        : id;

      const graph = await client.getEntityGraph(canonicalId, 2);
      return graph.rootEntity;
    },
    async getEntityGraph(id: string, depth = 2) {
      const json = await requestWithFallback(baseUrl, `/api/v1/entities/${encodeURIComponent(id)}/graph?depth=${depth}&maxNodes=50&maxRelations=50`, {}, { headers });

      const graphRecord = isRecord(json) ? (json as Record<string, any>) : {};
      const baseEntity = normalizeEntity(graphRecord.rootEntity ?? graphRecord.entity ?? graphRecord);
      const nodes = normalizeEntityLinks(graphRecord.nodes);
      const relations: GraphRelation[] = asArray<unknown>(graphRecord.relations).map((item, index) => {
        const relation = (isRecord(item) ? item : {}) as Record<string, any>;
        const sourceEntityId = asString(relation.sourceEntityId) || undefined;
        const targetEntityId = asString(relation.targetEntityId) || undefined;
        // The backend does not say which way a relation points; derive it from the root entity.
        // Relations that do not touch the root (deeper in the graph) have no single direction.
        const direction: GraphRelation['direction'] = sourceEntityId === baseEntity.id ? 'outgoing' : targetEntityId === baseEntity.id ? 'incoming' : 'bidirectional';
        return {
          id: asString(relation.id, `graph_relation_${index + 1}`),
          sourceEntityId,
          targetEntityId,
          relationType: asString(relation.relationType) || undefined,
          label: relationLabel(asString(relation.relationType) || undefined, asString(relation.label, `Relación ${index + 1}`)),
          description: asString(relation.description, 'Relación del mapa'),
          direction,
          depth: asNumber(relation.depth, 1) || undefined,
          importanceScore: asNumber(relation.importanceScore, 0) || undefined,
        };
      });
      // The root entity record carries no relations or related entities of its own; they live
      // in the graph, so copy them over or the detail screen counts zero connections.
      const rootEntity: EntityDetail = {
        ...baseEntity,
        relations: baseEntity.relations.length ? baseEntity.relations : relations,
        relatedEntities: baseEntity.relatedEntities.length ? baseEntity.relatedEntities : nodes,
      };
      return { rootEntity, nodes, relations };
    },
    async inspectInsight(idOrQuery: { id?: string; q?: string }) {
      const params = new URLSearchParams();
      if (idOrQuery.id) params.set('id', idOrQuery.id);
      if (idOrQuery.q) params.set('q', idOrQuery.q);
      const json = await requestWithFallback(baseUrl, `/api/v1/insights?${params.toString()}`, {}, { headers });
      return normalizeInsight(json);
    },
    async recordKnowledgeFeedback(input) {
      await safeFetchJson(baseUrl, '/api/v1/knowledge/feedback', { method: 'POST', body: input, headers });
      return { ok: true };
    },
    async capture(kind, payload) {
      const route =
        kind === 'note'
          ? '/api/v1/capture/note'
          : kind === 'email'
            ? '/api/v1/capture/email'
            : kind === 'notification'
              ? '/api/v1/capture/notification'
              : kind === 'wallet'
                ? '/api/v1/capture/wallet'
                : '/api/v1/events';

      const body =
        kind === 'event'
          ? {
              id: payload.externalId || `event_${Date.now()}`,
              source: asString(payload.source, 'mobile'),
              kind: asString(payload.kind, 'other'),
              title: asString(payload.title) || undefined,
              body: asString(payload.body) || undefined,
              timestamp: asString(payload.timestamp) || undefined,
              externalId: asString(payload.externalId) || undefined,
              idempotencyKey: asString(payload.idempotencyKey) || undefined,
              raw: payload.raw ?? payload,
              tags: asArray<string>(payload.tags).length > 0 ? asArray<string>(payload.tags) : [],
            }
          : {
              ...payload,
              id: asString(payload.id, `${kind}_${Date.now()}`),
              ...(kind === 'wallet'
                ? {
                    merchant: asString(payload.merchant, asString(payload.merchantLabel) || undefined),
                    amount: asString(payload.amount) || undefined,
                  }
                : {}),
            };

      await safeFetchJson(baseUrl, route, {
        method: 'POST',
        body,
        headers,
      });

      return { ok: true };
    },
    async mergeEntity({ aliasEntityId, canonicalEntityId, reason, confidence }) {
      await safeFetchJson(baseUrl, `/api/v1/entities/${encodeURIComponent(aliasEntityId)}/merge`, {
        method: 'POST',
        body: {
          canonicalEntityId,
          reason,
          confidence,
        },
        headers,
      });

      return { ok: true };
    },
    async resolveAlias(aliasId, payload) {
      await safeFetchJson(baseUrl, `/api/v1/review/aliases/${encodeURIComponent(aliasId)}/resolve`, {
        method: 'POST',
        body: payload,
        headers,
      });

      return { ok: true };
    },
    async ignoreAlias(aliasId) {
      await safeFetchJson(baseUrl, `/api/v1/review/aliases/${encodeURIComponent(aliasId)}/ignore`, {
        method: 'POST',
        body: {},
        headers,
      });

      return { ok: true };
    },
    async reprocessEvent(eventId, options) {
      const json = await safeFetchJson(baseUrl, `/api/v1/events/${encodeURIComponent(eventId)}/reprocess`, {
        method: 'POST',
        body: {
          stages: options.stages,
          execution: options.execution ?? 'new',
        },
        headers,
      });

      return normalizeReprocessResult(json, options.stages);
    },
    async listEventJobs(eventId) {
      const json = await safeFetchJson(baseUrl, `/api/v1/events/${encodeURIComponent(eventId)}/jobs`, { headers });
      const jobs = isRecord(json) ? asArray<unknown>(json.jobs) : [];
      return jobs
        .map((job, index) => normalizeReprocessJob(job, index))
        .filter((job): job is ReprocessJob => Boolean(job && job.jobType === 'event_reprocess'));
    },
  };

  return client;
}

export async function loadDashboardBundle(client: BrainIAClient, financialPeriodStartDay = 1) {
  const previewState = getLocalPreviewState();
  if (previewState === 'error') {
    throwPreviewError('Today');
  }
  if (previewState === 'loading') {
    return waitForPreviewLoading();
  }
  if (previewState === 'empty') {
    return { ...emptyDashboard, live: false, source: 'empty' as const, cachedAt: undefined };
  }
  if (previewState === 'edge') {
    return { metrics: edgeMetrics, insights: demoInsights, digests: demoDigests, transactions: edgeTransactions, live: false, source: 'cache' as const, cachedAt: undefined };
  }

  const health = await client.health().catch(() => ({ ok: false }));
  const cacheKey = buildCacheKey(client.baseUrl, 'dashboard:v2');
  const bundle = await resolveBundle(
    cacheKey,
    async () => {
      const [metrics, insights, digests, transactions] = await Promise.all([
        // Metrics are admin-only on the backend; the owner key gets 403. Keep the rest of Today live.
        client.metrics().catch(() => []),
        client.listInsights(3),
        client.listDigests(2),
        loadMonthlyFinancialSummaryTransactions(client, financialPeriodStartDay),
      ]);

      return {
        metrics,
        insights,
        digests,
        transactions,
      };
    },
    {
      metrics: demoMetrics,
      insights: demoInsights,
      digests: demoDigests,
      transactions: [],
    },
    !health.ok,
    'dashboard'
  );

  return {
    ...bundle.value,
    live: health.ok,
    source: bundle.source,
    cachedAt: bundle.cachedAt,
  };
}

export async function loadSearchBundle(client: BrainIAClient, query: string) {
  const previewState = getLocalPreviewState();
  if (previewState === 'error') {
    throwPreviewError('Search');
  }
  if (previewState === 'loading' && query.trim()) {
    return waitForPreviewLoading();
  }
  if (previewState === 'empty' && query.trim()) {
    return { results: [], live: false, source: 'empty' as const };
  }

  if (!query.trim()) {
    return { results: [], live: false, source: 'empty' as const };
  }

  const cacheKey = buildCacheKey(client.baseUrl, `search:${query.toLowerCase()}`);
  const bundle = await resolveBundle(
    cacheKey,
    async () => {
      const results = await client.search(query);
      return { results };
    },
    {
      results: [
        {
          id: 'entity_spotify',
          title: 'Spotify',
          subtitle: 'Merchant',
          description: 'Recurring subscription merchant with recent money activity.',
          type: 'entity',
          route: '/entity/entity_spotify',
          relevance: 0.94,
          hint: 'Matched merchant name and subscription activity.',
        },
        {
          id: 'tx_spotify',
          title: 'Spotify charge',
          subtitle: 'Transaction',
          description: 'Recent subscription charge grouped under Subscriptions.',
          type: 'transaction',
          route: '/transaction/tx_spotify',
          relevance: 0.86,
          hint: 'Matched wallet activity and merchant name.',
        },
        {
          id: 'insight_spotify',
          title: 'Spotify appears as a recurring charge',
          subtitle: 'Insight',
          description: 'Spotify has repeated enough to treat it as a recurring subscription.',
          type: 'insight',
          route: '/insight/insight_spotify',
          relevance: 0.82,
          hint: 'Matched merchant history and insight summary.',
        },
        {
          id: 'rel_spotify_subscriptions',
          title: 'Spotify belongs to Subscriptions',
          subtitle: 'Conexión',
          description: 'Spotify is connected to recurring subscription spending.',
          type: 'relation',
          route: '/entity/entity_spotify',
          relevance: 0.78,
          hint: 'Matched category connection.',
        },
      ],
    },
    false,
    'search'
  );

  return {
    ...bundle.value,
    live: bundle.source === 'live',
    source: bundle.source,
    cachedAt: bundle.cachedAt,
  };
}

export async function loadFinancialBundle(client: BrainIAClient, financialPeriodStartDay = 1) {
  const previewState = getLocalPreviewState();
  if (previewState === 'error') {
    throwPreviewError('Money');
  }
  if (previewState === 'loading') {
    return waitForPreviewLoading();
  }
  if (previewState === 'empty') {
    return { transactions: [], trendTransactions: [], pendingTransactions: [], accounts: [], insights: [], digests: [], source: 'empty' as const };
  }
  if (previewState === 'edge') {
    return { transactions: edgeTransactions, trendTransactions: edgeTransactions, pendingTransactions: [], accounts: [], insights: demoInsights, digests: demoDigests, source: 'cache' as const };
  }

  const cacheKey = buildCacheKey(client.baseUrl, `financials:v5:${financialPeriodStartDay}`);
  const bundle = await resolveBundle(
    cacheKey,
    async () => {
      const [transactions, trendTransactions, pendingTransactions, accounts, insights, digests] = await Promise.all([
        loadMonthlyFinancialSummaryTransactions(client, financialPeriodStartDay),
        client.listTransactions(FINANCIAL_TREND_LIMIT, financialTrendRange(financialPeriodStartDay)),
        client.listPendingTransactions(),
        client.listFinancialAccounts(),
        client.listInsights(3),
        client.listDigests(2),
      ]);

      return {
        transactions,
        trendTransactions,
        pendingTransactions,
        accounts,
        insights,
        digests,
      };
    },
    {
      transactions: [],
      trendTransactions: [],
      pendingTransactions: [],
      accounts: [],
      insights: demoInsights,
      digests: demoDigests,
    },
    false,
    'financials'
  );

  return {
    ...bundle.value,
    source: bundle.source,
    cachedAt: bundle.cachedAt,
  };
}

// Financial cycles can contain more than 100 records. Fetching only the most
// recent transactions silently drops earlier income and spending from reports.
const FINANCIAL_SUMMARY_LIMIT = 1000;
const FINANCIAL_TREND_LIMIT = 1000;

export function currentFinancialPeriodRange(financialPeriodStartDay = 1, now = new Date()) {
  const startDay = Number.isInteger(financialPeriodStartDay)
    ? Math.min(28, Math.max(1, financialPeriodStartDay))
    : 1;
  const startsThisMonth = now.getDate() >= startDay;
  const from = new Date(
    now.getFullYear(),
    now.getMonth() - (startsThisMonth ? 0 : 1),
    startDay,
  );
  // The backend's `to` filter is inclusive, so stop one millisecond before
  // the next boundary to keep adjacent financial cycles from overlapping.
  const nextBoundary = new Date(from.getFullYear(), from.getMonth() + 1, startDay);
  const to = new Date(nextBoundary.getTime() - 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

/** Six completed/current financial cycles for month-by-month cash-flow trends. */
export function financialTrendRange(financialPeriodStartDay = 1, now = new Date(), monthCount = 6) {
  const current = currentFinancialPeriodRange(financialPeriodStartDay, now);
  const from = new Date(current.from);
  from.setMonth(from.getMonth() - Math.max(0, monthCount - 1));
  return { from: from.toISOString(), to: current.to };
}

/** Shared live dataset for Today and Money summaries in the user's financial cycle. */
export function loadMonthlyFinancialSummaryTransactions(client: BrainIAClient, financialPeriodStartDay = 1) {
  return client.listTransactions(
    FINANCIAL_SUMMARY_LIMIT,
    currentFinancialPeriodRange(financialPeriodStartDay),
  );
}

export async function loadReviewBundle(client: BrainIAClient) {
  const previewState = getLocalPreviewState();
  if (previewState === 'error') {
    throwPreviewError('Review');
  }
  if (previewState === 'loading') {
    return waitForPreviewLoading();
  }
  if (previewState === 'empty') {
    return { reviews: [], source: 'empty' as const };
  }
  if (previewState === 'edge') {
    return { reviews: demoReviews, source: 'preview-edge' as const };
  }

  const cacheKey = buildCacheKey(client.baseUrl, 'review');
  const bundle = await resolveBundle(
    cacheKey,
    async () => {
      const reviews = await client.listReviews('pending');
      return {
        reviews,
      };
    },
    { reviews: demoReviews },
    false,
    'review'
  );

  return {
    ...bundle.value,
    source: bundle.source,
    cachedAt: bundle.cachedAt,
  };
}

export async function loadEntityBundle(client: BrainIAClient, entityId: string) {
  const previewState = getLocalPreviewState();
  if (previewState === 'error') {
    throwPreviewError('Item detail');
  }
  if (previewState === 'loading') {
    return waitForPreviewLoading();
  }
  if (previewState === 'empty') {
    return {
      entity: {
        id: entityId,
        title: 'No item yet',
        type: 'item',
        canonical: false,
        summary: 'No item details are available for this preview state.',
        aliases: [],
        relatedEvents: [],
        relatedEntities: [],
        relations: [],
      },
      graph: {
        rootEntity: demoEntity(entityId),
        nodes: [],
        relations: [],
      },
      source: 'empty' as const,
    };
  }

  const cacheKey = buildCacheKey(client.baseUrl, `entity:${entityId}`);
  const bundle = await resolveBundle(
    cacheKey,
    async () => {
      const [entity, graph] = await Promise.all([client.getEntity(entityId), client.getEntityGraph(entityId)]);
      return {
        entity,
        graph,
      };
    },
    {
      entity: demoEntity(entityId),
      graph: {
        rootEntity: demoEntity(entityId),
        nodes: demoEntity(entityId).relatedEntities,
        relations: demoEntity(entityId).relations,
      },
    },
    false,
    'entity'
  );

  return {
    ...bundle.value,
    source: bundle.source,
    cachedAt: bundle.cachedAt,
  };
}

export async function loadTransactionBundle(client: BrainIAClient, transactionId: string) {
  const previewState = getLocalPreviewState();
  if (previewState === 'error') {
    throwPreviewError('Transaction detail');
  }
  if (previewState === 'loading') {
    return waitForPreviewLoading();
  }
  if (previewState === 'empty') {
    return {
      transaction: {
        id: transactionId,
        merchantLabel: 'No transaction yet',
        displayMerchantLabel: undefined,
        amount: '$0.00',
        currency: 'USD',
        kind: 'expense',
        observedAt: undefined,
        category: 'Uncategorized',
        account: undefined,
        accountId: undefined,
        destinationAccount: undefined,
        destinationAccountId: undefined,
        destinationAmount: undefined,
        destinationCurrency: undefined,
        merchantEntityId: undefined,
        status: undefined,
        primarySource: undefined,
        excludedFromReports: false,
        adjustmentTargetBalance: undefined,
        evidenceCount: 0,
        observedWindow: undefined,
        evidence: [],
      },
      source: 'empty' as const,
    };
  }
  if (previewState === 'edge') {
    return { transaction: demoTransactionDetail('tx_long_category'), source: 'cache' as const };
  }

  const cacheKey = buildCacheKey(client.baseUrl, `transaction:v2:${transactionId}`);
  const bundle = await resolveBundle(
    cacheKey,
    async () => {
      const transaction = await client.getTransaction(transactionId);
      return { transaction };
    },
    {
      // Never fabricate a financial record when its live detail cannot be loaded.
      transaction: undefined as unknown as TransactionDetail,
    },
    false,
    'transaction'
  );

  return {
    ...bundle.value,
    source: bundle.source,
    cachedAt: bundle.cachedAt,
  };
}

export async function loadInsightBundle(client: BrainIAClient, idOrQuery: { id?: string; q?: string }) {
  const previewState = getLocalPreviewState();
  if (previewState === 'error') {
    throwPreviewError('Insight detail');
  }
  if (previewState === 'loading') {
    return waitForPreviewLoading();
  }
  if (previewState === 'empty') {
    return {
      insight: {
        id: idOrQuery.id ?? 'insight_empty',
        title: 'No insight yet',
        summary: 'No insight is available for this preview state.',
        takeaways: [],
        whyItMatters: undefined,
        recommendedAction: undefined,
        confidence: undefined,
        model: undefined,
        timestamp: undefined,
        relatedCount: undefined,
        supportingReferences: undefined,
      },
      source: 'empty' as const,
    };
  }
  if (previewState === 'edge') {
    return {
      insight: demoInsights.find((insight) => insight.id === idOrQuery.id) ?? demoInsights[0],
      source: 'cache' as const,
    };
  }

  const cacheKey = buildCacheKey(client.baseUrl, `insight:${idOrQuery.id ?? idOrQuery.q ?? 'default'}`);
  const bundle = await resolveBundle(
    cacheKey,
    async () => {
      const insight = idOrQuery.id?.startsWith('insight_')
        ? await client.getInsightRun(idOrQuery.id)
        : await client.inspectInsight(idOrQuery);
      return { insight };
    },
    { insight: demoInsights.find((insight) => insight.id === idOrQuery.id) ?? demoInsights[0] },
    false,
    'insight'
  );

  return {
    ...bundle.value,
    source: bundle.source,
    cachedAt: bundle.cachedAt,
  };
}

export async function loadDigestBundle(client: BrainIAClient, id: string) {
  const previewState = getLocalPreviewState();
  if (previewState === 'error') {
    throwPreviewError('Digest detail');
  }
  if (previewState === 'loading') {
    return waitForPreviewLoading();
  }
  if (previewState === 'empty') {
    return {
      digest: {
        id,
        title: 'No digest yet',
        summary: 'No summary is available for this preview state.',
        windowLabel: 'No activity',
        metrics: [],
        highlights: [],
        recommendedAction: undefined,
      },
      source: 'empty' as const,
    };
  }

  const cacheKey = buildCacheKey(client.baseUrl, `digest:${id}`);
  const bundle = await resolveBundle(
    cacheKey,
    async () => {
      return { digest: await client.getDigestRun(id) };
    },
    { digest: demoDigests.find((digest) => digest.id === id) ?? demoDigests[0] },
    false,
    'digest'
  );

  return {
    ...bundle.value,
    source: bundle.source,
    cachedAt: bundle.cachedAt,
  };
}
