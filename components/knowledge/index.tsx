import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { DigestCard, DigestSummaryCard, InsightCard, InsightArticleCard } from '@/components/cards';
import { Button, ListRow, Panel, Surface } from '@/components/primitives';
import { useTheme } from '@/lib/app-state';
import { EntityDetail, EntityLink } from '@/lib/domain';
import { cleanDisplayText } from '@/lib/format';

export { DigestCard, DigestSummaryCard, InsightCard, InsightArticleCard };

export type DailyBriefItem = {
  id: string;
  title: string;
  summary?: string;
  onActionPress: () => void;
};

export function DailyBrief({ items }: { items: DailyBriefItem[] }) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md }}>
        <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>Daily brief</Text>
        <View style={{ borderRadius: theme.radius.pill, backgroundColor: theme.colors.accent, paddingHorizontal: 10, paddingVertical: 5 }}>
          <Text style={[theme.typography.caption, { color: theme.colors.onAccent }]}>Priority scan</Text>
        </View>
      </View>
      {items.slice(0, 4).map((item) => (
        <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={cleanDisplayText(item.title)} onPress={item.onActionPress}>
          <Panel tone="accent" style={{ gap: theme.spacing.sm, borderLeftWidth: 3, borderColor: theme.colors.accent }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary, flex: 1 }]}>{cleanDisplayText(item.title)}</Text>
              <Feather name="arrow-up-right" size={16} color={theme.colors.accentStrong} />
            </View>
            {item.summary ? <Text numberOfLines={3} style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{cleanDisplayText(item.summary)}</Text> : null}
          </Panel>
        </Pressable>
      ))}
    </View>
  );
}

export function EntityPill({ label, type, canonical, onPress }: { label: string; type?: string; canonical?: boolean; onPress?: () => void }) {
  const theme = useTheme();
  const pill = (
    <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, gap: 6, backgroundColor: canonical ? theme.colors.accentSoft : theme.colors.surfaceSubtle }}>
      <Text style={[theme.typography.caption, { color: canonical ? theme.colors.accentStrong : theme.colors.textSecondary }]}>{cleanDisplayText(label)}</Text>
      {type ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted, marginLeft: 8 }]}>{cleanDisplayText(type)}</Text> : null}
    </View>
  );

  if (!onPress) {
    return pill;
  }

  return (
    <Button label={label} onPress={onPress} variant="secondary" />
  );
}

export function EntitySummary({ entity, onPress }: { entity: EntityDetail; onPress?: () => void }) {
  return <ListRow title={entity.title} subtitle={entity.type} description={entity.summary} onPress={onPress} />;
}

export function GraphPreview({ nodes, relations }: { nodes: EntityLink[]; relations: { id: string; label: string }[] }) {
  const theme = useTheme();

  return (
    <Surface variant="subtle" style={{ gap: theme.spacing.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {nodes.slice(0, 6).map((node) => (
          <EntityPill key={node.id} label={node.label} type={node.type} canonical={node.canonical} />
        ))}
      </View>
      <View style={{ gap: theme.spacing.sm }}>
        {relations.slice(0, 3).map((relation) => (
          <ListRow key={relation.id} title={relation.label} subtitle="Connection" />
        ))}
      </View>
    </Surface>
  );
}

export function RelationPathRow({ label, description, direction }: { label: string; description: string; direction: 'incoming' | 'outgoing' | 'bidirectional' }) {
  return <ListRow title={label} subtitle={direction} description={description} />;
}

export const GraphRelationRow = RelationPathRow;

export function EventTimeline({ entity }: { entity: EntityDetail }) {
  return (
    <View style={{ gap: 12 }}>
      <ListRow title={entity.title} subtitle={entity.type} description={entity.summary} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {entity.aliases.map((alias) => (
          <EntityPill key={alias} label={alias} type="alternate name" />
        ))}
      </View>
      {entity.relatedEntities.map((node) => (
        <EntityPill key={node.id} label={node.label} type={node.type} canonical={node.canonical} />
      ))}
    </View>
  );
}
