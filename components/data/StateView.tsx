import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '@/components/glass/GlassSurface';
import { Button } from '@/components/controls';
import { SkeletonChartCard, SkeletonHeroAmount, SkeletonRow, SkeletonSignalCard } from '@/components/skeletons/parts';
import { IconTile } from './Row';
import { SkeletonBlock, SkeletonGroup, SkeletonLine } from './Skeleton';
import { useTheme } from '@/lib/app-state';
import { cleanDisplayText } from '@/lib/format';

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

  if (kind === 'loading') {
    return (
      <SkeletonGroup label={title === 'Cargando' ? undefined : title} style={{ gap: theme.spacing.sm }}>
        {Array.from({ length: skeletonCount }).map((_, index) => <GenericSkeleton key={index} variant={skeleton} />)}
      </SkeletonGroup>
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

/** One placeholder of a generic loading variant; the per-view skeletons mirror their own screens instead. */
function GenericSkeleton({ variant }: { variant: 'list' | 'hero' | 'chart' | 'detail' | 'card' }) {
  switch (variant) {
    case 'chart':
      return <SkeletonChartCard legend={false} />;
    case 'card':
      return <SkeletonSignalCard variant="card" />;
    case 'hero':
      return (
        <GlassSurface level="strong" padding="lg" contentStyle={{ gap: 12 }}>
          <SkeletonLine width="38%" lineHeight={14} />
          <SkeletonHeroAmount />
          <SkeletonLine width="64%" lineHeight={16} />
        </GlassSurface>
      );
    case 'detail':
      return (
        <GlassSurface level="thin" padding="md" contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <SkeletonBlock width={48} height={48} radius={15} />
          <View style={{ flex: 1 }}>
            <SkeletonLine width="56%" lineHeight={21} />
            <SkeletonLine lineHeight={16} />
            <SkeletonLine width="70%" lineHeight={16} />
          </View>
        </GlassSurface>
      );
    default:
      return <SkeletonRow trailing />;
  }
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
