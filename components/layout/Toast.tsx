import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { useSegments } from 'expo-router';
import Animated, { FadeIn, FadeOut, FadeInDown, FadeOutDown, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassPressable } from '@/components/glass/GlassPressable';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { useTheme } from '@/lib/app-state';
import { cleanDisplayText } from '@/lib/format';
import { useReduceMotion } from '@/lib/hooks';

type ToastAction = { label: string; onPress: () => void };
type ToastMessage = { id: number; message: string; duration: number; action?: ToastAction; tone?: 'neutral' | 'positive' | 'danger' };

type ToastContextValue = {
  show: (message: string, options?: { action?: ToastAction; tone?: ToastMessage['tone']; duration?: number }) => void;
  hide: () => void;
  toast: ToastMessage | null;
  overlays: number;
  registerOverlay: () => () => void;
  inset: number;
  setInset: (offset: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sequence = useRef(0);
  const [screenReader, setScreenReader] = useState(true);
  const [overlays, setOverlays] = useState(0);
  const [inset, setInset] = useState(0);
  const shownAt = useRef(0);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const registerOverlay = useCallback(() => {
    // A toast from before a sheet opened belongs to the screen underneath; hosted in the sheet it would sit on its footer button.
    if (Date.now() - shownAt.current > 300) hide();
    setOverlays((count) => count + 1);
    return () => setOverlays((count) => Math.max(0, count - 1));
  }, [hide]);

  const show = useCallback<ToastContextValue['show']>((message, options) => {
    if (timer.current) clearTimeout(timer.current);
    shownAt.current = Date.now();
    setToast({ id: ++sequence.current, message, action: options?.action, tone: options?.tone, duration: options?.duration ?? Math.min(8000, 3000 + message.length * 50) });
  }, []);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((enabled) => { if (active) setScreenReader(enabled); }).catch(() => { if (active) setScreenReader(false); });
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    // Keep actionable feedback available while TalkBack is reading it.
    if (toast && !screenReader) timer.current = setTimeout(hide, toast.duration);
    return () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  }, [hide, screenReader, toast]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <ToastContext.Provider value={{ show, hide, toast, overlays, registerOverlay, inset, setInset }}>
      {children}
      <ToastHost />
    </ToastContext.Provider>
  );
}

/** A native Modal must contain its own host; the root host yields while it is open. */
export function useToastOverlay(mounted: boolean) {
  const register = useContext(ToastContext)?.registerOverlay;
  useEffect(() => mounted && register ? register() : undefined, [mounted, register]);
}

/** Screen may publish dock + measured pinned-bar height; reset on blur/unmount. */
export function useToastInset(offset: number) {
  const setInset = useContext(ToastContext)?.setInset;
  useEffect(() => { setInset?.(offset); return () => setInset?.(0); }, [offset, setInset]);
}

export function ToastHost({ modal = false }: { modal?: boolean }) {
  const context = useContext(ToastContext);
  if (!context || (!modal && context.overlays > 0)) return null;
  return context.toast ? <ToastView key={context.toast.id} toast={context.toast} onDismiss={context.hide} modal={modal} offset={context.inset} /> : null;
}

function ToastView({ toast, onDismiss, modal, offset }: { toast: ToastMessage; onDismiss: () => void; modal: boolean; offset: number }) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const bottom = modal ? theme.spacing.lg : Math.max(offset, segments[0] === '(tabs)' ? theme.layout.dockHeight : 0) + theme.spacing.lg;
  const accent = toast.tone === 'danger' ? theme.colors.danger : toast.tone === 'positive' ? theme.colors.accent : theme.colors.textPrimary;

  return (
    <Animated.View
      entering={reduceMotion ? FadeIn.duration(theme.motion.duration.reduced).reduceMotion(ReduceMotion.Never) : FadeInDown.duration(theme.motion.duration.quick)}
      exiting={reduceMotion ? FadeOut.duration(theme.motion.duration.reduced).reduceMotion(ReduceMotion.Never) : FadeOutDown.duration(theme.motion.duration.quick)}
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: bottom + insets.bottom, left: theme.spacing.lg + theme.spacing.xs, right: theme.spacing.lg + theme.spacing.xs }]}
    >
      <GlassSurface level="strong" chrome padding="none" radius="md" style={{ width: '100%', maxWidth: 440, alignSelf: 'center' }}>
        <View accessibilityLiveRegion="polite" style={[styles.toast, { gap: theme.spacing.md, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm }]}>
          <View style={[styles.dot, { backgroundColor: accent }]} />
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary, flex: 1, minWidth: 0 }]}>
            {cleanDisplayText(toast.message)}
          </Text>
          {toast.action ? (
            <GlassPressable accessibilityRole="button" accessibilityLabel={toast.action.label} onPress={() => { toast.action?.onPress(); onDismiss(); }} hitSlop={8} scaleTo={0.94} style={styles.action}>
              <Text style={[theme.typography.bodyStrong, { color: theme.colors.accentStrong, fontSize: 13 }]}>{cleanDisplayText(toast.action.label)}</Text>
            </GlassPressable>
          ) : null}
          <GlassPressable accessibilityRole="button" accessibilityLabel="Cerrar aviso" onPress={onDismiss} scaleTo={0.94} style={[styles.action, { minWidth: theme.layout.minTarget }]}>
            <Text style={[theme.typography.bodyStrong, { color: theme.colors.textSecondary }]}>×</Text>
          </GlassPressable>
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
    alignItems: 'center',
  },
  toast: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
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
