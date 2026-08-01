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
import { CategoryPicker } from '@/components/review';
import { useBrainIAClient, useTheme } from '@/lib/app-state';
import { loadReviewBundle } from '@/lib/api';
import { useAsyncResource } from '@/lib/hooks';
import { EntitySuggestion, EventSummary, ReviewItem, SemanticCandidate } from '@/lib/domain';
import { formatCategoryLabel, formatDate } from '@/lib/format';

const reviewTypes = [
  { value: 'merchants', label: 'Names' },
  { value: 'categories', label: 'Categories' },
  { value: 'merges', label: 'Merges' },
  { value: 'reprocess', label: 'Reprocess' },
  { value: 'resolved', label: 'Resolved' },
] as const;

type ReviewType = (typeof reviewTypes)[number]['value'];

export default function ReviewScreen() {
  const theme = useTheme();
  const client = useBrainIAClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewType, setReviewType] = useState<ReviewType>('merchants');
  const [friendlyName, setFriendlyName] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [equivalentEntityIds, setEquivalentEntityIds] = useState<string[]>([]);
  const [categoryPath, setCategoryPath] = useState('');
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
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
  const categoriesLoader = useMemo(() => () => client.listFinancialCategories(), [client]);
  const { data: financialCategories } = useAsyncResource(categoriesLoader, [categoriesLoader]);

  const reviews = useMemo(() => data?.reviews ?? [], [data?.reviews]);
  const selected = reviews.find((item) => item.id === selectedId) ?? reviews[0];
  const grouped = useMemo(() => groupReviews(reviews), [reviews]);
  const categoryOptions = useMemo(
    () =>
      uniqueStrings([
        ...(financialCategories?.expense ?? []),
        ...(financialCategories?.income ?? []),
        ...reviews.map((item) => item.categoryPath.join(' / ')),
        ...customCategories,
      ]),
    [customCategories, financialCategories, reviews]
  );
  const selectedCategoryLabel = categoryPath.trim() || 'Choose a category';
  const selectedEntityQuery = selected?.originalValue ?? selected?.alias ?? '';
  const selectedReviewId = selected?.id;

  useEffect(() => {
    if (!selectedEntityQuery || !selectedReviewId) return;

    let active = true;
    Promise.resolve().then(() => {
      if (active) setLoadingEntitySuggestions(true);
    });
    client.findEntityMatches(selectedEntityQuery)
      .then((matches) => {
        if (active) setEntitySuggestions(matches.filter((match) => match.id !== selectedReviewId));
      })
      .catch(() => {
        if (active) setEntitySuggestions([]);
      })
      .finally(() => {
        if (active) setLoadingEntitySuggestions(false);
      });

    return () => {
      active = false;
    };
  }, [client, selectedEntityQuery, selectedReviewId]);

  function chooseReview(item: ReviewItem) {
    setSelectedId(item.id);
    setFriendlyName(item.normalizedValue ?? item.alias);
    setSelectedEntityId(null);
    setEquivalentEntityIds([]);
    setCategoryPath(item.categoryPath.join(' / '));
    setCategorySheetOpen(false);
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
    setCategorySheetOpen(false);
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
              Confirm merchant names and categories so future searches, spending summaries, and insights use friendly language.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <StatusBadge label={`${grouped.merchants.length} merchant names`} tone={grouped.merchants.length ? 'warning' : 'neutral'} />
              <StatusBadge label={`${grouped.categories.length} categories`} />
              <StatusBadge label={`${grouped.reprocess.length} reprocess`} />
              <StatusBadge label={`${grouped.resolved.length} resolved`} tone={grouped.resolved.length ? 'positive' : 'neutral'} />
            </View>
          </Panel>

          {(semanticCandidates?.length ?? 0) > 0 ? <Section title="Semantic connections" subtitle="Review the exact entity, relationship, and destination before saving." count={semanticCandidates?.length}>
            {semanticCandidates?.map((candidate: SemanticCandidate) => (
              <SemanticCandidateCard
                key={candidate.id}
                candidate={candidate}
                onKeep={async () => { await client.resolveSemanticCandidate(candidate.id, { action: 'approve', createRule: true }); await refreshSemantic(); }}
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
            <Section title="Decision" subtitle={`Help BrainIA recognize ${selectedLabel}.`}>
              <Panel tone="review" style={{ gap: theme.spacing.md }}>
                <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Should this be the friendly name?</Text>
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  This choice rewrites how BrainIA names the merchant and how it classifies future activity.
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {uniqueSuggestions(selected).map((suggestion) => (
                    <FilterChip key={suggestion} label={suggestion} selected={(friendlyName || selected.alias) === suggestion} onPress={() => setFriendlyName(suggestion)} />
                  ))}
                </View>
                <Input
                  label="Friendly name"
                  value={friendlyName || selected.alias}
                  onChangeText={(value) => {
                    setFriendlyName(value);
                    setSelectedEntityId(null);
                  }}
                  placeholder="Merchant or topic name"
                />
                <Surface variant="subtle" style={{ gap: 8 }}>
                  <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>Same entity matches</Text>
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Select every matching name, then set the friendly name above. BrainIA merges every selected variant into that preferred entity and keeps their aliases and evidence.</Text>
                  {loadingEntitySuggestions ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Checking known entities…</Text> : null}
                  {!loadingEntitySuggestions && entitySuggestions.length === 0 ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>No close matches found.</Text> : null}
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
                    <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Category</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <Text style={[theme.typography.bodyStrong, { color: categoryPath ? theme.colors.textPrimary : theme.colors.textSecondary, flex: 1 }]}>
                        {selectedCategoryLabel}
                      </Text>
                      <Feather name="chevron-down" size={18} color={theme.colors.textMuted} />
                    </View>
                    <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                      Choose an existing category or create a new one.
                    </Text>
                  </Surface>
                </Pressable>
                <Surface variant="raised" style={{ gap: 4, borderColor: theme.status.review + '44' }}>
                  <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Action preview</Text>
                  <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
                    {selectedEntityId ? `This item${equivalentEntityIds.length > 1 ? ` and ${equivalentEntityIds.length - 1} selected match${equivalentEntityIds.length === 2 ? '' : 'es'}` : ''} will become the same entity as ${friendlyName || selected.alias}.` : `Future searches for ${selected.alias} will match ${friendlyName || selected.alias}.`} {categoryPath ? ` It will be grouped under ${categoryPath}.` : ' Pick a category to keep spending summaries consistent.'}
                  </Text>
                </Surface>
                <Surface variant="raised" style={{ gap: 4, borderColor: theme.depth.glow }}>
                  <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>What happens next</Text>
                  <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
                    Accepted changes will help future search results, transaction summaries, and insights use this friendlier label.
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

      <BottomSheet visible={categorySheetOpen} title="Category" onClose={() => setCategorySheetOpen(false)}>
        <CategoryPicker
          categories={categoryOptions}
          selectedCategory={categoryPath}
          onSelect={applyCategory}
          onCreate={(path) => {
            setCustomCategories((current) => uniqueStrings([...current, path], 12));
            applyCategory(path);
          }}
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
  onKeep: () => Promise<void>;
  onSkip: () => Promise<void>;
}) {
  const theme = useTheme();
  const [resolving, setResolving] = useState<'keep' | 'skip' | null>(null);
  const relationLabel = formatRelationLabel(candidate.relationType);
  const confidence = Math.round(candidate.confidence * 100);
  const roleLabel = candidate.anchorRole === 'primary'
    ? 'Primary area'
    : candidate.anchorRole === 'secondary'
      ? 'Secondary area'
      : 'Semantic link';

  async function resolve(action: 'keep' | 'skip') {
    setResolving(action);
    try {
      await (action === 'keep' ? onKeep() : onSkip());
    } finally {
      setResolving(null);
    }
  }

  return (
    <Panel tone="review" style={{ gap: theme.spacing.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <StatusBadge label={`${confidence}% confidence`} tone={confidence >= 85 ? 'positive' : confidence >= 70 ? 'warning' : 'neutral'} />
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

function groupReviews(reviews: ReviewItem[]): Record<ReviewType, ReviewItem[]> {
  const pending = reviews.filter((item) => item.status === 'pending');

  return {
    merchants: pending.filter((item) => !item.categoryPath.length || item.normalizedValue || /merchant|alias|name/i.test(item.reason)),
    categories: pending.filter((item) => item.categoryPath.length > 0),
    merges: pending.filter((item) => /merge|same|duplicate/i.test(item.reason)),
    reprocess: pending.filter((item) => /reprocess|stale|refresh/i.test(item.reason)),
    resolved: reviews.filter((item) => item.status === 'resolved' || item.status === 'ignored'),
  };
}

function emptyCopy(type: ReviewType) {
  switch (type) {
    case 'merges':
      return 'Suggested item merges will appear here when BrainIA finds likely duplicates.';
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
    return `Suggested category: ${item.categoryPath.join(' / ')}.`;
  }

  return 'Confirm whether this should be searchable as a real merchant or topic.';
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

function uniqueStrings(values: string[], limit = 8) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, limit);
}
