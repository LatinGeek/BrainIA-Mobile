import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';

import {
  AppScreen,
  Section,
  TopBar,
} from '@/components/layout';
import { BottomSheet, Button, FilterChip, Input, ListRow, Panel, SegmentedControl, StatusBadge, Surface } from '@/components/primitives';
import { EmptyState, LoadingSkeleton } from '@/components/states';
import { ConfidenceTier, ProvenanceMark } from '@/components/trust';
import { EntityTagPicker } from '@/components/review';
import { useBrainIAClient, useTheme } from '@/lib/app-state';
import { loadReviewBundle } from '@/lib/api';
import { useAsyncResource } from '@/lib/hooks';
import { EntityRole, EntitySemanticProfile, EntitySuggestion, EventSummary, ReviewItem, SemanticCandidate } from '@/lib/domain';
import { formatCategoryLabel, formatDate } from '@/lib/format';

const reviewTypes = [
  { value: 'entities', label: 'Entities' },
  { value: 'labels', label: 'Labels' },
  { value: 'relations', label: 'Relations' },
  { value: 'reprocess', label: 'Reprocess' },
  { value: 'resolved', label: 'Resolved' },
] as const;

type ReviewType = (typeof reviewTypes)[number]['value'];

export default function ReviewScreen() {
  const theme = useTheme();
  const client = useBrainIAClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewType, setReviewType] = useState<ReviewType>('entities');
  const [friendlyNameDraft, setFriendlyNameDraft] = useState<{ reviewId: string; value: string } | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [equivalentEntityIds, setEquivalentEntityIds] = useState<string[]>([]);
  const [categoryPath, setCategoryPath] = useState('');
  const [taxonomyKeys, setTaxonomyKeys] = useState<string[]>([]);
  const [entityRoles, setEntityRoles] = useState<EntityRole[]>([]);
  const [profileRelations, setProfileRelations] = useState<EntitySemanticProfile['relations']>([]);
  const [relationType, setRelationType] = useState<EntitySemanticProfile['relations'][number]['relationType']>('part_of');
  const [relationQuery, setRelationQuery] = useState('');
  const [relationSuggestions, setRelationSuggestions] = useState<EntitySuggestion[]>([]);
  const [loadingRelationSuggestions, setLoadingRelationSuggestions] = useState(false);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [entitySuggestions, setEntitySuggestions] = useState<EntitySuggestion[]>([]);
  const [loadingEntitySuggestions, setLoadingEntitySuggestions] = useState(false);
  const [activityExpanded, setActivityExpanded] = useState(false);
  const loader = useMemo(() => () => loadReviewBundle(client), [client]);
  const { data, loading, error, refresh } = useAsyncResource(loader, [loader]);
  const eventsLoader = useMemo(() => () => client.listEvents(12), [client]);
  const { data: events, loading: eventsLoading, error: eventsError, refresh: refreshEvents } = useAsyncResource(eventsLoader, [eventsLoader]);
  const semanticLoader = useMemo(() => () => client.listSemanticCandidates(), [client]);
  const { data: semanticCandidates, refresh: refreshSemantic } = useAsyncResource(semanticLoader, [semanticLoader]);
  const tagsLoader = useMemo(() => () => client.listEntityTags(), [client]);
  const { data: entityTags } = useAsyncResource(tagsLoader, [tagsLoader]);

  const reviews = useMemo(() => data?.reviews ?? [], [data?.reviews]);
  const selected = reviews.find((item) => item.id === selectedId) ?? reviews[0];
  const friendlyName = friendlyNameDraft && friendlyNameDraft.reviewId === selected?.id
    ? friendlyNameDraft.value
    : selected?.normalizedValue ?? selected?.alias ?? '';
  const grouped = useMemo(() => groupReviews(reviews), [reviews]);
  const selectedCategoryLabel = categoryPath.trim() || 'Sin etiquetas todavía';
  const selectedProfileEntityId = selectedEntityId ?? selected?.entityId ?? null;
  const selectedTagLabels = useMemo(() => taxonomyKeys.map((key) => entityTags?.find((tag) => tag.key === key)?.label ?? key), [entityTags, taxonomyKeys]);
  const selectedEntityQuery = friendlyName.trim();
  const selectedReviewId = selected?.id;

  useEffect(() => {
    if (selectedEntityQuery.length < 2 || !selectedReviewId) return;

    let active = true;
    const timer = setTimeout(() => {
      setLoadingEntitySuggestions(true);
      client.findEntityMatches(selectedEntityQuery)
        .then((matches) => {
          if (active) setEntitySuggestions(matches.filter((match) => match.id !== selected?.entityId && (!selected?.entityType || match.type === selected.entityType)));
        })
        .catch(() => {
          if (active) setEntitySuggestions([]);
        })
        .finally(() => {
          if (active) setLoadingEntitySuggestions(false);
        });
    }, 280);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [client, selected?.entityId, selected?.entityType, selectedEntityQuery, selectedReviewId]);

  useEffect(() => {
    if (!selectedProfileEntityId) return;
    let active = true;
    client.getEntitySemanticProfile(selectedProfileEntityId).then((profile) => {
      if (!active || !profile) return;
      setTaxonomyKeys(profile.taxonomyKeys);
      setEntityRoles(profile.roles);
      setProfileRelations(profile.relations);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [client, selectedProfileEntityId]);

  function chooseReview(item: ReviewItem) {
    setSelectedId(item.id);
    setFriendlyNameDraft({ reviewId: item.id, value: item.normalizedValue ?? item.alias });
    setSelectedEntityId(null);
    setEquivalentEntityIds([]);
    setEntitySuggestions([]);
    setLoadingEntitySuggestions(false);
    setCategoryPath(item.categoryPath.join(' / '));
    setTaxonomyKeys([]);
    setEntityRoles([]);
    setProfileRelations([]);
    setRelationQuery('');
    setRelationSuggestions([]);
    setCategorySheetOpen(false);
  }

  function changeFriendlyName(value: string) {
    if (!selected) return;
    setFriendlyNameDraft({ reviewId: selected.id, value });
    setSelectedEntityId(null);
    setEquivalentEntityIds([]);
    setEntitySuggestions([]);
    setLoadingEntitySuggestions(false);
  }

  function chooseEntitySuggestion(suggestion: EntitySuggestion) {
    setEquivalentEntityIds((current) => {
      const next = current.includes(suggestion.id) ? current.filter((id) => id !== suggestion.id) : [...current, suggestion.id];
      const canonicalId = next[0] ?? null;
      setSelectedEntityId(canonicalId);
      return next;
    });
  }

  async function confirm(title: string, message: string) {
    if (Platform.OS === 'web') {
      return Promise.resolve(globalThis.confirm(`${title}\n\n${message}`));
    }

    return new Promise<boolean>((resolve) => {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continue', onPress: () => resolve(true) },
      ]);
    });
  }

  async function resolveSelected() {
    if (!selected) return;
    setBusy(true);
    try {
      const mergeCount = Math.max(0, equivalentEntityIds.length - 1);
      const approved = await confirm('Save decision', selectedEntityId ? `Merge this item${mergeCount ? ` and ${mergeCount} other selected match${mergeCount === 1 ? '' : 'es'}` : ''} into "${friendlyName || selected.alias}"?` : `Use "${friendlyName || selected.alias}" for future searches and money summaries?`);
      if (!approved) return;
      await client.resolveAlias(selected.id, {
        alias: friendlyName.trim() || selected.alias,
        categoryPath: categoryPath.split('/').map((part) => part.trim()).filter(Boolean),
        targetEntityId: selectedEntityId ?? undefined,
      });
      const profileEntityId = selectedEntityId ?? selected.entityId;
      if (profileEntityId) {
        await client.saveEntitySemanticProfile(profileEntityId, {
          taxonomyKeys,
          roles: entityRoles,
          relations: profileRelations.map(({ relationType: savedRelationType, targetEntityId }) => ({ relationType: savedRelationType, targetEntityId })),
        });
      }
      if (selectedEntityId) {
        for (const entityId of equivalentEntityIds.filter((id) => id !== selectedEntityId)) {
          await client.mergeEntity({ aliasEntityId: entityId, canonicalEntityId: selectedEntityId, reason: 'User confirmed these review matches are the same entity.', confidence: 1 });
        }
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStatusMessage(`Saved decision for ${friendlyName || selected.alias}.`);
      await refresh();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not save this decision. Try a different alias.');
    } finally {
      setBusy(false);
    }
  }

  async function ignoreSelected() {
    if (!selected) return;
    setBusy(true);
    try {
      const approved = await confirm('Ignore suggestion', `Ignore "${selected.alias}" if it is not useful?`);
      if (!approved) return;
      await client.ignoreAlias(selected.id);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStatusMessage(`Ignored ${selected.alias}.`);
      await refresh();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not ignore this review item.');
    } finally {
      setBusy(false);
    }
  }

  const selectedLabel = selected?.normalizedValue ?? selected?.alias ?? '';

  function applyCategory(path: string) {
    setCategoryPath(path);
    const tag = (entityTags ?? []).find((candidate) => tagPath(candidate, entityTags ?? []).join(' / ') === path);
    if (tag) setTaxonomyKeys([tag.key]);
    setCategorySheetOpen(false);
  }

  function toggleRole(role: EntityRole) {
    setEntityRoles((current) => current.includes(role) ? current.filter((value) => value !== role) : [...current, role]);
  }

  useEffect(() => {
    const query = relationQuery.trim();
    if (query.length < 2 || !selectedProfileEntityId) return;
    let active = true;
    const timer = setTimeout(() => {
      setLoadingRelationSuggestions(true);
      client.findEntityMatches(query).then((matches) => {
        if (active) setRelationSuggestions(matches.filter((match) => match.id !== selectedProfileEntityId));
      }).catch(() => {
        if (active) setRelationSuggestions([]);
      }).finally(() => {
        if (active) setLoadingRelationSuggestions(false);
      });
    }, 280);
    return () => { active = false; clearTimeout(timer); };
  }, [client, relationQuery, selectedProfileEntityId]);

  function addRelation(target: EntitySuggestion) {
    setProfileRelations((current) => current.some((relation) => relation.relationType === relationType && relation.targetEntityId === target.id)
      ? current
      : [...current, { relationType, targetEntityId: target.id, targetLabel: target.name }]);
    setRelationQuery('');
    setRelationSuggestions([]);
  }

  function removeRelation(targetEntityId: string, savedRelationType: EntitySemanticProfile['relations'][number]['relationType']) {
    setProfileRelations((current) => current.filter((relation) => relation.targetEntityId !== targetEntityId || relation.relationType !== savedRelationType));
  }

  return (
    <AppScreen refreshing={loading || eventsLoading} onRefresh={() => Promise.all([refresh(), refreshEvents()])}>
      <TopBar
        title="Review"
        subtitle="Inspect what arrived, then make decisions that improve your knowledge base."
        secondaryAction={<Button label="Settings" onPress={() => router.push('/settings')} variant="ghost" />}
      />

      {error ? <EmptyState title="Could not load review" description={error} primaryActionLabel="Retry" onPrimaryAction={refresh} /> : null}
      {loading && !data ? <LoadingSkeleton variant="card" count={2} /> : null}

      {!error && data ? (
        <>
          <Panel tone="review" style={{ gap: theme.spacing.md }}>
            <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>Improve your knowledge base</Text>
            <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
              Confirm identities, labels, and relationships. Each decision becomes evidence BrainIA can use to understand later events.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <StatusBadge label={`${grouped.entities.length} entities`} tone={grouped.entities.length ? 'warning' : 'neutral'} />
              <StatusBadge label={`${semanticCandidates?.length ?? 0} relationships`} tone={(semanticCandidates?.length ?? 0) ? 'warning' : 'neutral'} />
              <StatusBadge label={`${grouped.labels.length} labels`} />
              <StatusBadge label={`${grouped.resolved.length} resolved`} tone={grouped.resolved.length ? 'positive' : 'neutral'} />
            </View>
          </Panel>

          {(semanticCandidates?.length ?? 0) > 0 ? <Section title="Relationships and graph placement" subtitle="Confirm what is connected to what; this is how isolated events become usable knowledge." count={semanticCandidates?.length}>
            {semanticCandidates?.map((candidate: SemanticCandidate) => (
              <SemanticCandidateCard
                key={candidate.id}
                candidate={candidate}
                onKeep={async (createRule) => { await client.resolveSemanticCandidate(candidate.id, { action: 'approve', createRule }); await refreshSemantic(); }}
                onSkip={async () => { await client.resolveSemanticCandidate(candidate.id, { action: 'reject' }); await refreshSemantic(); }}
              />
            ))}
          </Section> : null}

          <Section title="Incoming activity" subtitle="Recent events that are now available for review and knowledge extraction." count={events?.length ?? 0} actionLabel={activityExpanded ? 'Collapse' : 'Expand'} onActionPress={() => setActivityExpanded((current) => !current)}>
            {eventsError ? <EmptyState title="Activity unavailable" description={eventsError} primaryActionLabel="Retry" onPrimaryAction={refreshEvents} /> : null}
            {eventsLoading && !events ? <LoadingSkeleton variant="card" count={2} /> : null}
            {activityExpanded && events?.length ? events.map((event: EventSummary) => (
              <ListRow
                key={event.id}
                leading={<Feather name={event.kind === 'email' ? 'mail' : event.kind === 'notification' ? 'bell' : 'inbox'} size={18} color={theme.colors.accentStrong} />}
                title={event.title}
                subtitle={`${event.source.replace(/^make\./, 'Make · ')} · ${event.receivedAt ? formatDate(event.receivedAt) : 'Received time unavailable'}`}
                description={event.body}
                descriptionNumberOfLines={3}
                trailing={<StatusBadge label={event.inferredKind ?? event.kind} />}
                onPress={() => router.push({ pathname: '/event/[id]', params: { id: event.id } })}
              />
            )) : !eventsLoading && !eventsError && activityExpanded ? <EmptyState title="No activity yet" description="New emails, notifications, and captures will appear here as they arrive." primaryActionLabel="Refresh" onPrimaryAction={refreshEvents} /> : null}
          </Section>

          <SegmentedControl value={reviewType} onChange={setReviewType} options={reviewTypes.map((type) => ({ ...type, count: grouped[type.value].length }))} />

          <Section title="Review items" subtitle="Pick one item and preview the effect before saving." count={grouped[reviewType].length}>
            {grouped[reviewType].length ? (
              grouped[reviewType].map((item) => (
                <ListRow
                  key={item.id}
                  title={item.normalizedValue ?? item.alias}
                  subtitle={item.categoryPath.length ? item.categoryPath.map((category) => formatCategoryLabel(category)).join(' / ') : 'Needs category review'}
                  description={decisionCopy(item)}
                  trailing={<StatusBadge label={item.id === selected?.id ? 'Selected' : 'Review'} />}
                  onPress={() => chooseReview(item)}
                />
              ))
            ) : (
              <EmptyState title="Nothing here" description={emptyCopy(reviewType)} />
            )}
          </Section>

          {selected ? (
            <Section title="Curate entity" subtitle={`Help BrainIA recognize ${selectedLabel} as part of your knowledge graph.`}>
              <Panel tone="review" style={{ gap: theme.spacing.md }}>
                <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>What is the canonical identity?</Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}> 
                  This confirms an entity, its preferred label, and possible equivalent identities. BrainIA can use it as supervised context for future classification.
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {uniqueSuggestions(selected).map((suggestion) => (
                    <FilterChip key={suggestion} label={suggestion} selected={friendlyName === suggestion} onPress={() => changeFriendlyName(suggestion)} />
                  ))}
                </View>
                <Input
                  label="Canonical label"
                  value={friendlyName}
                  onChangeText={changeFriendlyName}
                  placeholder="Person, organization, place, app, or topic"
                />
                <Surface variant="subtle" style={{ gap: 8 }}>
                  <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Possible existing matches</Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Suggestions update as you type. Select every identity that represents the same real-world entity; BrainIA keeps aliases, evidence, and links together.</Text>
                  {loadingEntitySuggestions ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Checking known entities…</Text> : null}
                  {!loadingEntitySuggestions && selectedEntityQuery.length < 2 ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Type at least two characters to search existing names.</Text> : null}
                  {!loadingEntitySuggestions && selectedEntityQuery.length >= 2 && entitySuggestions.length === 0 ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>No close matches found. This can be saved as a new name.</Text> : null}
                  {entitySuggestions.map((suggestion) => (
                    <ListRow
                      key={suggestion.id}
                      title={suggestion.name}
                      subtitle={`${suggestion.type}${suggestion.aliasCount ? ` · ${suggestion.aliasCount} alternate name${suggestion.aliasCount === 1 ? '' : 's'}` : ''}`}
                      trailing={<StatusBadge label={equivalentEntityIds.includes(suggestion.id) ? 'Same entity' : 'Mark same'} tone={equivalentEntityIds.includes(suggestion.id) ? 'positive' : 'neutral'} />}
                      onPress={() => chooseEntitySuggestion(suggestion)}
                    />
                  ))}
                </Surface>
                <Pressable onPress={() => setCategorySheetOpen(true)}>
                  <Surface variant="raised" style={{ gap: 6 }}>
                    <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Etiquetas de contexto</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <Text style={[theme.typography.bodyStrong, { color: categoryPath ? theme.colors.textPrimary : theme.colors.textSecondary, flex: 1 }]}>
                        {selectedCategoryLabel}
                      </Text>
                      <Feather name="chevron-down" size={18} color={theme.colors.textMuted} />
                    </View>
                    <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}> 
                      Ubicá esta entidad en un área de tu vida. Las categorías financieras pertenecen a movimientos, no a entidades.
                    </Text>
                  </Surface>
                </Pressable>
                <Surface variant="raised" style={{ gap: 8 }}>
                  <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>ROLES DE LA ENTIDAD</Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Una entidad puede cumplir varios roles. Por ejemplo, Google Pay puede ser método de pago y parte de una organización.</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {entityRoleOptions.map((option) => <FilterChip key={option.value} label={option.label} selected={entityRoles.includes(option.value)} onPress={() => toggleRole(option.value)} />)}
                  </View>
                  {selectedTagLabels.length ? <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Etiquetas estructuradas: {selectedTagLabels.join(' · ')}</Text> : null}
                </Surface>
                <Surface variant="raised" style={{ gap: 8 }}>
                  <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>RELACIONES CONFIRMADAS</Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Relacioná esta entidad con otra que ya exista en tu grafo. Esto es distinto de clasificarla o asignarle un rol.</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {relationTypeOptions.map((option) => <FilterChip key={option.value} label={option.label} selected={relationType === option.value} onPress={() => setRelationType(option.value)} />)}
                  </View>
                  <Input label={`Buscar entidad para “${relationTypeOptions.find((option) => option.value === relationType)?.label ?? relationType}”`} value={relationQuery} onChangeText={setRelationQuery} placeholder="Google, banco, aplicación, comercio…" />
                  {loadingRelationSuggestions ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Buscando entidades…</Text> : null}
                  {relationQuery.trim().length >= 2 ? relationSuggestions.map((suggestion) => <ListRow key={suggestion.id} title={suggestion.name} subtitle={suggestion.type} trailing={<StatusBadge label="Relacionar" />} onPress={() => addRelation(suggestion)} />) : null}
                  {profileRelations.map((relation) => <ListRow key={`${relation.relationType}:${relation.targetEntityId}`} title={relation.targetLabel} subtitle={relationTypeOptions.find((option) => option.value === relation.relationType)?.label ?? relation.relationType} trailing={<StatusBadge label="Quitar" tone="warning" />} onPress={() => removeRelation(relation.targetEntityId, relation.relationType)} />)}
                </Surface>
                <Surface variant="raised" style={{ gap: 4, borderColor: theme.status.review + '44' }}>
                  <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Action preview</Text>
                  <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
                    {selectedEntityId ? `This item${equivalentEntityIds.length > 1 ? ` and ${equivalentEntityIds.length - 1} selected match${equivalentEntityIds.length === 2 ? '' : 'es'}` : ''} will become the same entity as ${friendlyName || selected.alias}.` : `Future events using ${selected.alias} will recognize ${friendlyName || selected.alias}.`} {selectedTagLabels.length ? ` Etiquetas: ${selectedTagLabels.join(', ')}.` : ''} {entityRoles.length ? ` Roles: ${entityRoles.join(', ')}.` : ''} {profileRelations.length ? ` Relaciones: ${profileRelations.map((relation) => relation.targetLabel).join(', ')}.` : ''}
                  </Text>
                </Surface>
                <Surface variant="raised" style={{ gap: 4, borderColor: theme.depth.glow }}>
                  <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>What happens next</Text>
                  <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
                    Accepted changes become supervised examples for future event classification, entity matching, graph relations, search, and insights.
                  </Text>
                </Surface>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <Button label={busy ? 'Saving...' : 'Accept'} onPress={resolveSelected} loading={busy} />
                  <Button label="Ignore" onPress={ignoreSelected} variant="secondary" disabled={busy} />
                  <Button label="Later" onPress={() => setStatusMessage('Kept for later.')} variant="ghost" disabled={busy} />
                </View>
              </Panel>
            </Section>
          ) : null}
        </>
      ) : null}

      {statusMessage ? <EmptyState title="Review updated" description={statusMessage} primaryActionLabel="Dismiss" onPrimaryAction={() => setStatusMessage(null)} /> : null}

      <BottomSheet visible={categorySheetOpen} title="Etiquetar entidad" onClose={() => setCategorySheetOpen(false)}>
        <EntityTagPicker
          tags={entityTags ?? []}
          selectedPath={categoryPath.split('/').map((part) => part.trim()).filter(Boolean)}
          onSelect={(path) => applyCategory(path.join(' / '))}
        />
      </BottomSheet>
    </AppScreen>
  );
}

function SemanticCandidateCard({
  candidate,
  onKeep,
  onSkip,
}: {
  candidate: SemanticCandidate;
  onKeep: (createRule: boolean) => Promise<void>;
  onSkip: () => Promise<void>;
}) {
  const theme = useTheme();
  const [resolving, setResolving] = useState<'keep' | 'skip' | null>(null);
  const [createRule, setCreateRule] = useState(false);
  const relationLabel = formatRelationLabel(candidate.relationType);
  const roleLabel = candidate.anchorRole === 'primary'
    ? 'Primary area'
    : candidate.anchorRole === 'secondary'
      ? 'Secondary area'
      : 'Semantic link';

  async function resolve(action: 'keep' | 'skip') {
    setResolving(action);
    try {
      await (action === 'keep' ? onKeep(createRule) : onSkip());
    } finally {
      setResolving(null);
    }
  }

  return (
    <Panel tone="review" style={{ gap: theme.spacing.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <ProvenanceMark origin="model" label="Suggested" />
        <ConfidenceTier confidence={candidate.confidence} showValue />
        <StatusBadge label={roleLabel} />
        {candidate.decisionKind === 'create' ? <StatusBadge label="Creates a node" tone="warning" /> : null}
      </View>

      <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>PROPOSED RELATION</Text>
      <Surface variant="raised" style={{ gap: theme.spacing.sm }}>
        <View style={{ gap: 3 }}>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>From</Text>
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>
            {candidate.subjectValue ?? 'Source entity name unavailable'}
          </Text>
          {candidate.subjectType ? <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{formatRelationLabel(candidate.subjectType)}</Text> : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Feather name="arrow-down" size={16} color={theme.colors.accentStrong} />
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.accentStrong }]}>{relationLabel}</Text>
        </View>

        <View style={{ gap: 3 }}>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>To</Text>
          <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>{candidate.targetValue}</Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{formatRelationLabel(candidate.targetType)}</Text>
        </View>
      </Surface>

      {candidate.proposedPath.length ? (
        <View style={{ gap: 4 }}>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>PLACEMENT IN YOUR GRAPH</Text>
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{candidate.proposedPath.join(' → ')}</Text>
        </View>
      ) : null}

      <View style={{ gap: 4 }}>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>WHY THIS IS SUGGESTED</Text>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          {candidate.rationale ?? 'No explanation was provided for this proposal.'}
        </Text>
      </View>

      {candidate.alternatives.length ? (
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
          Other possible destinations: {candidate.alternatives.slice(0, 3).map((alternative) => `${alternative.value} (${Math.round(alternative.confidence * 100)}%)`).join(', ')}
        </Text>
      ) : null}

      <View style={{ gap: 7 }}>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>WHEN APPROVED</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button label="Apply once" size="sm" variant={createRule ? 'secondary' : 'primary'} onPress={() => setCreateRule(false)} />
          <Button label="Create rule" size="sm" variant={createRule ? 'primary' : 'secondary'} onPress={() => setCreateRule(true)} />
        </View>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{createRule ? 'Use this decision automatically for matching suggestions in the future.' : 'Save only this relationship; future suggestions will still ask.'}</Text>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
        <Button label="Reject" size="sm" variant="ghost" loading={resolving === 'skip'} disabled={resolving !== null} onPress={() => resolve('skip')} />
        <Button label="Approve relation" size="sm" loading={resolving === 'keep'} disabled={resolving !== null} onPress={() => resolve('keep')} />
      </View>
    </Panel>
  );
}

function formatRelationLabel(value: string) {
  const normalized = value.replace(/_/g, ' ').trim();
  if (normalized === 'part of') return 'is part of';
  if (normalized === 'belongs to domain') return 'belongs to';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

const entityRoleOptions: { value: EntityRole; label: string }[] = [
  { value: 'business', label: 'Negocio' },
  { value: 'merchant', label: 'Merchant' },
  { value: 'payment_method', label: 'Método de pago' },
  { value: 'organization', label: 'Organización' },
  { value: 'app', label: 'App' },
  { value: 'provider', label: 'Proveedor' },
  { value: 'account', label: 'Cuenta' },
];

const relationTypeOptions: { value: EntitySemanticProfile['relations'][number]['relationType']; label: string }[] = [
  { value: 'part_of', label: 'Es parte de' },
  { value: 'uses_service', label: 'Usa servicio' },
  { value: 'produced_by_app', label: 'Producido por app' },
  { value: 'controls', label: 'Controla' },
  { value: 'related_to', label: 'Relacionado con' },
];

function tagPath(tag: { key: string; label: string; parentKey?: string | null }, tags: { key: string; label: string; parentKey?: string | null }[]) {
  const byKey = new Map(tags.map((item) => [item.key, item]));
  const path: string[] = [];
  let current: typeof tag | undefined = tag;
  while (current) {
    path.unshift(current.label);
    current = current.parentKey ? byKey.get(current.parentKey) : undefined;
  }
  return path;
}

function groupReviews(reviews: ReviewItem[]): Record<ReviewType, ReviewItem[]> {
  const pending = reviews.filter((item) => item.status === 'pending');

  return {
    entities: pending.filter((item) => !/merge|same|duplicate/i.test(item.reason)),
    labels: pending.filter((item) => Boolean(item.normalizedValue) || /alias|name|identity/i.test(item.reason)),
    relations: pending.filter((item) => /merge|same|duplicate|relation/i.test(item.reason)),
    reprocess: pending.filter((item) => /reprocess|stale|refresh/i.test(item.reason)),
    resolved: reviews.filter((item) => item.status === 'resolved' || item.status === 'ignored'),
  };
}

function emptyCopy(type: ReviewType) {
  switch (type) {
    case 'relations':
      return 'Suggested links and duplicate identities will appear here when BrainIA finds a meaningful connection.';
    case 'reprocess':
      return 'Suggestions to refresh stale activity will appear here.';
    case 'resolved':
      return 'Completed decisions will appear here after actions are saved.';
    default:
      return 'This review type has no pending suggestions.';
  }
}

function decisionCopy(item: ReviewItem) {
  if (item.normalizedValue && item.normalizedValue !== item.alias) {
    return `Suggested friendly name: ${item.normalizedValue}.`;
  }

  if (item.categoryPath.length) {
    return `Etiquetas de contexto sugeridas: ${item.categoryPath.join(' / ')}.`;
  }

  return `Confirm whether this is a real ${item.entityType ?? 'entity'} that should be retained in your knowledge graph.`;
}

function uniqueSuggestions(selected: ReviewItem) {
  return Array.from(
    new Set([
      selected.normalizedValue,
      selected.alias,
      selected.originalValue,
      ...selected.categoryPath,
    ].filter((item): item is string => Boolean(item && item.trim().length > 0)))
  );
}
