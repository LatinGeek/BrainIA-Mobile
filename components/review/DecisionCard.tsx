import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Chip, ConfidenceMeter, Field, Tag } from '@/components/controls';
import { IconTile } from '@/components/data/Row';
import { GlassPressable } from '@/components/glass/GlassPressable';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { useTheme } from '@/lib/app-state';
import { cleanDisplayText, formatCurrency } from '@/lib/format';
import { describeDecision, ReviewDecision } from '@/lib/review-session';

export function DecisionCard({
  decision,
  onAnswer,
  onSkip,
  onWhy,
  whyOpen = false,
  variant = 'full',
}: {
  decision: ReviewDecision;
  onAnswer?: (choice: 'accept' | 'skip' | 'different' | 'no', value?: string, rule?: boolean) => void;
  onSkip?: () => void;
  onWhy?: () => void;
  whyOpen?: boolean;
  variant?: 'full' | 'compact';
}) {
  const theme = useTheme();
  const [customValue, setCustomValue] = useState('');
  const [createRule, setCreateRule] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const impact = decision.impact.transactions > 0
    ? `Ordena ${decision.impact.transactions} ${decision.impact.transactions === 1 ? 'movimiento' : 'movimientos'}${decision.impact.amount ? ` · ${formatCurrency(decision.impact.amount, decision.impact.currency)}` : ''}`
    : 'Sin movimientos coincidentes en el ciclo guardado';

  return (
    <GlassSurface level="strong" tone={decision.kind === 'relation' ? 'model' : 'review'} padding="lg" style={{ flex: 1 }} contentStyle={{ gap: 14, flexGrow: 1 }}>
      <View style={[styles.header, { flexWrap: 'wrap' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
          <Tag label={kindLabel(decision.kind)} tone="warning" />
          <ConfidenceMeter value={decision.confidence} showValue />
        </View>
        <Text numberOfLines={2} style={[theme.typography.overline, { color: theme.colors.textMuted, flexShrink: 1, textAlign: 'right' }]}>{cleanDisplayText(decision.topic)}</Text>
      </View>

      <Text style={[theme.typography.headline, { color: theme.colors.textPrimary, fontSize: 22, lineHeight: 28 }]}>
        {describeDecision(decision)}
      </Text>
      <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{impact}</Text>

      {decision.kind === 'batch' ? (
        <View style={{ gap: 6 }}>
          {(decision.variants ?? []).slice(0, 8).map((variantLabel) => (
            <View key={variantLabel} style={[styles.evidenceRow, { backgroundColor: theme.glass.inner, borderColor: theme.glass.divider }]}>
              <IconTile icon="check" size="sm" color={theme.colors.accent} />
              <Text numberOfLines={1} style={[theme.typography.caption, { color: theme.colors.textPrimary, flex: 1 }]}>{cleanDisplayText(variantLabel)}</Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>→ {cleanDisplayText(decision.suggestion)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {decision.kind === 'name' || decision.kind === 'label' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[styles.compare, { backgroundColor: theme.glass.inner, borderColor: theme.glass.divider }]}>
            <Text style={[theme.typography.overline, { color: theme.colors.textMuted }]}>Original</Text>
            <Text numberOfLines={2} style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{cleanDisplayText(decision.raw)}</Text>
          </View>
          <Feather name="arrow-right" size={15} color={theme.colors.textMuted} />
          <View style={[styles.compare, { backgroundColor: `${theme.colors.accent}1A`, borderColor: `${theme.colors.accent}47` }]}>
            <Text style={[theme.typography.overline, { color: theme.colors.accent }]}>Pasa a ser</Text>
            <Text numberOfLines={2} style={[theme.typography.caption, { color: theme.colors.textPrimary }]}>{cleanDisplayText(decision.suggestion)}</Text>
          </View>
        </View>
      ) : null}

      {decision.kind === 'same' ? (
        <View style={{ gap: 8 }}>
          <View style={styles.duo}>
            <View style={[styles.person, { backgroundColor: theme.glass.inner, borderColor: theme.glass.divider }]}>
              <IconTile icon="user" size="sm" />
              <Text numberOfLines={2} style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{cleanDisplayText(decision.raw)}</Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>De esta revisión</Text>
            </View>
            <View style={[styles.person, { backgroundColor: theme.glass.inner, borderColor: theme.glass.divider }]}>
              <IconTile icon="check-circle" size="sm" color={theme.colors.accent} />
              <Text numberOfLines={2} style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{cleanDisplayText(decision.suggestion)}</Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Entidad existente</Text>
            </View>
          </View>
          {onWhy ? (
            <Button label={whyOpen ? 'Ocultar motivo' : '¿Por qué coinciden?'} variant="ghost" size="sm" onPress={onWhy} icon={<Feather name="help-circle" size={14} color={theme.colors.textMuted} />} />
          ) : null}
          {whyOpen ? <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{cleanDisplayText(decision.rationale)}</Text> : null}
        </View>
      ) : null}

      {decision.kind === 'category' || decision.kind === 'label' ? (
        <View style={{ gap: 8 }}>
          <View style={{ gap: 8 }}>
            {decision.alternatives.slice(0, 3).map((option, index) => {
              const selected = decision.suggestion === option;
              return (
                <GlassPressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityLabel={`${option}${selected ? ', suggested' : ''}`}
                  accessibilityState={{ selected }}
                  haptic="selection"
                  scaleTo={0.97}
                  onPress={() => onAnswer?.('accept', option)}
                  style={[styles.answerTile, { minHeight: theme.layout.answerTarget, borderRadius: theme.radius.md, backgroundColor: selected ? theme.glass.selected : theme.glass.inner, borderColor: selected ? theme.glass.selected : theme.glass.divider }]}
                >
                  <Text style={[theme.typography.mono, { color: selected ? theme.glass.onSelected : theme.colors.textMuted }]}>{index + 1}</Text>
                  <Text numberOfLines={2} style={[theme.typography.bodyStrong, { flex: 1, color: selected ? theme.glass.onSelected : theme.colors.textPrimary }]}>{cleanDisplayText(option)}</Text>
                  {selected ? <Feather name="check" size={16} color={theme.glass.onSelected} /> : null}
                </GlassPressable>
              );
            })}
          </View>
          {showCustom ? (
            <View style={{ gap: 8 }}>
              <Field label="Otra opción" value={customValue} onChangeText={setCustomValue} placeholder="Escribe una categoría o etiqueta" autoFocus />
              <Button label="Usar esta" size="sm" disabled={!customValue.trim()} onPress={() => onAnswer?.('accept', customValue.trim())} />
            </View>
          ) : (
            <Button label="Otra opción…" variant="ghost" size="sm" onPress={() => setShowCustom(true)} />
          )}
        </View>
      ) : null}

      {decision.kind === 'relation' ? (
        <View style={{ gap: 8 }}>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{cleanDisplayText(decision.rationale)}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 6 }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, flex: 1 }]}>Aplicar esto automáticamente la próxima vez</Text>
            <Chip label={createRule ? 'Regla activa' : 'Solo esta vez'} selected={createRule} onPress={() => setCreateRule((value) => !value)} icon={createRule ? 'repeat' : 'check'} />
          </View>
        </View>
      ) : null}

      {variant === 'full' ? (
        <View style={{ gap: 10, marginTop: 'auto' }}>
          {decision.kind === 'relation' ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Button label="No" variant="secondary" size="lg" onPress={() => onAnswer?.('no', undefined, false)} /></View>
              <View style={{ flex: 1 }}><Button label="Sí, conectar" size="lg" onPress={() => onAnswer?.('accept', undefined, createRule)} /></View>
            </View>
          ) : decision.kind === 'category' || decision.kind === 'label' ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Button label="No es este" variant="secondary" size="lg" onPress={() => onAnswer?.('different')} /></View>
              <View style={{ flex: 1 }}><Button label="Usar sugerencia" size="lg" onPress={() => onAnswer?.('accept', decision.suggestion)} /></View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Button label="Omitir" variant="secondary" size="lg" onPress={onSkip ?? (() => onAnswer?.('skip'))} icon={<Feather name="arrow-left" size={14} color={theme.colors.textPrimary} />} /></View>
              <View style={{ flex: 1 }}><Button label={decision.kind === 'batch' ? `Unificar ${decision.variants?.length ?? decision.reviewIds.length}` : 'Aceptar'} size="lg" onPress={() => onAnswer?.('accept')} icon={<Feather name="check" size={14} color={theme.colors.onAccent} />} /></View>
            </View>
          )}
        </View>
      ) : null}
    </GlassSurface>
  );
}

function kindLabel(kind: ReviewDecision['kind']) {
  if (kind === 'name') return 'Nombre';
  if (kind === 'batch') return 'Lote';
  if (kind === 'category') return 'Categoría';
  if (kind === 'same') return 'Misma empresa';
  if (kind === 'relation') return 'Conexión';
  return 'Etiqueta';
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  evidenceRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10, // theme.radius.sm
    borderWidth: StyleSheet.hairlineWidth,
  },
  answerTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  compare: {
    flex: 1,
    gap: 3,
    padding: 10,
    borderRadius: 14, // theme.radius.md
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 62,
  },
  duo: {
    flexDirection: 'row',
    gap: 8,
  },
  person: {
    flex: 1,
    gap: 6,
    padding: 10,
    borderRadius: 14, // theme.radius.md
    borderWidth: StyleSheet.hairlineWidth,
  },
});
