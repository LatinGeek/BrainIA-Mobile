import { Pressable, Text, View } from 'react-native';
import { useMemo } from 'react';

import GraphForceCanvas from './GraphForceCanvas';
import { ExploreGraph, ExploreGraphNode } from '@/lib/domain';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { useTheme } from '@/lib/app-state';
import { translateKnownLabel } from '@/lib/format';

export function GraphExplorer({ graph, focusedEntityId, onFocus, onOpen }: {
  graph: ExploreGraph;
  focusedEntityId?: string;
  onFocus: (entity: ExploreGraphNode) => void;
  onOpen: (entity: ExploreGraphNode) => void;
}) {
  const theme = useTheme();
  const visualGraph = useMemo(() => {
    const evidenceTypes = new Set(['activity_instance', 'financial_event', 'email_message']);
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    const parentByEvidence = new Map<string, string>();
    graph.relations.forEach((relation) => {
      if ((relation.relationType === 'part_of' || relation.relationType === 'belongs_to_domain') && evidenceTypes.has(nodeById.get(relation.sourceEntityId)?.type ?? '')) {
        parentByEvidence.set(relation.sourceEntityId, relation.targetEntityId);
      }
    });
    const grouped = new Map<string, string[]>();
    parentByEvidence.forEach((parentId, evidenceId) => grouped.set(parentId, [...(grouped.get(parentId) ?? []), evidenceId]));
    const groupedEvidence = new Set([...grouped.values()].flat());
    const aggregateNodes = [...grouped.entries()].map(([parentId, evidenceIds]) => {
      const parent = nodeById.get(parentId);
      if (!parent) return null;
      const kinds = [...new Set(evidenceIds.map((id) => nodeById.get(id)?.type).filter(Boolean))];
      const label = evidenceIds.length === 1 ? '1 captured event' : `${evidenceIds.length} captured events`;
      return {
        id: `evidence:${parentId}`,
        name: label,
        type: 'evidence_group',
        description: `${label} grouped beneath ${parent.name}. Open that meaning to inspect the individual source records.`,
        importanceScore: evidenceIds.length,
        communityId: parent.communityId,
        hierarchyDepth: parent.hierarchyDepth + 1,
        eventId: undefined,
        kinds,
      };
    }).filter(Boolean) as ExploreGraphNode[];
    const aggregateRelations = [...grouped.entries()].map(([parentId, evidenceIds]) => ({
      id: `evidence-relation:${parentId}`,
      sourceEntityId: `evidence:${parentId}`,
      targetEntityId: parentId,
      relationType: 'part_of',
      label: evidenceIds.length === 1 ? 'captured evidence' : `${evidenceIds.length} captured events`,
      description: 'Captured source records grouped beneath their shared meaning.',
      confidence: 1,
      importanceScore: evidenceIds.length,
    }));
    const nodes = [...graph.nodes.filter((node) => !groupedEvidence.has(node.id)), ...aggregateNodes];
    const communities = graph.communities.map((community) => ({ ...community, nodeCount: nodes.filter((node) => node.communityId === community.id).length }));
    return { ...graph, nodes, relations: [...graph.relations.filter((relation) => !groupedEvidence.has(relation.sourceEntityId) && !groupedEvidence.has(relation.targetEntityId)), ...aggregateRelations], communities };
  }, [graph]);
  const focused = visualGraph.nodes.find((node) => node.id === focusedEntityId);
  const focusedRelations = useMemo(
    () => visualGraph.relations.filter((relation) => relation.sourceEntityId === focusedEntityId || relation.targetEntityId === focusedEntityId),
    [visualGraph.relations, focusedEntityId],
  );
  const communityById = useMemo(() => new Map(visualGraph.communities.map((community) => [community.id, community])), [visualGraph.communities]);
  const rankedCommunities = useMemo(
    () => [...visualGraph.communities].sort((left, right) => right.nodeCount - left.nodeCount).slice(0, 4),
    [visualGraph.communities],
  );

  const focusById = async (id: string) => {
    const entity = visualGraph.nodes.find((node) => node.id === id);
    if (entity) {
      if (entity.id.startsWith('evidence:')) {
        const parent = graph.nodes.find((node) => node.id === entity.id.slice('evidence:'.length));
        if (parent) onFocus(parent);
        return;
      }
      onFocus(entity);
    }
  };

  const summary = focused
    ? focused.nodeKind === 'category'
      ? `${focused.breadcrumb?.join(' › ') ?? communityById.get(focused.communityId)?.label ?? 'Categoría'} · ${focused.evidenceCount ?? 0} captured event${focused.evidenceCount === 1 ? '' : 's'}`
      : `${communityById.get(focused.communityId)?.label ?? 'Connected group'} · ${focusedRelations.length} direct connection${focusedRelations.length === 1 ? '' : 's'}`
    : visualGraph.nodes.every((node) => node.nodeKind === 'category')
      ? `${visualGraph.stats.nodesCount} categories · tap a category to descend one level`
      : `${visualGraph.stats.nodesCount} entities arranged into live connection clusters`;

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
        {visualGraph.nodes.every((node) => node.nodeKind === 'category')
          ? 'Empieza por un área de tu vida y toca una categoría para ver el siguiente nivel. Los totales incluyen toda la actividad de cada rama.'
          : 'Zoom out to see the full map. Repeated events are grouped beneath one meaning; open a concept to inspect its individual evidence.'}
      </Text>

      {/* The map handles its own drag gestures, so two transparent strips over its edges hand a swipe to the page. */}
      <View style={{ height: 332, overflow: 'hidden', borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.glass.divider, backgroundColor: theme.ambient.base }}>
        <GraphForceCanvas
          nodes={visualGraph.nodes}
          relations={visualGraph.relations}
          communities={visualGraph.communities}
          focusedEntityId={focusedEntityId}
          onFocus={focusById}
          dom={{ scrollEnabled: false, containerStyle: { height: 332, backgroundColor: theme.ambient.base } }}
          background={theme.ambient.base}
        />
        <View pointerEvents="auto" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 22 }} />
        <View pointerEvents="auto" style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 22 }} />
      </View>
      <Text style={[theme.typography.caption, { color: theme.colors.textMuted, textAlign: 'center' }]}>Arrastra dentro del mapa para moverlo. Desliza por los bordes para seguir bajando.</Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>{rankedCommunities.map((community) => <Pressable key={community.id} accessibilityRole="button" onPress={() => { void focusById(community.leaderEntityId); }} style={{ paddingVertical: 5, paddingHorizontal: 8, borderRadius: 9, backgroundColor: theme.glass.inner, borderWidth: 1, borderColor: theme.glass.divider, maxWidth: '100%' }}><Text numberOfLines={1} style={[theme.typography.caption, { color: theme.colors.textSecondary, maxWidth: 230 }]}>{translateKnownLabel(community.label)}</Text></Pressable>)}</View>

      {focused ? <Pressable onPress={() => onOpen(focused)} accessibilityRole="button">
        <GlassSurface level="thin" padding="sm" radius="md" contentStyle={{ gap: 3 }}>
        <Text numberOfLines={2} style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{focused.name}</Text>
        <Text numberOfLines={2} style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{summary}</Text>
        {focused.description ? <Text numberOfLines={3} style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{focused.description}</Text> : null}
        <Text style={[theme.typography.caption, { color: theme.colors.accentStrong, marginTop: 4 }]}>{focused.nodeKind === 'category' && focused.hasMore ? 'Toca el nodo para explorar esta categoría' : 'Abrir detalles de la entidad'}</Text>
        </GlassSurface>
      </Pressable> : <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Cada isla de color es una comunidad con nombre. Su centro es la entidad más conectada de ese grupo.</Text>}
    </View>
  );
}
