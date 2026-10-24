import type { EventProgress, ProgressStageKey, ProgressStatus } from './domain';

const STATUSES: readonly ProgressStatus[] = ['pending', 'running', 'completed', 'awaiting_review', 'recoverable_failure', 'terminal_failure', 'not_applicable'];
export const PROGRESS_STAGE_ORDER: readonly ProgressStageKey[] = ['classification', 'semanticInterpretation', 'financialProjection', 'searchIndexing'];

export const stageLabel: Record<ProgressStageKey, string> = {
  classification: 'Clasificación',
  semanticInterpretation: 'Interpretación',
  financialProjection: 'Registro financiero',
  searchIndexing: 'Búsqueda',
};

export const statusLabel: Record<ProgressStatus, string> = {
  pending: 'Pendiente',
  running: 'En curso',
  completed: 'Listo',
  awaiting_review: 'Esperando tu revisión',
  recoverable_failure: 'Falló, se reintentará',
  terminal_failure: 'Falló',
  not_applicable: 'No aplica',
};

const isStatus = (value: unknown): value is ProgressStatus => STATUSES.includes(value as ProgressStatus);

/** Tolerant parse: older backends omit `progress`, and unknown shapes are dropped rather than rendered. */
export function parseEventProgress(input: unknown): EventProgress | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const raw = input as Record<string, any>;
  if (!raw.summary || !raw.stages || !isStatus(raw.summary.status)) return undefined;
  const stages = {} as EventProgress['stages'];
  for (const key of PROGRESS_STAGE_ORDER) {
    const stage = raw.stages[key];
    if (!stage || !isStatus(stage.status)) return undefined;
    const job = stage.job && typeof stage.job === 'object' ? stage.job : null;
    stages[key] = {
      status: stage.status,
      code: String(stage.code ?? ''),
      message: String(stage.message ?? ''),
      job: job ? { status: String(job.status), attempt: Number(job.attempt) || 0, maxAttempts: Number(job.maxAttempts) || 0, nextAttemptAt: job.nextAttemptAt ? String(job.nextAttemptAt) : null } : null,
    };
  }
  return { summary: { status: raw.summary.status, partial: raw.summary.partial === true, message: String(raw.summary.message ?? '') }, stages };
}

const recordedByKind: Record<string, string> = { expense: 'Gasto registrado', income: 'Ingreso registrado', transfer: 'Transferencia registrada' };
const phraseByStatus: Partial<Record<ProgressStatus, string>> = {
  pending: 'pendiente', running: 'en curso', awaiting_review: 'esperando revisión', recoverable_failure: 'falló y se reintentará', terminal_failure: 'falló',
};
const severity: Record<ProgressStatus, number> = { terminal_failure: 6, recoverable_failure: 5, awaiting_review: 4, running: 3, pending: 2, completed: 1, not_applicable: 0 };

/** Spanish headline, e.g. "Gasto registrado; interpretación pendiente." */
export function progressHeadline(progress: EventProgress, inferredKind?: string): string {
  const entries = PROGRESS_STAGE_ORDER.map((key) => ({ key, ...progress.stages[key] }));
  const open = entries.filter((entry) => entry.status !== 'completed' && entry.status !== 'not_applicable');
  const lead = open.reduce<typeof open[number] | undefined>((best, entry) => (!best || severity[entry.status] > severity[best.status] ? entry : best), undefined);
  const recorded = progress.stages.financialProjection.status === 'completed' ? (recordedByKind[inferredKind ?? ''] ?? 'Movimiento registrado') : '';
  if (!lead) {
    if (!entries.some((entry) => entry.status === 'completed')) return 'No hay nada que procesar para esta actividad.';
    return recorded ? `${recorded}; procesamiento completo.` : 'Procesamiento completo.';
  }
  const phrase = `${stageLabel[lead.key].toLowerCase()} ${phraseByStatus[lead.status]}`;
  return recorded && lead.key !== 'financialProjection' ? `${recorded}; ${phrase}.` : `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)}.`;
}

export function stageDetail(stage: EventProgress['stages'][ProgressStageKey]): string {
  const base = statusLabel[stage.status];
  const job = stage.job;
  if ((stage.status === 'recoverable_failure' || stage.status === 'terminal_failure') && job && job.maxAttempts > 0) {
    return `${base} · intento ${job.attempt} de ${job.maxAttempts}`;
  }
  return base;
}
