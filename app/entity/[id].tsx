import { useLocalSearchParams, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { ActionRow } from '@/components/forms';
import { EntityPill, EntitySummary, GraphPreview, GraphRelationRow } from '@/components/knowledge';
import { AppScreen, DetailBlock, SectionHeader, TopBar } from '@/components/layout';
import { BottomSheet, Button, Input, ListRow, StatusBadge } from '@/components/primitives';
import { EmptyState, LoadingSkeleton } from '@/components/states';
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
    <AppScreen refreshing={loading} onRefresh={refresh}>
      <TopBar showBack title={entity?.title ?? id} subtitle={entity?.type ? `Lo que Brain IA sabe sobre esta entidad de tipo ${entity.type}.` : 'Detalle del conocimiento'} />

      {error ? <EmptyState title="No se pudo cargar el elemento" description={error} primaryActionLabel="Reintentar" onPrimaryAction={refresh} /> : null}

      {loading && !entity ? (
        <LoadingSkeleton variant="detail" count={2} />
      ) : entity ? (
        <>
          <EntitySummary entity={entity} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <StatusBadge label={entity.canonical ? 'Preferred name' : 'Alternate name'} tone={entity.canonical ? 'positive' : 'neutral'} />
            <StatusBadge label={`${entity.aliases.length} names`} />
            <StatusBadge label={`${entity.relations.length} connections`} />
          </View>

          <SectionHeader title="Qué es" subtitle={entity.summary} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {entity.aliases.map((alias) => (
              <EntityPill key={alias} label={alias} type="alternate name" />
            ))}
          </View>

          <DetailBlock title="Nombres e identidad" subtitle="Agrega un nombre alternativo o vincula este nodo con la misma entidad real.">
            <Button label="Organizar este elemento" onPress={openOrganize} variant="secondary" />
          </DetailBlock>

          <DetailBlock title="Conexiones" subtitle="Personas, comercios, lugares, temas o actividad cercanos.">
            {graph?.nodes?.length || graph?.relations?.length ? (
              <GraphPreview nodes={graph?.nodes ?? []} relations={graph?.relations ?? []} />
            ) : (
              <EmptyState title="Todavía no hay conexiones" description="Aparecerán cuando más actividad haga referencia a este elemento." />
            )}
          </DetailBlock>

          <DetailBlock title="Origen" subtitle="Actividad que originó o respalda este elemento.">
            {originEvents.length ? originEvents.map((event) => (
              <ListRow
                key={event.id}
                title={event.title}
                subtitle={`${formatEventSource(event.source)} · ${event.receivedAt ? formatDate(event.receivedAt) : event.kind}`}
                description={event.body}
                trailing={<StatusBadge label="Abrir" />}
                onPress={() => router.push({ pathname: '/event/[id]', params: { id: event.id } })}
              />
            )) : <EmptyState title="Sin fuente capturada" description="Este elemento puede provenir de una decisión manual o su evento de origen ya no está disponible." />}
          </DetailBlock>

          <DetailBlock title="Detalles de conexión" subtitle="Por qué está relacionado este elemento.">
            {relationGroups.length ? relationGroups.map((relation) => <GraphRelationRow key={relation.key} label={relation.label} description={relation.description} direction={relation.direction} />) : null}
          </DetailBlock>

          <ActionRow primaryLabel="Abrir búsqueda" primaryOnPress={() => router.push('/search')} secondaryLabel="Actualizar" secondaryOnPress={refresh} />
        </>
      ) : null}

      <BottomSheet visible={organizeOpen} title="Organizar este elemento" onClose={() => setOrganizeOpen(false)}>
        <View style={{ gap: 12 }}>
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Alternate name</Text>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Use names people actually use for this person, place, project, merchant, topic, or account.</Text>
          <Input label="Nombre" value={alias} onChangeText={setAlias} placeholder="Agrega un nombre alternativo" />
          <Button label="Guardar nombre alternativo" onPress={saveAlias} disabled={!alias.trim() || saving} loading={saving} />

          <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary, marginTop: 8 }]}>Es el mismo elemento</Text>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Link duplicates so their knowledge and future activity stay together.</Text>
          <Input
            label="Buscar un elemento existente"
            value={equivalentQuery}
            onChangeText={(value) => {
              setEquivalentQuery(value);
              setEquivalentId(null);
            }}
            placeholder="Buscar por nombre"
          />
          {(equivalentMatches ?? []).filter((match) => match.id !== entity?.id).slice(0, 5).map((match) => (
            <ListRow key={match.id} title={match.name} subtitle={match.type} trailing={<StatusBadge label={equivalentId === match.id ? 'Seleccionado' : 'Usar'} tone={equivalentId === match.id ? 'positive' : 'neutral'} />} onPress={() => setEquivalentId(match.id)} />
          ))}
          <Button label="Unificar identidades" onPress={mergeEquivalent} disabled={!equivalentId || saving} loading={saving} />
          {message ? <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{message}</Text> : null}
        </View>
      </BottomSheet>
    </AppScreen>
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
