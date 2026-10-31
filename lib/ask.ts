import { fetch as expoFetch } from 'expo/fetch';
import { Platform } from 'react-native';

/**
 * Client side of `POST /api/v1/ask` (Explorar chat). The server streams
 * NDJSON events; numbers in `cards` are deterministic SQL results, while the
 * answer text is model-written and cites sources as [S1], [S2]...
 */

export type AskStage = 'understanding' | 'retrieving' | 'answering';

export type AskRoute = { pathname: string; params: Record<string, string> } | null;

export type AskSource = {
  id: string;
  kind: 'calculation' | 'transaction' | 'event' | 'entity';
  title: string;
  subtitle: string | null;
  date: string | null;
  route: AskRoute;
  amount: { value: string; currency: string; kind: string } | null;
};

export type AskTotalsCard = {
  type: 'totals';
  period: { label: string; fromDate: string; toDate: string };
  kind: 'expense' | 'income' | 'all';
  filtersLabel: string | null;
  rows: Array<{
    currency: string; expense: string; income: string; net: string; count: number;
    previous: { label: string; expense: string; income: string; count: number } | null;
    changePct: number | null;
  }>;
  excludedCount: number;
};

export type AskBreakdownCard = {
  type: 'breakdown';
  groupBy: 'category' | 'merchant' | 'account' | 'month' | 'week' | 'day';
  period: { label: string; fromDate: string; toDate: string };
  kind: 'expense' | 'income' | 'all';
  currency: string;
  total: string;
  items: Array<{ label: string; amount: string; share: number; count: number }>;
};

export type AskTransactionsCard = {
  type: 'transactions';
  title: string;
  items: Array<{ id: string; title: string; amount: string; currency: string; kind: string; date: string; category: string; account: string | null }>;
};

export type AskCard = AskTotalsCard | AskBreakdownCard | AskTransactionsCard;

export type AskPlanInfo = {
  standalone: string;
  intent: 'finance' | 'knowledge' | 'mixed' | 'chitchat';
  period: { label: string; fromDate: string; toDate: string; assumed: boolean } | null;
  filters: string[];
};

export type AskGrounding = { status: 'verified' | 'unverified' | 'not_applicable'; unverified: string[] };

export type AskEvent =
  | { type: 'status'; stage: AskStage }
  | ({ type: 'plan' } & AskPlanInfo)
  | { type: 'sources'; sources: AskSource[]; cards: AskCard[] }
  | { type: 'delta'; text: string }
  | { type: 'done'; answer: string; citations: string[]; grounding: AskGrounding; mode: 'model' | 'deterministic'; timings: Record<string, number> }
  | { type: 'error'; code: string; message: string };

export type AskTurn = { role: 'user' | 'assistant'; content: string };

export type AskRequest = { question: string; history: AskTurn[]; timeZone?: string };

/** Incremental UTF-8 decoder: a multi-byte character may be split across chunks. */
export function createUtf8Decoder() {
  if (typeof TextDecoder !== 'undefined') {
    const decoder = new TextDecoder('utf-8');
    return (chunk: Uint8Array, final = false) => decoder.decode(chunk, { stream: !final });
  }
  let pending: number[] = [];
  return (chunk: Uint8Array, final = false) => {
    const bytes = pending.concat(Array.from(chunk));
    pending = [];
    let out = '';
    let index = 0;
    while (index < bytes.length) {
      const byte = bytes[index]!;
      const length = byte < 0x80 ? 1 : byte >= 0xf0 ? 4 : byte >= 0xe0 ? 3 : byte >= 0xc0 ? 2 : 1;
      if (index + length > bytes.length) {
        if (!final) pending = bytes.slice(index);
        break;
      }
      let code = length === 1 ? byte : byte & (0xff >> (length + 1));
      for (let offset = 1; offset < length; offset += 1) code = (code << 6) | (bytes[index + offset]! & 0x3f);
      out += String.fromCodePoint(code);
      index += length;
    }
    return out;
  };
}

/** Splits an NDJSON text stream into parsed events, keeping partial lines buffered. */
export function createNdjsonParser(onEvent: (event: AskEvent) => void) {
  let buffer = '';
  const flushLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      onEvent(JSON.parse(trimmed) as AskEvent);
    } catch {
      // A malformed line is skipped; the final `done` or `error` still arrives.
    }
  };
  return {
    push(text: string) {
      buffer += text;
      let newline = buffer.indexOf('\n');
      while (newline >= 0) {
        flushLine(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
      }
    },
    end() {
      flushLine(buffer);
      buffer = '';
    },
  };
}

export function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Montevideo';
  } catch {
    return 'America/Montevideo';
  }
}

/**
 * Streams one Ask turn. Uses expo/fetch on native (it exposes a readable body,
 * unlike React Native's fetch) and falls back to reading the whole response
 * when the platform or a proxy delivers it buffered; the protocol is the same.
 */
export async function streamAsk(
  connection: { baseUrl: string; headers: Record<string, string> },
  request: AskRequest,
  onEvent: (event: AskEvent) => void,
  signal?: AbortSignal,
) {
  const url = `${connection.baseUrl.replace(/\/+$/, '')}/api/v1/ask`;
  const fetcher = (Platform.OS === 'web' ? globalThis.fetch : expoFetch) as typeof globalThis.fetch;
  const response = await fetcher(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/x-ndjson', ...connection.headers },
    body: JSON.stringify({ ...request, stream: true }),
    signal,
  });
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const json = await response.json() as { message?: string; error?: string };
      message = json.message ?? json.error ?? message;
    } catch {
      // keep the status message
    }
    // Server messages are developer-facing English; show the user what to do instead.
    if (response.status === 401 || response.status === 403) throw new Error('BrainIA no aceptó tus credenciales. Revísalas en Ajustes.');
    if (response.status === 503) throw new Error('El asistente está desactivado en el servidor.');
    if (response.status === 400) throw new Error('No pude entender la pregunta. Prueba reformularla.');
    throw new Error(response.status >= 500 ? 'BrainIA no está respondiendo ahora. Intenta en unos minutos.' : message);
  }
  const parser = createNdjsonParser(onEvent);
  const reader = response.body?.getReader?.();
  if (!reader) {
    parser.push(await response.text());
    parser.end();
    return;
  }
  const decode = createUtf8Decoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) parser.push(decode(value));
  }
  parser.push(decode(new Uint8Array(), true));
  parser.end();
}

/** "45320.5" → 45320.5 for display formatting only; totals are computed server-side. */
export function amountNumber(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
