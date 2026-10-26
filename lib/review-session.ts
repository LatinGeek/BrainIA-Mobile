import { BrainIAClient } from './api';
import { ReviewItem, SemanticActionKind, SemanticCandidate, SemanticEndpoint, SemanticEvidence, SemanticVerificationStatus, TransactionSummary } from './domain';
import { cleanDisplayText, formatCurrency } from './format';
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
  impact: { transactions: number; amount: number; currency: string; movements?: boolean };
  topic: string;
  targetEntityId?: string;
  createRule?: boolean;
  variants?: string[];
  /** Additive semantic-candidate fields. */
  actionKind?: SemanticActionKind;
  endpoints?: { subject?: SemanticEndpoint; target?: SemanticEndpoint };
  evidence?: SemanticEvidence[];
  verifiedEventCount?: number;
  verificationStatus?: SemanticVerificationStatus;
  changeExplanation?: string;
  ruleEligible?: boolean;
  policyVersion?: string;
  relationType?: string;
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
    const kind: DecisionKind = isSame && item.entityId ? 'same' : item.categoryPath.length ? 'name' : 'category';
    decisions.push(makeAliasDecision(kind, item, [item], suggestion, transactions, categories));
  });

  candidates.forEach((candidate) => {
    const actionKind = resolveActionKind(candidate);
    const subjectLabel = (candidate.endpoints?.subject?.label ?? candidate.subjectValue ?? '').trim();
    const targetLabel = (candidate.endpoints?.target?.label ?? candidate.targetValue ?? '').trim();
    const normalizedSubject = normalizeLabel(subjectLabel);
    const normalizedTarget = normalizeLabel(targetLabel);
    const sameLabel = Boolean(normalizedSubject) && normalizedSubject === normalizedTarget;
    // Legacy candidates (no actionKind) only add value when they point somewhere else.
    if (!actionKind && (!normalizedSubject || !normalizedTarget || sameLabel)) return;
    // A same-label card must at least let the user tell the two endpoints apart.
    if (sameLabel && !distinguishableEndpoints(candidate)) return;
    if (actionKind === 'merge_identities' && !normalizedSubject && !normalizedTarget) return;

    const evidence = candidate.evidence ?? [];
    const evidenceEventCount = new Set(evidence.map((entry) => entry.eventId).filter(Boolean)).size || evidence.length;
    // A backend count wins, even when it is 0; evidence length is only a fallback.
    const verifiedEventCount = candidate.verifiedEventCount;
    const backedCount = typeof verifiedEventCount === 'number' ? verifiedEventCount : evidenceEventCount;
    // Only a real category assignment is allowed to claim financial movements.
    const movements = actionKind === 'assign_existing_category';

    decisions.push({
      id: `relation:${candidate.id}`,
      kind: 'relation',
      reviewIds: [],
      candidateId: candidate.id,
      title: relationTitle(actionKind, subjectLabel, targetLabel),
      raw: subjectLabel,
      suggestion: targetLabel,
      alternatives: candidate.alternatives.slice(0, 3).map((alternative) => alternative.value),
      categoryPath: candidate.proposedPath,
      confidence: candidate.confidence,
      rationale: candidate.changeExplanation ?? candidate.rationale ?? 'Sugerido a partir de actividad relacionada.',
      impact: { transactions: backedCount, amount: 0, currency: 'UYU', movements },
      topic: 'Conexiones',
      actionKind,
      endpoints: {
        subject: candidate.endpoints?.subject ?? fallbackEndpoint(subjectLabel, candidate.subjectType, candidate.subjectEntityId),
        target: candidate.endpoints?.target ?? fallbackEndpoint(targetLabel, candidate.targetType),
      },
      evidence: evidence.length ? evidence : undefined,
      verifiedEventCount: verifiedEventCount || undefined,
      verificationStatus: candidate.verificationStatus,
      changeExplanation: candidate.changeExplanation,
      ruleEligible: candidate.ruleEligible,
      policyVersion: candidate.policyVersion,
      relationType: candidate.relationType,
    });
  });

  // Ranking never uses the model's own confidence: verified evidence first, then recency, then id.
  return decisions.sort((left, right) => {
    const evidenceDelta = evidenceScore(right) - evidenceScore(left);
    if (evidenceDelta) return evidenceDelta;
    const recencyDelta = decisionRecency(right) - decisionRecency(left);
    if (recencyDelta) return recencyDelta;
    return right.id.localeCompare(left.id);
  });
}

function evidenceScore(decision: ReviewDecision) {
  if (decision.kind !== 'relation') return decision.impact.transactions;
  return Math.max(decision.verifiedEventCount ?? 0, decision.evidence?.length ?? 0, decision.impact.transactions);
}

function decisionRecency(decision: ReviewDecision) {
  const timestamps = (decision.evidence ?? [])
    .map((entry) => (entry.occurredAt ? Date.parse(entry.occurredAt) : Number.NaN))
    .filter((value) => Number.isFinite(value));
  return timestamps.length ? Math.max(...timestamps) : 0;
}

function normalizeLabel(value?: string) {
  return cleanDisplayText(value ?? '').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

function resolveActionKind(candidate: SemanticCandidate): SemanticActionKind | undefined {
  if (candidate.actionKind) return candidate.actionKind;
  switch (candidate.decisionKind) {
    case 'reuse': return 'assign_existing_category';
    case 'create': return 'create_category';
    case 'merge': return 'merge_identities';
    case 'association': return 'associate_entities';
    default: return undefined;
  }
}

function fallbackEndpoint(label: string, type?: string, id?: string): SemanticEndpoint | undefined {
  if (!label) return undefined;
  return { label, type, id: id || undefined };
}

/** True when the two endpoints carry different kind/type information (e.g. Actividad vs Categoría). */
function distinguishableEndpoints(candidate: SemanticCandidate) {
  const subject = candidate.endpoints?.subject ?? fallbackEndpoint(candidate.subjectValue ?? '', candidate.subjectType, candidate.subjectEntityId);
  const target = candidate.endpoints?.target ?? fallbackEndpoint(candidate.targetValue ?? '', candidate.targetType);
  const signature = (endpoint?: SemanticEndpoint) => (endpoint?.kind ?? '').trim() || (endpoint?.type ?? '').trim().toLocaleLowerCase();
  const subjectSignature = signature(subject);
  const targetSignature = signature(target);
  return Boolean(subjectSignature) && Boolean(targetSignature) && subjectSignature !== targetSignature;
}

function relationTitle(actionKind: SemanticActionKind | undefined, subject: string, target: string) {
  if (actionKind === 'assign_existing_category') {
    return subject && target ? `Clasificar ${subject} en ${target}` : subject || target || 'Clasificar actividad';
  }
  if (actionKind === 'create_category') {
    return target ? `Crear la categoría ${target}` : 'Crear categoría';
  }
  if (actionKind === 'merge_identities') return subject ? `Unificar ${subject}` : 'Unificar identidades';
  if (actionKind === 'associate_entities') {
    return subject && target ? `Asociar ${subject} con ${target}` : subject || target || 'Asociar elementos';
  }
  if (subject && target) return `${subject} → ${target}`;
  return subject || target || 'Revisar relación';
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
      // Rules only exist for eligible actions and only when the user opted in.
      createRule: descriptor.rule === true && decision.ruleEligible === true,
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
      reason: 'El usuario confirmó que estas coincidencias son la misma entidad.',
      confidence: 1,
    });
  }
}

const RELATION_LABELS: Record<string, string> = {
  spent_at: 'Pagar en',
  uses_service: 'Usar el servicio',
  sent_by: 'Enviado por',
  received_from: 'Recibido de',
  produced_by_app: 'Capturado por',
  related_to: 'Relacionar',
};

export function decisionSubjectLabel(decision: ReviewDecision) {
  return cleanDisplayText(decision.endpoints?.subject?.label ?? decision.raw) || 'este elemento';
}

export function decisionTargetLabel(decision: ReviewDecision) {
  return cleanDisplayText(decision.endpoints?.target?.label ?? decision.suggestion) || 'este elemento';
}

/** Rejected/unavailable verification must not offer an approve path as if it were verified. */
export function decisionNeedsReview(decision: ReviewDecision) {
  return decision.kind === 'relation' && (decision.verificationStatus === 'rejected' || decision.verificationStatus === 'unavailable');
}

export function decisionAcceptLabel(decision: ReviewDecision) {
  if (decision.actionKind === 'assign_existing_category') return 'Clasificar aquí';
  if (decision.actionKind === 'create_category') return 'Crear categoría';
  if (decision.actionKind === 'merge_identities') return 'Unificar';
  if (decision.actionKind === 'place_entity') return 'Ubicar';
  return 'Asociar';
}

export function decisionRuleScope(decision: ReviewDecision) {
  return `Aplicar a futuras actividades de «${decisionSubjectLabel(decision)}»`;
}

/** Copy for the evidence-backed impact line; never claims movements for association/create/merge. */
export function semanticImpactLabel(decision: ReviewDecision) {
  if (decision.kind !== 'relation' || decisionNeedsReview(decision)) return undefined;
  if (decision.impact.movements && decision.impact.transactions > 0) {
    const amount = decision.impact.amount > 0 ? ` · ${formatCurrency(decision.impact.amount, decision.impact.currency)}` : '';
    return `Ordena ${decision.impact.transactions} ${decision.impact.transactions === 1 ? 'movimiento' : 'movimientos'}${amount}`;
  }
  const count = decision.verifiedEventCount ?? 0;
  if (count > 0) return `Respaldada por ${count} ${count === 1 ? 'evento' : 'eventos'}`;
  return undefined;
}

export function describeDecision(decision: ReviewDecision) {
  if (decision.kind === 'relation') return describeSemanticDecision(decision);
  if (decision.kind === 'batch') return `¿Unificar ${decision.variants?.length ?? decision.reviewIds.length} variantes de “${decision.suggestion}”?`;
  if (decision.kind === 'category') return `¿Qué categoría corresponde a “${decision.raw}”?`;
  if (decision.kind === 'same') return `¿Son la misma empresa?`;
  if (decision.kind === 'label') return `Elige una etiqueta para “${decision.raw}”.`;
  return `¿“${decision.raw}” es ${decision.suggestion}?`;
}

function describeSemanticDecision(decision: ReviewDecision) {
  const subject = decisionSubjectLabel(decision);
  const target = decisionTargetLabel(decision);
  if (decision.actionKind === 'assign_existing_category') return `Clasificar “${subject}” en “${target}”`;
  if (decision.actionKind === 'create_category') return `Crear la categoría “${target}” para “${subject}”`;
  if (decision.actionKind === 'merge_identities') return 'Unificar estas identidades';
  if (decision.actionKind === 'place_entity') return `Ubicar “${subject}” en “${target}”`;
  const relationLabel = decision.relationType ? RELATION_LABELS[decision.relationType] : undefined;
  if (relationLabel && relationLabel !== 'Relacionar') {
    return subject !== 'este elemento' && subject !== target
      ? `${relationLabel} “${target}” desde “${subject}”`
      : `${relationLabel} “${target}”`;
  }
  return `Asociar “${subject}” con “${target}”`;
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
  const labels: Record<string, string> = { merchantidentitycandidate: 'Elige la categoría de este comercio', categorycandidate: 'Categoría sugerida', relationcandidate: 'Posible conexión', namecandidate: 'Nombre sugerido' };
  return labels[text.toLowerCase().replace(/[\s_-]+/g, '')] ?? 'Sugerido a partir de actividad relacionada.';
}
