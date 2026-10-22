import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';

import { GlassSurface } from '@/components/glass/GlassSurface';
import { Button } from '@/components/controls';
import { IconTile } from './Row';
import { useTheme } from '@/lib/app-state';
import { cleanDisplayText } from '@/lib/format';
import { useReduceMotion } from '@/lib/hooks';

export type StateKind = 'empty' | 'error' | 'success' | 'loading';

export function StateView({
  kind = 'empty',
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  errorCode,
  skeleton = 'list',
  skeletonCount = 3,
  children,
}: {
  kind?: StateKind;
  icon?: React.ComponentProps<typeof import('@expo/vector-icons').Feather>['name'];
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  errorCode?: string;
  skeleton?: 'list' | 'hero' | 'chart' | 'detail' | 'card';
  skeletonCount?: number;
  children?: ReactNode;
}) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();

  if (kind === 'loading') {
    const height = skeleton === 'chart' ? 160 : skeleton === 'hero' ? 120 : skeleton === 'detail' ? 88 : 60;
    return (
      // Fades out instead of vanishing, so the content rising in behind it never meets an empty screen.
      <Animated.View exiting={reduceMotion ? undefined : FadeOut.duration(220)} accessibilityRole="progressbar" accessibilityLabel={'Cargando contenido'} style={{ gap: theme.spacing.sm }}>
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <GlassSurface key={index} level="thin" padding="none" style={{ height }} contentStyle={{ height }}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.glass.inner }]} />
          </GlassSurface>
        ))}
      </Animated.View>
    );
  }

  const accent = kind === 'error' ? theme.colors.danger : kind === 'success' ? theme.colors.accent : theme.colors.model;
  const resolvedIcon = icon ?? (kind === 'error' ? 'alert-triangle' : kind === 'success' ? 'check' : 'share-2');

  return (
    <GlassSurface level="thin" tone={kind === 'error' ? 'danger' : 'neutral'} padding="lg" contentStyle={{ alignItems: 'center', gap: 10 }}>
      <IconTile icon={resolvedIcon} size="md" color={accent} tint={`${accent}18`} />
      <Text style={[theme.typography.headline, { color: theme.colors.textPrimary, textAlign: 'center' }]}>{cleanDisplayText(title)}</Text>
      {description ? <Text style={[theme.typography.body, { color: theme.colors.textSecondary, textAlign: 'center' }]}>{cleanDisplayText(description)}</Text> : null}
      {errorCode ? <Text style={[theme.typography.mono, { color: theme.colors.textMuted }]}>{cleanDisplayText(errorCode)}</Text> : null}
      {children}
      {actionLabel && onAction ? (
        <View style={styles.actions}>
          <Button label={actionLabel} onPress={onAction} variant={kind === 'error' ? 'secondary' : 'primary'} />
          {secondaryActionLabel && onSecondaryAction ? <Button label={secondaryActionLabel} onPress={onSecondaryAction} variant="ghost" /> : null}
        </View>
      ) : null}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
});
