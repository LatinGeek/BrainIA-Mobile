import { Feather } from '@expo/vector-icons';
import { Text, View, useWindowDimensions } from 'react-native';

import { GlassSurface } from '@/components/glass/GlassSurface';
import { GraphExplorer } from '@/components/knowledge/GraphExplorer';
import { useTheme } from '@/lib/app-state';
import { ExploreGraph, ExploreGraphNode, GraphRelation, EntityLink } from '@/lib/domain';
import { cleanDisplayText } from '@/lib/format';

export function Graph({
  mode = 'explore',
  graph,
  focusedEntityId,
  onFocus,
  onOpen,
  nodes = [],
  relations = [],
  title,
  subtitle,
}: {
  mode?: 'explore' | 'preview';
  graph?: ExploreGraph;
  focusedEntityId?: string;
  onFocus?: (entity: ExploreGraphNode) => void;
  onOpen?: (entity: ExploreGraphNode) => void;
  nodes?: EntityLink[];
  relations?: (GraphRelation | { id: string; label: string; description?: string })[];
  title?: string;
  subtitle?: string;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();

  if (mode === 'explore' && graph && onFocus && onOpen) {
    return <GraphExplorer graph={graph} focusedEntityId={focusedEntityId} onFocus={onFocus} onOpen={onOpen} />;
  }

  return (
    <GlassSurface level="thin" padding="md" contentStyle={{ gap: 10 }}>
      {title ? <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>{cleanDisplayText(title)}</Text> : null}
      {subtitle ? <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{cleanDisplayText(subtitle)}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
        {nodes.slice(0, Math.max(4, Math.min(6, Math.floor(width / 130)))).map((node) => (
          <View key={node.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 9, borderRadius: 10, backgroundColor: theme.glass.inner, borderWidth: 1, borderColor: theme.glass.divider }}>
            {node.canonical ? <Feather name="check-circle" size={11} color={theme.colors.accent} /> : <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: theme.colors.model }} />}
            <Text numberOfLines={1} style={[theme.typography.caption, { color: theme.colors.textSecondary, maxWidth: 150 }]}>{cleanDisplayText(node.label)}</Text>
          </View>
        ))}
      </View>
      {relations.slice(0, 3).map((relation) => (
        <View key={relation.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
          <Feather name="link-2" size={13} color={theme.colors.textMuted} />
          <Text numberOfLines={1} style={[theme.typography.caption, { color: theme.colors.textSecondary, flex: 1 }]}>{cleanDisplayText(relation.label)}</Text>
        </View>
      ))}
    </GlassSurface>
  );
}
