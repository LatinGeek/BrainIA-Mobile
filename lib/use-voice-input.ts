import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * On-device speech-to-text for the Explorar composer. The native module ships
 * with new builds only, so it is loaded lazily: older installs (and platforms
 * without a recognizer) simply report `available: false` and hide the mic.
 * Audio never reaches BrainIA's servers; only the final transcript is sent.
 */

type SpeechModule = typeof import('expo-speech-recognition');

let speech: SpeechModule | null | undefined;
function loadSpeech(): SpeechModule | null {
  if (speech !== undefined) return speech;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require('expo-speech-recognition') as SpeechModule;
    speech = module.ExpoSpeechRecognitionModule?.isRecognitionAvailable?.() ? module : null;
  } catch {
    speech = null;
  }
  return speech;
}

export type VoiceState = 'idle' | 'starting' | 'listening' | 'processing';

export function useVoiceInput(options: { onFinal: (transcript: string) => void; lang?: string }) {
  const [available] = useState(() => loadSpeech() !== null);
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** Normalised 0..1 input level for the listening animation. */
  const [level, setLevel] = useState(0);
  const finalText = useRef('');
  const onFinal = useRef(options.onFinal);
  onFinal.current = options.onFinal;

  useEffect(() => {
    const module = loadSpeech();
    if (!module) return;
    const recognizer = module.ExpoSpeechRecognitionModule;
    const subscriptions = [
      recognizer.addListener('start', () => setState('listening')),
      recognizer.addListener('speechend', () => setState('processing')),
      recognizer.addListener('result', (event) => {
        const text = event.results[0]?.transcript?.trim() ?? '';
        if (event.isFinal) finalText.current = [finalText.current, text].filter(Boolean).join(' ');
        setTranscript(event.isFinal ? finalText.current : [finalText.current, text].filter(Boolean).join(' '));
      }),
      recognizer.addListener('volumechange', (event) => {
        // Android reports roughly -2..10 dB; iOS similar. Map to 0..1.
        setLevel(Math.max(0, Math.min(1, (event.value + 2) / 12)));
      }),
      recognizer.addListener('error', (event) => {
        // "no-speech" and "aborted" are normal outcomes, not errors worth showing.
        if (event.error === 'not-allowed') setError('Permite el micrófono en Ajustes para preguntar con la voz.');
        else if (event.error !== 'no-speech' && event.error !== 'aborted') setError('No pude escucharte bien. Intenta de nuevo.');
      }),
      recognizer.addListener('end', () => {
        setState('idle');
        setLevel(0);
        const text = finalText.current.trim();
        finalText.current = '';
        setTranscript('');
        if (text) onFinal.current(text);
      }),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, []);

  const start = useCallback(async () => {
    const module = loadSpeech();
    if (!module || state !== 'idle') return;
    setError(null);
    setState('starting');
    const permission = await module.ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setState('idle');
      setError('Permite el micrófono en Ajustes para preguntar con la voz.');
      return;
    }
    finalText.current = '';
    setTranscript('');
    module.ExpoSpeechRecognitionModule.start({
      lang: options.lang ?? 'es-UY',
      interimResults: true,
      continuous: false,
      addsPunctuation: true,
      // Merchant and app vocabulary the recognizer would otherwise misspell.
      contextualStrings: ['BrainIA', 'PedidosYa', 'Uber', 'Spotify', 'UYU', 'USD'],
      volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
      androidIntentOptions: { EXTRA_LANGUAGE_MODEL: 'web_search' },
    });
  }, [options.lang, state]);

  /** Finishes listening; the transcript so far is delivered through onFinal. */
  const stop = useCallback(() => loadSpeech()?.ExpoSpeechRecognitionModule.stop(), []);
  /** Cancels without sending anything. */
  const cancel = useCallback(() => {
    finalText.current = '';
    loadSpeech()?.ExpoSpeechRecognitionModule.abort();
  }, []);

  return { available, state, listening: state !== 'idle', transcript, level, error, clearError: () => setError(null), start, stop, cancel };
}

/** Whether this build and device can dictate (native module present and a recognizer available). */
export function isVoiceAvailable() {
  return loadSpeech() !== null;
}
