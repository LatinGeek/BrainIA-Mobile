import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Chip, ConfidenceMeter, Field, Tag } from '@/components/controls';
import { IconTile } from '@/components/data/Row';
import { GlassPressable } from '@/components/glass/GlassPressable';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { useTheme } from '@/lib/app-state';
import { cleanDisplayText, formatCurrency, formatDate } from '@/lib/format';
import {
  decisionAcceptLabel,
  decisionNeedsReview,
  decisionRuleScope,
  decisionSubjectLabel,
  decisionTargetLabel,
  describeDecision,
  ReviewDecision,
  semanticImpactLabel,
} from '@/lib/review-session';

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
    : 'Sin movimientos relacionados en este ciclo';
  const isRelation = decision.kind === 'relation';
  const needsReview = decisionNeedsReview(decision);
  const subjectLabel = decisionSubjectLabel(decision);
  const targetLabel = decisionTargetLabel(decision);
  const sameLabel = Boolean(subjectLabel && targetLabel && subjectLabel.toLocaleLowerCase() === targetLabel.toLocaleLowerCase());
  const relationImpact = semanticImpactLabel(decision);

  return (
    <GlassSurface level="strong" tone={isRelation ? 'model' : 'review'} padding="lg" style={{ flex: 1 }} contentStyle={{ gap: 14, flexGrow: 1 }}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexShrink: 1 }}>
          <Tag label={kindLabel(decision)} tone="warning" />
          {isRelation ? null : <ConfidenceMeter value={decision.confidence} showValue />}
        </View>
        <Text style={[theme.typography.overline, { color: theme.colors.textMuted }]}>{cleanDisplayText(decision.topic)}</Text>
      </View>

      <Text style={[theme.typography.headline, { color: theme.colors.textPrimary, fontSize: 22, lineHeight: 28 }]}>
        {describeDecision(decision)}
      </Text>
      {isRelation ? null : <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{impact}</Text>}

      {decision.kind === 'batch' ? (
        <View style={{ gap: 6 }}>
          {(decision.variants ?? []).slice(0, 8).map((variantLabel) => (
            <GlassSurface key={variantLabel} level="thin" padding="none" radius="sm" contentStyle={styles.evidenceRow}>
              <IconTile icon="check" size="sm" color={theme.colors.accent} />
              <Text numberOfLines={1} style={[theme.typography.caption, { color: theme.colors.textPrimary, flex: 1 }]}>{cleanDisplayText(variantLabel)}</Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>→ {cleanDisplayText(decision.suggestion)}</Text>
            </GlassSurface>
          ))}
        </View>
      ) : null}

      {decision.kind === 'name' || decision.kind === 'label' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <GlassSurface level="thin" padding="sm" radius="md" style={{ flex: 1 }} contentStyle={styles.compare}>
            <Text style={[theme.typography.overline, { color: theme.colors.textMuted }]}>Original</Text>
            <Text numberOfLines={2} style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{cleanDisplayText(decision.raw)}</Text>
          </GlassSurface>
          <Feather name="arrow-right" size={15} color={theme.colors.textMuted} />
          <GlassSurface level="thin" tone="accent" padding="sm" radius="md" style={{ flex: 1, borderColor: `${theme.colors.accent}47` }} contentStyle={styles.compare}>
            <Text style={[theme.typography.overline, { color: theme.colors.accent }]}>Pasa a ser</Text>
            <Text numberOfLines={2} style={[theme.typography.caption, { color: theme.colors.textPrimary }]}>{cleanDisplayText(decision.suggestion)}</Text>
          </GlassSurface>
        </View>
      ) : null}

      {decision.kind === 'same' ? (
        <View style={{ gap: 8 }}>
          <View style={styles.duo}>
            <GlassSurface level="thin" padding="sm" radius="md" style={{ flex: 1 }} contentStyle={styles.person}>
              <IconTile icon="user" size="sm" />
              <Text numberOfLines={2} style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{cleanDisplayText(decision.raw)}</Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>De esta revisión</Text>
            </GlassSurface>
            <GlassSurface level="thin" padding="sm" radius="md" style={{ flex: 1 }} contentStyle={styles.person}>
              <IconTile icon="check-circle" size="sm" color={theme.colors.accent} />
              <Text numberOfLines={2} style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{cleanDisplayText(decision.suggestion)}</Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>Entidad existente</Text>
            </GlassSurface>
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
                  accessibilityLabel={`${option}${selected ? ', sugerida' : ''}`}
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

      {isRelation ? (
        <View style={{ gap: 10 }}>
          {sameLabel ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} accessibilityLabel={`Origen ${endpointTypeLabel(decision, 'subject')}, destino ${endpointTypeLabel(decision, 'target')}`}>
              <Chip label={endpointTypeLabel(decision, 'subject')} static />
              <Chip label={endpointTypeLabel(decision, 'target')} static />
            </View>
          ) : null}
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            {cleanDisplayText(decision.changeExplanation ?? decision.rationale)}
          </Text>

          <EvidenceBlock decision={decision} />

          {decision.verificationStatus === 'verified' ? (
            <View style={{ flexDirection: 'row' }}>
              <Tag label="Verificada con la evidencia disponible" tone="positive" icon="check-circle" />
            </View>
          ) : null}
          {needsReview ? (
            <View style={{ flexDirection: 'row' }}>
              <Tag label="Requiere nueva revisión" tone="warning" icon="alert-triangle" />
            </View>
          ) : null}

          {relationImpact ? (
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{relationImpact}</Text>
          ) : null}

          {decision.ruleEligible && !needsReview ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 4 }}>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary, flex: 1 }]}>{decisionRuleScope(decision)}</Text>
              <Chip
                label={createRule ? 'Aplicar siempre' : 'Solo esta vez'}
                selected={createRule}
                onPress={() => setCreateRule((value) => !value)}
                icon={createRule ? 'repeat' : 'check'}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {variant === 'full' ? (
        <View style={{ gap: 10, marginTop: 'auto' }}>
          {isRelation ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button label="No" variant="secondary" size="lg" accessibilityLabel="No, descartar esta relación" onPress={() => onAnswer?.('no', undefined, false)} />
              </View>
              <View style={{ flex: 1 }}>
                {needsReview ? (
                  <Button label="Omitir" variant="secondary" size="lg" accessibilityLabel="Omitir, requiere nueva revisión" onPress={onSkip ?? (() => onAnswer?.('skip'))} icon={<Feather name="arrow-left" size={14} color={theme.colors.textPrimary} />} />
                ) : (
                  <Button
                    label={decisionAcceptLabel(decision)}
                    size="lg"
                    accessibilityLabel={`${decisionAcceptLabel(decision)}, confirmar`}
                    onPress={() => onAnswer?.('accept', undefined, decision.ruleEligible ? createRule : false)}
                    icon={<Feather name="check" size={14} color={theme.colors.onAccent} />}
                  />
                )}
              </View>
            </View>
          ) : decision.kind === 'category' || decision.kind === 'label' ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Button label="No es esta" variant="secondary" size="lg" onPress={() => onAnswer?.('different')} /></View>
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

function EvidenceBlock({ decision }: { decision: ReviewDecision }) {
  const theme = useTheme();
  const evidence = decision.evidence?.[0];
  const path = decision.categoryPath.map((entry) => cleanDisplayText(entry)).filter(Boolean);
  if (!evidence && !path.length) return null;
  const source = evidenceSourceLabel(evidence?.source);
  const date = evidence?.occurredAt ? formatDate(evidence.occurredAt) : '';
  const meta = [source, date].filter(Boolean).join(' · ');
  const title = evidence?.title?.trim();
  const excerpt = evidence?.excerpt?.trim();
  const showExcerpt = Boolean(excerpt && excerpt !== title);

  return (
    <GlassSurface level="thin" padding="sm" radius="md" contentStyle={styles.evidence}>
      {evidence ? (
        <View style={{ gap: 3 }}>
          {meta ? <Text style={[theme.typography.overline, { color: theme.colors.textMuted }]}>{cleanEvidenceText(meta)}</Text> : null}
          {evidence.title ? <Text numberOfLines={2} style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{cleanEvidenceText(title)}</Text> : null}
          {showExcerpt ? <Text numberOfLines={3} style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{cleanEvidenceText(excerpt)}</Text> : null}
        </View>
      ) : null}
      {path.length ? (
        <Text numberOfLines={2} style={[theme.typography.caption, { color: theme.colors.textSecondary }]} accessibilityLabel={`Ubicación propuesta, ${path.join(', ')}`}>
          {path.join(' › ')}
        </Text>
      ) : null}
    </GlassSurface>
  );
}

function evidenceSourceLabel(source?: string) {
  const value = cleanDisplayText(source);
  if (!value) return '';
  const labels: Record<string, string> = { gmail: 'Gmail', email: 'Correo', notification: 'Notificación', wallet: 'Billetera', bank: 'Banco', manual: 'Carga manual', user: 'Carga manual' };
  return labels[value.toLocaleLowerCase()] ?? value;
}

/** Evidence must stay literal: keep asterisks, amounts and punctuation. */
function cleanEvidenceText(value?: string) {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function endpointTypeLabel(decision: ReviewDecision, side: 'subject' | 'target') {
  const endpoint = side === 'subject' ? decision.endpoints?.subject : decision.endpoints?.target;
  if (endpoint?.kind === 'event') return 'Actividad';
  if (endpoint?.kind === 'category') return 'Categoría';
  if (endpoint?.kind === 'identity') return 'Identidad';
  if (endpoint?.kind === 'concept') return 'Concepto';
  const type = (endpoint?.type ?? '').toLocaleLowerCase();
  if (/categ|taxonomy|expense|income|budget/.test(type)) return 'Categoría';
  if (/merchant|business|person|identity|company|organization/.test(type)) return 'Comercio';
  if (/event|activity|transaction|payment/.test(type)) return 'Actividad';
  if (/app|service|provider|account/.test(type)) return 'Servicio';
  if (decision.actionKind === 'merge_identities') return 'Identidad';
  if (decision.actionKind === 'create_category' || decision.actionKind === 'assign_existing_category' || decision.actionKind === 'place_entity') {
    return side === 'subject' ? 'Actividad' : 'Categoría';
  }
  return side === 'subject' ? 'Origen' : 'Destino';
}

function kindLabel(decision: ReviewDecision) {
  if (decision.kind === 'name') return 'Nombre';
  if (decision.kind === 'batch') return 'Lote';
  if (decision.kind === 'category') return 'Categoría';
  if (decision.kind === 'same') return 'Misma empresa';
  if (decision.kind === 'relation') {
    if (decision.actionKind === 'assign_existing_category') return 'Clasificar';
    if (decision.actionKind === 'create_category') return 'Crear categoría';
    if (decision.actionKind === 'merge_identities') return 'Unificar';
    if (decision.actionKind === 'place_entity') return 'Ubicar';
    if (decision.actionKind === 'associate_entities') return 'Asociar';
    return 'Relación';
  }
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
  },
  evidence: {
    gap: 6,
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
    gap: 3,
    minHeight: 62,
  },
  duo: {
    flexDirection: 'row',
    gap: 8,
  },
  person: {
    gap: 6,
  },
});
