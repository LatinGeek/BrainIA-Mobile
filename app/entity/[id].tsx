import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Chip, Field, Tag } from '@/components/controls';
import { Graph } from '@/components/data/Graph';
import { IconTile, Row } from '@/components/data/Row';
import { StateView } from '@/components/data/StateView';
import { Timeline } from '@/components/data/Timeline';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { BottomSheet } from '@/components/layout/BottomSheet';
import { Screen, Section } from '@/components/layout/Screen';
import { useBrainIAClient, useTheme } from '@/lib/app-state';
import { loadEntityBundle } from '@/lib/api';
import { useAsyncResource } from '@/lib/hooks';
import { formatDate } from '@/lib/format';

export default function EntityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useBrainIAClient();
  const theme = useTheme();
  const loader = useMemo(() => () => loadEntityBundle(client, id), [client, id]);
  const { data, loading, error, refresh } = useAsyncResource(loader, [loader]);
  const eventsLoader = useMemo(() => () => client.listEvents(), [client]);
  const { data: events } = useAsyncResource(eventsLoader, [eventsLoader]);
  const [organizeOpen, setOrganizeOpen] = useState(false);
  const [alias, setAlias] = useState('');
  const [equivalentQuery, setEquivalentQuery] = useState('');
  const [equivalentId, setEquivalentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const entity = data?.entity;
  const graph = data?.graph;
  const relationGroups = useMemo(() => groupRelationsByType(graph?.relations ?? []), [graph?.relations]);
  const relatedEventIds = new Set<string>(entity?.relatedEvents ?? []);
  const originEvents = (events ?? []).filter((event) => relatedEventIds.has(event.id));
  const matchesLoader = useMemo(() => () => client.findEntityMatches(equivalentQuery), [client, equivalentQuery]);
  const { data: equivalentMatches } = useAsyncResource(matchesLoader, [matchesLoader]);

  function openOrganize() {
    setAlias('');
    setEquivalentQuery('');
    setEquivalentId(null);
    setMessage(null);
    setOrganizeOpen(true);
  }

  async function saveAlias() {
    if (!entity || !alias.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      await client.createEntityAlias({ entityId: entity.id, alias: alias.trim() });
      setAlias('');
      setMessage('Alternate name saved.');
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save this alternate name.');
    } finally {
      setSaving(false);
    }
  }

  async function mergeEquivalent() {
    if (!entity || !equivalentId) return;
    setSaving(true);
    setMessage(null);
    try {
      await client.mergeEntity({ aliasEntityId: entity.id, canonicalEntityId: equivalentId, reason: 'User confirmed these nodes represent the same thing.', confidence: 1 });
      setMessage('Nodes linked as the same thing.');
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not link these nodes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen title={entity?.title ?? id} overline={entity?.type ?? 'Knowledge'} subtitle={entity?.type ? `Lo que Brain IA sabe sobre esta entidad de tipo ${entity.type}.` : 'Detalle del conocimiento'} back refreshing={loading} onRefresh={refresh}>
      {error ? <StateView kind="error" title="No se pudo cargar el elemento" description={error} actionLabel="Reintentar" onAction={refresh} /> : null}
      {loading && !entity ? <StateView kind="loading" title="Loading" skeleton="detail" skeletonCount={2} /> : null}

      {entity ? (
        <>
          <GlassSurface level="strong" tone="accent" padding="lg" contentStyle={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconTile icon="share-2" size="lg" color={theme.colors.accent} tint={`${theme.colors.accent}1F`} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>{entity.title}</Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{entity.summary}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Tag label={entity.canonical ? 'Preferred name' : 'Alternate name'} tone={entity.canonical ? 'positive' : 'neutral'} />
              <Tag label={`${entity.aliases.length} names`} tone="neutral" />
              <Tag label={`${entity.relations.length} connections`} tone="info" />
            </View>
            <Button label="Organizar este elemento" variant="secondary" size="sm" onPress={openOrganize} icon={<Feather name="edit-2" size={13} color={theme.colors.textPrimary} />} />
          </GlassSurface>

          <Section title="Aliases" subtitle="Names people actually use for this item.">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {entity.aliases.map((value) => <Chip key={value} label={value} static canonical={value === entity.title} alias={value !== entity.title} />)}
            </View>
          </Section>

          <Section title="Connections" subtitle="People, merchants, places, topics or nearby activity.">
            {graph?.nodes?.length || graph?.relations?.length ? (
              <Graph mode="preview" nodes={entity.relatedEntities} relations={graph?.relations ?? []} />
            ) : <StateView title="Todavía no hay conexiones" description="Aparecerán cuando más actividad haga referencia a este elemento." />}
          </Section>

          <Section title="Evidence" subtitle="Activity that created or supports this item.">
            {originEvents.length ? (
              <Timeline items={originEvents.map((event) => ({
                id: event.id,
                icon: event.kind === 'email' ? 'mail' : event.kind === 'notification' ? 'bell' : 'inbox',
                title: event.title,
                subtitle: formatEventSource(event.source),
                time: event.receivedAt ? formatDate(event.receivedAt) : event.kind,
                reason: event.body,
                onPress: () => router.push({ pathname: '/event/[id]', params: { id: event.id } }),
              }))} />
            ) : <StateView title="Sin fuente capturada" description="Este elemento puede provenir de una decisión manual o su evento de origen ya no está disponible." />}
          </Section>

          <Section title="Why it is connected" subtitle="The evidence behind each relation.">
            {relationGroups.length ? relationGroups.map((relation) => (
              <Row key={relation.key} title={relation.label} subtitle={relation.direction} description={relation.description} leading={<IconTile icon="link-2" />} accessory="none" />
            )) : null}
          </Section>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Button label="Abrir búsqueda" variant="secondary" onPress={() => router.push('/search')} /></View>
            <View style={{ flex: 1 }}><Button label="Actualizar" variant="ghost" onPress={refresh} /></View>
          </View>
        </>
      ) : null}

      <BottomSheet visible={organizeOpen} title="Organizar este elemento" onClose={() => setOrganizeOpen(false)}>
        <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Alternate name</Text>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Use names people actually use for this person, place, project, merchant, topic, or account.</Text>
        <Field label="Nombre" value={alias} onChangeText={setAlias} placeholder="Agrega un nombre alternativo" />
        <Button label="Guardar nombre alternativo" onPress={saveAlias} disabled={!alias.trim() || saving} loading={saving} />
        <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary, marginTop: 8 }]}>Es el mismo elemento</Text>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Link duplicates so their knowledge and future activity stay together.</Text>
        <Field label="Buscar un elemento existente" value={equivalentQuery} onChangeText={(value) => { setEquivalentQuery(value); setEquivalentId(null); }} placeholder="Buscar por nombre" />
        {(equivalentMatches ?? []).filter((match) => match.id !== entity?.id).slice(0, 5).map((match) => (
          <Row key={match.id} title={match.name} subtitle={match.type} trailing={<Tag label={equivalentId === match.id ? 'Selected' : 'Use'} tone={equivalentId === match.id ? 'positive' : 'neutral'} />} onPress={() => setEquivalentId(match.id)} />
        ))}
        <Button label="Unificar identidades" onPress={mergeEquivalent} disabled={!equivalentId || saving} loading={saving} />
        {message ? <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{message}</Text> : null}
      </BottomSheet>
    </Screen>
  );
}

function formatEventSource(source: string) {
  const labels: Record<string, string> = { 'make.gmail': 'Gmail via Make', 'make.outlook': 'Outlook via Make' };
  return labels[source.toLowerCase()] ?? source.replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function groupRelationsByType(relations: import('@/lib/domain').GraphRelation[]) {
  const groups = new Map<string, { key: string; label: string; description: string; direction: import('@/lib/domain').GraphRelation['direction']; count: number }>();
  for (const relation of relations) {
    const key = relation.relationType?.trim().toLowerCase() || relation.label.trim().toLowerCase();
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    groups.set(key, { key, label: relation.label, description: relation.description, direction: relation.direction, count: 1 });
  }
  return [...groups.values()].map((group) => ({
    ...group,
    label: group.count === 1 ? group.label : `${group.label} · ${group.count} connections`,
    description: group.count === 1 ? group.description : `Standard relation type represented by ${group.count} graph connections.`,
  }));
}
