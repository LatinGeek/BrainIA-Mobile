import { useCallback, useEffect, useState } from 'react';

import type { TransactionSummary } from '@/lib/domain';
import { translateKnownLabel } from '@/lib/format';
import { deleteStoredValue, readStoredValue, writeStoredValue } from '@/lib/storage';

/**
 * Rules tell the app what to assume when a movement arrives without a value ("PedidosYa and the currency is unclear:
 * UYU"). They fill gaps only: a currency, category or account the backend already knows is never overridden, and every
 * assumed value is reported on `assumed` so the interface can say where it came from.
 */
export type RuleCurrencyMatch = 'any' | 'unknown' | 'UYU' | 'USD';

export type RuleAction =
  | { field: 'currency'; value: 'UYU' | 'USD' }
  | { field: 'category'; value: string }
  | { field: 'account'; accountId: string; accountName: string };

export type Rule = {
  id: string;
  enabled: boolean;
  /** Where the movement comes from (an app, a bank, a channel). Empty matches any. */
  source: string;
  /** Text the movement mentions (merchant, concept). Empty matches any. */
  text: string;
  currency: RuleCurrencyMatch;
  /** An account or card number, or its last digits. Empty matches any. */
  reference: string;
  action: RuleAction;
  createdAt: number;
};

export type RuleDraft = Omit<Rule, 'id' | 'createdAt' | 'enabled'> & { enabled?: boolean };

export type Assumption = { field: RuleAction['field']; ruleId: string };

type RuleSubject = TransactionSummary & { evidence?: { source?: string; merchantLabel?: string }[] };

const STORAGE_KEY = 'brainia_mobile.rules.v1';
// SecureStore documents a ~2 KB limit per value, so the list is stored in chunks well under it.
const CHUNK_SIZE = 1200;

function fold(value: string | undefined) {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function isCurrencyUnknown(currency: string | undefined) {
  return !currency || !/^[A-Z]{3}$/.test(currency) || currency === 'UNKNOWN';
}

/** Everything the movement says about where it came from and what it is. */
function haystack(subject: RuleSubject) {
  return fold([
    subject.primarySource,
    subject.merchantLabel,
    subject.displayMerchantLabel,
    subject.account,
    subject.destinationAccount,
    ...(subject.hints ?? []),
    ...(subject.evidence ?? []).flatMap((item) => [item.source, item.merchantLabel]),
  ].filter(Boolean).join(' '));
}

/** An account or card number is only looked for in the account the movement already names, never in amounts or labels. */
function referenceMatches(subject: RuleSubject, reference: string) {
  const wanted = reference.trim();
  if (!wanted) return true;
  const fields = [subject.account, subject.destinationAccount].filter(Boolean).join(' ');
  if (/^\d+$/.test(wanted)) return (fields.match(/\d+/g) ?? []).some((run) => run.endsWith(wanted));
  return fold(fields).includes(fold(wanted));
}

export function conditionCount(rule: Pick<Rule, 'source' | 'text' | 'currency' | 'reference'>) {
  return [rule.source.trim(), rule.text.trim(), rule.reference.trim()].filter(Boolean).length + (rule.currency !== 'any' ? 1 : 0);
}

function matches(rule: Rule, subject: RuleSubject, hay: string, currency: string | undefined) {
  const has = (needle: string) => !needle.trim() || hay.includes(fold(needle));
  if (!has(rule.source) || !has(rule.text) || !referenceMatches(subject, rule.reference)) return false;
  if (rule.currency === 'any') return true;
  if (rule.currency === 'unknown') return isCurrencyUnknown(currency);
  return currency === rule.currency;
}

/** The most specific matching rule wins; between equals, the newest. */
function best(rules: Rule[], field: RuleAction['field'], subject: RuleSubject, hay: string, currency: string | undefined) {
  return rules
    .filter((rule) => rule.enabled && rule.action.field === field && conditionCount(rule) > 0 && matches(rule, subject, hay, currency))
    .sort((a, b) => conditionCount(b) - conditionCount(a) || b.createdAt - a.createdAt)[0];
}

export function applyRules<T extends RuleSubject>(subject: T, rules: Rule[]): T {
  if (!rules.some((rule) => rule.enabled)) return subject;
  const hay = haystack(subject);
  const assumed: Assumption[] = [];
  let next: T = subject;

  if (isCurrencyUnknown(subject.currency)) {
    const rule = best(rules, 'currency', subject, hay, subject.currency);
    if (rule && rule.action.field === 'currency') {
      next = { ...next, currency: rule.action.value };
      assumed.push({ field: 'currency', ruleId: rule.id });
    }
  }
  if (!subject.category) {
    const rule = best(rules, 'category', subject, hay, next.currency);
    if (rule && rule.action.field === 'category') {
      next = { ...next, category: rule.action.value };
      assumed.push({ field: 'category', ruleId: rule.id });
    }
  }
  if (!subject.accountId) {
    const rule = best(rules, 'account', subject, hay, next.currency);
    if (rule && rule.action.field === 'account') {
      next = { ...next, account: rule.action.accountName, accountId: rule.action.accountId };
      assumed.push({ field: 'account', ruleId: rule.id });
    }
  }
  return assumed.length ? { ...next, assumed: [...(subject.assumed ?? []), ...assumed] } : subject;
}

const CURRENCY_LABEL: Record<RuleCurrencyMatch, string> = { any: '', unknown: 'la moneda es incierta', UYU: 'está en UYU', USD: 'está en USD' };

/** "Si viene de PedidosYa y la moneda es incierta" */
export function describeConditions(rule: Pick<Rule, 'source' | 'text' | 'currency' | 'reference'>) {
  const parts = [
    rule.source.trim() ? `viene de ${rule.source.trim()}` : '',
    rule.text.trim() ? `menciona “${rule.text.trim()}”` : '',
    rule.reference.trim() ? `la cuenta o tarjeta contiene ${rule.reference.trim()}` : '',
    CURRENCY_LABEL[rule.currency],
  ].filter(Boolean);
  if (!parts.length) return 'Sin condiciones';
  return `Si ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}` : parts[0]}`;
}

/** "Asumir categoría Delivery" */
export function describeAction(action: RuleAction) {
  if (action.field === 'currency') return `Asumir moneda ${action.value}`;
  if (action.field === 'category') return `Asumir categoría ${translateKnownLabel(action.value)}`;
  return `Asignar a la cuenta ${action.accountName}`;
}

export function validateDraft(draft: RuleDraft): string | null {
  if (conditionCount(draft) === 0) return 'Añade al menos una condición.';
  if (draft.action.field === 'category' && !draft.action.value.trim()) return 'Elige una categoría.';
  if (draft.action.field === 'account' && !draft.action.accountId) return 'Elige una cuenta.';
  return null;
}

// --- Store -----------------------------------------------------------------------------------------------------------

let current: Rule[] = [];
let loaded: Promise<void> | null = null;
let isLoaded = false;
const listeners = new Set<() => void>();

function isRule(value: unknown): value is Rule {
  const rule = value as Rule | null;
  return Boolean(rule && typeof rule.id === 'string' && rule.action && typeof rule.action.field === 'string' && typeof rule.source === 'string');
}

async function readPersisted() {
  const count = Number(await readStoredValue(`${STORAGE_KEY}.count`));
  if (!Number.isInteger(count) || count < 1) return readStoredValue(STORAGE_KEY);
  const parts = await Promise.all(Array.from({ length: count }, (_, index) => readStoredValue(`${STORAGE_KEY}.${index}`)));
  return parts.some((part) => part === null) ? null : parts.join('');
}

async function persist(next: Rule[]) {
  const json = JSON.stringify(next);
  const parts = Array.from({ length: Math.ceil(json.length / CHUNK_SIZE) }, (_, index) => json.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE));
  const previous = Number(await readStoredValue(`${STORAGE_KEY}.count`)) || 0;
  await Promise.all(parts.map((part, index) => writeStoredValue(`${STORAGE_KEY}.${index}`, part)));
  await writeStoredValue(`${STORAGE_KEY}.count`, String(Math.max(parts.length, 1)));
  if (!parts.length) await writeStoredValue(`${STORAGE_KEY}.0`, '[]');
  for (let index = Math.max(parts.length, 1); index < previous; index += 1) await deleteStoredValue(`${STORAGE_KEY}.${index}`);
}

export function ensureRulesLoaded() {
  loaded ??= readPersisted()
    .then((raw) => {
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      current = Array.isArray(parsed) ? parsed.filter(isRule) : [];
    })
    .catch(() => { current = []; })
    .finally(() => { isLoaded = true; });
  return loaded;
}

export function getRules() {
  return current;
}

/** Applies the change at once; if it cannot be saved the previous list comes back and the caller hears about it. */
async function commit(next: Rule[]) {
  const previous = current;
  current = next;
  listeners.forEach((listener) => listener());
  try {
    await persist(next);
  } catch (error) {
    current = previous;
    listeners.forEach((listener) => listener());
    throw error;
  }
}

function newId() {
  return `rule_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function useRules() {
  const [rules, setRules] = useState<Rule[]>(current);
  const [ready, setReady] = useState(isLoaded);

  useEffect(() => {
    let active = true;
    const sync = () => { if (active) setRules(current); };
    listeners.add(sync);
    void ensureRulesLoaded().then(() => { if (active) { setRules(current); setReady(true); } });
    return () => { active = false; listeners.delete(sync); };
  }, []);

  const add = useCallback((draft: RuleDraft) => commit([{ ...draft, enabled: draft.enabled ?? true, id: newId(), createdAt: Date.now() }, ...current]), []);
  const update = useCallback((id: string, draft: RuleDraft) => commit(current.map((rule) => (rule.id === id ? { ...rule, ...draft, enabled: draft.enabled ?? rule.enabled } : rule))), []);
  const setEnabled = useCallback((id: string, enabled: boolean) => commit(current.map((rule) => (rule.id === id ? { ...rule, enabled } : rule))), []);
  const remove = useCallback((id: string) => commit(current.filter((rule) => rule.id !== id)), []);

  return { rules, ready, add, update, setEnabled, remove };
}
