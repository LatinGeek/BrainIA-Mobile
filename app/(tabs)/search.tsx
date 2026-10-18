import { Feather } from '@expo/vector-icons';
import { IntelligenceOverview } from '@/components/intelligence';
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
import { recordInteraction } from '@/lib/interaction-telemetry';

const sourceFilters = [
  { value: 'all', label: 'Todo' },
  { value: 'wallet', label: 'Dinero' },
  { value: 'email', label: 'Email' },
  { value: 'mobile', label: 'Notas' },
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
      <IntelligenceOverview/>
      <TopBar
        title="Descubrir"
        subtitle="Explora conexiones o busca una persona, comercio, tema o actividad."
        secondaryAction={<StatusBadge label={loading ? 'Buscando' : hasQuery ? `${results.length} resultados` : `${entities?.length ?? 0} nodos`} />}
      />

      <CommandPanel>
        <SearchField
          label="Busca en tu conocimiento"
          value={query}
          onChangeText={setQuery}
          placeholder="Spotify, compras, un contacto, un tema…"
          accessibilityLabel="Busca en tu mapa de conocimiento"
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
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Prueba un punto de partida o explora el mapa inferior</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {recentPrompts.map((item) => (
                <FilterChip key={item} label={item} selected={false} onPress={() => setQuery(item)} />
              ))}
            </View>
          </View>
        )}
      </CommandPanel>

      {error ? <EmptyState title="Búsqueda no disponible" description={error} primaryActionLabel="Reintentar" onPrimaryAction={refresh} /> : null}

      {!hasQuery ? (
        <>
          <Section title="Mapa de conocimiento" subtitle="Explora las conexiones entre tus actividades.">
            {entitiesError || graphError ? <EmptyState title="Mapa no disponible" description={entitiesError ?? graphError ?? 'No se pudo cargar el mapa.'} primaryActionLabel="Reintentar" onPrimaryAction={() => { void refreshEntities(); void refreshGraph(); }} /> : null}
            {(entitiesLoading && !entities) || (graphLoading && !graph) ? <LoadingSkeleton variant="card" count={2} /> : null}
            {displayGraph?.nodes.length ? (
              <Panel tone="accent" style={{ gap: theme.spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                  <Feather name="share-2" size={20} color={theme.colors.accentStrong} />
                  <View style={{ flex: 1 }}>
                    <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Mapa de conocimiento interactivo</Text>
                    <Text numberOfLines={2} style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Start broad, then tap a node to reveal the relationships that matter.</Text>
                  </View>
                </View>
                <ToggleRow
                  title="Mostrar personas y servicios"
                  subtitle="Muestra comercios, aplicaciones, contactos y cuentas conectados con el mapa de categorías."
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
                  title="Mostrar evidencia"
                  subtitle="Incluye los correos, notificaciones y eventos financieros capturados que sostienen este mapa."
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
                <Button label="Actualizar mapa" onPress={() => { void refreshEntities(); void refreshGraph(); }} variant="secondary" />
              </Panel>
            ) : !entitiesLoading && !graphLoading && !entitiesError && !graphError ? <EmptyState title="Tu conocimiento está creciendo" description="Captura notas, correos o notificaciones para crear personas, comercios, temas y conexiones." /> : null}
          </Section>

          <Section title="Actividad reciente" subtitle="Retoma donde lo dejaste.">
            {recentError ? <EmptyState title="Actividad reciente no disponible" description={recentError} primaryActionLabel="Reintentar" onPrimaryAction={refreshRecent} /> : null}
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
                    subtitle={transaction.kind === 'income' ? 'Ingresos' : formatCategoryLabel(transaction.category)}
                    description={transaction.observedAt ? `Seen ${transaction.observedAt}` : 'Recent transaction'}
                    trailing={<StatusBadge label={transaction.amount} tone={transaction.kind === 'income' ? 'positive' : 'danger'} />}
                    onPress={() => router.push(`/transaction/${transaction.id}`)}
                  />
                ))}
              </View>
            ) : null}
          </Section>

          <Section title="Cómo funciona la exploración" subtitle="Todo lo que capturas se puede buscar y conectar.">
            <Panel tone="accent" style={{ gap: theme.spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                <Feather name="search" size={20} color={theme.colors.accentStrong} />
                <View style={{ flex: 1 }}>
                  <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Búsqueda unificada</Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                    La búsqueda encuentra actividad relevante y nodos de conocimiento. Al abrir un nodo verás sus conexiones cercanas y el motivo de cada relación.
                  </Text>
                </View>
              </View>
            </Panel>
          </Section>
        </>
      ) : null}

      {hasQuery ? (
        <>
          <Section title="Mejor coincidencia" subtitle={topMatch?.hint ?? topMatch?.description ?? 'Mejor resultado disponible para esta consulta.'}>
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
                <Button label="Abrir resultado" onPress={() => { recordInteraction('explore', 'search', 'success'); router.push(topMatch.route as never); }} variant="secondary" />
              </Panel>
            ) : null}
            {!loading && !error && !topMatch ? <EmptyState title="Sin coincidencias" description="Prueba otra frase o quita el filtro." /> : null}
          </Section>

          <Section title="Resultados agrupados" subtitle="Grupos fáciles de revisar con acciones directas." count={results.length}>
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
      return 'Perspectiva';
    case 'transaction':
      return 'Transaction';
    case 'event':
      return 'Activity';
    default:
      return 'Conexión';
  }
}
