import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Chip, Field, Tag } from '@/components/controls';
import { Graph } from '@/components/data/Graph';
import { IconTile, Row } from '@/components/data/Row';
import { StateView } from '@/components/data/StateView';
import { Timeline } from '@/components/data/Timeline';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { BottomSheet } from '@/components/layout/BottomSheet';
import { useToast } from '@/components/layout/Toast';
import { Screen, Section } from '@/components/layout/Screen';
import { useBrainIAClient, useTheme } from '@/lib/app-state';
import { loadEntityBundle } from '@/lib/api';
import { useAsyncResource } from '@/lib/hooks';
import { cleanDisplayText, formatDate } from '@/lib/format';

export default function EntityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useBrainIAClient();
  const theme = useTheme();
  const toast = useToast();
  const loader = useMemo(() => () => loadEntityBundle(client, id), [client, id]);
  const { data, loading, error, refresh } = useAsyncResource(loader, [loader]);
  const eventsLoader = useMemo(() => () => client.listEvents(), [client]);
  const { data: events, loading: eventsLoading, error: eventsError, refresh: refreshEvents } = useAsyncResource(eventsLoader, [eventsLoader]);
  const [organizeOpen, setOrganizeOpen] = useState(false);
  const [alias, setAlias] = useState('');
  const [equivalentQuery, setEquivalentQuery] = useState('');
  const [equivalentId, setEquivalentId] = useState<string | null>(null);
  const [saving, setSaving] = useState<'alias' | 'merge' | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const entity = data?.entity;
  const graph = data?.graph;
  const relationGroups = useMemo(() => groupRelationsByType(graph?.relations ?? []), [graph?.relations]);
  const relatedEventIds = new Set<string>(entity?.relatedEvents ?? []);
  const originEvents = (events ?? []).filter((event) => relatedEventIds.has(event.id));
  const matchesLoader = useMemo(() => async () => {
    const query = equivalentQuery.trim();
    return { query, matches: organizeOpen && query.length >= 2 ? await client.findEntityMatches(query) : [] };
  }, [client, equivalentQuery, organizeOpen]);
  const { data: matchResult, loading: matchesLoading, error: matchesError } = useAsyncResource(matchesLoader, [matchesLoader]);

  const equivalentMatches = matchResult?.query === equivalentQuery.trim() ? matchResult.matches.filter((match) => match.id !== entity?.id).slice(0, 5) : [];
  const selectedMatch = equivalentMatches.find((match) => match.id === equivalentId);

  function openOrganize() {
    setAlias('');
    setEquivalentQuery('');
    setEquivalentId(null);
    setMessage(null);
    setConfirming(false);
    setOrganizeOpen(true);
  }

  async function saveAlias() {
    if (!entity || !alias.trim() || saving) return;
    setSaving('alias');
    setMessage(null);
    try {
      await client.createEntityAlias({ entityId: entity.id, alias: alias.trim() });
      setAlias('');
      setOrganizeOpen(false);
      toast.show('Nombre alternativo guardado.', { tone: 'positive' });
      await refresh();
    } catch {
      setMessage('No se pudo guardar el nombre. Intenta de nuevo.');
    } finally {
      setSaving(null);
    }
  }

  async function mergeEquivalent() {
    if (!entity || !selectedMatch || saving) return;
    if (!confirming) { setConfirming(true); return; }
    setSaving('merge');
    setMessage(null);
    try {
      await client.mergeEntity({ aliasEntityId: entity.id, canonicalEntityId: selectedMatch.id, reason: 'El usuario confirmó que ambos elementos representan lo mismo.', confidence: 1 });
      setOrganizeOpen(false);
      toast.show('Elementos unificados.', { tone: 'positive' });
      await refresh();
    } catch {
      setMessage('No se pudieron unificar. Intenta de nuevo.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <Screen title={entity?.title ?? 'Elemento'} overline={entity ? entityTypeLabel(entity.type) : 'Conocimiento'} subtitle={entity ? `Lo que Brain IA sabe sobre este elemento (${entityTypeLabel(entity.type).toLowerCase()}).` : 'Detalle del conocimiento'} back refreshing={loading && Boolean(entity)} onRefresh={refresh}>
      {error ? <StateView kind="error" title="No se pudo cargar el elemento" description={friendlyError(error)} actionLabel="Reintentar" onAction={refresh} /> : null}
      {loading && !entity ? <StateView kind="loading" title="Cargando" skeleton="detail" skeletonCount={2} /> : null}

      {entity ? (
        <>
          <GlassSurface level="strong" tone="accent" padding="lg" contentStyle={{ gap: theme.spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <IconTile icon="share-2" size="lg" color={theme.colors.accent} tint={`${theme.colors.accent}1F`} />
              <View style={{ flex: 1, gap: theme.spacing.xs }}>
                <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>{entityTypeLabel(entity.type)}</Text>
                {entity.summary ? <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{entity.summary}</Text> : null}
              </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              <Tag label={entity.canonical ? 'Nombre preferido' : 'Nombre alternativo'} tone={entity.canonical ? 'positive' : 'neutral'} />
              <Tag label={`${entity.aliases.length} ${entity.aliases.length === 1 ? 'nombre' : 'nombres'}`} tone="neutral" />
              <Tag label={`${entity.relations.length} ${entity.relations.length === 1 ? 'conexión' : 'conexiones'}`} tone="info" />
            </View>
            <Button label="Organizar este elemento" variant="secondary" size="sm" onPress={openOrganize} icon={<Feather name="edit-2" size={13} color={theme.colors.textPrimary} />} />
          </GlassSurface>

          <Section title="Otros nombres" subtitle="Nombres que se usan para este elemento.">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {entity.aliases.map((value) => <Chip key={value} label={value} static canonical={value === entity.title} alias={value !== entity.title} />)}
            </View>
          </Section>

          <Section title="Conexiones" subtitle="Personas, comercios, lugares, temas o actividad cercana.">
            {graph?.nodes?.length || graph?.relations?.length ? (
              <Graph mode="preview" nodes={entity.relatedEntities} relations={graph?.relations ?? []} />
            ) : <StateView title="Todavía no hay conexiones" description="Aparecerán cuando más actividad haga referencia a este elemento." />}
          </Section>

          <Section title="Evidencia" subtitle="Actividad que creó o respalda este elemento.">
            {eventsError ? <StateView kind="error" title="No se pudo cargar la evidencia" description={friendlyError(eventsError)} actionLabel="Reintentar" onAction={refreshEvents} /> : eventsLoading && !events ? <StateView kind="loading" title="Cargando" skeleton="list" skeletonCount={2} /> : originEvents.length ? (
              <GlassSurface level="thin" padding="none" contentStyle={{ paddingHorizontal: theme.spacing.md }}>
              <Timeline items={originEvents.map((event) => ({
                id: event.id,
                icon: event.kind === 'email' ? 'mail' : event.kind === 'notification' ? 'bell' : 'inbox',
                title: event.title,
                subtitle: formatEventSource(event.source),
                time: event.receivedAt ? formatDate(event.receivedAt) : ({ email: 'Correo', notification: 'Notificación' } as Record<string, string>)[event.kind],
                reason: event.body,
                onPress: () => router.push({ pathname: '/event/[id]', params: { id: event.id } }),
              }))} />
              </GlassSurface>
            ) : <StateView title="Sin fuente capturada" description="Este elemento puede provenir de una decisión manual o su evento de origen ya no está disponible." />}
          </Section>

          {relationGroups.length ? <Section title="Por qué está conectado" subtitle="La evidencia detrás de cada relación.">
            <GlassSurface level="thin" padding="none">{relationGroups.map((relation, index) => (
              <Row titleLines={0} descriptionLines={0} style={index === relationGroups.length - 1 ? { borderBottomWidth: 0 } : undefined} key={relation.key} title={relation.label} subtitle={directionLabel[relation.direction]} description={relation.description} leading={<IconTile icon="link-2" />} accessory="none" />
            ))}</GlassSurface>
          </Section> : null}

          <Button label="Buscar relacionados" variant="secondary" onPress={() => router.push({ pathname: '/search', params: { q: entity.title } })} />
        </>
      ) : null}

      <BottomSheet visible={organizeOpen} title="Organizar este elemento" onClose={() => setOrganizeOpen(false)}>
        <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Nombre alternativo</Text>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Usa los nombres con los que realmente se nombra a esta persona, lugar, proyecto, comercio, tema o cuenta.</Text>
        <Field label="Nombre" value={alias} onChangeText={setAlias} placeholder="Agrega un nombre alternativo" />
        <Button label="Guardar nombre alternativo" onPress={saveAlias} disabled={!alias.trim() || saving !== null} loading={saving === 'alias'} />
        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.glass.divider }} />
        <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Es el mismo elemento</Text>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Une duplicados para que su conocimiento y la actividad futura queden juntos.</Text>
        <Field label="Buscar un elemento existente" value={equivalentQuery} onChangeText={(value) => { setEquivalentQuery(value); setEquivalentId(null); setConfirming(false); }} placeholder="Buscar por nombre" />
        {equivalentQuery.trim().length >= 2 ? (
          matchesError ? <Text accessibilityLiveRegion="polite" style={[theme.typography.caption, { color: theme.colors.danger }]}>No se pudieron buscar coincidencias. Intenta de nuevo.</Text>
            : matchesLoading || matchResult?.query !== equivalentQuery.trim() ? <StateView kind="loading" title="Cargando coincidencias" skeleton="list" skeletonCount={1} />
            : equivalentMatches.length ? <GlassSurface level="thin" padding="none">{equivalentMatches.map((match, index) => (
              <Row key={match.id} title={match.name} subtitle={entityTypeLabel(match.type)} selected={equivalentId === match.id} style={index === equivalentMatches.length - 1 ? { borderBottomWidth: 0 } : undefined} trailing={<Tag label={equivalentId === match.id ? 'Elegido' : 'Usar'} tone={equivalentId === match.id ? 'positive' : 'neutral'} />} onPress={() => { setEquivalentId(match.id); setConfirming(false); }} />
            ))}</GlassSurface> : <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Sin coincidencias para «{equivalentQuery.trim()}».</Text>
        ) : <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Ingresa al menos dos caracteres para buscar.</Text>}
        {confirming ? <Text accessibilityLiveRegion="polite" style={[theme.typography.caption, { color: theme.colors.warning }]}>Esta acción combina el historial de ambos elementos. Pulsa de nuevo para confirmar.</Text> : null}
        <Button label={confirming ? 'Confirmar unificación' : selectedMatch ? `Unificar con «${selectedMatch.name}»` : 'Unificar identidades'} variant={confirming ? 'danger' : 'primary'} onPress={mergeEquivalent} disabled={!selectedMatch || saving !== null || matchesLoading} loading={saving === 'merge'} />
        {message ? <Text accessibilityLiveRegion="polite" style={[theme.typography.caption, { color: theme.colors.danger }]}>{message}</Text> : null}
      </BottomSheet>
    </Screen>
  );
}

function formatEventSource(source: string) {
  const labels: Record<string, string> = { 'make.gmail': 'Gmail via Make', 'make.outlook': 'Outlook via Make' };
  return labels[source.toLowerCase()] ?? source.replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const entityTypeLabels: Record<string, string> = { person: 'Persona', merchant: 'Comercio', place: 'Lugar', project: 'Proyecto', topic: 'Tema', account: 'Cuenta', app: 'Aplicación', concept: 'Concepto', domain: 'Dominio', sender: 'Remitente', financial_event: 'Movimiento', activity_instance: 'Actividad' };
function entityTypeLabel(type: string) {
  return entityTypeLabels[type] ?? cleanDisplayText(type);
}
const directionLabel: Record<'incoming' | 'outgoing' | 'bidirectional', string> = { incoming: 'Entrante', outgoing: 'Saliente', bidirectional: 'Mutua' };

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
    label: group.count === 1 ? group.label : `${group.label} · ${group.count} conexiones`,
    description: group.count === 1 ? group.description : `Tipo de relación presente en ${group.count} conexiones del grafo.`,
  }));
}

function friendlyError(error: string) {
  return /network|fetch|connection|timeout|offline/i.test(error)
    ? 'Sin conexión con Brain IA. Revisa tu red e intenta de nuevo.'
    : 'No se pudieron cargar los datos. Intenta de nuevo.';
}
