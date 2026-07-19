import { Pressable, Text, View } from 'react-native';
import { useMemo } from 'react';

import GraphForceCanvas from './GraphForceCanvas';
import { ExploreGraph, ExploreGraphNode } from '@/lib/domain';
import { useTheme } from '@/lib/app-state';

export function GraphExplorer({ graph, focusedEntityId, onFocus, onOpen }: {
  graph: ExploreGraph;
  focusedEntityId?: string;
  onFocus: (entity: ExploreGraphNode) => void;
  onOpen: (entity: ExploreGraphNode) => void;
}) {
  const theme = useTheme();
  const focused = graph.nodes.find((node) => node.id === focusedEntityId);
  const focusedRelations = useMemo(
    () => graph.relations.filter((relation) => relation.sourceEntityId === focusedEntityId || relation.targetEntityId === focusedEntityId),
    [graph.relations, focusedEntityId],
  );
  const communityById = useMemo(() => new Map(graph.communities.map((community) => [community.id, community])), [graph.communities]);
  const rankedCommunities = useMemo(
    () => [...graph.communities].sort((left, right) => right.nodeCount - left.nodeCount).slice(0, 4),
    [graph.communities],
  );

  const focusById = async (id: string) => {
    const entity = graph.nodes.find((node) => node.id === id);
    if (entity) {
      onFocus(entity);
    }
  };

  const summary = focused
    ? `${communityById.get(focused.communityId)?.label ?? 'Connected group'} · ${focusedRelations.length} direct connection${focusedRelations.length === 1 ? '' : 's'}`
    : `${graph.stats.nodesCount} entities arranged into live connection clusters`;

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
        Zoom out to see the full map. Zoom in to reveal node names; select a node to reveal the names of its direct relations.
      </Text>

      <View style={{ height: 332, overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#090F1D' }}>
        <GraphForceCanvas
          nodes={graph.nodes}
          relations={graph.relations}
          communities={graph.communities}
          focusedEntityId={focusedEntityId}
          onFocus={focusById}
          dom={{ scrollEnabled: false, containerStyle: { height: 332, backgroundColor: '#090F1D' } }}
        />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>{rankedCommunities.map((community) => <Pressable key={community.id} accessibilityRole="button" onPress={() => { void focusById(community.leaderEntityId); }} style={{ paddingVertical: 5, paddingHorizontal: 8, borderRadius: 9, backgroundColor: theme.colors.surfaceSubtle, maxWidth: '100%' }}><Text numberOfLines={1} style={[theme.typography.caption, { color: theme.colors.textSecondary, maxWidth: 230 }]}>{community.label}</Text></Pressable>)}</View>

      {focused ? <Pressable onPress={() => onOpen(focused)} accessibilityRole="button" style={{ padding: theme.spacing.sm, borderRadius: 14, backgroundColor: theme.colors.surfaceSubtle, gap: 3 }}>
        <Text numberOfLines={2} style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{focused.name}</Text>
        <Text numberOfLines={2} style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{summary}</Text>
        {focused.description ? <Text numberOfLines={3} style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{focused.description}</Text> : null}
        <Text style={[theme.typography.caption, { color: theme.colors.accentStrong, marginTop: 4 }]}>Open entity details</Text>
      </Pressable> : <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Each colored island is a named community. Its center is the most connected entity in that cluster.</Text>}
    </View>
  );
}
