import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassPressable } from '@/components/glass/GlassPressable';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { useTheme } from '@/lib/app-state';
import { cleanDisplayText } from '@/lib/format';

type ToastAction = { label: string; onPress: () => void };
type ToastMessage = { id: number; message: string; action?: ToastAction; tone?: 'neutral' | 'positive' | 'danger' };

type ToastContextValue = {
  show: (message: string, options?: { action?: ToastAction; tone?: ToastMessage['tone']; duration?: number }) => void;
  hide: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const show = useCallback<ToastContextValue['show']>((message, options) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message, action: options?.action, tone: options?.tone });
    timer.current = setTimeout(hide, options?.duration ?? 5_000);
  }, [hide]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <ToastContext.Provider value={{ show, hide }}>
      {children}
      {toast ? <ToastView toast={toast} onDismiss={hide} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const accent = toast.tone === 'danger' ? theme.colors.danger : toast.tone === 'positive' ? theme.colors.accent : theme.colors.textPrimary;

  return (
    <Animated.View
      entering={FadeInDown.duration(theme.motion.duration.quick)}
      exiting={FadeOutDown.duration(theme.motion.duration.quick)}
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: 84 + insets.bottom }]}
    >
      <GlassSurface level="strong" chrome padding="none" radius="md" style={{ alignSelf: 'center' }}>
        <View accessibilityLiveRegion="polite" style={styles.toast}>
          <View style={[styles.dot, { backgroundColor: accent }]} />
          <Text numberOfLines={3} style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary, flex: 1, fontSize: 14 }]}>
            {cleanDisplayText(toast.message)}
          </Text>
          {toast.action ? (
            <GlassPressable accessibilityRole="button" accessibilityLabel={toast.action.label} onPress={() => { toast.action?.onPress(); onDismiss(); }} hitSlop={8} scaleTo={0.94} style={styles.action}>
              <Text style={[theme.typography.bodyStrong, { color: theme.colors.accentStrong, fontSize: 13 }]}>{cleanDisplayText(toast.action.label)}</Text>
            </GlassPressable>
          ) : null}
        </View>
      </GlassSurface>
    </Animated.View>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used within ToastProvider');
  return value;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  toast: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: 440,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  action: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
});
