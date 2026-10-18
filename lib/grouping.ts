import { SearchResultItem, TransactionSummary } from './domain';
import { parseCurrency } from './format';

export type TransactionGroup = {
  label: string;
  total: number;
  count: number;
  items: TransactionSummary[];
};

export function groupTransactionsByField(items: TransactionSummary[], field: 'category' | 'account'): TransactionGroup[] {
  const groups = new Map<string, TransactionSummary[]>();

  items.forEach((item) => {
    const key = item[field] || 'Uncategorized';
    const next = groups.get(key) ?? [];
    next.push(item);
    groups.set(key, next);
  });

  return Array.from(groups.entries())
    .map(([label, groupItems]) => ({
      label,
      count: groupItems.length,
      total: groupItems.reduce((total, transaction) => total + (transaction.kind === 'expense' ? parseCurrency(transaction.amount) : 0), 0),
      items: groupItems,
    }))
    .sort((a, b) => b.total - a.total || b.count - a.count || a.label.localeCompare(b.label));
}

export type SearchCluster = {
  id: string;
  title: string;
  subtitle: string;
  tone: 'neutral' | 'positive' | 'warning';
  items: SearchResultItem[];
  featured: SearchResultItem;
  count: number;
};

export function clusterSearchResults(results: SearchResultItem[]): SearchCluster[] {
  const groups = new Map<SearchResultItem['type'], SearchResultItem[]>();

  results.forEach((item) => {
    const next = groups.get(item.type) ?? [];
    next.push(item);
    groups.set(item.type, next);
  });

  const typeMeta: Record<SearchResultItem['type'], { title: string; subtitle: string; tone: SearchCluster['tone']; priority: number }> = {
    entity: { title: 'Items', subtitle: 'People, merchants, places, and topics.', tone: 'positive', priority: 0 },
    insight: { title: 'Perspectivas', subtitle: 'Conclusiones claras y puntos relevantes.', tone: 'positive', priority: 1 },
    transaction: { title: 'Transactions', subtitle: 'Money movement with merchant and category context.', tone: 'warning', priority: 2 },
    event: { title: 'Activity', subtitle: 'Notes, notifications, emails, and captured records.', tone: 'warning', priority: 3 },
    relation: { title: 'Connections', subtitle: 'Readable links between items.', tone: 'neutral', priority: 4 },
  };

  return Array.from(groups.entries())
    .map(([type, items]) => {
      const ranked = [...items].sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0) || a.title.localeCompare(b.title));
      const meta = typeMeta[type];

      return {
        id: type,
        title: meta.title,
        subtitle: meta.subtitle,
        tone: meta.tone,
        items: ranked,
        featured: ranked[0],
        count: ranked.length,
      };
    })
    .sort((a, b) => typeMeta[a.id as SearchResultItem['type']].priority - typeMeta[b.id as SearchResultItem['type']].priority);
}
