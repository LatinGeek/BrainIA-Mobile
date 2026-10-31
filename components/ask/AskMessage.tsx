import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { Button, Tag } from '@/components/controls';
import { MixCard, type MixSegment } from '@/components/data/MixCard';
import { IconTile, Row } from '@/components/data/Row';
import { TrendChart } from '@/components/data/TrendChart';
import { GlassPressable } from '@/components/glass/GlassPressable';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { useTheme } from '@/lib/app-state';
import { amountNumber, type AskBreakdownCard, type AskCard, type AskSource, type AskStage, type AskTotalsCard, type AskTransactionsCard } from '@/lib/ask';
import { formatCurrency } from '@/lib/format';
import { useReduceMotion } from '@/lib/hooks';
import type { AskAssistantMessage, AskUserMessage } from '@/lib/use-ask-chat';

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** YYYY-MM-DD as a local calendar date (never shifted by the device time zone). */
function shortDate(value: string | null) {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month) return value;
  return new Intl.DateTimeFormat('es-UY', { day: day ? '2-digit' : undefined, month: 'short', ...(day ? {} : { year: 'numeric' }) })
    .format(new Date(year, month - 1, day || 1)).replace('.', '').replace(/-/g, ' ');
}

function money(value: string, currency: string) {
  return formatCurrency(amountNumber(value), currency);
}

const sourceIcons: Record<AskSource['kind'], React.ComponentProps<typeof Feather>['name']> = {
  calculation: 'hash',
  transaction: 'credit-card',
  event: 'file-text',
  entity: 'circle',
};

function openRoute(route: AskSource['route']) {
  if (route) router.push(route as never);
}

// ---------------------------------------------------------------------------
// User bubble
// ---------------------------------------------------------------------------

export function UserBubble({ message }: { message: AskUserMessage }) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <View
        accessibilityRole="text"
        accessibilityLabel={`Tu pregunta: ${message.text}`}
        style={[styles.userBubble, {
          backgroundColor: theme.colors.accentSoft,
          borderColor: `${theme.colors.accent}38`,
          borderRadius: theme.radius.lg,
          borderBottomRightRadius: theme.radius.sm / 2,
        }]}
      >
        <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>{message.text}</Text>
        {message.via === 'voice' ? (
          <View style={styles.voiceStamp}>
            <Feather name="mic" size={10} color={theme.colors.textMuted} />
            <Text style={[theme.typography.mono, { color: theme.colors.textMuted, fontSize: 9 }]}>VOZ</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Progress while BrainIA works
// ---------------------------------------------------------------------------

const stages: { key: AskStage; label: string }[] = [
  { key: 'understanding', label: 'Entendiendo' },
  { key: 'retrieving', label: 'Buscando en tus datos' },
  { key: 'answering', label: 'Redactando' },
];

function PulseDot({ active, done }: { active: boolean; done: boolean }) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (active && !reduceMotion) {
      opacity.value = withRepeat(withSequence(withTiming(0.35, { duration: 520 }), withTiming(1, { duration: 520 })), -1);
    } else {
      cancelAnimation(opacity);
      opacity.value = 1;
    }
  }, [active, opacity, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const color = done ? theme.colors.model : active ? theme.colors.accent : theme.glass.divider;
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

export function AskProgress({ stage, planLabel }: { stage: AskStage; planLabel?: string | null }) {
  const theme = useTheme();
  const current = stages.findIndex((item) => item.key === stage);
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={`${stages[current]?.label ?? 'Pensando'}…`} style={{ gap: 8 }}>
      <View style={styles.stageRow}>
        {stages.map((item, index) => (
          <View key={item.key} style={styles.stageItem}>
            <PulseDot active={index === current} done={index < current} />
            <Text style={[theme.typography.caption, { color: index === current ? theme.colors.textPrimary : theme.colors.textMuted }]}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>
      {planLabel ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{planLabel}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Answer text with tappable citations
// ---------------------------------------------------------------------------

function AnswerText({ text, sources, streaming, onCitation }: {
  text: string; sources: AskSource[]; streaming: boolean; onCitation: (source: AskSource) => void;
}) {
  const theme = useTheme();
  const lines = text.split('\n').map((line) => line.trimEnd()).filter((line, index, all) => line || (index > 0 && all[index - 1]));
  const renderInline = (line: string, key: string) => line.split(/(\[S\d+\])/g).map((part, index) => {
    const match = part.match(/^\[S(\d+)\]$/);
    if (!match) return <Text key={`${key}-${index}`}>{part}</Text>;
    const source = sources.find((item) => item.id === `S${match[1]}`);
    if (!source) return null; // a partial marker while streaming
    return (
      <Text
        key={`${key}-${index}`}
        accessibilityRole="link"
        accessibilityLabel={`Fuente ${match[1]}: ${source.title}`}
        onPress={() => onCitation(source)}
        suppressHighlighting={false}
        style={[theme.typography.mono, { color: theme.colors.model, backgroundColor: `${theme.colors.model}1F`, fontSize: 10 }]}
      >
        {` ${match[1]} `}
      </Text>
    );
  });
  return (
    <View style={{ gap: 6 }}>
      {lines.map((line, index) => {
        const bullet = /^\s*[-•]\s+/.test(line);
        const content = renderInline(line.replace(/^\s*[-•]\s+/, ''), `l${index}`);
        const isLast = index === lines.length - 1;
        return (
          <View key={index} style={bullet ? styles.bulletRow : undefined}>
            {bullet ? <View style={[styles.bullet, { backgroundColor: theme.colors.model }]} /> : null}
            <Text selectable style={[theme.typography.body, { color: theme.colors.textPrimary, flex: bullet ? 1 : undefined, lineHeight: 23 }]}>
              {content}
              {streaming && isLast ? <Text style={{ color: theme.colors.accent }}> ▍</Text> : null}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Deterministic data cards
// ---------------------------------------------------------------------------

function ProvenanceHeader({ overline }: { overline: string }) {
  const theme = useTheme();
  return (
    <View style={styles.cardHeader}>
      <Text numberOfLines={1} style={[theme.typography.overline, { color: theme.colors.textMuted, flex: 1 }]}>{overline}</Text>
      <Tag label="Calculado" kind="provenance" icon="database" tone="neutral" />
    </View>
  );
}

function TotalsCard({ card }: { card: AskTotalsCard }) {
  const theme = useTheme();
  const focus = card.kind === 'income' ? 'income' : 'expense';
  const label = card.kind === 'income' ? 'Ingresos' : card.kind === 'all' ? 'Gastos' : 'Gastado';
  if (!card.rows.length) {
    return (
      <GlassSurface level="regular" tone="finance" padding="md" contentStyle={{ gap: 6 }}>
        <ProvenanceHeader overline={`${label} · ${card.period.label}`} />
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>No hay movimientos confirmados en este período{card.filtersLabel ? ` para ${card.filtersLabel}` : ''}.</Text>
      </GlassSurface>
    );
  }
  return (
    <GlassSurface level="regular" tone="finance" padding="md" contentStyle={{ gap: 12 }}>
      <ProvenanceHeader overline={`${label} · ${card.period.label}`} />
      {card.rows.map((row, index) => {
        const up = (row.changePct ?? 0) > 0;
        // For spending, going up is the warning direction; for income it is good.
        const good = focus === 'income' ? up : !up;
        return (
          <View key={row.currency} style={{ gap: 4 }}>
            <Text
              accessibilityLabel={`${label}: ${money(row[focus], row.currency)}`}
              style={[theme.typography.numeral, { color: theme.colors.textPrimary, fontSize: index === 0 ? 34 : 22, lineHeight: index === 0 ? 40 : 28 }]}
            >
              {money(row[focus], row.currency)}
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
              {row.count} {row.count === 1 ? 'movimiento' : 'movimientos'}
              {card.kind === 'all' ? ` · ingresos ${money(row.income, row.currency)} · neto ${money(row.net, row.currency)}` : ''}
            </Text>
            {row.previous && row.changePct !== null ? (
              <Text style={[theme.typography.caption, { color: row.changePct === 0 ? theme.colors.textMuted : good ? theme.status.income : theme.status.expense }]}>
                {row.changePct === 0 ? '=' : up ? '↑' : '↓'} {Math.abs(row.changePct).toFixed(1).replace('.', ',')}% vs {row.previous.label} ({money(row.previous[focus], row.currency)})
              </Text>
            ) : row.previous ? (
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Sin movimientos en {row.previous.label} para comparar.</Text>
            ) : null}
          </View>
        );
      })}
      {card.filtersLabel || card.excludedCount ? (
        <View style={[styles.cardFooter, { borderTopColor: theme.glass.divider }]}>
          {card.filtersLabel ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{card.filtersLabel}</Text> : null}
          {card.excludedCount ? (
            <Text style={[theme.typography.caption, { color: theme.colors.warning }]}>
              {card.excludedCount} {card.excludedCount === 1 ? 'movimiento queda' : 'movimientos quedan'} fuera por monto o moneda sin confirmar.
            </Text>
          ) : null}
        </View>
      ) : null}
    </GlassSurface>
  );
}

function BreakdownCard({ card }: { card: AskBreakdownCard }) {
  const theme = useTheme();
  const chronological = card.groupBy === 'month' || card.groupBy === 'week' || card.groupBy === 'day';
  const noun = card.kind === 'income' ? 'de los ingresos' : 'del gasto';
  const title = { category: 'Por categoría', merchant: 'Por comercio', account: 'Por cuenta', month: 'Por mes', week: 'Por semana', day: 'Por día' }[card.groupBy];
  if (chronological) {
    return (
      <GlassSurface level="regular" padding="md" contentStyle={{ gap: 8 }}>
        <ProvenanceHeader overline={`${title} · ${card.currency}`} />
        <TrendChart
          mode="bars"
          labels={card.items.map((item) => card.groupBy === 'month' ? shortDate(item.label) : shortDate(item.label))}
          series={[{ label: card.kind === 'income' ? 'Ingresos' : 'Gastos', color: card.kind === 'income' ? theme.status.income : theme.status.expense, data: card.items.map((item) => amountNumber(item.amount)) }]}
          formatValue={(value) => formatCurrency(value, card.currency)}
          height={160}
        />
      </GlassSurface>
    );
  }
  const segments: MixSegment[] = card.items.map((item, index) => ({
    id: `${card.currency}:${item.label}`, label: item.label, value: amountNumber(item.amount), color: theme.colors.chart[index % theme.colors.chart.length],
  }));
  return (
    <MixCard
      overline={`Calculado · ${card.period.label}`}
      title={title}
      segments={segments}
      centerValue={money(card.total, card.currency)}
      centerAmount={amountNumber(card.total)}
      currency={card.currency}
      centerLabel={card.kind === 'income' ? 'Ingresos' : 'Gasto total'}
      formatValue={(value) => formatCurrency(value, card.currency)}
      percentageNoun={noun}
    />
  );
}

function TransactionsCard({ card }: { card: AskTransactionsCard }) {
  const theme = useTheme();
  return (
    <GlassSurface level="thin" padding="none" contentStyle={{ paddingVertical: 4 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <ProvenanceHeader overline={card.title} />
      </View>
      {card.items.map((item) => (
        <Row
          key={item.id}
          title={item.title}
          subtitle={[shortDate(item.date), item.category, item.account].filter(Boolean).join(' · ')}
          leading={<IconTile size="sm" icon={item.kind === 'income' ? 'arrow-down-left' : 'arrow-up-right'} color={item.kind === 'income' ? theme.status.income : theme.status.expense} />}
          trailing={<Text style={[theme.typography.bodyStrong, { color: item.kind === 'income' ? theme.status.income : theme.colors.textPrimary, fontVariant: ['tabular-nums'] }]}>{item.kind === 'income' ? '+' : '−'}{money(item.amount, item.currency)}</Text>}
          onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: item.id, label: item.title } } as never)}
          titleLines={1}
        />
      ))}
    </GlassSurface>
  );
}

export function AskCards({ cards }: { cards: AskCard[] }) {
  if (!cards.length) return null;
  return (
    <View style={{ gap: 10 }}>
      {cards.map((card, index) => card.type === 'totals'
        ? <TotalsCard key={index} card={card} />
        : card.type === 'breakdown'
          ? <BreakdownCard key={index} card={card} />
          : <TransactionsCard key={index} card={card} />)}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sources rail
// ---------------------------------------------------------------------------

function SourceChip({ source, highlighted }: { source: AskSource; highlighted: boolean }) {
  const theme = useTheme();
  // A calculation's period is already in its title; a date would only repeat it.
  const subtitle = [source.kind === 'calculation' ? null : shortDate(source.date), source.subtitle].filter(Boolean).join(' · ');
  return (
    <GlassPressable
      accessibilityRole={source.route ? 'link' : 'text'}
      accessibilityLabel={`Fuente ${source.id.slice(1)}: ${source.title}`}
      disabled={!source.route}
      onPress={() => openRoute(source.route)}
      scaleTo={0.97}
      haptic="selection"
    >
      <GlassSurface
        level="thin"
        padding="sm"
        radius="md"
        style={[styles.sourceCard, highlighted ? { borderColor: theme.colors.model, borderWidth: 1 } : null]}
        contentStyle={{ gap: 4 }}
      >
        <View style={styles.sourceTop}>
          <Text style={[theme.typography.mono, { color: theme.colors.model }]}>{source.id.slice(1)}</Text>
          <Feather name={sourceIcons[source.kind]} size={12} color={theme.colors.textMuted} />
          {source.amount ? (
            <Text numberOfLines={1} style={[theme.typography.caption, { color: theme.colors.textSecondary, marginLeft: 'auto', fontVariant: ['tabular-nums'] }]}>
              {money(source.amount.value, source.amount.currency)}
            </Text>
          ) : null}
        </View>
        <Text numberOfLines={2} style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary, fontSize: 13, lineHeight: 18 }]}>{source.title}</Text>
        {subtitle ? <Text numberOfLines={1} style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{subtitle}</Text> : null}
      </GlassSurface>
    </GlassPressable>
  );
}

function SourcesRail({ sources, citations, highlighted }: { sources: AskSource[]; citations: string[]; highlighted: string | null }) {
  const theme = useTheme();
  // Cited sources first, in citation order; the rest after.
  const ordered = useMemo(() => {
    const cited = citations.map((id) => sources.find((source) => source.id === id)).filter((source): source is AskSource => Boolean(source));
    return [...cited, ...sources.filter((source) => !citations.includes(source.id))];
  }, [citations, sources]);
  if (!ordered.length) return null;
  return (
    <View style={{ gap: 8 }}>
      <Text style={[theme.typography.overline, { color: theme.colors.textMuted }]}>
        Fuentes · {citations.length ? `${citations.length} citadas de ${sources.length}` : sources.length}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
        {ordered.map((source) => <SourceChip key={source.id} source={source} highlighted={highlighted === source.id} />)}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Assistant message
// ---------------------------------------------------------------------------

export function AssistantMessage({ message, onRetry, onFeedback, highlighted, onCitation }: {
  message: AskAssistantMessage;
  onRetry: () => void;
  onFeedback: (value: 'useful' | 'incorrect') => void;
  highlighted: string | null;
  onCitation: (source: AskSource) => void;
}) {
  const theme = useTheme();
  const working = message.status === 'pending' || (message.status === 'streaming' && !message.text);
  const streaming = message.status === 'streaming';
  const period = message.plan?.period;
  const planLabel = period ? `${period.assumed ? 'Período supuesto: ' : 'Período: '}${period.label}` : null;

  return (
    <View style={{ gap: 12 }} accessibilityLiveRegion={message.status === 'done' ? 'polite' : 'none'}>
      <View style={styles.assistantHeader}>
        <View style={[styles.orb, { backgroundColor: `${theme.colors.model}1F`, borderColor: `${theme.colors.model}55` }]}>
          <Feather name="cpu" size={12} color={theme.colors.model} />
        </View>
        <Text style={[theme.typography.overline, { color: theme.colors.model }]}>BrainIA</Text>
        {period && !working ? <Tag label={period.label} tone={period.assumed ? 'warning' : 'info'} icon="calendar" /> : null}
      </View>

      {working ? <AskProgress stage={message.stage} planLabel={planLabel} /> : null}

      {message.status === 'error' ? (
        <GlassSurface level="thin" tone="danger" padding="md" contentStyle={{ gap: 10 }}>
          <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>{message.error}</Text>
          <Button label="Reintentar" variant="secondary" size="sm" icon={<Feather name="rotate-ccw" size={14} color={theme.colors.textPrimary} />} onPress={onRetry} />
        </GlassSurface>
      ) : null}

      {/* Calculated figures land first and do not move while the narrative streams below them. */}
      <AskCards cards={message.cards} />

      {message.text ? (
        <AnswerText text={message.text} sources={message.sources} streaming={streaming} onCitation={onCitation} />
      ) : null}

      {message.status === 'cancelled' ? (
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Detenido. {message.text ? 'La respuesta quedó incompleta.' : ''}</Text>
      ) : null}

      {message.status === 'done' || message.status === 'cancelled' ? (
        <SourcesRail sources={message.sources} citations={message.citations} highlighted={highlighted} />
      ) : null}

      {message.status === 'done' ? (
        <View style={styles.footer}>
          {message.grounding?.status === 'verified' ? (
            <View style={styles.footerNote}>
              <Feather name="check-circle" size={13} color={theme.colors.success} />
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Cifras verificadas con tus datos</Text>
            </View>
          ) : message.grounding?.status === 'unverified' ? (
            <View style={styles.footerNote}>
              <Feather name="alert-triangle" size={13} color={theme.colors.warning} />
              <Text style={[theme.typography.caption, { color: theme.colors.warning, flex: 1 }]}>
                No encontré {message.grounding.unverified.join(', ')} en tus datos. Revisa las fuentes.
              </Text>
            </View>
          ) : <View style={{ flex: 1 }} />}
          <View style={styles.feedback}>
            {(['useful', 'incorrect'] as const).map((value) => (
              <GlassPressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={value === 'useful' ? 'Respuesta útil' : 'Respuesta incorrecta'}
                accessibilityState={{ selected: message.feedback === value }}
                onPress={() => onFeedback(value)}
                haptic="selection"
                scaleTo={0.9}
                hitSlop={8}
                style={[styles.feedbackButton, { backgroundColor: message.feedback === value ? theme.colors.accentSoft : 'transparent' }]}
              >
                <Feather name={value === 'useful' ? 'thumbs-up' : 'thumbs-down'} size={14} color={message.feedback === value ? theme.colors.accent : theme.colors.textMuted} />
              </GlassPressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  userBubble: { maxWidth: '86%', paddingHorizontal: 14, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, gap: 4 },
  voiceStamp: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
  stageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  stageItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  bulletRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bullet: { width: 5, height: 5, borderRadius: 3, marginTop: 9 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardFooter: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 4 },
  sourceCard: { width: 196, minHeight: 92 },
  sourceTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  assistantHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orb: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  footerNote: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  feedback: { flexDirection: 'row', gap: 4 },
  feedbackButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
