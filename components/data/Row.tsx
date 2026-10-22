import { Feather } from '@expo/vector-icons';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Easing } from 'react-native-reanimated';
import { StyleSheet, Switch, Text, View, ViewStyle, useWindowDimensions } from 'react-native';

import { GlassPressable } from '@/components/glass/GlassPressable';
import { useTheme } from '@/lib/app-state';
import { cleanDisplayText, formatCategoryLabel, formatCurrency, parseCurrency } from '@/lib/format';
import { useReduceMotion } from '@/lib/hooks';
import { useScreenEntering } from '@/components/layout/Screen';

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
  titleLines = 2,
  descriptionLines = 2,
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
  /** Lines before the title is cut off; 0 shows it in full (model sentences). */
  titleLines?: number;
  /** Lines before the subtitle and description are cut off; 0 shows them in full. */
  descriptionLines?: number;
}) {
  const theme = useTheme();
  const foreground = selected ? theme.glass.onSelected : theme.colors.textPrimary;
  const secondary = selected ? `${theme.glass.onSelected}B0` : theme.colors.textSecondary;
  const tertiary = selected ? `${theme.glass.onSelected}80` : theme.colors.textMuted;
  const content = (
    <View style={styles.row}>
      {leading ? <View style={{ marginRight: 12 }}>{leading}</View> : null}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={titleLines || undefined} style={[theme.typography.bodyStrong, { color: foreground }]}>{cleanDisplayText(title)}</Text>
        {subtitle ? <Text numberOfLines={descriptionLines || undefined} style={[theme.typography.caption, { color: secondary }]}>{cleanDisplayText(subtitle)}</Text> : null}
        {description ? <Text numberOfLines={descriptionLines || undefined} style={[theme.typography.caption, { color: tertiary }]}>{cleanDisplayText(description)}</Text> : null}
      </View>
      {trailing ? <View style={{ marginLeft: 12, alignItems: 'flex-end' }}>{trailing}</View> : null}
      {accessory === 'chevron' && onPress && !trailing ? <Feather name="chevron-right" size={16} color={tertiary} style={{ marginLeft: 6 }} /> : null}
      {accessory === 'expand' ? <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={17} color={tertiary} style={{ marginLeft: 6 }} /> : null}
      {accessory === 'switch' && onSwitchChange ? (
        <Switch
          accessibilityLabel={title}
          disabled={disabled}
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

/** JS numerals retain native text fitting and write at most 30 frames per second. */
export function useCountedAmount(target: number, animated = true) {
  const { motion: M } = useTheme();
  const reduceMotion = useReduceMotion();
  const entering = useScreenEntering();
  const [display, setDisplay] = useState(animated && entering && !reduceMotion ? 0 : target);
  const lastDisplay = useRef(display);
  useEffect(() => {
    if (!animated || reduceMotion) {
      lastDisplay.current = target;
      // Sync the stored value too so disabling Reduce Motion cannot restore a stale amount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplay(target);
      return;
    }
    const from = lastDisplay.current;
    if (from === target) return;
    const startedAt = Date.now();
    let lastWrite = startedAt;
    let frame: number;
    const ease = Easing.bezier(...M.easing.out).factory();
    const tick = () => {
      const now = Date.now();
      const progress = Math.min(1, (now - startedAt) / M.duration.count);
      if (progress === 1 || now - lastWrite >= 1000 / 30) {
        lastWrite = now;
        lastDisplay.current = progress === 1 ? target : from + (target - from) * ease(progress);
        setDisplay(lastDisplay.current);
      }
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [M.duration.count, M.easing.out, animated, reduceMotion, target]);
  return !animated || reduceMotion ? target : display;
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
  const display = useCountedAmount(target, animated);

  const color = tone === 'income' || tone === 'positive'
    ? theme.status.income
    : tone === 'expense'
      ? theme.status.expense
      : tone === 'transfer'
        ? theme.status.transfer
        : theme.colors.textPrimary;
  const largeText = fontScale >= 1.3;
  const heroSize = (width < 360 ? 28 : 36) * (largeText ? 0.85 : 1);
  const shown = animated ? display : target;
  const known = !!currency && hasKnownCurrency(currency);
  const plain = (v: number) => new Intl.NumberFormat('es-UY', { minimumFractionDigits: currency ? 2 : 0, maximumFractionDigits: currency ? 2 : 0 }).format(v);
  const money = (v: number) => (known ? formatCurrency(v, currency.toUpperCase()) : plain(v));
  const formatted = money(Math.abs(shown));
  const sign = prefix ?? (signed ? (target < 0 ? '−' : '+') : target < 0 ? '−' : '');
  // adjustsFontSizeToFit is native-only, so size tile numerals from the final
  // value's length against a half-width tile's inner width. The currency code
  // wraps under the value when they do not fit on one line.
  const finalLength = sign.length + money(Math.abs(target)).length;
  const tileWidth = largeText ? width - 72 : (Math.min(width, 520) - 48) / 2 - 28;
  const tileSize = Math.max(14, Math.min(24, tileWidth / (finalLength * 0.62)));
  const fontSize = size === 'hero' ? heroSize : size === 'tile' ? tileSize : 15;
  const lineHeight = size === 'hero' ? Math.round(heroSize * 1.17) : size === 'tile' ? Math.round(tileSize * 1.25) : 20;
  return (
    <View style={[styles.amountRow, size === 'tile' ? { flexWrap: 'wrap' } : null, size === 'row' ? { flexDirection: 'column', alignItems: 'flex-end', gap: 0 } : null]} accessibilityLabel={`${sign}${money(Math.abs(target))}${currency && !known ? ', moneda sin definir' : ''}`}>
      <Text
        accessibilityLabel={`${sign}${money(Math.abs(target))}${currency && !known ? ', moneda sin definir' : ''}`}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.55}
        style={[
          theme.typography.numeral,
          { color, fontSize, lineHeight, letterSpacing: size === 'row' ? -0.2 : size === 'tile' ? -0.6 : -1.2, flexShrink: 1 },
        ]}
      >
        {sign}{formatted}
      </Text>
      {currency && (size !== 'hero' || !known) ? (size === 'row'
        ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted, fontSize: 11, lineHeight: 14 }]}>{known ? currency.toUpperCase() : 'sin moneda'}</Text>
        : <Text style={[theme.typography.mono, { color: theme.colors.textMuted, fontSize: 10 }]}>{known ? currency.toUpperCase() : 'SIN MONEDA'}</Text>) : null}
    </View>
  );
}

function hasKnownCurrency(code: string | null | undefined) {
  return /^[A-Za-z]{3}$/.test(code?.trim() ?? '') && code?.trim().toUpperCase() !== 'UNKNOWN';
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
    ? 'Transferencia'
    : transaction.kind === 'income'
      ? 'Ingreso'
      : formatCategoryLabel(transaction.category);
  return (
    <Row
      title={merchant}
      subtitle={[subtitle, visibility !== 'essential' ? transaction.account : undefined].filter(Boolean).join(' · ')}
      leading={<IconTile icon={transaction.kind === 'income' ? 'arrow-down-left' : transaction.kind === 'transfer' ? 'repeat' : 'arrow-up-right'} color={transaction.kind === 'income' ? theme.status.income : transaction.kind === 'transfer' ? theme.status.transfer : theme.status.expense} />}
      trailing={<Amount value={transaction.amount} currency={hasKnownCurrency(transaction.currency) ? currency ?? transaction.currency : transaction.currency} tone={transaction.kind === 'income' ? 'income' : 'expense'} size="row" animated={false} />}
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
    borderRadius: 14,
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
