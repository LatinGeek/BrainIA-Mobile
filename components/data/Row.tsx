import { Feather } from '@expo/vector-icons';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, Text, View, ViewStyle, useWindowDimensions } from 'react-native';

import { GlassPressable } from '@/components/glass/GlassPressable';
import { useTheme } from '@/lib/app-state';
import { cleanDisplayText, formatCurrency, parseCurrency } from '@/lib/format';

type IconName = React.ComponentProps<typeof Feather>['name'];

export function IconTile({
  icon,
  size = 'md',
  color,
  tint,
}: {
  icon: IconName;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  tint?: string;
}) {
  const theme = useTheme();
  const box = size === 'sm' ? 30 : size === 'lg' ? 48 : 38;
  const resolvedColor = color ?? theme.colors.textSecondary;

  return (
    <View
      style={{
        width: box,
        height: box,
        borderRadius: Math.round(box * 0.32),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tint ?? theme.glass.inner,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: `${resolvedColor}33`,
      }}
    >
      <Feather name={icon} size={size === 'sm' ? 14 : size === 'lg' ? 21 : 17} color={resolvedColor} />
    </View>
  );
}

export function Row({
  title,
  subtitle,
  description,
  leading,
  trailing,
  accessory = 'chevron',
  selected = false,
  expanded = false,
  switchValue,
  onSwitchChange,
  onPress,
  onLongPress,
  disabled,
  style,
}: {
  title: string;
  subtitle?: string;
  description?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  accessory?: 'chevron' | 'switch' | 'expand' | 'none';
  selected?: boolean;
  expanded?: boolean;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const foreground = selected ? theme.glass.onSelected : theme.colors.textPrimary;
  const secondary = selected ? `${theme.glass.onSelected}B0` : theme.colors.textSecondary;
  const tertiary = selected ? `${theme.glass.onSelected}80` : theme.colors.textMuted;
  const content = (
    <View style={styles.row}>
      {leading ? <View style={{ marginRight: 12 }}>{leading}</View> : null}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={2} style={[theme.typography.bodyStrong, { color: foreground }]}>{cleanDisplayText(title)}</Text>
        {subtitle ? <Text numberOfLines={2} style={[theme.typography.caption, { color: secondary }]}>{cleanDisplayText(subtitle)}</Text> : null}
        {description ? <Text numberOfLines={2} style={[theme.typography.caption, { color: tertiary }]}>{cleanDisplayText(description)}</Text> : null}
      </View>
      {trailing ? <View style={{ marginLeft: 12, alignItems: 'flex-end' }}>{trailing}</View> : null}
      {accessory === 'chevron' && onPress && !trailing ? <Feather name="chevron-right" size={16} color={tertiary} style={{ marginLeft: 6 }} /> : null}
      {accessory === 'expand' ? <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={17} color={tertiary} style={{ marginLeft: 6 }} /> : null}
      {accessory === 'switch' && onSwitchChange ? (
        <Switch
          accessibilityLabel={title}
          value={Boolean(switchValue)}
          onValueChange={onSwitchChange}
          trackColor={{ false: theme.glass.divider, true: `${theme.colors.accent}80` }}
          thumbColor={switchValue ? theme.colors.accent : theme.colors.textPrimary}
        />
      ) : null}
    </View>
  );

  if (!onPress && !onLongPress) {
    return (
      <View style={[styles.shell, { backgroundColor: selected ? theme.glass.selected : 'transparent', borderBottomColor: theme.glass.divider }, style]}>
        {content}
      </View>
    );
  }

  return (
    <GlassPressable
      accessibilityRole="button"
      accessibilityLabel={cleanDisplayText(title)}
      accessibilityState={{ selected, expanded, disabled }}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      scaleTo={0.985}
      style={[styles.shell, { backgroundColor: selected ? theme.glass.selected : 'transparent', borderBottomColor: theme.glass.divider, opacity: disabled ? 0.5 : 1 }, style]}
    >
      {content}
    </GlassPressable>
  );
}

export function Amount({
  value,
  currency,
  tone = 'neutral',
  size = 'row',
  prefix,
  animated = true,
  signed = false,
}: {
  value: string | number;
  currency?: string;
  tone?: 'neutral' | 'income' | 'expense' | 'positive' | 'transfer';
  size?: 'row' | 'tile' | 'hero';
  prefix?: string;
  animated?: boolean;
  signed?: boolean;
}) {
  const theme = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const target = typeof value === 'number' ? value : parseCurrency(value);
  const [display, setDisplay] = useState(animated ? 0 : target);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (!animated) return;
    const startedAt = Date.now();
    const from = display;
    const duration = theme.motion.duration.count;
    const tick = () => {
      const progress = Math.min(1, (Date.now() - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (target - from) * eased);
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
    // Intentionally animate from the previous rendered value only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animated, target, theme.motion.duration.count]);

  const color = tone === 'income' || tone === 'positive'
    ? theme.status.income
    : tone === 'expense'
      ? theme.status.expense
      : tone === 'transfer'
        ? theme.status.transfer
        : theme.colors.textPrimary;
  const largeText = fontScale >= 1.3;
  const heroSize = (width < 360 ? 28 : 36) * (largeText ? 0.85 : 1);
  const fontSize = size === 'hero' ? heroSize : size === 'tile' ? 24 : 15;
  const lineHeight = size === 'hero' ? Math.round(heroSize * 1.17) : size === 'tile' ? 30 : 20;
  const shown = animated ? display : target;
  const formatted = currency
    ? formatCurrency(Math.abs(shown), currency.toUpperCase())
    : new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 }).format(Math.abs(shown));
  const sign = prefix ?? (signed ? (target < 0 ? '−' : '+') : target < 0 ? '−' : '');
  return (
    <View style={styles.amountRow} accessibilityLabel={`${sign}${formatted}`}>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.55}
        style={[
          theme.typography.numeral,
          { color, fontSize, lineHeight, letterSpacing: size === 'row' ? -0.2 : -1.2 },
        ]}
      >
        {sign}{formatted}
      </Text>
      {currency && size !== 'hero' ? <Text style={[theme.typography.mono, { color: theme.colors.textMuted, fontSize: 10 }]}>{currency.toUpperCase()}</Text> : null}
    </View>
  );
}

export function TransactionRow({
  transaction,
  currency,
  onPress,
  selected = false,
  selectionMode = false,
  onLongPress,
  visibility = 'balanced',
}: {
  transaction: import('@/lib/domain').TransactionSummary;
  currency?: string;
  onPress?: () => void;
  selected?: boolean;
  selectionMode?: boolean;
  onLongPress?: () => void;
  visibility?: 'essential' | 'balanced' | 'detailed';
}) {
  const theme = useTheme();
  const merchant = transaction.displayMerchantLabel ?? transaction.merchantLabel;
  const subtitle = transaction.kind === 'transfer'
    ? 'Transfer'
    : transaction.kind === 'income'
      ? 'Income'
      : cleanDisplayText(transaction.category || 'Needs category review');
  return (
    <Row
      title={merchant}
      subtitle={[subtitle, visibility !== 'essential' ? transaction.account : undefined].filter(Boolean).join(' · ')}
      leading={<IconTile icon={transaction.kind === 'income' ? 'arrow-down-left' : transaction.kind === 'transfer' ? 'repeat' : 'arrow-up-right'} color={transaction.kind === 'income' ? theme.status.income : transaction.kind === 'transfer' ? theme.status.transfer : theme.status.expense} />}
      trailing={<Amount value={transaction.amount} currency={currency ?? transaction.currency} tone={transaction.kind === 'income' ? 'income' : 'expense'} size="row" animated={false} />}
      selected={selected}
      onPress={onPress}
      onLongPress={onLongPress}
      accessory={onPress && !selectionMode ? 'chevron' : 'none'}
      disabled={selectionMode && !onPress}
    />
  );
}

const styles = StyleSheet.create({
  shell: {
    minHeight: 52,
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    gap: 6,
  },
});
