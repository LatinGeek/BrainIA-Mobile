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
import { EntityTagPicker, ReviewDecisionCard } from '@/components/review';
import { useBrainIAClient, useTheme } from '@/lib/app-state';
import { loadReviewBundle } from '@/lib/api';
import { useAsyncResource } from '@/lib/hooks';
import { EntityRole, EntitySemanticProfile, EntitySuggestion, EventSummary, ReviewItem, SemanticCandidate } from '@/lib/domain';
import { formatDate } from '@/lib/format';
import { recordInteraction } from '@/lib/interaction-telemetry';

const reviewTypes = [
  { value: 'pending', label: 'Pendientes' },
  { value: 'identities', label: 'Identidades' },
  { value: 'connections', label: 'Conexiones' },
  { value: 'history', label: 'Historial' },
] as const;

type ReviewType = (typeof reviewTypes)[number]['value'];

export default function ReviewScreen() {
  const theme = useTheme();
  const client = useBrainIAClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewType, setReviewType] = useState<ReviewType>('pending');
  const [editorOpen, setEditorOpen] = useState(false);
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
  const pendingReviews = useMemo(() => reviews.filter((item) => item.status === 'pending'), [reviews]);
  const identityReviews = useMemo(() => pendingReviews.filter((item) => !isRelationshipReview(item)), [pendingReviews]);
  const historyReviews = useMemo(() => reviews.filter((item) => item.status === 'resolved' || item.status === 'ignored'), [reviews]);
  const visibleReviews = reviewType === 'pending' ? pendingReviews : reviewType === 'identities' ? identityReviews : reviewType === 'history' ? historyReviews : [];
  const queueReviews = reviewType === 'pending' ? visibleReviews.slice(1) : visibleReviews;
  const pendingCount = pendingReviews.length + (semanticCandidates?.length ?? 0);
  const activeCount = reviewType === 'connections' ? semanticCandidates?.length ?? 0 : queueReviews.length;
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
    setEditorOpen(true);
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
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continuar', onPress: () => resolve(true) },
      ]);
    });
  }

  async function resolveSelected() {
    if (!selected) return;
    setBusy(true);
    try {
      const mergeCount = Math.max(0, equivalentEntityIds.length - 1);
      const approved = await confirm('Guardar decisión', selectedEntityId ? `¿Unificar este elemento${mergeCount ? ` y ${mergeCount} coincidencias seleccionadas` : ''} en "${friendlyName || selected.alias}"?` : `¿Usar "${friendlyName || selected.alias}" en búsquedas y resúmenes de dinero futuros?`);
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
      recordInteraction('review', 'review', 'success');
      setStatusMessage(`Decisión guardada para ${friendlyName || selected.alias}.`);
      await refresh();
      setEditorOpen(false);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'No se pudo guardar la decisión. Prueba con otro alias.');
    } finally {
      setBusy(false);
    }
  }

  async function ignoreSelected() {
    if (!selected) return;
    setBusy(true);
    try {
      const approved = await confirm('Ignorar sugerencia', `¿Ignorar "${selected.alias}" si no es útil?`);
      if (!approved) return;
      await client.ignoreAlias(selected.id);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStatusMessage(`Se ignoró ${selected.alias}.`);
      await refresh();
      setEditorOpen(false);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'No se pudo ignorar este elemento.');
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
        title="Revisar"
        subtitle="Inspecciona lo recibido y toma decisiones que mejoran tu conocimiento."
        secondaryAction={<Button label="Ajustes" onPress={() => router.push('/settings')} variant="ghost" />}
      />

      {error ? <EmptyState title="No se pudo cargar la revisión" description={error} primaryActionLabel="Reintentar" onPrimaryAction={refresh} /> : null}
      {loading && !data ? <LoadingSkeleton variant="card" count={2} /> : null}

      {!error && data ? (
        <>
          <Panel tone={pendingCount ? 'review' : 'accent'} style={{ gap: theme.spacing.md }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>REVISIÓN DE HOY</Text>
            <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>
              {pendingCount ? `${pendingCount} ${pendingCount === 1 ? 'decisión para hoy' : 'decisiones para hoy'}` : 'Todo al día'}
            </Text>
            <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
              {pendingCount ? 'Confirmá lo que importa. Cada decisión mejora cómo BrainIA reconoce tu información después.' : 'No hay decisiones pendientes. La próxima actividad que necesite contexto aparecerá aquí.'}
            </Text>
            {pendingReviews[0] ? <ReviewDecisionCard item={pendingReviews[0]} priority onPress={() => chooseReview(pendingReviews[0])} /> : null}
          </Panel>

          <SegmentedControl
            value={reviewType}
            onChange={setReviewType}
            scrollable
            options={reviewTypes.map((type) => ({
              ...type,
              count: type.value === 'pending' ? pendingCount : type.value === 'identities' ? identityReviews.length : type.value === 'connections' ? semanticCandidates?.length ?? 0 : historyReviews.length,
            }))}
          />

          {reviewType !== 'pending' || queueReviews.length ? <Section
            title={reviewType === 'connections' ? 'Conexiones por confirmar' : reviewType === 'history' ? 'Decisiones anteriores' : reviewType === 'identities' ? 'Identidades por aclarar' : 'Después, podés revisar'}
            subtitle={reviewType === 'connections' ? 'Confirmá sólo los vínculos que reconozcas.' : reviewType === 'history' ? 'Podés consultar lo que ya resolviste o descartaste.' : reviewType === 'pending' ? 'Estas son las siguientes decisiones disponibles.' : 'Abrí una decisión para ver la evidencia y el efecto antes de guardarla.'}
            count={activeCount}
          >
            {reviewType === 'connections' ? (
              (semanticCandidates?.length ?? 0) > 0 ? semanticCandidates?.map((candidate: SemanticCandidate) => (
                <SemanticCandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  onKeep={async (createRule) => { await client.resolveSemanticCandidate(candidate.id, { action: 'approve', createRule }); await refreshSemantic(); }}
                  onSkip={async () => { await client.resolveSemanticCandidate(candidate.id, { action: 'reject' }); await refreshSemantic(); }}
                />
              )) : <EmptyState title="No hay conexiones para confirmar" description="BrainIA te mostrará vínculos cuando encuentre evidencia suficiente." />
            ) : queueReviews.length ? (
              queueReviews.map((item) => <ReviewDecisionCard key={item.id} item={item} onPress={() => chooseReview(item)} />)
            ) : (
              <EmptyState title={reviewType === 'history' ? 'Todavía no hay decisiones anteriores' : 'Todo al día'} description={emptyCopy(reviewType)} />
            )}
          </Section> : null}

          <Section title="Actividad reciente" subtitle="Contexto recibido. Sólo algunos elementos requieren una decisión." actionLabel={activityExpanded ? 'Ver menos' : events?.length && events.length > 3 ? `Ver ${events.length}` : undefined} onActionPress={events?.length && events.length > 3 ? () => setActivityExpanded((current) => !current) : undefined}>
            {eventsError ? <EmptyState title="Actividad no disponible" description={eventsError} primaryActionLabel="Reintentar" onPrimaryAction={refreshEvents} /> : null}
            {eventsLoading && !events ? <LoadingSkeleton variant="list" count={3} /> : null}
            {(activityExpanded ? events : events?.slice(0, 3))?.map((event: EventSummary) => (
              <ListRow
                key={event.id}
                leading={<Feather name={event.kind === 'email' ? 'mail' : event.kind === 'notification' ? 'bell' : 'inbox'} size={18} color={theme.colors.accentStrong} />}
                title={event.title}
                subtitle={`${event.source.replace(/^make\./, 'Make · ')} · ${event.receivedAt ? formatDate(event.receivedAt) : 'Hora no disponible'}`}
                description={event.body}
                descriptionNumberOfLines={2}
                trailing={event.interpretationStatus === 'review' ? <StatusBadge label="Requiere contexto" tone="warning" /> : undefined}
                onPress={() => router.push({ pathname: '/event/[id]', params: { id: event.id } })}
              />
            ))}
            {!eventsLoading && !eventsError && !events?.length ? <EmptyState title="Todavía no hay actividad" description="Los nuevos correos, notificaciones y capturas aparecerán aquí." primaryActionLabel="Actualizar" onPrimaryAction={refreshEvents} /> : null}
          </Section>

          <BottomSheet visible={editorOpen && Boolean(selected)} title={selected ? `Revisar ${selectedLabel}` : 'Revisar decisión'} onClose={() => setEditorOpen(false)}>
            {selected ? (
              <View style={{ gap: theme.spacing.md }}>
                <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Confirmá el contexto antes de guardar</Text>
                <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Vas a decidir cómo BrainIA reconocerá este nombre en futuras búsquedas, eventos y resúmenes.</Text>
                <Surface variant="subtle" style={{ gap: 4, borderColor: theme.status.review + '44' }}>
                  <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>QUÉ CAMBIA</Text>
                  <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
                    {selectedEntityId ? `Se unificará con ${friendlyName || selected.alias}.` : `Las próximas referencias a ${selected.alias} se reconocerán como ${friendlyName || selected.alias}.`}
                  </Text>
                </Surface>
                <Panel tone="review" style={{ gap: theme.spacing.md }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {uniqueSuggestions(selected).map((suggestion) => (
                    <FilterChip key={suggestion} label={suggestion} selected={friendlyName === suggestion} onPress={() => changeFriendlyName(suggestion)} />
                  ))}
                </View>
                <Input
                  label="Nombre principal"
                  value={friendlyName}
                  onChangeText={changeFriendlyName}
                  placeholder="Persona, organización, lugar, aplicación o tema"
                />
                <Surface variant="subtle" style={{ gap: 8 }}>
                  <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Posibles coincidencias existentes</Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Las coincidencias se actualizan mientras escribís. Elegí sólo los nombres que representen la misma entidad real.</Text>
                  {loadingEntitySuggestions ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Buscando entidades conocidas…</Text> : null}
                  {!loadingEntitySuggestions && selectedEntityQuery.length < 2 ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Escribí al menos dos caracteres para buscar nombres existentes.</Text> : null}
                  {!loadingEntitySuggestions && selectedEntityQuery.length >= 2 && entitySuggestions.length === 0 ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>No hay coincidencias cercanas. Podés guardarlo como un nombre nuevo.</Text> : null}
                  {entitySuggestions.map((suggestion) => (
                    <ListRow
                      key={suggestion.id}
                      title={suggestion.name}
                      subtitle={`${suggestion.type}${suggestion.aliasCount ? ` · ${suggestion.aliasCount} nombre${suggestion.aliasCount === 1 ? '' : 's'} alternativo${suggestion.aliasCount === 1 ? '' : 's'}` : ''}`}
                      trailing={<StatusBadge label={equivalentEntityIds.includes(suggestion.id) ? 'Misma entidad' : 'Marcar igual'} tone={equivalentEntityIds.includes(suggestion.id) ? 'positive' : 'neutral'} />}
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
                <Surface variant="raised" style={{ gap: 4, borderColor: theme.depth.glow }}>
                  <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Qué cambia después</Text>
                  <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
                    Los cambios aceptados se convierten en ejemplos supervisados para clasificar eventos, reconocer entidades, relacionar conocimiento y mejorar búsquedas futuras.
                  </Text>
                </Surface>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <Button label={busy ? 'Guardando…' : 'Aceptar'} onPress={resolveSelected} loading={busy} />
                  <Button label="Ignorar" onPress={ignoreSelected} variant="secondary" disabled={busy} />
                  <Button label="Más tarde" onPress={() => { setEditorOpen(false); setStatusMessage('La decisión quedó pendiente para más tarde.'); }} variant="ghost" disabled={busy} />
                </View>
              </Panel>
              </View>
            ) : null}
          </BottomSheet>
        </>
      ) : null}

      {statusMessage ? <EmptyState title="Revisión actualizada" description={statusMessage} primaryActionLabel="Descartar" onPrimaryAction={() => setStatusMessage(null)} /> : null}

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
    ? 'Área principal'
    : candidate.anchorRole === 'secondary'
      ? 'Área secundaria'
      : 'Vínculo semántico';

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
        <ProvenanceMark origin="model" label="Sugerido" />
        <ConfidenceTier confidence={candidate.confidence} showValue />
        <StatusBadge label={roleLabel} />
        {candidate.decisionKind === 'create' ? <StatusBadge label="Crea un elemento" tone="warning" /> : null}
      </View>

      <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>RELACIÓN PROPUESTA</Text>
      <Surface variant="raised" style={{ gap: theme.spacing.sm }}>
        <View style={{ gap: 3 }}>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Desde</Text>
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>
            {candidate.subjectValue ?? 'El nombre de la entidad de origen no está disponible'}
          </Text>
          {candidate.subjectType ? <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{formatRelationLabel(candidate.subjectType)}</Text> : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Feather name="arrow-down" size={16} color={theme.colors.accentStrong} />
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.accentStrong }]}>{relationLabel}</Text>
        </View>

        <View style={{ gap: 3 }}>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Hacia</Text>
          <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>{candidate.targetValue}</Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{formatRelationLabel(candidate.targetType)}</Text>
        </View>
      </Surface>

      {candidate.proposedPath.length ? (
        <View style={{ gap: 4 }}>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>UBICACIÓN EN TU CONOCIMIENTO</Text>
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{candidate.proposedPath.join(' → ')}</Text>
        </View>
      ) : null}

      <View style={{ gap: 4 }}>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>POR QUÉ SE SUGIERE</Text>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          {candidate.rationale ?? 'No se recibió una explicación para esta sugerencia.'}
        </Text>
      </View>

      {candidate.alternatives.length ? (
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
          Otros destinos posibles: {candidate.alternatives.slice(0, 3).map((alternative) => `${alternative.value} (${Math.round(alternative.confidence * 100)}%)`).join(', ')}
        </Text>
      ) : null}

      <View style={{ gap: 7 }}>
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>AL CONFIRMAR</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button label="Aplicar una vez" size="sm" variant={createRule ? 'secondary' : 'primary'} onPress={() => setCreateRule(false)} />
          <Button label="Crear regla" size="sm" variant={createRule ? 'primary' : 'secondary'} onPress={() => setCreateRule(true)} />
        </View>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{createRule ? 'Usá esta decisión automáticamente cuando aparezca una sugerencia equivalente.' : 'Guardá sólo esta relación; las próximas sugerencias volverán a preguntarte.'}</Text>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
        <Button label="Rechazar" size="sm" variant="ghost" loading={resolving === 'skip'} disabled={resolving !== null} onPress={() => resolve('skip')} />
        <Button label="Aprobar relación" size="sm" loading={resolving === 'keep'} disabled={resolving !== null} onPress={() => resolve('keep')} />
      </View>
    </Panel>
  );
}

function formatRelationLabel(value: string) {
  const normalized = value.replace(/_/g, ' ').trim();
  if (normalized === 'part of') return 'Es parte de';
  if (normalized === 'belongs to domain') return 'Pertenece a';
  if (normalized === 'uses service') return 'Usa el servicio';
  if (normalized === 'produced by app') return 'Producido por la app';
  if (normalized === 'related to') return 'Relacionado con';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

const entityRoleOptions: { value: EntityRole; label: string }[] = [
  { value: 'business', label: 'Negocio' },
  { value: 'merchant', label: 'Comercio' },
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

function isRelationshipReview(item: ReviewItem) {
  return /merge|same|duplicate|relation/i.test(item.reason);
}

function emptyCopy(type: ReviewType) {
  if (type === 'history') return 'Las decisiones que aceptes o descartes aparecerán aquí.';
  if (type === 'connections') return 'BrainIA te avisará cuando encuentre un vínculo con evidencia suficiente.';
  if (type === 'identities') return 'No hay nombres que necesiten una aclaración en este momento.';
  return 'No hay decisiones pendientes por ahora.';
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
