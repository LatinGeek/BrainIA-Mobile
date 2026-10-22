import { AppSettings, TransactionSummary } from './domain';
import { cleanDisplayText, formatCategoryLabel, formatDate, joinDisplayParts } from './format';

export type DataVisibility = AppSettings['dataVisibility'];
export type BundleSource = 'live' | 'cache' | 'empty';

export function getVisibilityCopy(visibility: DataVisibility) {
  if (visibility === 'essential') {
    return {
      label: 'Esencial',
      description: 'Muestra resúmenes y decisiones. Oculta identificadores, motivos técnicos y datos de cuentas.',
    };
  }

  if (visibility === 'detailed') {
    return {
      label: 'Detallado',
      description: 'Muestra evidencias, diagnósticos y contexto operativo para auditar.',
    };
  }

  return {
    label: 'Equilibrado',
    description: 'Muestra contexto útil y oculta identificadores y detalles técnicos de poco valor.',
  };
}

export function getSourcePresentation(source?: BundleSource | string) {
  if (source === 'live') {
    return { label: 'Datos en vivo', tone: 'positive' as const };
  }

  if (source === 'cache') {
    return { label: 'Datos en caché', tone: 'warning' as const };
  }

  if (source === 'empty') {
    return { label: 'Sin resultados', tone: 'neutral' as const };
  }

  return { label: 'No disponible', tone: 'neutral' as const };
}

export function shouldShowOperationalDetail(visibility: DataVisibility) {
  return visibility === 'detailed';
}

export function shouldShowEvidenceDetail(visibility: DataVisibility) {
  return visibility !== 'essential';
}

export function maskIdentifier(value?: string, visibility: DataVisibility = 'balanced') {
  const cleaned = cleanDisplayText(value);
  if (!cleaned) {
    return 'No disponible';
  }

  if (visibility === 'detailed') {
    return cleaned;
  }

  if (cleaned.length <= 6) {
    return 'Oculto';
  }

  return `${cleaned.slice(0, 3)}...${cleaned.slice(-3)}`;
}

export function maskAccount(value?: string, visibility: DataVisibility = 'balanced') {
  const cleaned = cleanDisplayText(value);
  if (!cleaned) {
    return visibility === 'essential' ? 'Cuenta oculta' : 'Cuenta desconocida';
  }

  if (visibility !== 'essential') {
    return cleaned;
  }
  return 'Cuenta oculta';
}

export function presentTransactionSubtitle(transaction: TransactionSummary, visibility: DataVisibility) {
  if (transaction.excludedFromReports) {
    const account = shouldShowEvidenceDetail(visibility) ? maskAccount(transaction.account, visibility) : undefined;
    return joinDisplayParts(['Ajuste de saldo', 'Excluido de los informes', account]);
  }
  if (transaction.kind === 'transfer') {
    const destination = shouldShowEvidenceDetail(visibility) ? maskAccount(transaction.destinationAccount, visibility) : undefined;
    return joinDisplayParts(['Transferencia', transaction.account ? `Desde ${maskAccount(transaction.account, visibility)}` : undefined, destination ? `Hacia ${destination}` : undefined]);
  }
  const account = shouldShowEvidenceDetail(visibility) ? maskAccount(transaction.account, visibility) : undefined;
  const category = transaction.kind === 'income' ? 'Ingreso' : formatCategoryLabel(transaction.category);
  return joinDisplayParts([category, account]);
}

export function presentEvidenceReason(reason: string | undefined, visibility: DataVisibility) {
  if (!reason) {
    return undefined;
  }

  if (visibility === 'detailed') {
    return cleanDisplayText(reason);
  }

  if (visibility === 'balanced') {
    return 'Evidence matched by amount, source and merchant context.';
  }

  return undefined;
}

export function presentObservedAt(value: string | undefined, visibility: DataVisibility) {
  if (!value) {
    return undefined;
  }

  return visibility === 'essential' ? undefined : formatDate(value);
}
