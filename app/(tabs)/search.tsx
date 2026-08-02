import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import {
  AppScreen,
  Section,
  TopBar,
} from '@/components/layout';
import { DigestCard, InsightCard } from '@/components/cards';
import { Button, CommandPanel, FilterChip, ListRow, Panel, SearchField, StatusBadge, Surface, ToggleRow } from '@/components/primitives';
import { EmptyState, LoadingSkeleton } from '@/components/states';
import { useBrainIAClient, useTheme } from '@/lib/app-state';
import { loadSearchBundle } from '@/lib/api';
import { DigestSummary, ExploreGraph, InsightSummary, TransactionSummary } from '@/lib/domain';
import { formatCategoryLabel } from '@/lib/format';
import { useAsyncResource, useDebouncedValue } from '@/lib/hooks';
import { clusterSearchResults } from '@/lib/grouping';
import { GraphExplorer } from '@/components/knowledge/GraphExplorer';

const sourceFilters = [
  { value: 'all', label: 'All' },
  { value: 'wallet', label: 'Money' },
  { value: 'email', label: 'Email' },
  { value: 'mobile', label: 'Notes' },
] as const;

export default function SearchScreen() {
  const theme = useTheme();
  const client = useBrainIAClient();
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<(typeof sourceFilters)[number]['value']>('all');
  const [focusedEntityId, setFocusedEntityId] = useState<string | undefined>();
  const [expandedGraph, setExpandedGraph] = useState<ExploreGraph | undefined>();
  const [showEvidenceNodes, setShowEvidenceNodes] = useState(false);
  const [showIdentityNodes, setShowIdentityNodes] = useState(false);
  const [taxonomyStack, setTaxonomyStack] = useState<{ key: string; label: string }[]>([]);
  const debouncedQuery = useDebouncedValue(query, 250);
  const hasQuery = debouncedQuery.trim().length > 0;

  const loader = useMemo(
    () => () =>
      loadSearchBundle(client, debouncedQuery).then((bundle) => ({
        ...bundle,
        results: bundle.results.filter((result) => sourceFilter === 'all' || result.subtitle?.toLowerCase().includes(sourceFilter)),
      })),
    [client, debouncedQuery, sourceFilter]
  );
  const { data, loading, error, refresh } = useAsyncResource(loader, [loader]);
  const recentLoader = useMemo(
    () => async () => {
      const [insights, transactions, digests] = await Promise.all([client.listInsights(3), client.listTransactions(4), client.listDigests(2)]);
      return { insights, transactions, digests };
    },
    [client]
  );
  const {
    data: recentData,
    loading: recentLoading,
    error: recentError,
    refresh: refreshRecent,
  } = useAsyncResource(recentLoader, [recentLoader]);
  const entityLoader = useMemo(() => () => client.listEntities(), [client]);
  const { data: entities, loading: entitiesLoading, error: entitiesError, refresh: refreshEntities } = useAsyncResource(entityLoader, [entityLoader]);
  const graphLoader = useMemo(() => () => client.getExploreGraph(80, {
    includeEventEvidence: showEvidenceNodes,
    includeIdentities: showIdentityNodes,
    projection: showEvidenceNodes || showIdentityNodes ? 'network' : 'taxonomy',
    root: showEvidenceNodes || showIdentityNodes ? undefined : taxonomyStack.at(-1)?.key,
    depth: showEvidenceNodes || showIdentityNodes ? 2 : 1,
  }), [client, showEvidenceNodes, showIdentityNodes, taxonomyStack]);
  const { data: graph, loading: graphLoading, error: graphError, refresh: refreshGraph } = useAsyncResource(graphLoader, [graphLoader]);

  const results = data?.results ?? [];
  const clusters = clusterSearchResults(results);
  const topMatch = results[0];
  const recentPrompts = useMemo(() => {
    const values = [
      'Spotify',
      'groceries',
      'last week',
      'receipts',
      ...(recentData?.insights.map((item) => item.title) ?? []),
      ...(recentData?.transactions.map((item) => item.displayMerchantLabel ?? item.merchantLabel) ?? []),
      ...(recentData?.digests.map((item) => item.title) ?? []),
    ];

    return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean))).slice(0, 6);
  }, [recentData]);
  const activeRefresh = hasQuery ? refresh : refreshRecent;
  const activeRefreshing = hasQuery ? loading : recentLoading;
  const nameSuggestions = useMemo(() => (entities ?? []).filter((entity) => query.trim().length > 0 && entity.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 5), [entities, query]);
  useEffect(() => {
    if (!focusedEntityId || graph?.nodes.some((node) => node.id === focusedEntityId)) return;
    let cancelled = false;
    void client.getEntityGraph(focusedEntityId, 2).then((neighborhood) => {
      if (cancelled) return;
      const nodes = [neighborhood.rootEntity, ...neighborhood.nodes].map((node) => ({ id: node.id, name: 'title' in node ? node.title : node.label, type: node.type, description: 'summary' in node ? node.summary : node.description ?? '', importanceScore: 'confidence' in node ? node.confidence ?? 1 : 1, communityId: focusedEntityId, hierarchyDepth: 'depth' in node ? Number(node.depth ?? 0) : 0 }));
      const relations = neighborhood.relations
        .filter((relation) => relation.sourceEntityId && relation.targetEntityId)
        .map((relation) => ({ id: relation.id, sourceEntityId: relation.sourceEntityId!, targetEntityId: relation.targetEntityId!, relationType: relation.relationType ?? 'related_to', label: relation.label, description: relation.description, confidence: 1, importanceScore: relation.importanceScore ?? 1 }));
      setExpandedGraph({ communities: [{ id: focusedEntityId, label: `${nodes[0]?.name ?? 'Selected'} network`, nodeCount: nodes.length, leaderEntityId: focusedEntityId }], nodes, relations, stats: { nodesCount: nodes.length, relationsCount: relations.length, truncated: false } });
    }).catch(() => setExpandedGraph(undefined));
    return () => { cancelled = true; };
  }, [client, focusedEntityId, graph?.nodes]);
  const displayGraph = useMemo<ExploreGraph | undefined>(() => {
    if (!graph) return undefined;
    if (expandedGraph && expandedGraph.nodes.some((node) => node.id === focusedEntityId)) {
      const nodes = [...graph.nodes, ...expandedGraph.nodes.filter((node) => !graph.nodes.some((existing) => existing.id === node.id))];
      const relations = [...graph.relations, ...expandedGraph.relations.filter((relation) => !graph.relations.some((existing) => existing.id === relation.id))];
      const communities = [...graph.communities, ...expandedGraph.communities.filter((community) => !graph.communities.some((existing) => existing.id === community.id))];
      return { communities, nodes, relations, stats: { nodesCount: nodes.length, relationsCount: relations.length, truncated: graph.stats.truncated } };
    }
    const selected = entities?.find((entity) => entity.id === focusedEntityId);
    if (!selected || graph.nodes.some((node) => node.id === selected.id)) return graph;
    return { ...graph, nodes: [...graph.nodes, { ...selected, description: '', importanceScore: 1, communityId: selected.id, hierarchyDepth: 0 }], stats: { ...graph.stats, nodesCount: graph.stats.nodesCount + 1 } };
  }, [entities, expandedGraph, focusedEntityId, graph]);

  return (
    <AppScreen refreshing={activeRefreshing} onRefresh={activeRefresh} contentStyle={{ paddingTop: theme.spacing.md }}>
      <TopBar
        title="Discover"
        subtitle="Explore your knowledge graph or search for a person, merchant, topic, or event."
        secondaryAction={<StatusBadge label={loading ? 'Searching' : hasQuery ? `${results.length} results` : `${entities?.length ?? 0} nodes`} />}
      />

      <CommandPanel>
        <SearchField
          label="Search your knowledge"
          value={query}
          onChangeText={setQuery}
          placeholder="Spotify, groceries, a contact, a topic..."
          accessibilityLabel="Search your knowledge graph"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {nameSuggestions.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{nameSuggestions.map((entity) => <FilterChip key={entity.id} label={entity.name} selected={entity.id === focusedEntityId} onPress={() => { setQuery(entity.name); setFocusedEntityId(entity.id); }} />)}</View> : null}
        {hasQuery ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {sourceFilters.map((item) => (
              <FilterChip key={item.value} label={item.label} selected={sourceFilter === item.value} onPress={() => setSourceFilter(item.value)} />
            ))}
          </ScrollView>
        ) : (
          <View style={{ gap: 8 }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Try a starting point or explore the graph below</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {recentPrompts.map((item) => (
                <FilterChip key={item} label={item} selected={false} onPress={() => setQuery(item)} />
              ))}
            </View>
          </View>
        )}
      </CommandPanel>

      {error ? <EmptyState title="Search unavailable" description={error} primaryActionLabel="Retry" onPrimaryAction={refresh} /> : null}

      {!hasQuery ? (
        <>
          <Section title="Knowledge graph" subtitle="Explore the connections behind your captured activity.">
            {entitiesError || graphError ? <EmptyState title="Knowledge graph unavailable" description={entitiesError ?? graphError ?? 'Could not load the graph.'} primaryActionLabel="Retry" onPrimaryAction={() => { void refreshEntities(); void refreshGraph(); }} /> : null}
            {(entitiesLoading && !entities) || (graphLoading && !graph) ? <LoadingSkeleton variant="card" count={2} /> : null}
            {displayGraph?.nodes.length ? (
              <Panel tone="accent" style={{ gap: theme.spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                  <Feather name="share-2" size={20} color={theme.colors.accentStrong} />
                  <View style={{ flex: 1 }}>
                    <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Interactive knowledge map</Text>
                    <Text numberOfLines={2} style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Start broad, then tap a node to reveal the relationships that matter.</Text>
                  </View>
                </View>
                <ToggleRow
                  title="Show people and services"
                  subtitle="Reveal merchants, apps, contacts, and accounts connected to the category map."
                  value={showIdentityNodes}
                  onValueChange={(value) => {
                    setShowIdentityNodes(value);
                    if (value) setShowEvidenceNodes(false);
                    setTaxonomyStack([]);
                    setFocusedEntityId(undefined);
                    setExpandedGraph(undefined);
                  }}
                />
                <ToggleRow
                  title="Show event evidence"
                  subtitle="Include the captured emails, notifications, and financial events behind this map."
                  value={showEvidenceNodes}
                  onValueChange={(value) => {
                    setShowEvidenceNodes(value);
                    if (value) setShowIdentityNodes(false);
                    setTaxonomyStack([]);
                    setFocusedEntityId(undefined);
                    setExpandedGraph(undefined);
                  }}
                />
                {!showEvidenceNodes && !showIdentityNodes && taxonomyStack.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <FilterChip label="All domains" selected={false} onPress={() => { setTaxonomyStack([]); setFocusedEntityId(undefined); }} />
                  {taxonomyStack.map((item, index) => <FilterChip key={item.key} label={item.label} selected={index === taxonomyStack.length - 1} onPress={() => { setTaxonomyStack((current) => current.slice(0, index + 1)); setFocusedEntityId(undefined); }} />)}
                </View> : null}
                <GraphExplorer graph={displayGraph} focusedEntityId={focusedEntityId} onFocus={(entity) => {
                  setFocusedEntityId(entity.id);
                  if (!showEvidenceNodes && !showIdentityNodes && entity.taxonomyKey && entity.hasMore) {
                    setTaxonomyStack((current) => current.some((item) => item.key === entity.taxonomyKey) ? current : [...current, { key: entity.taxonomyKey!, label: entity.name }]);
                  }
                }} onOpen={(entity) => entity.eventId ? router.push(`/event/${entity.eventId}`) : router.push(`/entity/${entity.id}`)} />
                <Button label="Refresh graph" onPress={() => { void refreshEntities(); void refreshGraph(); }} variant="secondary" />
              </Panel>
            ) : !entitiesLoading && !graphLoading && !entitiesError && !graphError ? <EmptyState title="Your graph is still growing" description="Capture notes, emails, or notifications to create people, merchants, topics, and their connections." /> : null}
          </Section>

          <Section title="Recent activity" subtitle="Pick up where you left off.">
            {recentError ? <EmptyState title="Recent activity unavailable" description={recentError} primaryActionLabel="Retry" onPrimaryAction={refreshRecent} /> : null}
            {recentLoading && !recentData ? <LoadingSkeleton variant="card" count={3} /> : null}
            {!recentLoading && recentData ? (
              <View style={{ gap: theme.spacing.md }}>
                {recentData.insights.slice(0, 2).map((insight: InsightSummary) => (
                  <InsightCard key={insight.id} insight={insight} onPress={() => router.push(`/insight/${insight.id}`)} />
                ))}
                {recentData.digests.slice(0, 1).map((digest: DigestSummary) => (
                  <DigestCard key={digest.id} digest={digest} onPress={() => router.push(`/digest/${digest.id}`)} />
                ))}
                {recentData.transactions.slice(0, 3).map((transaction: TransactionSummary) => (
                  <ListRow
                    key={transaction.id}
                    title={transaction.displayMerchantLabel ?? transaction.merchantLabel}
                    subtitle={transaction.kind === 'income' ? 'Income' : formatCategoryLabel(transaction.category)}
                    description={transaction.observedAt ? `Seen ${transaction.observedAt}` : 'Recent transaction'}
                    trailing={<StatusBadge label={transaction.amount} tone={transaction.kind === 'income' ? 'positive' : 'danger'} />}
                    onPress={() => router.push(`/transaction/${transaction.id}`)}
                  />
                ))}
              </View>
            ) : null}
          </Section>

          <Section title="How discovery works" subtitle="Everything you capture becomes searchable and connected.">
            <Panel tone="accent" style={{ gap: theme.spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                <Feather name="search" size={20} color={theme.colors.accentStrong} />
                <View style={{ flex: 1 }}>
                  <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Universal retrieval</Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                    Search finds relevant activity and graph nodes. Opening a node expands its bounded neighborhood with readable connection reasons.
                  </Text>
                </View>
              </View>
            </Panel>
          </Section>
        </>
      ) : null}

      {hasQuery ? (
        <>
          <Section title="Top match" subtitle={topMatch?.hint ?? topMatch?.description ?? 'Best available result for this query.'}>
            {loading ? <LoadingSkeleton variant="card" count={1} /> : null}
            {!loading && topMatch ? (
              <Panel tone="accent" style={{ gap: theme.spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing.md }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>{topMatch.title}</Text>
                    <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{topMatch.description}</Text>
                  </View>
                  <StatusBadge label={resultTypeLabel(topMatch.type)} />
                </View>
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
                  {topMatch.hint ?? `Matched ${topMatch.subtitle ?? topMatch.type} content.`}
                </Text>
                <Button label="Open result" onPress={() => router.push(topMatch.route as never)} variant="secondary" />
              </Panel>
            ) : null}
            {!loading && !error && !topMatch ? <EmptyState title="No matches" description="Try another phrase or clear the filter." /> : null}
          </Section>

          <Section title="Grouped results" subtitle="Skimmable result groups with direct actions." count={results.length}>
            {clusters.map((cluster) => (
              <Surface key={cluster.id} variant="subtle" style={{ gap: theme.spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{cluster.title}</Text>
                    <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{cluster.subtitle}</Text>
                  </View>
                  <StatusBadge label={`${cluster.count}`} tone={cluster.tone} />
                </View>
                {cluster.items.slice(0, 3).map((result) => (
                  <ListRow
                    key={result.id}
                    title={result.title}
                    subtitle={result.subtitle}
                    description={result.hint ?? result.description}
                    onPress={() => router.push(result.route as never)}
                  />
                ))}
              </Surface>
            ))}
          </Section>
        </>
      ) : null}
    </AppScreen>
  );
}

function resultTypeLabel(type: string) {
  switch (type) {
    case 'entity':
      return 'Item';
    case 'insight':
      return 'Insight';
    case 'transaction':
      return 'Transaction';
    case 'event':
      return 'Activity';
    default:
      return 'Connection';
  }
}
