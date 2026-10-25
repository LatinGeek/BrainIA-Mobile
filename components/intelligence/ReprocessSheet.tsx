import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, ButtonGroup, Tag } from '@/components/controls';
import { GlassPressable } from '@/components/glass/GlassPressable';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { BottomSheet } from '@/components/layout/BottomSheet';
import { useTheme } from '@/lib/app-state';
import type { EventProgress, EventSummary, ProgressStageKey } from '@/lib/domain';
import {
  classificationIsAvailable,
  isReprocessStageNotApplicable,
  recommendedReprocessStages,
  REPROCESS_JOB_STATUS_LABEL,
  REPROCESS_STAGES,
  REPROCESS_STAGE_META,
  reprocessErrorMessage,
  reprocessStageStatusLabel,
  reprocessStageTone,
  reprocessStagesSummary,
  toggleReprocessStage,
  type ReprocessJob,
  type ReprocessStage,
} from '@/lib/reprocess';

type StageStatus = EventProgress['stages'][ProgressStageKey]['status'];

export function ReprocessSheet({
  visible,
  event,
  activeJob,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  event: EventSummary;
  activeJob?: ReprocessJob | null;
  onClose: () => void;
  onSubmit: (stages: ReprocessStage[]) => Promise<void>;
}) {
  const theme = useTheme();
  const [selected, setSelected] = useState<ReprocessStage[]>(() => recommendedReprocessStages(event.progress));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const classificationAvailable = classificationIsAvailable(event);
  const allNotApplicable = REPROCESS_STAGES.every((stage) => isReprocessStageNotApplicable(event.progress, stage));
  const close = () => {
    if (!submitting) onClose();
  };

  function toggle(stage: ReprocessStage) {
    if (isReprocessStageNotApplicable(event.progress, stage)) return;
    if (stage === 'classification' && !classificationAvailable && selected.includes('classification')) return;
    setSelected((current) => toggleReprocessStage(current, stage, classificationAvailable));
    setError(null);
  }

  async function submit() {
    if (!selected.length || submitting || activeJob || allNotApplicable) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(selected);
    } catch (cause) {
      setError(reprocessErrorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  }

  const footer = (
    <ButtonGroup style={{ justifyContent: 'flex-end' }}>
      <Button label="Cancelar" variant="ghost" onPress={close} disabled={submitting} />
      <Button
        label={activeJob ? 'Reprocesamiento en curso' : 'Reprocesar'}
        onPress={() => { void submit(); }}
        loading={submitting}
        disabled={Boolean(activeJob) || !selected.length || allNotApplicable}
      />
    </ButtonGroup>
  );

  return (
    <BottomSheet visible={visible} title="Reprocesar actividad" onClose={close} footer={footer}>
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
        Elige qué parte quieres reconstruir. Solo se ejecutarán las etapas seleccionadas.
      </Text>

      {activeJob ? (
        <GlassSurface level="thin" tone="accent" padding="md" contentStyle={{ gap: theme.spacing.xs }}>
          <View style={styles.bannerHeader}>
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary, flex: 1 }]}>
              Ya hay un reprocesamiento en curso
            </Text>
            <Tag label={REPROCESS_JOB_STATUS_LABEL[activeJob.status]} tone="info" live />
          </View>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            {reprocessStagesSummary(activeJob.stages)} · espera a que termine para pedir otras etapas.
          </Text>
        </GlassSurface>
      ) : null}

      <View style={styles.options}>
        {REPROCESS_STAGES.map((stage, index) => {
          const meta = REPROCESS_STAGE_META[stage];
          const status = event.progress?.stages[meta.progressKey]?.status;
          const notApplicable = isReprocessStageNotApplicable(event.progress, stage);
          const checked = selected.includes(stage);
          const locked = stage === 'classification' && !classificationAvailable && checked;
          const disabled = notApplicable || locked || submitting || Boolean(activeJob);
          return (
            <StageOption
              key={stage}
              label={meta.label}
              description={meta.description}
              icon={meta.icon}
              checked={checked}
              disabled={disabled}
              locked={locked}
              status={status}
              divider={index < REPROCESS_STAGES.length - 1}
              onPress={() => toggle(stage)}
            />
          );
        })}
      </View>

      {!classificationAvailable && selected.some((stage) => stage !== 'classification') ? (
        <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>
          La clasificación se incluye automáticamente porque es requisito de las demás etapas.
        </Text>
      ) : null}

      {allNotApplicable ? (
        <Text style={[theme.typography.caption, { color: theme.colors.warning }]}>
          Esta actividad no se puede procesar por su política de privacidad o de la fuente.
        </Text>
      ) : null}

      {error ? (
        <GlassSurface level="thin" tone="danger" padding="md">
          <Text accessibilityLiveRegion="polite" style={[theme.typography.caption, { color: theme.colors.danger }]}>
            {error}
          </Text>
        </GlassSurface>
      ) : null}
    </BottomSheet>
  );
}

// The sheet is a native modal; Screen must not wrap it in scroll-content layout.
ReprocessSheet.screenOverlay = true;

function StageOption({
  label,
  description,
  icon,
  checked,
  disabled,
  locked,
  status,
  divider,
  onPress,
}: {
  label: string;
  description: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  checked: boolean;
  disabled: boolean;
  locked: boolean;
  status?: StageStatus;
  divider: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <GlassPressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={`${label}. ${description}`}
      onPress={onPress}
      disabled={disabled}
      haptic="selection"
      scaleTo={0.99}
      style={[
        styles.option,
        divider ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.glass.divider } : null,
        { opacity: disabled && !locked ? 0.5 : 1 },
      ]}
    >
      <View
        style={[
          styles.check,
          {
            borderColor: checked ? theme.colors.accent : theme.glass.edge[0],
            backgroundColor: checked ? theme.colors.accent : 'transparent',
          },
        ]}
      >
        {checked ? <Feather name="check" size={13} color={theme.colors.onAccent} /> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.optionHeader}>
          <Feather name={icon} size={14} color={checked ? theme.colors.accentStrong : theme.colors.textMuted} />
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary, flex: 1 }]}>{label}</Text>
          {status ? (
            <Tag
              label={reprocessStageStatusLabel(status)}
              tone={reprocessStageTone(status)}
            />
          ) : null}
        </View>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{description}</Text>
        {locked ? (
          <Text style={[theme.typography.caption, { color: theme.colors.accentStrong }]}>
            Requisito de las etapas elegidas
          </Text>
        ) : null}
      </View>
    </GlassPressable>
  );
}

const styles = StyleSheet.create({
  bannerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  options: { overflow: 'hidden' },
  option: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  optionHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  check: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
});
