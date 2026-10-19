/* eslint-disable react-hooks/refs -- gesture handlers legitimately read the pending-commit ref */
import { Feather } from '@expo/vector-icons';

import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Tag } from '@/components/controls';
import { StateView } from '@/components/data/StateView';
import { BlurTargetView } from 'expo-blur';
import { AmbientBackground } from '@/components/glass/AmbientBackground';
import { useBlurTarget } from '@/lib/blur-target';
import { GlassPressable } from '@/components/glass/GlassPressable';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { DecisionCard } from '@/components/review/DecisionCard';
import { useToast } from '@/components/layout/Toast';
import { useBrainIAClient, useTheme } from '@/lib/app-state';
import { buildReviewQueue, commitDecision, PendingCommitDescriptor, persistReviewSessionState, readReviewSessionState, ReviewAnswer, ReviewDecision } from '@/lib/review-session';
import { formatCurrency } from '@/lib/format';
import { loadReviewBundle } from '@/lib/api';
import { useAsyncResource } from '@/lib/hooks';

type PendingEntry = {
  descriptor: PendingCommitDescriptor;
  decision: ReviewDecision;
  timer: ReturnType<typeof setTimeout> | null;
};

export default function ReviewSessionScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const client = useBrainIAClient();
  const toast = useToast();
  const { topic } = useLocalSearchParams<{ topic?: string }>();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<ReviewAnswer[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [startingAt] = useState(() => Date.now());
  const pending = useRef(new Map<string, PendingEntry>());
  const ambientRef = useRef<View | null>(null);
  const blurTargets = useBlurTarget();

  useEffect(() => {
    if (ambientRef.current) blurTargets?.setCardTarget(ambientRef.current);
  }, [blurTargets]);
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  const loader = useMemo(() => async () => {
    const [bundle, candidates, transactions, categories] = await Promise.all([
      loadReviewBundle(client),
      client.listSemanticCandidates().catch(() => []),
      client.listTransactions(500).catch(() => []),
      client.listFinancialCategories().catch(() => ({ expense: [], income: [] })),
    ]);
    return buildReviewQueue({ reviews: bundle.reviews, candidates, transactions, categories: [...categories.expense, ...categories.income] });
  }, [client]);
  const { data, loading, error, refresh } = useAsyncResource(loader, [loader]);

  const decisions = useMemo(() => (data ?? []).filter((decision) => !topic || decision.topic === topic), [data, topic]);
  const current = decisions[index];
  const next = decisions[index + 1];

  useEffect(() => {
    if (!decisions.length) return;
    void readReviewSessionState().then((stored) => {
      if (!stored || !stored.order.length) return;
      if (stored.order.every((id, position) => decisions[position]?.id === id)) {
        const restored = Math.min(stored.index, decisions.length);
        if (restored >= decisions.length && stored.answers.length) setFinished(true);
        else setIndex(restored);
      }
    });
  }, [decisions]);

  const flush = useCallback(async () => {
    for (const [id, entry] of pending.current) {
      if (entry.timer) clearTimeout(entry.timer);
      try {
        await commitDecision(client, entry.descriptor, entry.decision);
      } catch {
        // Preserve the descriptor for the next launch.
        continue;
      }
      pending.current.delete(id);
    }
  }, [client]);

  const persist = useCallback((nextIndex: number, nextAnswers: ReviewAnswer[], nextSkipped: string[]) => {
    void persistReviewSessionState({
      order: decisions.map((decision) => decision.id),
      index: nextIndex,
      answers: nextAnswers,
      skipped: nextSkipped,
      pending: [...pending.current.values()].map((entry) => entry.descriptor),
      startedAt: startingAt,
    });
  }, [decisions, startingAt]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void flush();
    });
    return () => {
      subscription.remove();
      void flush();
    };
  }, [flush]);

  const finish = useCallback(async () => {
    await flush();
    setFinished(true);
    void persistReviewSessionState({ order: [], index: 0, answers: [], skipped: [], pending: [], startedAt: startingAt });
  }, [flush, startingAt]);

  const answer = useCallback(async (decision: ReviewDecision, choice: ReviewAnswer['choice'], value?: string, rule?: boolean) => {
    if (choice === 'accept') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else void Haptics.selectionAsync();

    const nextAnswers = [...answers, { id: decision.id, choice, value, rule, at: Date.now() }];
    const nextSkipped = choice === 'skip' ? [...new Set([...skipped, decision.id])] : skipped;
    const nextIndex = index + 1;

    if (choice !== 'skip') {
      const id = `${decision.id}:${Date.now()}`;
      const descriptor: PendingCommitDescriptor = {
        id,
        decisionId: decision.id,
        choice,
        value,
        rule,
        reviewIds: decision.reviewIds,
        candidateId: decision.candidateId,
        categoryPath: decision.categoryPath,
        targetEntityId: decision.targetEntityId,
      };
      const entry: PendingEntry = {
        descriptor,
        decision,
        timer: setTimeout(() => {
          void commitDecision(client, descriptor, decision).then(() => {
            const existing = pending.current.get(id);
            if (existing?.timer) clearTimeout(existing.timer);
            pending.current.delete(id);
          }).catch(() => {
            toast.show('Could not save that answer. It will retry when you leave review.', { tone: 'danger' });
          });
        }, 5_000),
      };
      pending.current.set(id, entry);

      toast.show(choice === 'accept' ? 'Saved · Undo for 5 seconds' : 'Saved · Undo for 5 seconds', {
        tone: 'positive',
        action: {
          label: 'Undo',
          onPress: () => {
            const pendingEntry = pending.current.get(id);
            if (pendingEntry?.timer) clearTimeout(pendingEntry.timer);
            pending.current.delete(id);
            setAnswers((currentAnswers) => currentAnswers.filter((answerEntry) => answerEntry.id !== decision.id));
            setSkipped((currentSkipped) => currentSkipped.filter((skippedId) => skippedId !== decision.id));
            setIndex((currentIndex) => Math.max(0, currentIndex - 1));
          },
        },
      });
    } else {
      toast.show('Skipped · kept for later', { tone: 'neutral' });
    }

    setAnswers(nextAnswers);
    setSkipped(nextSkipped);
    setWhyOpen(false);
    x.set(0);
    y.set(0);

    if (nextIndex >= decisions.length) {
      setIndex(nextIndex);
      await finish();
      return;
    }
    setIndex(nextIndex);
    persist(nextIndex, nextAnswers, nextSkipped);
  }, [answers, client, decisions.length, finish, index, persist, skipped, toast, x, y]);

  const undoLast = useCallback(() => {
    const last = answers[answers.length - 1];
    if (!last) return;
    for (const [id, entry] of pending.current) {
      if (entry.descriptor.decisionId === last.id) {
        if (entry.timer) clearTimeout(entry.timer);
        pending.current.delete(id);
      }
    }
    const nextAnswers = answers.slice(0, -1);
    setAnswers(nextAnswers);
    setSkipped((current) => current.filter((id) => id !== last.id));
    setIndex((current) => Math.max(0, current - 1));
    toast.show('Undone', { tone: 'neutral' });
  }, [answers, toast]);

  const close = useCallback(async () => {
    await flush();
    if (router.canGoBack()) router.back();
    else router.replace('/review');
  }, [flush]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!current) return;
      if (event.key === 'ArrowRight' || event.key === 'Enter') {
        event.preventDefault();
        void answer(current, 'accept');
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        void answer(current, 'skip');
      } else if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        undoLast();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        void close();
      } else if (['1', '2', '3'].includes(event.key) && (current.kind === 'category' || current.kind === 'label')) {
        event.preventDefault();
        const option = current.alternatives[Number(event.key) - 1];
        if (option) void answer(current, 'accept', option);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [answer, close, current, undoLast]);

  const exitDuration = theme.motion.duration.quick;
  const settleSpring = theme.motion.spring.thumb;
  const pan = Gesture.Pan()
    .activeOffsetX([-16, 16])
    .onUpdate((event) => {
      x.set(event.translationX);
      y.set(event.translationY * 0.15);
    })
    .onEnd((event) => {
      const threshold = width * 0.3;
      if (x.value > threshold || event.velocityX > 800) {
        x.set(withTiming(width * 1.2, { duration: exitDuration }));
        runOnJS(answer)(current, 'accept');
      } else if (x.value < -threshold || event.velocityX < -800) {
        x.set(withTiming(-width * 1.2, { duration: exitDuration }));
        runOnJS(answer)(current, 'skip');
      } else {
        x.set(withSpring(0, settleSpring));
        y.set(withSpring(0, settleSpring));
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${x.value / 18}deg` },
    ],
  }));
  const acceptStamp = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [20, 90], [0, 1], 'clamp') }));
  const skipStamp = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [-90, -20], [1, 0], 'clamp') }));

  const progress = decisions.length ? answers.length / decisions.length : 0;
  const tidyCount = answers.filter((entry) => entry.choice === 'accept').reduce((sum, entry) => {
    const decision = decisions.find((item) => item.id === entry.id);
    return sum + (decision?.impact.transactions ?? 0);
  }, 0);
  const rules = answers.filter((entry) => entry.rule).length;

  if (finished) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]}>
        <BlurTargetView ref={ambientRef} style={StyleSheet.absoluteFill}>
          <AmbientBackground />
        </BlurTargetView>
        <View style={[styles.summaryWrap, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}>
          <StateView
            kind="success"
            title={skipped.length ? 'Nice work' : 'All clear'}
            description={`${answers.filter((entry) => entry.choice === 'accept').length} answered · ${skipped.length} kept for later${tidyCount ? ` · ${tidyCount} transactions tidied` : ''}${rules ? ` · ${rules} rule${rules === 1 ? '' : 's'} created` : ''}.`}
            actionLabel="Done"
            onAction={() => void close()}
            secondaryActionLabel={skipped.length ? 'Review skipped' : undefined}
            onSecondaryAction={skipped.length ? () => {
              const firstSkipped = decisions.findIndex((decision) => skipped.includes(decision.id));
              setFinished(false);
              setIndex(Math.max(0, firstSkipped));
            } : undefined}
          />
          <GlassSurface level="thin" padding="md" contentStyle={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{`${skipped.length} skipped · progress saved`}</Text>
            <Tag label="No confirm dialogs" tone="positive" icon="check" />
          </GlassSurface>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <BlurTargetView ref={ambientRef} style={StyleSheet.absoluteFill}>
        <AmbientBackground />
      </BlurTargetView>
      <View style={{ flex: 1, paddingTop: insets.top ? 6 : 0 }}>
        <View style={styles.header}>
          <GlassPressable accessibilityRole="button" accessibilityLabel={`Close review, ${Math.max(0, decisions.length - index)} left`} onPress={() => { void close(); }} hitSlop={10} scaleTo={0.9} style={styles.iconButton}>
            <Feather name="x" size={19} color={theme.colors.textPrimary} />
          </GlassPressable>
          <View style={{ flex: 1, gap: 6 }}>
            <View style={styles.progressRow} accessibilityLabel={`Review progress, ${answers.length} of ${decisions.length}`}>
              {decisions.map((decision, position) => (
                <View key={decision.id} style={[styles.progressSegment, { backgroundColor: position < index ? theme.colors.accent : theme.glass.divider }]} />
              ))}
            </View>
            <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{`${Math.max(0, decisions.length - index)} left · ${Math.round(progress * 100)}%`}</Text>
          </View>
          <GlassPressable accessibilityRole="button" accessibilityLabel="Undo last answer" onPress={undoLast} hitSlop={10} scaleTo={0.9} style={styles.iconButton} disabled={!answers.length}>
            <Feather name="rotate-ccw" size={17} color={answers.length ? theme.colors.textPrimary : theme.colors.textMuted} />
          </GlassPressable>
        </View>

        {loading || !current ? (
          error ? <StateView kind="error" title="Review could not load" description={error} actionLabel="Retry" onAction={refresh} /> : <StateView kind="loading" title="Loading" skeleton="hero" skeletonCount={1} />
        ) : (
          <View style={styles.cardStage}>
          <View style={[styles.cardArea, { maxHeight: theme.layout.reviewCardMax }]}>
            {next ? (
              <View pointerEvents="none" style={[styles.cardLayer, { transform: [{ scale: 0.96 }, { translateY: 10 }], opacity: 0.5 }]}>
                <DecisionCard decision={next} variant="compact" />
              </View>
            ) : null}
            <GestureDetector gesture={pan}>
              <Animated.View style={[styles.cardLayer, cardStyle]}>
                <Animated.View pointerEvents="none" style={[styles.stamp, styles.acceptStamp, { borderColor: `${theme.colors.accent}B3` }, acceptStamp]}>
                  <Text style={[theme.typography.headline, { color: theme.colors.accent }]}>ACCEPT</Text>
                </Animated.View>
                <Animated.View pointerEvents="none" style={[styles.stamp, styles.skipStamp, { borderColor: `${theme.colors.danger}B3` }, skipStamp]}>
                  <Text style={[theme.typography.headline, { color: theme.colors.danger }]}>SKIP</Text>
                </Animated.View>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
                  <DecisionCard
                    decision={current}
                    whyOpen={whyOpen}
                    onWhy={() => setWhyOpen((value) => !value)}
                    onAnswer={(choice, value, rule) => void answer(current, choice, value, rule)}
                    onSkip={() => void answer(current, 'skip')}
                  />
                </ScrollView>
              </Animated.View>
            </GestureDetector>
          </View>
          </View>
        )}

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, textAlign: 'center' }]}>Swipe right to accept · left to skip · every gesture has a button</Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textMuted, textAlign: 'center' }]}>{`About ${formatCurrency(decisions.slice(index).reduce((sum, decision) => sum + decision.impact.amount, 0), 'UYU')} in movement to tidy`}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    gap: 3,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  cardStage: {
    flex: 1,
    justifyContent: 'center',
  },
  cardArea: {
    flex: 1,
    marginHorizontal: 16,
    marginTop: 8,
  },
  cardLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  stamp: {
    position: 'absolute',
    top: 20,
    zIndex: 5,
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    transform: [{ rotate: '-12deg' }],
  },
  acceptStamp: {
    left: 18,
  },
  skipStamp: {
    right: 18,
    transform: [{ rotate: '12deg' }],
  },
  footer: {
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  summaryWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 14,
  },
});
