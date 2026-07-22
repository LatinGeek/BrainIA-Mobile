import { AppSettings, TransactionSummary } from './domain';
import { cleanDisplayText, formatCategoryLabel, formatDate, joinDisplayParts } from './format';

export type DataVisibility = AppSettings['dataVisibility'];
export type BundleSource = 'live' | 'cache' | 'empty';

export function getVisibilityCopy(visibility: DataVisibility) {
  if (visibility === 'essential') {
    return {
      label: 'Essential',
      description: 'Shows summaries and decisions. Hides raw identifiers, technical reasons and account details.',
    };
  }

  if (visibility === 'detailed') {
    return {
      label: 'Detailed',
      description: 'Shows evidence, diagnostics and operational context for audit work.',
    };
  }

  return {
    label: 'Balanced',
    description: 'Shows useful context while masking low-value identifiers and technical details.',
  };
}

export function getSourcePresentation(source?: BundleSource | string) {
  if (source === 'live') {
    return { label: 'Live data', tone: 'positive' as const };
  }

  if (source === 'cache') {
    return { label: 'Cached data', tone: 'warning' as const };
  }

  if (source === 'empty') {
    return { label: 'No results', tone: 'neutral' as const };
  }

  return { label: 'Unavailable', tone: 'neutral' as const };
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
    return 'Not available';
  }

  if (visibility === 'detailed') {
    return cleaned;
  }

  if (cleaned.length <= 6) {
    return 'Hidden';
  }

  return `${cleaned.slice(0, 3)}...${cleaned.slice(-3)}`;
}

export function maskAccount(value?: string, visibility: DataVisibility = 'balanced') {
  const cleaned = cleanDisplayText(value);
  if (!cleaned) {
    return visibility === 'essential' ? 'Account hidden' : 'Unknown account';
  }

  if (visibility === 'detailed') {
    return cleaned;
  }

  const trailingDigits = cleaned.match(/(\d{2,4})\D*$/)?.[1];
  if (trailingDigits) {
    return `Account ...${trailingDigits}`;
  }

  return visibility === 'essential' ? 'Account hidden' : cleaned.replace(/[A-Za-z0-9]/g, '*');
}

export function presentTransactionSubtitle(transaction: TransactionSummary, visibility: DataVisibility) {
  if (transaction.kind === 'transfer') {
    const destination = shouldShowEvidenceDetail(visibility) ? maskAccount(transaction.destinationAccount, visibility) : undefined;
    return joinDisplayParts(['Transfer', transaction.account ? `From ${maskAccount(transaction.account, visibility)}` : undefined, destination ? `To ${destination}` : undefined]);
  }
  const account = shouldShowEvidenceDetail(visibility) ? maskAccount(transaction.account, visibility) : undefined;
  const category = transaction.kind === 'income' ? 'Income' : formatCategoryLabel(transaction.category);
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
