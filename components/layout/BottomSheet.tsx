import { ReactNode, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Easing, ReduceMotion, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassPressable } from '@/components/glass/GlassPressable';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/lib/app-state';
import { cleanDisplayText } from '@/lib/format';
import { useReduceMotion } from '@/lib/hooks';
import { StaggerGroup } from '@/components/layout/Screen';
import { ToastHost, useToastOverlay } from '@/components/layout/Toast';

export function BottomSheet({
  visible,
  title,
  children,
  onClose,
  footer,
}: {
  visible: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const [availableHeight, setAvailableHeight] = useState(height);
  const maxSheetHeight = Math.min(availableHeight, height - insets.top - insets.bottom - theme.spacing.xl);
  const progress = useSharedValue(visible ? 1 : 0);
  useToastOverlay(mounted);
  // Retain the Modal after visible becomes false so its exit can complete.
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    progress.set(withTiming(visible ? 1 : 0, {
      duration: reduceMotion ? theme.motion.duration.reduced : theme.motion.duration.quick,
      easing: Easing.bezier(...theme.motion.easing.out),
      reduceMotion: ReduceMotion.Never,
    }, (finished) => {
      if (finished && !visible) runOnJS(setMounted)(false);
    }));
  }, [progress, reduceMotion, theme.motion, visible]);
  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const transitionStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: reduceMotion ? 0 : (1 - progress.value) * theme.motion.distance.push }],
  }));

  // Drag the handle or title down to dismiss; a short drag springs back.
  const dragY = useSharedValue(0);
  const drag = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .onUpdate((event) => {
      dragY.set(Math.max(0, event.translationY));
    })
    .onEnd((event) => {
      if (event.translationY > 96 || event.velocityY > 900) {
        runOnJS(onClose)();
        // A busy sheet may reject the close; never leave it dragged off-screen.
        dragY.set(withTiming(0, { duration: theme.motion.duration.quick }));
      } else {
        dragY.set(withSpring(0, theme.motion.spring.thumb));
      }
    });
  const sheetDragStyle = useAnimatedStyle(() => ({ transform: [{ translateY: dragY.value }] }));

  return (
    <Modal visible={mounted} animationType="none" transparent statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.flex}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View onLayout={(event) => setAvailableHeight(Math.max(0, event.nativeEvent.layout.height - insets.top - insets.bottom - theme.spacing.sm - theme.spacing.md))} style={[styles.scrim, { paddingHorizontal: theme.spacing.md, paddingTop: insets.top + theme.spacing.sm, paddingBottom: insets.bottom + theme.spacing.md }]}>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.depth.overlay }, scrimStyle]} />
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} style={StyleSheet.absoluteFill} />
          <Animated.View style={[{ marginTop: 'auto', width: '100%', maxHeight: '100%', flexShrink: 1 }, transitionStyle]}>
            <Animated.View style={[{ maxHeight: '100%', flexShrink: 1 }, sheetDragStyle]}>
            <GlassSurface level="strong" chrome radius="xl" padding="lg" style={{ maxHeight: Math.max(0, maxSheetHeight), flexShrink: 1, borderRadius: theme.radius.sheet }} contentStyle={{ gap: theme.spacing.md, flexShrink: 1, minHeight: 0 }}>
              <GestureDetector gesture={drag}>
              <View collapsable={false} style={{ gap: theme.spacing.sm, marginTop: -theme.spacing.xs }}>
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.handle, { backgroundColor: theme.glass.edge[0] }]} />
              <View style={[styles.header, { gap: theme.spacing.md }]}>
                <Text accessibilityRole="header" style={[theme.typography.headline, { color: theme.colors.textPrimary, flex: 1 }]}>{cleanDisplayText(title)}</Text>
                <GlassPressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} hitSlop={10} scaleTo={0.9} style={styles.close}>
                  <Feather name="x" size={18} color={theme.colors.textPrimary} />
                </GlassPressable>
              </View>
              </View>
              </GestureDetector>
              <ScrollView
                style={{ flexShrink: 1 }}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}
              >
                <StaggerGroup gap={theme.spacing.md}>{children}</StaggerGroup>
              </ScrollView>
              {footer}
            </GlassSurface>
            </Animated.View>
          </Animated.View>
        </View>
        <ToastHost modal />
      </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

// Screen must leave this native modal out of its scroll-content wrappers.
BottomSheet.screenOverlay = true;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    opacity: 0.8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
