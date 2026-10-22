import { BrainIAClient } from './api';
import { ReviewItem, SemanticCandidate, TransactionSummary } from './domain';
import { readStoredValue, writeStoredValue } from './storage';

export type DecisionKind = 'name' | 'batch' | 'category' | 'same' | 'relation' | 'label';

export type ReviewDecision = {
  id: string;
  kind: DecisionKind;
  reviewIds: string[];
  candidateId?: string;
  title: string;
  raw: string;
  suggestion: string;
  alternatives: string[];
  categoryPath: string[];
  confidence: number;
  rationale: string;
  impact: { transactions: number; amount: number; currency: string };
  topic: string;
  targetEntityId?: string;
  createRule?: boolean;
  variants?: string[];
};

export type ReviewAnswer = {
  id: string;
  choice: 'accept' | 'skip' | 'different' | 'no';
  value?: string;
  rule?: boolean;
  at: number;
};

export type PendingCommitDescriptor = {
  id: string;
  decisionId: string;
  choice: ReviewAnswer['choice'];
  value?: string;
  rule?: boolean;
  reviewIds: string[];
  candidateId?: string;
  categoryPath?: string[];
  targetEntityId?: string;
};

export type ReviewSessionState = {
  order: string[];
  index: number;
  answers: ReviewAnswer[];
  skipped: string[];
  pending: PendingCommitDescriptor[];
  startedAt: number;
};

const STORAGE_KEY = 'review.session.v1';

export function loadReviewSessionState(): ReviewSessionState | null {
  try {
    // Storage is async on native; this helper is only used on web where
    // localStorage is synchronous. Native callers use readStoredValue below.
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as ReviewSessionState : null;
  } catch {
    return null;
  }
}

export async function readReviewSessionState() {
  const raw = await readStoredValue(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ReviewSessionState;
  } catch {
    return null;
  }
}

export function persistReviewSessionState(state: ReviewSessionState) {
  return writeStoredValue(STORAGE_KEY, JSON.stringify(state));
}

export async function clearReviewSessionState() {
  return writeStoredValue(STORAGE_KEY, '');
}

export function buildReviewQueue({
  reviews,
  candidates,
  transactions,
  categories,
}: {
  reviews: ReviewItem[];
  candidates: SemanticCandidate[];
  transactions: TransactionSummary[];
  categories: string[];
}): ReviewDecision[] {
  const pending = reviews.filter((item) => item.status === 'pending');
  const batchGroups = new Map<string, ReviewItem[]>();
  const singles: ReviewItem[] = [];

  pending.forEach((item) => {
    const key = (item.normalizedValue ?? '').trim().toLocaleLowerCase();
    if (key && pending.filter((candidate) => (candidate.normalizedValue ?? '').trim().toLocaleLowerCase() === key).length > 1) {
      batchGroups.set(key, [...(batchGroups.get(key) ?? []), item]);
    } else {
      singles.push(item);
    }
  });

  const decisions: ReviewDecision[] = [];
  batchGroups.forEach((items) => {
    const suggestion = items[0].normalizedValue ?? items[0].alias;
    decisions.push(makeAliasDecision('batch', items[0], items, suggestion, transactions, categories));
  });
  singles.forEach((item) => {
    const suggestion = (item.normalizedValue ?? item.alias).trim();
    const isSame = /merge|same|duplicate/i.test(item.reason);
    const kind: DecisionKind = isSame && item.entityId ? 'same' : item.categoryPath.length || /merchant|identity/i.test(item.reason) ? 'name' : 'category';
    decisions.push(makeAliasDecision(kind, item, [item], suggestion, transactions, categories));
  });

  candidates.forEach((candidate) => {
    const transactions = 0;
    decisions.push({
      id: `relation:${candidate.id}`,
      kind: 'relation',
      reviewIds: [],
      candidateId: candidate.id,
      title: candidate.targetValue ? `${candidate.subjectValue ?? 'Este elemento'} → ${candidate.targetValue}` : candidate.rationale ?? 'Conexión sugerida',
      raw: candidate.subjectValue ?? candidate.targetValue,
      suggestion: candidate.targetValue,
      alternatives: candidate.alternatives.slice(0, 3).map((alternative) => alternative.value),
      categoryPath: candidate.proposedPath,
      confidence: candidate.confidence,
      rationale: candidate.rationale ?? 'Sugerido a partir de actividad relacionada.',
      impact: { transactions, amount: 0, currency: 'UYU' },
      topic: 'Conexiones',
    });
  });

  return decisions.sort((left, right) => {
    const leftScore = (left.impact.transactions + 1) * (left.confidence || 0.5);
    const rightScore = (right.impact.transactions + 1) * (right.confidence || 0.5);
    return rightScore - leftScore;
  });
}

function makeAliasDecision(kind: DecisionKind, item: ReviewItem, items: ReviewItem[], suggestion: string, transactions: TransactionSummary[], categories: string[]): ReviewDecision {
  const aliases = items.map((entry) => entry.alias);
  let matched = 0;
  let amount = 0;
  transactions.forEach((transaction) => {
    const haystack = `${transaction.merchantLabel} ${transaction.displayMerchantLabel ?? ''} ${transaction.category ?? ''}`.toLocaleLowerCase();
    if (aliases.some((alias) => alias && haystack.includes(alias.toLocaleLowerCase()))) {
      matched += 1;
      amount += Number(String(transaction.amount).replace(/[^0-9.-]/g, '')) || 0;
    }
  });
  const alternativeSet = new Set<string>([
    suggestion,
    ...items.map((entry) => entry.alias),
    ...items.flatMap((entry) => entry.categoryPath),
    ...categories.slice(0, 6),
  ]);
  alternativeSet.delete('');
  return {
    id: `review:${items.map((entry) => entry.id).join('+')}`,
    kind,
    reviewIds: items.map((entry) => entry.id),
    title: kind === 'batch' ? `${items.length} variantes de ${suggestion}` : suggestion || item.alias,
    raw: item.alias,
    suggestion,
    alternatives: [...alternativeSet].slice(0, 6),
    categoryPath: item.categoryPath,
    confidence: 0.5,
    rationale: reviewReasonLabel(item.reason),
    impact: { transactions: matched, amount, currency: 'UYU' },
    topic: item.categoryPath[0] ?? (/(merge|same|duplicate)/i.test(item.reason) ? 'Identidades' : 'Nombres'),
    targetEntityId: kind === 'same' ? item.entityId : undefined,
    variants: kind === 'batch' ? aliases : undefined,
  };
}

export async function commitDecision(client: BrainIAClient, descriptor: PendingCommitDescriptor, decision: ReviewDecision) {
  if (decision.kind === 'relation' && decision.candidateId) {
    await client.resolveSemanticCandidate(decision.candidateId, {
      action: descriptor.choice === 'accept' ? 'approve' : 'reject',
      createRule: descriptor.rule,
    });
    return;
  }

  if (descriptor.choice === 'different' || descriptor.choice === 'no') {
    for (const reviewId of descriptor.reviewIds) await client.ignoreAlias(reviewId);
    return;
  }

  for (const reviewId of descriptor.reviewIds) {
    const categoryPath = decision.kind === 'category' || decision.kind === 'label'
      ? [descriptor.value ?? decision.suggestion]
      : descriptor.categoryPath ?? decision.categoryPath;
    await client.resolveAlias(reviewId, {
      alias: descriptor.value ?? decision.suggestion,
      categoryPath,
      targetEntityId: decision.kind === 'same' ? decision.targetEntityId : undefined,
    });
  }

  if (decision.kind === 'same' && decision.targetEntityId) {
    await client.mergeEntity({
      aliasEntityId: decision.reviewIds[0],
      canonicalEntityId: decision.targetEntityId,
      reason: 'User confirmed these review matches are the same entity.',
      confidence: 1,
    });
  }
}

export function describeDecision(decision: ReviewDecision) {
  if (decision.kind === 'relation') return `¿Conectar ${decision.raw} con ${decision.suggestion}?`;
  if (decision.kind === 'batch') return `¿Unificar ${decision.variants?.length ?? decision.reviewIds.length} variantes de “${decision.suggestion}”?`;
  if (decision.kind === 'category') return `¿Qué categoría corresponde a “${decision.raw}”?`;
  if (decision.kind === 'same') return `¿Son la misma empresa?`;
  if (decision.kind === 'label') return `Elige una etiqueta para “${decision.raw}”.`;
  return `¿“${decision.raw}” es ${decision.suggestion}?`;
}

export function decisionSeconds(count: number) {
  return Math.max(20, Math.round(count * 8));
}

export function decisionEffort(count: number) {
  const seconds = Math.max(20, Math.round(count * 8));
  return `${count} ${count === 1 ? 'decisión rápida' : 'decisiones rápidas'} · unos ${seconds} segundos`;
}

function reviewReasonLabel(reason?: string) {
  const text = (reason ?? '').trim();
  if (!text) return 'Detectado en la actividad reciente.';
  if (/\s/.test(text)) return text;
  const labels: Record<string, string> = { merchantidentitycandidate: 'Nombre de comercio por confirmar', categorycandidate: 'Categoría sugerida', relationcandidate: 'Posible conexión', namecandidate: 'Nombre sugerido' };
  return labels[text.toLowerCase().replace(/[\s_-]+/g, '')] ?? 'Sugerido a partir de actividad relacionada.';
}
