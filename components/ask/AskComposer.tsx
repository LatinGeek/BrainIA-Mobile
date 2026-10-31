import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { GlassPressable } from '@/components/glass/GlassPressable';
import { useTheme } from '@/lib/app-state';
import { useReduceMotion } from '@/lib/hooks';
import { useVoiceInput } from '@/lib/use-voice-input';

const BAR_WEIGHTS = [0.55, 0.85, 1, 0.75, 0.5];

/** Five bars that follow the microphone level; a calm static shape with reduced motion. */
function LevelBars({ level }: { level: number }) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  return (
    <View style={styles.bars} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {BAR_WEIGHTS.map((weight, index) => <LevelBar key={index} level={reduceMotion ? 0.4 : level} weight={weight} color={theme.colors.accent} />)}
    </View>
  );
}

function LevelBar({ level, weight, color }: { level: number; weight: number; color: string }) {
  const height = useSharedValue(6);
  useEffect(() => {
    height.value = withSpring(6 + Math.min(1, level * weight * 1.4) * 18, { damping: 14, stiffness: 260 });
  }, [height, level, weight]);
  const style = useAnimatedStyle(() => ({ height: height.value }));
  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

function RoundButton({ icon, label, onPress, tone, disabled }: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
  tone: 'accent' | 'neutral' | 'danger';
  disabled?: boolean;
}) {
  const theme = useTheme();
  const background = tone === 'accent' ? theme.colors.accent : tone === 'danger' ? `${theme.colors.danger}26` : theme.glass.inner;
  const color = tone === 'accent' ? theme.colors.onAccent : tone === 'danger' ? theme.colors.danger : theme.colors.textPrimary;
  return (
    <GlassPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      haptic="light"
      scaleTo={0.9}
      hitSlop={4}
      style={[styles.round, {
        width: theme.layout.minTarget, height: theme.layout.minTarget,
        backgroundColor: background, opacity: disabled ? 0.4 : 1,
        borderColor: tone === 'neutral' ? theme.glass.divider : 'transparent',
      }]}
    >
      <Feather name={icon} size={18} color={color} />
    </GlassPressable>
  );
}

export function AskComposer({ busy, onSend, onStop, autoFocusKey }: {
  busy: boolean;
  onSend: (text: string, via: 'text' | 'voice') => void;
  onStop: () => void;
  /** Changing this value focuses the field (e.g. after "Nueva conversación"). */
  autoFocusKey?: number;
}) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const input = useRef<TextInput>(null);
  const voice = useVoiceInput({
    onFinal: (transcript) => {
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSend(transcript, 'voice');
    },
  });
  const listeningOpacity = useSharedValue(0);
  useEffect(() => {
    listeningOpacity.value = withTiming(voice.listening ? 1 : 0, { duration: theme.motion.duration.quick });
  }, [listeningOpacity, theme.motion.duration.quick, voice.listening]);
  const listeningStyle = useAnimatedStyle(() => ({ opacity: listeningOpacity.value }));

  useEffect(() => {
    if (autoFocusKey) input.current?.focus();
  }, [autoFocusKey]);

  const submit = () => {
    const value = text.trim();
    if (value.length < 2 || busy) return;
    setText('');
    onSend(value, 'text');
  };

  const canSend = text.trim().length >= 2 && !busy;

  return (
    <View style={{ gap: 6 }}>
      {voice.error ? (
        <GlassPressable accessibilityRole="button" accessibilityLabel={`${voice.error}. Toca para cerrar.`} onPress={voice.clearError} style={styles.errorRow}>
          <Feather name="mic-off" size={12} color={theme.colors.warning} />
          <Text style={[theme.typography.caption, { color: theme.colors.warning, flex: 1 }]}>{voice.error}</Text>
        </GlassPressable>
      ) : null}
      <View style={styles.row}>
        {voice.listening ? (
          <Animated.View
            accessibilityLiveRegion="polite"
            accessibilityLabel={voice.transcript ? `Escuchando: ${voice.transcript}` : 'Escuchando'}
            style={[styles.field, styles.listening, listeningStyle, {
              borderColor: `${theme.colors.accent}55`, backgroundColor: theme.colors.accentSoft, borderRadius: theme.radius.lg,
            }]}
          >
            <LevelBars level={voice.level} />
            <Text numberOfLines={2} style={[theme.typography.body, { flex: 1, color: voice.transcript ? theme.colors.textPrimary : theme.colors.textSecondary }]}>
              {voice.transcript || (voice.state === 'processing' ? 'Procesando…' : 'Te escucho…')}
            </Text>
          </Animated.View>
        ) : (
          <View style={[styles.field, { backgroundColor: theme.glass.solid.thin, borderColor: theme.glass.divider, borderRadius: theme.radius.lg }]}>
            <TextInput
              ref={input}
              value={text}
              onChangeText={setText}
              placeholder="Pregunta sobre tus gastos, notas, personas…"
              placeholderTextColor={theme.colors.textMuted}
              selectionColor={theme.colors.accent}
              accessibilityLabel="Escribe tu pregunta para BrainIA"
              multiline
              maxLength={1000}
              submitBehavior="submit"
              returnKeyType="send"
              onSubmitEditing={submit}
              style={[theme.typography.body, styles.input, { color: theme.colors.textPrimary }]}
            />
          </View>
        )}

        {voice.listening ? (
          <>
            <RoundButton icon="x" label="Cancelar dictado" tone="neutral" onPress={voice.cancel} />
            <RoundButton icon="check" label="Terminar y preguntar" tone="accent" onPress={voice.stop} />
          </>
        ) : busy ? (
          <RoundButton icon="square" label="Detener respuesta" tone="danger" onPress={onStop} />
        ) : canSend || !voice.available ? (
          <RoundButton icon="arrow-up" label="Enviar pregunta" tone="accent" disabled={!canSend} onPress={submit} />
        ) : (
          <RoundButton icon="mic" label="Preguntar con la voz" tone="accent" onPress={() => void voice.start()} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  field: { flex: 1, minHeight: 44, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center' },
  input: { maxHeight: 112, paddingHorizontal: 14, paddingTop: Platform.OS === 'ios' ? 12 : 8, paddingBottom: Platform.OS === 'ios' ? 12 : 8 },
  listening: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 8 },
  bars: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 26 },
  bar: { width: 3, borderRadius: 2 },
  round: { borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
});
