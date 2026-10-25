import type { EventProgress, ProgressStageKey } from './domain';

export const REPROCESS_STAGES = [
  'classification',
  'semanticInterpretation',
  'financialCorrelation',
  'embeddings',
] as const;

export type ReprocessStage = typeof REPROCESS_STAGES[number];
export type ReprocessExecution = 'coalesce' | 'new';
export type ReprocessDisposition = 'queued' | 'coalesced' | 'already_completed' | 'revived';
export type ReprocessJobStatus = 'queued' | 'running' | 'retry_scheduled' | 'succeeded' | 'dead_letter' | 'cancelled';

export type ReprocessJob = {
  id: string;
  jobType: string;
  status: ReprocessJobStatus;
  stages: ReprocessStage[];
  attemptCount: number;
  maxAttempts: number;
  runAfter?: string;
  createdAt?: string;
  completedAt?: string | null;
};

export type ReprocessResult = {
  mode: 'queued' | 'legacy';
  disposition?: ReprocessDisposition;
  requestedStages: ReprocessStage[];
  job?: ReprocessJob;
};

export const REPROCESS_STAGE_META: Record<ReprocessStage, {
  label: string;
  shortLabel: string;
  description: string;
  icon: 'tag' | 'cpu' | 'credit-card' | 'search';
  progressKey: ProgressStageKey;
}> = {
  classification: {
    label: 'Clasificación',
    shortLabel: 'Clasificación',
    description: 'Reconstruye el tipo, comercio e importe desde el contenido original.',
    icon: 'tag',
    progressKey: 'classification',
  },
  semanticInterpretation: {
    label: 'Interpretación',
    shortLabel: 'Interpretación',
    description: 'Vuelve a ubicar la actividad en tu conocimiento y categorías.',
    icon: 'cpu',
    progressKey: 'semanticInterpretation',
  },
  financialCorrelation: {
    label: 'Registro financiero',
    shortLabel: 'Registro',
    description: 'Vuelve a enlazar la actividad con su movimiento en el ledger.',
    icon: 'credit-card',
    progressKey: 'financialProjection',
  },
  embeddings: {
    label: 'Búsqueda',
    shortLabel: 'Búsqueda',
    description: 'Actualiza el texto e índice que usa la búsqueda de Brain IA.',
    icon: 'search',
    progressKey: 'searchIndexing',
  },
};

export const REPROCESS_DEPENDENT_STAGES: readonly ReprocessStage[] = [
  'semanticInterpretation',
  'financialCorrelation',
  'embeddings',
];

export const REPROCESS_JOB_STATUS_LABEL: Record<ReprocessJobStatus, string> = {
  queued: 'En cola',
  running: 'En curso',
  retry_scheduled: 'Se reintentará',
  succeeded: 'Completado',
  dead_letter: 'Falló',
  cancelled: 'Cancelado',
};

export function isReprocessStage(value: unknown): value is ReprocessStage {
  return typeof value === 'string' && (REPROCESS_STAGES as readonly string[]).includes(value);
}

export function isActiveReprocessJob(status: ReprocessJobStatus | string | undefined) {
  return status === 'queued' || status === 'running' || status === 'retry_scheduled';
}

export function isReprocessStageNotApplicable(progress: EventProgress | undefined, stage: ReprocessStage) {
  return progress?.stages[REPROCESS_STAGE_META[stage].progressKey]?.status === 'not_applicable';
}

export function classificationIsAvailable(event: { progress?: EventProgress; description?: string }) {
  if (event.progress) return event.progress.stages.classification.status === 'completed';
  return Boolean(event.description);
}

/** Canonical order, independent of tap order. */
export function normalizeReprocessSelection(
  stages: Iterable<ReprocessStage>,
  classificationAvailable: boolean,
): ReprocessStage[] {
  const selected = new Set(stages);
  if (!classificationAvailable && REPROCESS_DEPENDENT_STAGES.some((stage) => selected.has(stage))) {
    selected.add('classification');
  }
  return REPROCESS_STAGES.filter((stage) => selected.has(stage));
}

/**
 * Preselects only the work that is not already done. Fully processed activities
 * default to interpretation + search, which is the common "reinterpret" action.
 */
export function recommendedReprocessStages(progress: EventProgress | undefined): ReprocessStage[] {
  if (!progress) return ['classification', 'semanticInterpretation', 'financialCorrelation', 'embeddings'];
  const statuses = REPROCESS_STAGES.map((stage) => progress.stages[REPROCESS_STAGE_META[stage].progressKey]?.status);
  if (statuses.every((status) => status === 'not_applicable')) return [];
  const open = REPROCESS_STAGES.filter((_stage, index) => {
    const status = statuses[index];
    return status !== 'completed' && status !== 'not_applicable';
  });
  const selected = new Set<ReprocessStage>(open);
  if (selected.size === 0) {
    selected.add('semanticInterpretation');
    selected.add('embeddings');
  }
  if (selected.has('classification')) {
    // Classification projects the ledger itself and rebuilds the data that
    // interpretation/search consume, so those follow in the same recovery.
    selected.add('semanticInterpretation');
    selected.add('embeddings');
    selected.delete('financialCorrelation');
  }
  return normalizeReprocessSelection(selected, progress.stages.classification.status === 'completed');
}

export function toggleReprocessStage(
  current: readonly ReprocessStage[],
  stage: ReprocessStage,
  classificationAvailable: boolean,
) {
  const selected = new Set(current);
  if (selected.has(stage)) selected.delete(stage);
  else selected.add(stage);
  return normalizeReprocessSelection(selected, classificationAvailable);
}

export function reprocessStagesSummary(stages: readonly ReprocessStage[]) {
  return stages.map((stage) => REPROCESS_STAGE_META[stage].shortLabel).join(' · ');
}

export function reprocessJobTone(status: ReprocessJobStatus): 'positive' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (status) {
    case 'succeeded': return 'positive';
    case 'running': return 'info';
    case 'retry_scheduled': return 'warning';
    case 'dead_letter': return 'danger';
    default: return 'neutral';
  }
}

export function reprocessStageTone(status: EventProgress['stages'][ProgressStageKey]['status']) {
  switch (status) {
    case 'completed': return 'positive' as const;
    case 'running': return 'info' as const;
    case 'awaiting_review':
    case 'recoverable_failure': return 'warning' as const;
    case 'terminal_failure': return 'danger' as const;
    default: return 'neutral' as const;
  }
}

export function reprocessStageStatusLabel(status: EventProgress['stages'][ProgressStageKey]['status']) {
  switch (status) {
    case 'completed': return 'Listo';
    case 'running': return 'En curso';
    case 'awaiting_review': return 'Revisión';
    case 'recoverable_failure': return 'Reintentar';
    case 'terminal_failure': return 'Falló';
    case 'not_applicable': return 'No aplica';
    default: return 'Pendiente';
  }
}

function errorCode(error: unknown) {
  return error && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'string'
    ? String((error as { code: string }).code)
    : '';
}

export function reprocessErrorMessage(error: unknown) {
  const code = errorCode(error);
  if (code === 'reprocess_in_progress') return 'Ya hay un reprocesamiento en curso para esta actividad. Espera a que termine.';
  if (code === 'reprocess_prerequisites_missing') return 'Falta clasificar esta actividad antes de ejecutar esas etapas.';
  if (code === 'event_not_processable') return 'Esta actividad está excluida del procesamiento por su política de privacidad.';
  if (code === 'invalid_reprocess_selection') return 'Elige al menos una etapa para reprocesar.';
  if (code === 'reprocess_idempotency_key_conflict') return 'La solicitud cambió mientras se procesaba. Intenta nuevamente.';
  const message = error instanceof Error ? error.message : '';
  if (/network|fetch|connection|timeout|offline/i.test(message)) return 'Sin conexión con Brain IA. Revisa tu red e intenta nuevamente.';
  return 'No se pudo iniciar el reprocesamiento. Revisa tu conexión e intenta nuevamente.';
}
