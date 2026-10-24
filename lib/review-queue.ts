import { useSyncExternalStore } from 'react';

import { loadReviewBundle } from './api';
import { buildReviewQueue } from './review-session';

type ReviewClient = Parameters<typeof loadReviewBundle>[0];

let queueSize: number | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** One source of truth for "how many decisions are waiting", shared by the dock badge, Today and Review. */
export function setReviewQueueSize(size: number) {
  if (size === queueSize) return;
  queueSize = size;
  listeners.forEach((listener) => listener());
}

export function useReviewQueueSize() {
  return useSyncExternalStore(subscribe, () => queueSize, () => queueSize);
}

export async function refreshReviewQueueSize(client: ReviewClient) {
  try {
    const [bundle, candidates, transactions, categories] = await Promise.all([
      loadReviewBundle(client),
      client.listSemanticCandidates().catch(() => []),
      client.listTransactions(500).catch(() => []),
      client.listFinancialCategories().catch(() => ({ expense: [], income: [] })),
    ]);
    const queue = buildReviewQueue({ reviews: bundle.reviews, candidates, transactions, categories: [...categories.expense, ...categories.income] });
    setReviewQueueSize(queue.length);
  } catch {
    // Keep the last known size; the badge simply stays as it was.
  }
}
