import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Button, Chip, ChipGroup, Field, Tag } from '@/components/controls';
import { IconTile, Row, TransactionRow } from '@/components/data/Row';
import { Graph } from '@/components/data/Graph';
import { SignalCard } from '@/components/data/SignalCard';
import { StateView } from '@/components/data/StateView';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { Screen, Section } from '@/components/layout/Screen';
import { useBrainIAClient, useTheme } from '@/lib/app-state';
import { loadSearchBundle } from '@/lib/api';
import { DigestSummary, ExploreGraph, InsightSummary, TransactionSummary } from '@/lib/domain';
import { useAsyncResource, useDebouncedValue } from '@/lib/hooks';
import { clusterSearchResults } from '@/lib/grouping';
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
    () => () => loadSearchBundle(client, debouncedQuery).then((bundle) => ({
      ...bundle,
      results: bundle.results.filter((result) => sourceFilter === 'all' || result.subtitle?.toLowerCase().includes(sourceFilter)),
    })),
    [client, debouncedQuery, sourceFilter],
  );
  const { data, loading, error, refresh } = useAsyncResource(loader, [loader]);
  const recentLoader = useMemo(
    () => async () => {
      const [insights, transactions, digests] = await Promise.all([client.listInsights(3), client.listTransactions(4), client.listDigests(2)]);
      return { insights, transactions, digests };
    },
    [client],
  );
  const { data: recentData, loading: recentLoading, error: recentError, refresh: refreshRecent } = useAsyncResource(recentLoader, [recentLoader]);
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
      'compras',
      'la semana pasada',
      'recibos',
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
      setExpandedGraph({ communities: [{ id: focusedEntityId, label: `Red de ${nodes[0]?.name ?? 'la selección'}`, nodeCount: nodes.length, leaderEntityId: focusedEntityId }], nodes, relations, stats: { nodesCount: nodes.length, relationsCount: relations.length, truncated: false } });
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
    <Screen
      title="Descubrir"
      overline={`${displayGraph?.stats.nodesCount ?? entities?.length ?? 0} nodos`}
      subtitle="Explora conexiones o busca una persona, comercio, tema o actividad."
      refreshing={activeRefreshing}
      onRefresh={activeRefresh}
      actions={<Tag label={loading ? 'Buscando' : hasQuery ? `${results.length} resultados` : 'Mapa en vivo'} tone={loading ? 'warning' : 'neutral'} live={!loading} />}
    >
      <View style={{ gap: 10 }}>
        <Field
          variant="search"
          value={query}
          onChangeText={setQuery}
          placeholder="Spotify, compras, un contacto, un tema…"
          accessibilityLabel="Busca en tu mapa de conocimiento"
          leading={<Feather name="search" size={16} color={theme.colors.textMuted} />}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {nameSuggestions.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {nameSuggestions.map((entity) => <Chip key={entity.id} label={entity.name} selected={entity.id === focusedEntityId} onPress={() => { setQuery(entity.name); setFocusedEntityId(entity.id); }} />)}
          </ScrollView>
        ) : null}
        {hasQuery ? (
          <ChipGroup items={sourceFilters} selected={sourceFilter} onChange={(value) => setSourceFilter(value as typeof sourceFilter)} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {recentPrompts.map((item) => <Chip key={item} label={item} onPress={() => setQuery(item)} />)}
          </ScrollView>
        )}
      </View>

      {error ? <StateView kind="error" title="Búsqueda no disponible" description={error} actionLabel="Reintentar" onAction={refresh} /> : null}

      {!hasQuery ? (
        <>
          <GlassSurface level="thin" padding="none">
            <Row title="Conocimiento" subtitle="Pregunta, descubre y conserva lo que importa" leading={<IconTile icon="zap" />} onPress={() => router.push('/intelligence')} />
          </GlassSurface>
          <Section title="Tus conexiones" subtitle="Cómo se relacionan tus actividades, comercios y personas.">
            {entitiesError || graphError ? <StateView kind="error" title="Mapa no disponible" description={entitiesError ?? graphError ?? 'No se pudo cargar el mapa.'} actionLabel="Reintentar" onAction={() => { void refreshEntities(); void refreshGraph(); }} /> : null}
            {(entitiesLoading && !entities) || (graphLoading && !graph) ? <StateView kind="loading" title="Cargando" skeleton="chart" skeletonCount={2} /> : null}
            {displayGraph?.nodes.length ? (
              <GlassSurface level="regular" tone="accent" padding="md" contentStyle={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Mapa interactivo</Text>
                    <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Toca un nodo para enfocarlo; abre el elemento para ver todo lo que BrainIA sabe de él.</Text>
                  </View>
                  <Tag label={`${displayGraph.stats.nodesCount} nodos`} tone="info" />
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <Chip label="Personas y servicios" selected={showIdentityNodes} onPress={() => { setShowIdentityNodes((value) => !value); if (!showIdentityNodes) setShowEvidenceNodes(false); setTaxonomyStack([]); setFocusedEntityId(undefined); setExpandedGraph(undefined); }} />
                  <Chip label="Evidencia" selected={showEvidenceNodes} onPress={() => { setShowEvidenceNodes((value) => !value); if (!showEvidenceNodes) setShowIdentityNodes(false); setTaxonomyStack([]); setFocusedEntityId(undefined); setExpandedGraph(undefined); }} />
                </View>
                {!showEvidenceNodes && !showIdentityNodes && taxonomyStack.length ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <Chip label="Todas las áreas" onPress={() => { setTaxonomyStack([]); setFocusedEntityId(undefined); }} />
                    {taxonomyStack.map((item, index) => <Chip key={item.key} label={item.label} selected={index === taxonomyStack.length - 1} onPress={() => { setTaxonomyStack((current) => current.slice(0, index + 1)); setFocusedEntityId(undefined); }} />)}
                  </View>
                ) : null}
                <Graph
                  mode="explore"
                  graph={displayGraph}
                  focusedEntityId={focusedEntityId}
                  onFocus={(entity) => {
                    setFocusedEntityId(entity.id);
                    if (!showEvidenceNodes && !showIdentityNodes && entity.taxonomyKey && entity.hasMore) {
                      setTaxonomyStack((current) => current.some((item) => item.key === entity.taxonomyKey) ? current : [...current, { key: entity.taxonomyKey!, label: entity.name }]);
                    }
                  }}
                  onOpen={(entity) => entity.eventId ? router.push(`/event/${entity.eventId}`) : router.push(`/entity/${entity.id}`)}
                />
                <Button label="Actualizar mapa" variant="secondary" size="sm" onPress={() => { void refreshEntities(); void refreshGraph(); }} />
              </GlassSurface>
            ) : !entitiesLoading && !graphLoading && !entitiesError && !graphError ? (
              <StateView title="Tu conocimiento está creciendo" description="Captura notas, correos o notificaciones para crear personas, comercios, temas y conexiones." actionLabel="Capturar" onAction={() => router.push('/capture')} />
            ) : null}
          </Section>

          <Section title="Actividad reciente" subtitle="Retoma donde lo dejaste.">
            {recentError ? <StateView kind="error" title="Actividad reciente no disponible" description={recentError} actionLabel="Reintentar" onAction={refreshRecent} /> : null}
            {recentLoading && !recentData ? <StateView kind="loading" title="Cargando" skeleton="card" skeletonCount={3} /> : null}
            {!recentLoading && recentData ? (
              <View style={{ gap: 10 }}>
                {recentData.insights.slice(0, 2).map((insight: InsightSummary) => (
                  <SignalCard key={insight.id} variant="brief" origin="model" title={insight.title} summary={insight.summary} confidence={insight.confidence} onPress={() => router.push(`/insight/${insight.id}`)} />
                ))}
                {recentData.digests.slice(0, 1).map((digest: DigestSummary) => (
                  <SignalCard key={digest.id} variant="brief" origin="model" meta={digest.windowLabel} title={digest.title} summary={digest.summary} onPress={() => router.push(`/digest/${digest.id}`)} />
                ))}
                {recentData.transactions.slice(0, 3).map((transaction: TransactionSummary) => (
                  <TransactionRow key={transaction.id} transaction={transaction} onPress={() => router.push(`/transaction/${transaction.id}`)} />
                ))}
              </View>
            ) : null}
          </Section>
        </>
      ) : null}

      {hasQuery ? (
        <>
          <Section title="Mejor coincidencia" subtitle={topMatch?.hint ?? topMatch?.description ?? 'Mejor resultado para esta búsqueda.'}>
            {loading ? <StateView kind="loading" title="Cargando" skeleton="card" skeletonCount={1} /> : null}
            {!loading && topMatch ? (
              <GlassSurface level="regular" tone="accent" padding="lg" contentStyle={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>{topMatch.title}</Text>
                    <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{topMatch.description}</Text>
                  </View>
                  <Tag label={resultTypeLabel(topMatch.type)} tone="info" />
                </View>
                <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{topMatch.hint ?? `Coincide con contenido de tipo ${topMatch.subtitle ?? topMatch.type}.`}</Text>
                <Button label="Abrir resultado" variant="secondary" onPress={() => { recordInteraction('explore', 'search', 'success'); router.push(topMatch.route as never); }} />
              </GlassSurface>
            ) : null}
            {!loading && !error && !topMatch ? <StateView title="Sin coincidencias" description="Prueba otra frase o quita el filtro." /> : null}
          </Section>

          <Section title="Resultados agrupados" subtitle="Grupos fáciles de revisar con acciones directas." count={results.length}>
            {clusters.map((cluster) => (
              <GlassSurface key={cluster.id} level="thin" padding="md" contentStyle={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{cluster.title}</Text>
                    <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{cluster.subtitle}</Text>
                  </View>
                  <Tag label={`${cluster.count}`} tone={String(cluster.tone) === 'positive' ? 'positive' : String(cluster.tone) === 'warning' ? 'warning' : String(cluster.tone) === 'danger' ? 'danger' : 'neutral'} />
                </View>
                {cluster.items.slice(0, 3).map((result) => (
                  <Row key={result.id} title={result.title} subtitle={result.subtitle} description={result.hint ?? result.description} leading={<IconTile icon="link-2" />} onPress={() => router.push(result.route as never)} />
                ))}
              </GlassSurface>
            ))}
          </Section>
        </>
      ) : null}
    </Screen>
  );
}

function resultTypeLabel(type: string) {
  switch (type) {
    case 'entity': return 'Elemento';
    case 'insight': return 'Hallazgo';
    case 'transaction': return 'Movimiento';
    case 'event': return 'Actividad';
    default: return 'Conexión';
  }
}
