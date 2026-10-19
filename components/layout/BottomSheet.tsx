import { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassPressable } from '@/components/glass/GlassPressable';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/lib/app-state';
import { cleanDisplayText } from '@/lib/format';

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
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const maxSheetHeight = Math.max(320, height - insets.top - insets.bottom - 24);

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.scrim, { backgroundColor: theme.depth.overlay, paddingTop: insets.top + theme.spacing.sm, paddingBottom: insets.bottom + theme.spacing.md }]}>
          <GlassPressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={StyleSheet.absoluteFill}> <View /> </GlassPressable>
          <Animated.View entering={FadeInDown.springify().damping(18).stiffness(180)} style={{ marginTop: 'auto', width: '100%' }}>
            <GlassSurface level="strong" chrome radius="xl" padding="lg" style={{ maxHeight: maxSheetHeight, borderRadius: theme.radius.sheet }} contentStyle={{ gap: theme.spacing.md }}>
              <View style={styles.header}>
                <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>{cleanDisplayText(title)}</Text>
                <GlassPressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={10} scaleTo={0.9} style={styles.close}>
                  <Feather name="x" size={18} color={theme.colors.textPrimary} />
                </GlassPressable>
              </View>
              <ScrollView
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}
              >
                {children}
              </ScrollView>
              {footer}
            </GlassSurface>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
