import { deleteStoredValue, readStoredValue, writeStoredValue } from './storage';

const STORAGE_KEY = 'brainia_mobile.diagnostics';
const MAX_ENTRIES = 30;

export type DiagnosticEntry = {
  id: string;
  type: 'screen' | 'request' | 'cache' | 'error' | 'info';
  label: string;
  detail?: string;
  timestamp: string;
};

async function readEntries(): Promise<DiagnosticEntry[]> {
  const raw = await readStoredValue(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export async function recordDiagnostic(entry: Omit<DiagnosticEntry, 'id' | 'timestamp'>) {
  const next: DiagnosticEntry = {
    ...entry,
    id: `${entry.type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  };

  const entries = await readEntries();
  const updated = [next, ...entries].slice(0, MAX_ENTRIES);
  await writeStoredValue(STORAGE_KEY, JSON.stringify(updated));
  return next;
}

export async function readDiagnostics() {
  return readEntries();
}

export async function clearDiagnostics() {
  await deleteStoredValue(STORAGE_KEY);
}
