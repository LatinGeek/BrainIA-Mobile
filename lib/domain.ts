export type ThemeId = 'editorial-minimal' | 'intelligence-console' | 'warm-knowledge';

export type SummaryMetric = {
  label: string;
  value: string;
  delta?: string;
  tone?: 'neutral' | 'positive' | 'warning' | 'danger';
};

export type InsightSummary = {
  id: string;
  title: string;
  summary: string;
  takeaways: string[];
  model?: string;
  timestamp?: string;
  relatedCount?: number;
};

export type DigestSummary = {
  id: string;
  title: string;
  summary: string;
  windowLabel: string;
  eventCount?: number;
  relatedInsightCount?: number;
  metrics?: SummaryMetric[];
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
  merchantEntityId?: string;
  status?: string;
  primarySource?: string;
  eventIds?: string[];
  evidenceCount?: number;
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

export type EventSummary = {
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
};

export type ReviewItem = {
  id: string;
  alias: string;
  categoryPath: string[];
  reason: string;
  source?: string;
  eventId?: string;
  originalValue?: string;
  normalizedValue?: string;
  status: 'pending' | 'resolved' | 'ignored';
};

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
};

export type AppSettings = {
  themeId: ThemeId;
  baseUrl: string;
  apiKey: string;
  clientId: string;
  dashboardMode: 'balanced' | 'knowledge' | 'finance';
  dataVisibility: 'essential' | 'balanced' | 'detailed';
  digestNotifications: boolean;
  reviewNotifications: boolean;
};
