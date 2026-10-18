import { Feather } from '@expo/vector-icons';
import { ReactNode, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable, Surface } from '@/components/primitives';
import { useTheme } from '@/lib/app-state';
import { ProvenanceOrigin } from '@/lib/domain';
import { cleanDisplayText, FIXED_FX_LABEL, formatCurrency, parseCurrency } from '@/lib/format';

const provenanceLabels: Record<ProvenanceOrigin, string> = {
  model: 'IA',
  captured: 'Capturado',
  user: 'You',
  pending: 'Unresolved',
};

const provenanceIcons: Record<ProvenanceOrigin, keyof typeof Feather.glyphMap> = {
  model: 'cpu',
  captured: 'inbox',
  user: 'user',
  pending: 'alert-circle',
};

export function ProvenanceMark({ origin, label, onPress }: { origin: ProvenanceOrigin; label?: string; onPress?: () => void }) {
  const theme = useTheme();
  const color = theme.colors[origin];
  const content = (
    <View style={[styles.provenance, { borderColor: `${color}66`, backgroundColor: `${color}12` }]}>
      <Feather name={provenanceIcons[origin]} size={11} color={color} />
      <Text style={[theme.typography.mono, { color }]}>{cleanDisplayText(label ?? provenanceLabels[origin])}</Text>
    </View>
  );

  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={`${label ?? provenanceLabels[origin]} provenance`} onPress={onPress}>{content}</Pressable> : content;
}

export function ConfidenceTier({ confidence, showValue = false }: { confidence?: number; showValue?: boolean }) {
  const theme = useTheme();
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) return null;
  const normalized = Math.max(0, Math.min(1, confidence));
  const tier = normalized >= 0.85 ? 'Clear' : normalized >= 0.5 ? 'Unsure' : 'Guess';
  const color = normalized >= 0.85 ? theme.colors.success : normalized >= 0.5 ? theme.colors.warning : theme.colors.danger;

  return (
    <View accessibilityLabel={`${tier} confidence${showValue ? `, ${Math.round(normalized * 100)} percent` : ''}`} style={styles.confidence}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[theme.typography.caption, { color }]}>{tier}{showValue ? ` · ${Math.round(normalized * 100)}%` : ''}</Text>
    </View>
  );
}

export function MoneyAmount({ amount, currency, tone = 'neutral', compact = false }: { amount: string | number; currency: string; tone?: 'neutral' | 'income' | 'expense'; compact?: boolean }) {
  const theme = useTheme();
  const numeric = typeof amount === 'number' ? amount : parseCurrency(amount);
  const color = tone === 'income' ? theme.status.income : tone === 'expense' ? theme.status.expense : theme.colors.textPrimary;
  const formatted = formatCurrency(Math.abs(numeric), currency.toUpperCase());
  const unsigned = formatted.replace(/^[-+]/, '');
  const sign = numeric < 0 || tone === 'expense' ? '−' : tone === 'income' ? '+' : '';

  return (
    <View style={styles.moneyRow} accessibilityLabel={`${sign}${unsigned}`}>
      <Text style={[compact ? theme.typography.bodyStrong : theme.typography.numeral, { color }]}>{sign}{unsigned}</Text>
      <Text style={[theme.typography.mono, { color: theme.colors.textMuted }]}>{currency.toUpperCase()}</Text>
    </View>
  );
}

export function FxStamp({ onPress }: { onPress?: () => void }) {
  const theme = useTheme();
  const content = (
    <View style={[styles.fxStamp, { borderColor: theme.colors.border }]}>
      <Feather name="repeat" size={11} color={theme.colors.textMuted} />
      <Text style={[theme.typography.mono, { color: theme.colors.textMuted }]}>{FIXED_FX_LABEL}</Text>
    </View>
  );
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel="Ver explicación del tipo de cambio" onPress={onPress}>{content}</Pressable> : content;
}

export function GeneratedTextBlock({ title = 'Resumen generado', body, confidence, origin = 'model', children }: { title?: string; body: string; confidence?: number; origin?: ProvenanceOrigin; children?: ReactNode }) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const text = cleanDisplayText(body);
  if (!text) return null;

  return (
    <Surface variant="subtle" style={[styles.generated, { borderLeftColor: theme.colors[origin] }]}>
      <View style={styles.between}>
        <ProvenanceMark origin={origin} label={title} />
        <ConfidenceTier confidence={confidence} />
      </View>
      <Text numberOfLines={expanded ? undefined : 4} style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{text}</Text>
      {children}
      <AnimatedPressable accessibilityRole="button" accessibilityLabel={expanded ? 'Show less' : 'Read full generated text'} onPress={() => setExpanded((value) => !value)} style={styles.readMore}>
        <Text style={[theme.typography.caption, { color: theme.colors.model }]}>{expanded ? 'Show less' : 'Read full text'}</Text>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={theme.colors.model} />
      </AnimatedPressable>
    </Surface>
  );
}

export type EvidenceTrailItem = {
  id: string;
  title: string;
  subtitle?: string;
  detail?: string;
  origin?: Exclude<ProvenanceOrigin, 'model'>;
  onPress?: () => void;
};

export function EvidenceTrail({ items, emptyLabel = 'No supporting evidence is available.' }: { items: EvidenceTrailItem[]; emptyLabel?: string }) {
  const theme = useTheme();
  if (!items.length) return <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{emptyLabel}</Text>;

  return (
    <View style={styles.trail}>
      {items.map((item, index) => {
        const content = (
          <View style={[styles.trailRow, index < items.length - 1 && { borderBottomColor: theme.colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
            <View style={[styles.trailNode, { borderColor: theme.colors.captured }]} />
            <View style={styles.trailContent}>
              <View style={styles.between}>
                <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary, flex: 1 }]}>{cleanDisplayText(item.title)}</Text>
                <ProvenanceMark origin={item.origin ?? 'captured'} />
              </View>
              {item.subtitle ? <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{cleanDisplayText(item.subtitle)}</Text> : null}
              {item.detail ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{cleanDisplayText(item.detail)}</Text> : null}
            </View>
            {item.onPress ? <Feather name="chevron-right" size={16} color={theme.colors.textMuted} /> : null}
          </View>
        );
        return item.onPress ? <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.title} onPress={item.onPress}>{content}</Pressable> : <View key={item.id}>{content}</View>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  provenance: { alignSelf: 'flex-start', minHeight: 25, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 4 },
  confidence: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  moneyRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end', gap: 7 },
  fxStamp: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 7 },
  generated: { gap: 10, borderLeftWidth: 2 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  readMore: { minHeight: 36, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5 },
  trail: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  trailRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  trailNode: { width: 9, height: 9, borderRadius: 5, borderWidth: 2 },
  trailContent: { flex: 1, gap: 3 },
});
