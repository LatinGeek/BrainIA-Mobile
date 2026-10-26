export type ThemeId = 'intelligence-console';

/** Wire types stay separate from v1 display models. Runtime validation is required. */
export type V2Envelope = {
  contractVersion: 2;
  deliveryId: string;
  sourceInstanceId: string;
  sourceObservationKey: string;
  producerRevisionId: string;
  producerSequence: string;
  changeKind: 'posted' | 'updated' | 'removed' | 'imported';
  canonicalizationVersion: 'jcs-sha256-v1';
  contentFingerprint: string;
  sourceOccurredAt: string | null;
  sourceUpdatedAt: string | null;
  deviceObservedAt: string;
  content: Record<string, unknown>;
};

/** Queue storage persists this result; HELD/BLOCKED_AUTH never authorize a v1 retry. */
export type V2QueuedRevision = {
  envelope: V2Envelope;
  /** BLOCKED_AUTH is the 401 pause; HELD covers 403, gate and unsupported holds. */
  state: 'PENDING' | 'HELD' | 'BLOCKED_AUTH' | 'ACKNOWLEDGED';
  reason?: string;
  receipt?: unknown;
};

/** Approved `Capabilities` document; feature gates are server-authoritative. */
export type V2Capabilities = {
  apiVersion: '2.0.0';
  captureVersions: [1, 2];
  maxBatchItems: 100;
  maxItemBytes: 65536;
  maxBatchBytes: 1048576;
  currencyRegistryVersion: string;
  features: {
    observationRevisions: true;
    decimalFinance: true;
    email: false;
    activity: false;
    location: false;
    episodes: false;
    connectors: false;
  };
  policyVersion: number;
};

export type ProvenanceOrigin = 'model' | 'captured' | 'user' | 'pending';

export type SupportingReference = {
  id: string;
  label: string;
  description?: string;
  route?: string;
  kind: 'entity' | 'relation' | 'event' | 'transaction';
};

export type SummaryMetric = {
  label: string;
  value: string;
  delta?: string;
  tone?: 'neutral' | 'positive' | 'warning' | 'danger';
};

export type BriefCard = {
  title: string;
  summary: string;
  recommendedAction?: string;
};

export type InsightSummary = {
  id: string;
  title: string;
  summary: string;
  takeaways: string[];
  whyItMatters?: string;
  recommendedAction?: string;
  confidence?: number;
  cards?: BriefCard[];
  detectors?: string[];
  model?: string;
  timestamp?: string;
  relatedCount?: number;
  supportingReferences?: SupportingReference[];
};

export type DigestSummary = {
  id: string;
  title: string;
  summary: string;
  windowLabel: string;
  eventCount?: number;
  relatedInsightCount?: number;
  metrics?: SummaryMetric[];
  highlights?: string[];
  recommendedAction?: string;
  cards?: BriefCard[];
};

export type TransactionSummary = {
  id: string;
  merchantLabel: string;
  /** Canonical entity name, when this transaction's merchant has been reviewed or merged. */
  displayMerchantLabel?: string;
  amount: string;
  currency: string;
  kind: string;
  observedAt?: string;
  category?: string;
  account?: string;
  accountId?: string;
  destinationAccount?: string;
  destinationAccountId?: string;
  destinationAmount?: string;
  destinationCurrency?: string;
  merchantEntityId?: string;
  status?: string;
  primarySource?: string;
  eventIds?: string[];
  evidenceCount?: number;
  excludedFromReports?: boolean;
  adjustmentTargetBalance?: string;
  /** Sources and labels of the evidence behind the movement; rules match on them. */
  hints?: string[];
  /** Values filled in by one of the user's rules because the backend had none. */
  assumed?: { field: 'currency' | 'category' | 'account'; ruleId: string; previous?: { value?: string; accountId?: string } }[];
};

export type PendingTransaction = {
  id: string;
  title: string;
  kind: 'expense' | 'income';
  amount: string;
  currency: 'UYU' | 'USD';
  category?: string;
  account?: string;
  accountId?: string;
  estimatedExecutionDate: string;
  createdAt?: string;
  updatedAt?: string;
};

export type SearchResultItem = {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  type: 'event' | 'entity' | 'relation' | 'insight' | 'transaction';
  route: string;
  relevance?: number;
  hint?: string;
};

export type ProgressStageKey = 'classification' | 'semanticInterpretation' | 'financialProjection' | 'searchIndexing';
export type ProgressStatus = 'pending' | 'running' | 'completed' | 'awaiting_review' | 'recoverable_failure' | 'terminal_failure' | 'not_applicable';

/** Backend contract: docs/api.md "Event processing progress". Only present on event detail and capture responses. */
export type EventProgress = {
  summary: { status: ProgressStatus; partial: boolean; message: string };
  stages: Record<ProgressStageKey, {
    status: ProgressStatus;
    code: string;
    message: string;
    job: { status: string; attempt: number; maxAttempts: number; nextAttemptAt: string | null } | null;
  }>;
};

export type EventSummary = {
  privacyStatus?: string;
  id: string;
  source: string;
  kind: string;
  title: string;
  rawTitle?: string;
  description?: string;
  body?: string;
  receivedAt?: string;
  inferredKind?: string;
  confidence?: number;
  interpretationStatus?: 'resolved' | 'review' | 'retryable' | 'unclassified' | string;
  interpretationSource?: string;
  interpretationFailureReason?: string;
  taxonomyVersion?: string;
  primaryCategoryKey?: string;
  secondaryCategoryKeys?: string[];
  facets?: { type: string; value: string; confidence: number }[];
  progress?: EventProgress;
};

export type ReviewItem = {
  id: string;
  entityId?: string;
  entityType?: string;
  alias: string;
  categoryPath: string[];
  reason: string;
  source?: string;
  eventId?: string;
  financialKind?: 'expense' | 'income' | 'transfer';
  originalValue?: string;
  normalizedValue?: string;
  status: 'pending' | 'resolved' | 'ignored';
};

/** Additive backend contract: what the candidate would actually do if approved. */
export type SemanticActionKind = 'assign_existing_category' | 'create_category' | 'merge_identities' | 'associate_entities' | 'place_entity';

export type SemanticEndpointKind = 'event' | 'concept' | 'identity' | 'category';

export type SemanticEndpoint = {
  id?: string;
  type?: string;
  label?: string;
  canonicalId?: string;
  kind?: SemanticEndpointKind;
};

export type SemanticEvidence = {
  eventId?: string;
  source?: string;
  title?: string;
  excerpt?: string;
  occurredAt?: string;
  field?: string;
  kind?: string;
};

export type SemanticVerificationStatus = 'verified' | 'rejected' | 'unavailable' | 'not_required';

export type SemanticCandidate = {
  id: string;
  eventId?: string;
  subjectEntityId?: string;
  subjectValue?: string;
  subjectType?: string;
  relationType: string;
  targetType: string;
  targetValue: string;
  confidence: number;
  rationale?: string;
  extractor?: string;
  parentTargetValue?: string;
  decisionKind?: 'reuse' | 'create' | 'merge' | 'association' | string;
  domainValue?: string;
  anchorRole?: 'primary' | 'secondary';
  proposedPath: string[];
  alternatives: { parent?: string; value: string; confidence: number }[];
  recurrenceCount?: number;
  governanceVersion?: string;
  model?: string;
  status: 'pending' | 'approved' | 'rejected';
  /** Additive fields. All optional so older backends keep working. */
  actionKind?: SemanticActionKind;
  endpoints?: { subject?: SemanticEndpoint; target?: SemanticEndpoint };
  evidence?: SemanticEvidence[];
  verifiedEventCount?: number;
  verificationStatus?: SemanticVerificationStatus;
  changeExplanation?: string;
  ruleEligible?: boolean;
  policyVersion?: string;
};

export type EntitySuggestion = {
  id: string;
  name: string;
  type: string;
  aliasCount?: number;
  canonical?: boolean;
};

export type ExploreGraphNode = EntitySuggestion & {
  description: string;
  importanceScore: number;
  communityId: string;
  hierarchyDepth: number;
  eventId?: string;
  nodeKind?: 'category' | 'identity' | 'evidence';
  taxonomyKey?: string;
  parentEntityId?: string;
  breadcrumb?: string[];
  childCount?: number;
  evidenceCount?: number;
  hasMore?: boolean;
};

export type ExploreGraphRelation = {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationType: string;
  label: string;
  description: string;
  confidence: number;
  importanceScore: number;
};

export type ExploreGraph = {
  communities: { id: string; label: string; nodeCount: number; leaderEntityId: string }[];
  nodes: ExploreGraphNode[];
  relations: ExploreGraphRelation[];
  stats: { nodesCount: number; relationsCount: number; truncated: boolean };
};

export type EntityLink = {
  id: string;
  label: string;
  type: string;
  description?: string;
  canonical?: boolean;
  confidence?: number;
};

export type GraphRelation = {
  id: string;
  sourceEntityId?: string;
  targetEntityId?: string;
  relationType?: string;
  label: string;
  description: string;
  direction: 'incoming' | 'outgoing' | 'bidirectional';
  depth?: number;
  importanceScore?: number;
};

export type EntityDetail = {
  id: string;
  title: string;
  type: string;
  canonical?: boolean;
  summary: string;
  aliases: string[];
  relatedEvents: string[];
  relatedEntities: EntityLink[];
  relations: GraphRelation[];
};

export type TransactionDetail = TransactionSummary & {
  observedWindow?: string;
  evidence: {
    id: string;
    rawEventId?: string;
    source: string;
    kind: string;
    amount?: string;
    currency?: string;
    merchantLabel?: string;
    observedAt?: string;
    matchReason?: string;
  }[];
};

export type FinancialAccount = {
  id: string;
  name: string;
  type: string;
  mask?: string;
  currency?: 'UYU' | 'USD';
  color?: string;
  balance: string;
};

export type FinancialCategories = {
  expense: string[];
  income: string[];
};

/** Available even while the optional custom-category request is retried. */
export const DEFAULT_FINANCIAL_CATEGORIES: FinancialCategories = {
  expense: ['Food / Delivery', 'Food / Groceries', 'Subscriptions', 'Bills / Utilities', 'Transport', 'Shopping', 'Health', 'Home', 'Entertainment', 'Going Out'],
  income: ['Salary', 'Freelance / Client', 'Business', 'Refund', 'Investments', 'Interest', 'Gift', 'Other Income'],
};

export type EntityTag = {
  key: string;
  label: string;
  description: string;
  parentKey?: string | null;
  level: number;
  kind: 'domain' | 'family' | 'class' | 'subtype';
};

export type EntityRole = 'merchant' | 'business' | 'payment_method' | 'organization' | 'app' | 'provider' | 'account';

export type EntitySemanticProfile = {
  entityId: string;
  taxonomyKeys: string[];
  roles: EntityRole[];
  notes?: string | null;
  relations: Array<{
    relationType: 'part_of' | 'uses_service' | 'produced_by_app' | 'controls' | 'related_to';
    targetEntityId: string;
    targetLabel: string;
  }>;
  updatedAt?: string | null;
};

export type AppSettings = {
  themeId: ThemeId;
  baseUrl: string;
  apiKey: string;
  clientId: string;
  financialPeriodStartDay: number;
  dashboardMode: 'balanced' | 'knowledge' | 'finance';
  dataVisibility: 'essential' | 'balanced' | 'detailed';
  digestNotifications: boolean;
  reviewNotifications: boolean;
};
