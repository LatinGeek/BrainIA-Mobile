import { useCallback, useEffect, useRef, useState } from 'react';

import { deviceTimeZone, type AskCard, type AskGrounding, type AskPlanInfo, type AskSource, type AskStage, type AskTurn } from './ask';
import type { BrainIAClient } from './api';
import { recordInteraction } from './interaction-telemetry';

export type AskUserMessage = { id: string; role: 'user'; text: string; via: 'text' | 'voice' };

export type AskAssistantMessage = {
  id: string;
  role: 'assistant';
  question: string;
  status: 'pending' | 'streaming' | 'done' | 'error' | 'cancelled';
  stage: AskStage;
  text: string;
  plan: AskPlanInfo | null;
  sources: AskSource[];
  cards: AskCard[];
  citations: string[];
  grounding: AskGrounding | null;
  mode: 'model' | 'deterministic' | null;
  error: string | null;
  feedback: 'useful' | 'incorrect' | null;
};

export type AskMessage = AskUserMessage | AskAssistantMessage;

const HISTORY_TURNS = 6;

let sequence = 0;
const nextId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(sequence += 1)}`;

/** Prior turns for follow-ups ("¿y el mes pasado?"). Only completed answers are sent. */
function historyFrom(messages: AskMessage[]): AskTurn[] {
  const turns: AskTurn[] = [];
  for (const message of messages) {
    if (message.role === 'user') turns.push({ role: 'user', content: message.text });
    else if (message.status === 'done' && message.text) turns.push({ role: 'assistant', content: message.text });
  }
  return turns.slice(-HISTORY_TURNS);
}

export function useAskChat(client: BrainIAClient) {
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const controller = useRef<AbortController | null>(null);
  const messagesRef = useRef<AskMessage[]>([]);
  messagesRef.current = messages;

  useEffect(() => () => controller.current?.abort(), []);

  const update = useCallback((id: string, patch: (message: AskAssistantMessage) => Partial<AskAssistantMessage>) => {
    setMessages((current) => current.map((message) => message.id === id && message.role === 'assistant' ? { ...message, ...patch(message) } : message));
  }, []);

  const busy = messages.some((message) => message.role === 'assistant' && (message.status === 'pending' || message.status === 'streaming'));

  const send = useCallback(async (raw: string, via: 'text' | 'voice' = 'text') => {
    const question = raw.trim();
    if (question.length < 2) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const history = historyFrom(messagesRef.current);
    const assistantId = nextId('a');
    setMessages((current) => [
      ...current,
      { id: nextId('u'), role: 'user', text: question, via },
      {
        id: assistantId, role: 'assistant', question, status: 'pending', stage: 'understanding', text: '', plan: null,
        sources: [], cards: [], citations: [], grounding: null, mode: null, error: null, feedback: null,
      },
    ]);
    const started = Date.now();
    let finished = false;
    // Deltas arrive many times per second; batch them into one render per frame.
    let pendingText = '';
    let frame: ReturnType<typeof setTimeout> | null = null;
    const flushText = () => {
      frame = null;
      if (!pendingText) return;
      const chunk = pendingText;
      pendingText = '';
      update(assistantId, (message) => ({ text: message.text + chunk, status: 'streaming' }));
    };
    try {
      await client.ask({ question, history, timeZone: deviceTimeZone() }, (event) => {
        switch (event.type) {
          case 'status':
            update(assistantId, () => ({ stage: event.stage }));
            break;
          case 'plan': {
            const { type: _type, ...plan } = event;
            update(assistantId, () => ({ plan }));
            break;
          }
          case 'sources':
            update(assistantId, () => ({ sources: event.sources, cards: event.cards }));
            break;
          case 'delta':
            pendingText += event.text;
            if (!frame) frame = setTimeout(flushText, 40);
            break;
          case 'done':
            if (frame) clearTimeout(frame);
            pendingText = '';
            finished = true;
            // The final answer replaces the streamed text: citations are sanitised server-side.
            update(assistantId, () => ({ status: 'done', text: event.answer, citations: event.citations, grounding: event.grounding, mode: event.mode }));
            break;
          case 'error':
            finished = true;
            update(assistantId, () => ({ status: 'error', error: event.message, text: '' }));
            break;
        }
      }, abort.signal);
      if (!finished) update(assistantId, () => ({ status: 'error', error: 'La conexión se cortó antes de terminar. Intenta de nuevo.' }));
      recordInteraction('explore', 'ask', finished ? 'success' : 'failure', Date.now() - started);
    } catch (error) {
      if (frame) clearTimeout(frame);
      if (abort.signal.aborted) {
        update(assistantId, (message) => ({ status: 'cancelled', text: message.text + pendingText }));
        recordInteraction('explore', 'ask', 'cancelled', Date.now() - started);
        return;
      }
      const message = error instanceof Error ? error.message : 'No pude completar la respuesta.';
      update(assistantId, () => ({ status: 'error', error: /network|fetch|failed/i.test(message) ? 'Sin conexión con BrainIA. Revisa tu red e intenta de nuevo.' : message }));
      recordInteraction('explore', 'ask', 'failure', Date.now() - started);
    } finally {
      if (controller.current === abort) controller.current = null;
    }
  }, [client, update]);

  const stop = useCallback(() => controller.current?.abort(), []);

  const retry = useCallback((assistantId: string) => {
    const index = messagesRef.current.findIndex((message) => message.id === assistantId);
    const target = messagesRef.current[index];
    if (!target || target.role !== 'assistant') return;
    // Drop the failed exchange and ask again with the same history.
    setMessages((current) => current.filter((_, position) => position !== index && position !== index - 1));
    messagesRef.current = messagesRef.current.filter((_, position) => position !== index && position !== index - 1);
    void send(target.question);
  }, [send]);

  const reset = useCallback(() => {
    controller.current?.abort();
    setMessages([]);
  }, []);

  const giveFeedback = useCallback((assistantId: string, value: 'useful' | 'incorrect') => {
    update(assistantId, () => ({ feedback: value }));
    recordInteraction('explore', 'feedback', value === 'useful' ? 'success' : 'failure');
  }, [update]);

  return { messages, busy, send, stop, retry, reset, giveFeedback };
}
