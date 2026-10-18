import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, ScrollViewProps, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/primitives';
import { useTheme } from '@/lib/app-state';
import { cleanDisplayText } from '@/lib/format';
import { NavigationRail } from './NavigationRail';

export function AppScreen({
  children,
  scrollable = true,
  contentStyle,
  footer,
  stickyFooter,
  refreshing = false,
  onRefresh,
}: {
  children: ReactNode;
  scrollable?: boolean;
  contentStyle?: ScrollViewProps['contentContainerStyle'];
  footer?: ReactNode;
  stickyFooter?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const {width}=useWindowDimensions();
  const desktop=width>=1024;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background,flexDirection:'row' }]}>
      {desktop?<NavigationRail/>:null}
      {/* Android already resizes this activity (adjustResize in the manifest).
          Applying a second height-based keyboard avoidance shrinks the screen
          twice, which breaks the capture form and its sticky save action. */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        enabled={Platform.OS === 'ios'}
      >
      {scrollable ? (
        <ScrollView
          style={styles.flex}
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} colors={[theme.colors.accent]} /> : undefined}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: theme.spacing.lg,
              paddingHorizontal:desktop?40:20,
              width:'100%',maxWidth:1440,alignSelf:'center',gap:24,
              paddingBottom: (stickyFooter ? theme.spacing.xl : theme.spacing.xxxl) + insets.bottom,
            },
            contentStyle,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        >
          {children}
          {footer}
        </ScrollView>
      ) : (
        <View style={[styles.flex, styles.scrollContent, { paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.xxxl + insets.bottom }]}>
          {children}
          {footer}
        </View>
      )}
      {stickyFooter ? <View style={[styles.stickyFooter, { backgroundColor: theme.colors.background, borderTopColor: theme.colors.border, paddingBottom: Math.max(theme.spacing.sm, insets.bottom) }]}>{stickyFooter}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export const AppShell = AppScreen;

export function TopBar({
  title,
  subtitle,
  actionLabel,
  onActionPress,
  secondaryAction,
  showBack = false,
  backLabel = 'Volver',
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  secondaryAction?: ReactNode;
  showBack?: boolean;
  backLabel?: string;
}) {
  const theme = useTheme();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
      {showBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          onPress={handleBack}
          hitSlop={12}
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: theme.colors.surfaceSubtle, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="arrow-left" size={16} color={theme.colors.textPrimary} />
          <Text style={[theme.typography.caption, { color: theme.colors.textPrimary }]}>{backLabel}</Text>
        </Pressable>
      ) : null}
      <View style={styles.rowBetween}>
        <View style={{ flex: 1, paddingRight: theme.spacing.md }}>
          <View style={[styles.brandRow, { marginBottom: 6 }]}>
            <View style={[styles.brandDot, { backgroundColor: theme.colors.accent }]} />
            <Text style={[theme.typography.overline, { color: theme.colors.accentStrong }]}>BRAIN IA / PERSONAL</Text>
          </View>
          <Text style={[theme.typography.display, { color: theme.colors.textPrimary }]}>{cleanDisplayText(title)}</Text>
          {subtitle ? <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginTop: 4 }]}>{cleanDisplayText(subtitle)}</Text> : null}
        </View>
        <View style={styles.row}>
          <IconButton icon={<Feather name="plus" size={20} color={theme.colors.accent}/>} label="Capturar" onPress={()=>router.push('/capture')}/>
          {secondaryAction}
          {actionLabel ? (
            <IconButton icon={<Feather name="sliders" size={18} color={theme.colors.textPrimary} />} label={actionLabel} onPress={onActionPress ?? (() => router.push('/settings'))} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

export const ScreenHeader = TopBar;

export function Section({
  title,
  subtitle,
  actionLabel,
  onActionPress,
  count,
  children,
}: {
  title?: string;
  subtitle?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  count?: number;
  children: ReactNode;
}) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
      {title ? <SectionHeader title={title} subtitle={subtitle} actionLabel={actionLabel} onActionPress={onActionPress} count={count} /> : null}
      {children}
    </View>
  );
}

export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onActionPress,
  count,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  count?: number;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.rowBetween, { marginBottom: theme.spacing.xs, alignItems: 'flex-end' }]}>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.row}>
          <Text style={[theme.typography.overline, { color: theme.colors.textMuted }]}>{cleanDisplayText(title)}</Text>
          {typeof count === 'number' ? (
            <View style={[styles.pill, { backgroundColor: theme.colors.surfaceSubtle }]}>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{count}</Text>
            </View>
          ) : null}
        </View>
        {subtitle ? <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{cleanDisplayText(subtitle)}</Text> : null}
      </View>
      {actionLabel ? (
        <Pressable accessibilityRole="button" onPress={onActionPress} hitSlop={8} style={styles.row}>
          <Text style={[theme.typography.caption, { color: theme.colors.accentStrong }]}>{cleanDisplayText(actionLabel)}</Text>
          <Feather name="chevron-right" size={14} color={theme.colors.accentStrong} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function SectionTitle(props: { title: string; subtitle?: string; actionLabel?: string; onActionPress?: () => void; count?: number }) {
  return <SectionHeader {...props} />;
}

export function DetailBlock({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const theme = useTheme();

  return (
    <View style={{ marginBottom: theme.spacing.lg }}>
      <SectionHeader title={title} subtitle={subtitle} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  stickyFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  brandDot: {
    width: 9,
    height: 9,
    borderRadius: 3,
  },
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
  },
});
