import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Surface } from '@/components/primitives';
import { useTheme } from '@/lib/app-state';
import { cleanDisplayText } from '@/lib/format';

export function EmptyState({
  title,
  description,
  icon,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}) {
  const theme = useTheme();

  return (
    <Surface variant="subtle" style={{ alignItems: 'center', gap: theme.spacing.md }}>
      {icon}
      <Text style={[theme.typography.headline, { color: theme.colors.textPrimary, textAlign: 'center' }]}>{cleanDisplayText(title)}</Text>
      {description ? <Text style={[theme.typography.body, { color: theme.colors.textSecondary, textAlign: 'center' }]}>{cleanDisplayText(description)}</Text> : null}
      <View style={styles.row}>
        {primaryActionLabel && onPrimaryAction ? <Button label={primaryActionLabel} onPress={onPrimaryAction} /> : null}
        {secondaryActionLabel && onSecondaryAction ? <Button label={secondaryActionLabel} onPress={onSecondaryAction} variant="secondary" /> : null}
      </View>
    </Surface>
  );
}

export function ErrorState({
  title,
  description,
  errorCode,
  retryLabel = 'Reintentar',
  onRetry,
}: {
  title: string;
  description?: string;
  errorCode?: string;
  retryLabel?: string;
  onRetry?: () => void;
}) {
  const theme = useTheme();

  return (
    <Surface variant="subtle" style={{ gap: theme.spacing.sm }}>
      <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>{cleanDisplayText(title)}</Text>
      {description ? <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{cleanDisplayText(description)}</Text> : null}
      {errorCode ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{cleanDisplayText(errorCode)}</Text> : null}
      {onRetry ? <Button label={retryLabel} onPress={onRetry} variant="secondary" /> : null}
    </Surface>
  );
}

export function LoadingSkeleton({ variant = 'card', count = 1 }: { variant?: 'card' | 'list' | 'detail' | 'chart'; count?: number }) {
  const theme = useTheme();
  const itemHeight = variant === 'chart' ? 120 : variant === 'detail' ? 88 : variant === 'list' ? 64 : 96;

  return (
    <View accessibilityRole="progressbar" accessibilityLabel={`${variant} loading state`} style={{ gap: theme.spacing.md }}>
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={{
            height: itemHeight,
            borderRadius: theme.radius.lg,
            backgroundColor: theme.colors.surfaceSubtle,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: theme.colors.border,
          }}
        />
      ))}
    </View>
  );
}

export const LoadingState = LoadingSkeleton;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
