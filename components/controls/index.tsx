import { Feather } from '@expo/vector-icons';
import { ReactNode, Ref, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, withSpring } from 'react-native-reanimated';

import { GlassPressable } from '@/components/glass/GlassPressable';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { useTheme } from '@/lib/app-state';
import { cleanDisplayText } from '@/lib/format';
import { useReduceMotion } from '@/lib/hooks';
import { reducedFade } from '@/lib/motion';

type IconName = React.ComponentProps<typeof Feather>['name'];

/* -------------------------------------------------------------------------- */
/* Button                                                                     */
/* -------------------------------------------------------------------------- */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'onGlass';

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconOnly = false,
  full = false,
  accessibilityLabel,
  style,
}: {
  label?: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** sm and md meet the 44pt minimum; lg is the 52pt review answer size. */
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  iconOnly?: boolean;
  full?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const height = size === 'sm' ? theme.layout.minTarget : size === 'lg' ? theme.layout.answerTarget : 48;
  const isDisabled = disabled || loading;
  const palette: Record<ButtonVariant, { background: string; color: string; border: string }> = {
    primary: { background: theme.colors.accent, color: theme.colors.onAccent, border: theme.colors.accent },
    secondary: { background: theme.glass.inner, color: theme.colors.textPrimary, border: theme.glass.edge[0] },
    ghost: { background: 'transparent', color: theme.colors.textSecondary, border: 'transparent' },
    danger: { background: theme.colors.danger, color: theme.colors.onAccent, border: theme.colors.danger },
    onGlass: { background: theme.glass.selected, color: theme.glass.onSelected, border: theme.glass.selected },
  };
  const colors = palette[variant];

  return (
    <GlassPressable
      accessibilityRole="button"
      accessibilityLabel={cleanDisplayText(accessibilityLabel ?? label) || 'Botón'}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      haptic="light"
      scaleTo={0.94}
      onPress={onPress}
      style={[
        styles.button,
        {
          minHeight: height,
          height: iconOnly ? height : undefined,
          width: iconOnly ? height : undefined,
          paddingHorizontal: iconOnly ? 0 : size === 'sm' ? 14 : 18,
          borderRadius: theme.radius.pill,
          backgroundColor: colors.background,
          borderColor: colors.border,
          opacity: isDisabled ? 0.5 : 1,
          alignSelf: full ? 'stretch' : 'auto',
          flex: full ? 1 : undefined,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.color} />
      ) : (
        <>
          {icon}
          {!iconOnly && label ? (
            <Text numberOfLines={1} style={[theme.typography.bodyStrong, { color: colors.color, fontSize: size === 'sm' ? 13 : 15 }]}>
              {cleanDisplayText(label)}
            </Text>
          ) : null}
        </>
      )}
    </GlassPressable>
  );
}

export function ButtonGroup({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.buttonGroup, style]}>{children}</View>;
}

/* -------------------------------------------------------------------------- */
/* SegmentedControl                                                           */
/* -------------------------------------------------------------------------- */

export type SegmentItem<T extends string> = {
  value: T;
  label?: string;
  icon?: IconName;
  count?: number;
  accessibilityLabel?: string;
};

export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  size = 'md',
  scrollable = false,
  role = 'tab',
  accessibilityLabel,
}: {
  items: readonly SegmentItem<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'md' | 'mini';
  scrollable?: boolean;
  role?: 'tab' | 'radio';
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const [containerWidth, setContainerWidth] = useState(0);
  const reduceMotion = useReduceMotion();
  const thumbOpacity = useSharedValue(1);
  const thumbX = useSharedValue(0);
  const thumbWidth = useSharedValue(0);
  const height = size === 'mini' ? 28 : 38;
  useEffect(() => {
    const layout = layouts[value];
    if (!layout) return;
    thumbX.value = reduceMotion ? layout.x : withSpring(layout.x, theme.motion.spring.thumb);
    thumbWidth.value = reduceMotion ? layout.width : withSpring(layout.width, theme.motion.spring.thumb);
    thumbOpacity.value = reduceMotion ? 0 : 1;
    if (reduceMotion) thumbOpacity.value = withTiming(1, reducedFade);
  }, [reduceMotion, thumbOpacity, containerWidth, layouts, theme.motion.spring.thumb, thumbWidth, thumbX, value]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbX.value }],
    width: thumbWidth.value,
    opacity: thumbOpacity.value,
  }));

  return (
    <View
      accessibilityRole={role === 'radio' ? 'radiogroup' : 'tablist'}
      accessibilityLabel={accessibilityLabel}
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
      style={[
        styles.segmentTrack,
        {
          padding: size === 'mini' ? 3 : 4,
          borderRadius: theme.radius.pill,
          borderColor: theme.glass.divider,
          backgroundColor: theme.glass.solid.thin,
        },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: size === 'mini' ? 3 : 4,
            bottom: size === 'mini' ? 3 : 4,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.glass.selected,
          },
          thumbStyle,
        ]}
      />
      <View style={[styles.segmentRow, scrollable ? styles.segmentScroller : null]}>
        {items.map((item, index) => {
          const selected = item.value === value;
          return (
            <GlassPressable
              key={item.value}
              accessibilityRole={role}
              accessibilityLabel={item.accessibilityLabel ?? item.label ?? item.value}
              accessibilityState={{ selected }}
              haptic="selection"
              scaleTo={0.96}
              // The track's padding completes the 44pt target around a 38pt segment.
              hitSlop={size === 'mini' ? 8 : 4}
              onLayout={(event) => {
                const { x, width } = event.nativeEvent.layout;
                setLayouts((current) => current[item.value]?.x === x && current[item.value]?.width === width
                  ? current
                  : { ...current, [item.value]: { x, width } });
              }}
              onPress={() => onChange(item.value)}
              style={[
                styles.segment,
                {
                  height,
                  minWidth: size === 'mini' ? 42 : 64,
                  paddingHorizontal: size === 'mini' ? 8 : 12,
                  borderRadius: theme.radius.pill,
                  // Mini segments size to their label so short tracks never truncate.
                  flex: scrollable || size === 'mini' ? undefined : 1,
                },
              ]}
            >
              {item.icon ? (
                <Feather
                  name={item.icon}
                  size={size === 'mini' ? 13 : 15}
                  color={selected ? theme.glass.onSelected : theme.colors.textMuted}
                />
              ) : null}
              {item.label ? (
                <Text
                  numberOfLines={1}
                  style={[
                    theme.typography.caption,
                    {
                      color: selected ? theme.glass.onSelected : theme.colors.textSecondary,
                      fontFamily: selected ? 'Inter_600SemiBold' : 'Inter_500Medium',
                      fontSize: size === 'mini' ? 11 : 12,
                    },
                  ]}
                >
                  {cleanDisplayText(item.label)}
                </Text>
              ) : null}
              {typeof item.count === 'number' ? (
                <View style={[styles.segmentCount, { backgroundColor: selected ? `${theme.glass.onSelected}24` : theme.glass.inner }]}>
                  <Text style={[theme.typography.caption, { color: selected ? theme.glass.onSelected : theme.colors.textMuted, fontSize: 10 }]}>
                    {item.count}
                  </Text>
                </View>
              ) : null}
            </GlassPressable>
          );
        })}
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Chip + ChipGroup                                                           */
/* -------------------------------------------------------------------------- */

export function Chip({
  label,
  selected = false,
  count,
  icon,
  static: isStatic = false,
  canonical = false,
  alias = false,
  onPress,
  disabled,
}: {
  label: string;
  selected?: boolean;
  count?: number;
  icon?: IconName;
  static?: boolean;
  canonical?: boolean;
  alias?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const content = (
    <>
      {canonical ? <Feather name="check-circle" size={12} color={selected ? theme.glass.onSelected : theme.colors.success} /> : null}
      {alias ? <Feather name="corner-down-right" size={12} color={selected ? theme.glass.onSelected : theme.colors.textMuted} /> : null}
      {icon ? <Feather name={icon} size={13} color={selected ? theme.glass.onSelected : theme.colors.textSecondary} /> : null}
      <Text numberOfLines={1} style={[theme.typography.caption, { flexShrink: 1, color: selected ? theme.glass.onSelected : theme.colors.textSecondary, fontFamily: selected ? 'Inter_600SemiBold' : 'Inter_400Regular' }]}>
        {cleanDisplayText(label)}
      </Text>
      {typeof count === 'number' ? (
        <View style={[styles.chipCount, { backgroundColor: selected ? `${theme.glass.onSelected}1F` : theme.glass.inner }]}>
          <Text style={[theme.typography.caption, { color: selected ? theme.glass.onSelected : theme.colors.textMuted, fontSize: 10 }]}>{count}</Text>
        </View>
      ) : null}
      {selected && !isStatic ? <Feather name="x" size={12} color={theme.glass.onSelected} /> : null}
    </>
  );

  if (isStatic || !onPress) {
    return (
      <View style={[styles.chip, { backgroundColor: selected ? theme.glass.selected : theme.glass.inner, borderColor: selected ? 'transparent' : theme.glass.divider }]}>
        {content}
      </View>
    );
  }

  return (
    <GlassPressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={cleanDisplayText(label)}
      disabled={disabled}
      haptic="selection"
      scaleTo={0.94}
      // 34pt visual chip, 44pt touch target.
      hitSlop={5}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.glass.selected : theme.glass.inner,
          borderColor: selected ? 'transparent' : theme.glass.divider,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {content}
    </GlassPressable>
  );
}

export function ChipGroup<T extends string>({
  items,
  mode = 'single',
  selected,
  onChange,
  searchable,
  searchPlaceholder = 'Buscar',
  creatable,
  onCreate,
  emptyLabel = 'Sin coincidencias',
}: {
  items: readonly { value: T; label: string; count?: number; icon?: IconName }[];
  mode?: 'single' | 'multi';
  selected: T | T[];
  onChange: (value: T | T[]) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  creatable?: boolean;
  onCreate?: (value: string) => void;
  emptyLabel?: string;
}) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLocaleLowerCase();
  const visible = normalized ? items.filter((item) => item.label.toLocaleLowerCase().includes(normalized)) : items;
  const isSelected = (candidate: T) => Array.isArray(selected) ? selected.includes(candidate) : selected === candidate;

  const toggle = (candidate: T) => {
    if (mode === 'multi') {
      const current = Array.isArray(selected) ? selected : [];
      onChange(current.includes(candidate) ? current.filter((value) => value !== candidate) : [...current, candidate]);
    } else {
      onChange(candidate);
    }
  };

  return (
    <View style={{ gap: theme.spacing.md }}>
      {searchable ? (
        <Field
          variant="search"
          value={query}
          onChangeText={setQuery}
          placeholder={searchPlaceholder}
          accessibilityLabel={searchPlaceholder}
          returnKeyType="search"
          onSubmitEditing={() => {
            const value = query.trim();
            if (creatable && value && onCreate && !items.some((item) => item.label.toLocaleLowerCase() === value.toLocaleLowerCase())) onCreate(value);
          }}
        />
      ) : null}
      <View style={styles.chipWrap}>
        {visible.map((item) => (
          <Chip key={item.value} label={item.label} count={item.count} icon={item.icon} selected={isSelected(item.value)} onPress={() => toggle(item.value)} />
        ))}
        {creatable && normalized && !visible.length ? (
          <Chip label={`Crear “${query.trim()}”`} onPress={() => onCreate?.(query.trim())} icon="plus" />
        ) : null}
      </View>
      {!visible.length && !creatable ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{emptyLabel}</Text> : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Tag                                                                        */
/* -------------------------------------------------------------------------- */

export type TagTone = 'neutral' | 'positive' | 'warning' | 'danger' | 'info';

export function Tag({
  label,
  tone = 'neutral',
  kind = 'status',
  icon,
  live = false,
}: {
  label: string;
  tone?: TagTone;
  kind?: 'status' | 'provenance' | 'stamp';
  icon?: IconName;
  live?: boolean;
}) {
  const theme = useTheme();
  const color = tone === 'positive'
    ? theme.status.income
    : tone === 'warning'
      ? theme.status.warning
      : tone === 'danger'
        ? theme.status.expense
        : tone === 'info'
          ? theme.colors.model
          : theme.colors.textSecondary;
  const background = tone === 'neutral' ? theme.glass.inner : `${color}1F`;
  const palette = { color, background };
  const resolvedIcon = icon ?? (kind === 'provenance' ? 'cpu' : live ? 'radio' : undefined);

  return (
    <View
      accessibilityLabel={cleanDisplayText(label)}
      style={[
        styles.tag,
        {
          backgroundColor: kind === 'stamp' ? 'transparent' : palette.background,
          borderColor: kind === 'stamp' ? theme.glass.divider : `${palette.color}44`,
          borderRadius: kind === 'stamp' ? theme.radius.sm : theme.radius.pill,
        },
      ]}
    >
      {resolvedIcon ? <Feather name={resolvedIcon} size={11} color={palette.color} /> : <View style={[styles.tagDot, { backgroundColor: palette.color }]} />}
      <Text style={[theme.typography.caption, { color: palette.color, fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 0.1 }]}>
        {cleanDisplayText(label)}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* ConfidenceMeter                                                            */
/* -------------------------------------------------------------------------- */

export function ConfidenceMeter({ value, showValue = false }: { value?: number; showValue?: boolean }) {
  const theme = useTheme();
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const normalized = Math.max(0, Math.min(1, value));
  const level = normalized >= 0.85 ? 3 : normalized >= 0.5 ? 2 : 1;
  const word = normalized >= 0.85 ? 'Segura' : normalized >= 0.5 ? 'Dudosa' : 'Posible';
  const color = normalized >= 0.85 ? theme.colors.success : normalized >= 0.5 ? theme.colors.warning : theme.colors.danger;

  return (
    <View accessibilityLabel={`Confianza ${word.toLowerCase()}${showValue ? `, ${Math.round(normalized * 100)} por ciento` : ''}`} style={styles.confidence}>
      <View style={styles.confidenceBars}>
        {[1, 2, 3].map((bar) => (
          <View key={bar} style={[styles.confidenceBar, { height: 4 + bar * 3, backgroundColor: bar <= level ? color : theme.glass.divider }]} />
        ))}
      </View>
      <Text style={[theme.typography.caption, { color, fontSize: 11 }]}>{word}{showValue ? ` · ${Math.round(normalized * 100)}%` : ''}</Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Field                                                                      */
/* -------------------------------------------------------------------------- */

export function Field({
  variant = 'default',
  label,
  hint,
  error,
  leading,
  trailing,
  style,
  inputRef,
  ...props
}: TextInputProps & {
  variant?: 'default' | 'search' | 'amount';
  /** Ref to the underlying TextInput, for focus chaining. */
  inputRef?: Ref<TextInput>;
  label?: string;
  hint?: string;
  error?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  style?: TextInputProps['style'];
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isSearch = variant === 'search';
  const isAmount = variant === 'amount';

  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{cleanDisplayText(label)}</Text> : null}
      <GlassSurface
        level={isSearch ? 'thin' : 'regular'}
        padding="none"
        radius={isAmount ? 'lg' : 'md'}
        bordered={!isSearch}
        style={[
          { minHeight: isAmount ? Math.min(72, Math.max(58, width * 0.16)) : 48 },
          error ? { borderColor: theme.colors.danger } : null,
          isSearch ? { backgroundColor: theme.glass.solid.thin } : null,
        ]}
      >
        <View style={styles.fieldRow}>
          {leading ? <View style={{ marginLeft: 16, marginRight: -4 }}>{leading}</View> : null}
          <TextInput
            ref={inputRef}
            accessibilityLabel={props.accessibilityLabel ?? label}
            placeholderTextColor={theme.colors.textMuted}
            selectionColor={theme.colors.accent}
            {...props}
            style={[
              {
                flex: 1,
                minHeight: isAmount ? 64 : 44,
                color: theme.colors.textPrimary,
                paddingHorizontal: 14,
                paddingVertical: isAmount ? 12 : 10,
              },
              // A multiline input on Android centres its text vertically and stays one line tall.
              props.multiline ? { minHeight: 88, textAlignVertical: 'top' } : null,
              isAmount ? theme.typography.numeral : theme.typography.body,
              style,
            ]}
          />
          {trailing ? <View style={{ marginRight: 12 }}>{trailing}</View> : null}
        </View>
      </GlassSurface>
      {error ? <Text style={[theme.typography.caption, { color: theme.colors.danger }]}>{cleanDisplayText(error)}</Text> : null}
      {!error && hint ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{cleanDisplayText(hint)}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  buttonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  segmentTrack: {
    borderWidth: StyleSheet.hairlineWidth,
    position: 'relative',
    overflow: 'hidden',
  },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  segmentScroller: {
    flexWrap: 'nowrap',
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    zIndex: 1,
  },
  segmentCount: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    minHeight: 34,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipCount: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    minHeight: 24,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tagDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  confidence: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  confidenceBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  confidenceBar: {
    width: 3,
    borderRadius: 2,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
