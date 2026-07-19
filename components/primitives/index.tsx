import { Feather } from '@expo/vector-icons';
import { ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  PressableProps,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TextInputProps,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/lib/app-state';
import { cleanDisplayText } from '@/lib/format';

type SurfaceVariant = 'default' | 'raised' | 'subtle';
const AnimatedPressableRoot = Animated.createAnimatedComponent(Pressable);

export function AnimatedPressable({
  children,
  style,
  onPressIn,
  onPressOut,
  disabled,
  scaleTo = 0.985,
  ...props
}: PressableProps & {
  children: ReactNode;
  scaleTo?: number;
}) {
  const theme = useTheme();
  const progress = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - progress.value * (1 - scaleTo) }],
    opacity: disabled ? 0.58 : 1 - progress.value * 0.08,
  }));

  return (
    <AnimatedPressableRoot
      {...props}
      disabled={disabled}
      onPressIn={(event) => {
        progress.value = withTiming(1, { duration: theme.motion.fast });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        progress.value = withSpring(0, theme.motion.spring);
        onPressOut?.(event);
      }}
      style={[animatedStyle, style]}
    >
      {children}
    </AnimatedPressableRoot>
  );
}

export function Surface({
  children,
  variant = 'default',
  padding = 'md',
  radius = 'lg',
  bordered = true,
  style,
}: {
  children: ReactNode;
  variant?: SurfaceVariant;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  radius?: 'sm' | 'md' | 'lg' | 'xl';
  bordered?: boolean;
  style?: object;
}) {
  const theme = useTheme();
  const paddingValue = padding === 'none' ? 0 : padding === 'sm' ? theme.spacing.sm : padding === 'lg' ? theme.spacing.lg : theme.spacing.md;
  const backgroundColor = variant === 'raised' ? theme.colors.surfaceRaised : variant === 'subtle' ? theme.colors.surfaceSubtle : theme.colors.surface;
  const borderColor = variant === 'raised' ? theme.depth.hairline : variant === 'subtle' ? theme.depth.hairline : theme.colors.border;

  return (
    <View
      style={[
        {
          backgroundColor,
          borderRadius: theme.radius[radius],
          padding: paddingValue,
          borderWidth: bordered ? StyleSheet.hairlineWidth : 0,
          borderColor,
          ...(variant === 'raised' ? theme.shadow.card : {}),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Panel({
  children,
  tone = 'neutral',
  style,
  padding = 'md',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'finance' | 'review' | 'danger';
  style?: object;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}) {
  const theme = useTheme();
  const glow =
    tone === 'accent'
      ? theme.depth.glow
      : tone === 'finance'
        ? `${theme.status.income}24`
        : tone === 'review'
          ? `${theme.status.review}24`
          : tone === 'danger'
            ? `${theme.colors.danger}22`
            : theme.depth.hairline;

  return (
    <Surface
      variant="raised"
      padding={padding}
      style={[
        {
          borderColor: glow,
          borderWidth: 1,
        },
        style,
      ]}
    >
      {children}
    </Surface>
  );
}

export function CommandPanel({ children, style }: { children: ReactNode; style?: object }) {
  const theme = useTheme();

  return (
    <Panel
      tone="accent"
      style={[
        {
          gap: theme.spacing.md,
          backgroundColor: theme.colors.surfaceRaised,
        },
        style,
      ]}
    >
      {children}
    </Panel>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  const theme = useTheme();
  const paddings = {
    sm: { vertical: 7, horizontal: 12 },
    md: { vertical: 10, horizontal: 16 },
    lg: { vertical: 12, horizontal: 18 },
  };
  const backgrounds = {
    primary: theme.colors.accent,
    secondary: theme.colors.surfaceSubtle,
    ghost: 'transparent',
    danger: theme.colors.danger,
  };
  const textColor = variant === 'primary' || variant === 'danger' ? '#ffffff' : theme.colors.textPrimary;
  const resolvedTextColor = variant === 'primary' || variant === 'danger' ? theme.colors.onAccent : textColor;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        {
          backgroundColor: backgrounds[variant],
          borderColor: variant === 'ghost' ? theme.colors.border : backgrounds[variant],
          paddingVertical: paddings[size].vertical,
          paddingHorizontal: paddings[size].horizontal,
          borderRadius: theme.radius.md,
          minHeight: size === 'lg' ? 48 : size === 'md' ? 44 : 36,
        },
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={resolvedTextColor} /> : icon}
      {!loading ? (
        <Text style={[size === 'sm' ? theme.typography.caption : theme.typography.bodyStrong, { color: resolvedTextColor, fontSize: size === 'sm' ? 12 : 14 }]}>
          {cleanDisplayText(label)}
        </Text>
      ) : null}
    </AnimatedPressable>
  );
}

export const ActionButton = Button;

export function IconButton({
  icon,
  label,
  onPress,
  variant = 'ghost',
  size = 'md',
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  variant?: 'ghost' | 'filled';
  size?: 'sm' | 'md';
}) {
  const theme = useTheme();
  const boxSize = size === 'sm' ? 32 : 38;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      onPress={onPress}
      style={[
        styles.iconButton,
        {
          width: boxSize,
          height: boxSize,
          borderRadius: theme.radius.pill,
          backgroundColor: variant === 'filled' ? theme.colors.surfaceRaised : 'transparent',
          borderColor: theme.colors.border,
        },
      ]}
    >
      {icon}
    </AnimatedPressable>
  );
}

export function FilterChip({
  label,
  selected = false,
  count,
  onPress,
  disabled,
}: {
  label: string;
  selected?: boolean;
  count?: number;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.colors.accentSoft : theme.colors.surface,
          borderColor: selected ? theme.colors.accent : theme.colors.border,
          borderRadius: theme.radius.md,
          minHeight: 36,
        },
      ]}
    >
      <Text style={[theme.typography.caption, { color: selected ? theme.colors.accentStrong : theme.colors.textSecondary }]}>{cleanDisplayText(label)}</Text>
      {typeof count === 'number' ? (
        <View style={[styles.pill, { backgroundColor: selected ? theme.colors.surface : theme.colors.surfaceSubtle }]}>
          <Text style={[theme.typography.caption, { color: selected ? theme.colors.accentStrong : theme.colors.textMuted }]}>{count}</Text>
        </View>
      ) : null}
    </AnimatedPressable>
  );
}

export const FilterButton = FilterChip;

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string; icon?: ReactNode; count?: number }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();

  return (
    <View accessibilityRole="tablist" style={[styles.segmented, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.lg }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <AnimatedPressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              {
                backgroundColor: selected ? theme.colors.accent : theme.colors.surface,
                borderColor: selected ? theme.colors.accent : theme.colors.border,
                borderRadius: theme.radius.md,
              },
            ]}
          >
            {option.icon}
            <Text style={[theme.typography.caption, { color: selected ? theme.colors.onAccent : theme.colors.textSecondary }]}>{cleanDisplayText(option.label)}</Text>
            {typeof option.count === 'number' ? <Text style={[theme.typography.caption, { color: selected ? theme.colors.onAccent : theme.colors.textMuted }]}>{option.count}</Text> : null}
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

export function DisclosureSection({
  title,
  subtitle,
  children,
  defaultOpen = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Surface variant="subtle" style={{ gap: open ? theme.spacing.md : 0 }}>
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        style={styles.rowBetween}
      >
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{cleanDisplayText(title)}</Text>
          {subtitle ? <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{cleanDisplayText(subtitle)}</Text> : null}
        </View>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.textMuted} />
      </AnimatedPressable>
      {open ? children : null}
    </Surface>
  );
}

export function Input(props: TextInputProps & { label?: string }) {
  const theme = useTheme();
  const { label, style, ...inputProps } = props;

  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{cleanDisplayText(label)}</Text> : null}
      <TextInput
        accessibilityLabel={inputProps.accessibilityLabel ?? label}
        placeholderTextColor={theme.colors.textMuted}
        {...inputProps}
        style={[
          {
            backgroundColor: theme.colors.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.lg,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.md,
            color: theme.colors.textPrimary,
            minHeight: props.multiline ? 100 : 46,
            textAlignVertical: props.multiline ? 'top' : 'center',
          },
          style,
        ]}
      />
    </View>
  );
}

export function SearchField(props: TextInputProps & { label?: string }) {
  return <Input accessibilityRole="search" returnKeyType="search" {...props} />;
}

export function ListRow({
  title,
  subtitle,
  description,
  descriptionNumberOfLines,
  leading,
  trailing,
  onPress,
}: {
  title: string;
  subtitle?: string;
  description?: string;
  descriptionNumberOfLines?: number;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const content = (
    <View style={styles.listRow}>
      {leading ? <View style={{ marginRight: theme.spacing.md }}>{leading}</View> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{cleanDisplayText(title)}</Text>
        {subtitle ? <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{cleanDisplayText(subtitle)}</Text> : null}
        {description ? <Text numberOfLines={descriptionNumberOfLines} style={[theme.typography.caption, { color: theme.colors.textMuted }]}>{cleanDisplayText(description)}</Text> : null}
      </View>
      {trailing ? <View style={{ marginLeft: theme.spacing.md }}>{trailing}</View> : null}
      {onPress && !trailing ? <Feather name="chevron-right" size={16} color={theme.colors.textMuted} style={{ marginLeft: theme.spacing.sm }} /> : null}
    </View>
  );

  if (!onPress) {
    return <Surface variant="subtle" padding="sm">{content}</Surface>;
  }

  return (
    <AnimatedPressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={{ marginBottom: theme.spacing.sm }}>
      <Surface variant="raised" padding="sm">{content}</Surface>
    </AnimatedPressable>
  );
}

export function ToggleRow({
  title,
  subtitle,
  value,
  onValueChange,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}) {
  const theme = useTheme();

  return (
    <Surface variant="subtle">
      <View style={styles.rowBetween}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[theme.typography.bodyStrong, { color: theme.colors.textPrimary }]}>{cleanDisplayText(title)}</Text>
          {subtitle ? <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>{cleanDisplayText(subtitle)}</Text> : null}
        </View>
        <Switch accessibilityRole="switch" accessibilityLabel={title} accessibilityState={{ checked: value }} value={value} onValueChange={onValueChange} />
      </View>
    </Surface>
  );
}

export function StatusBadge({ label, tone = 'neutral', onPress }: { label: string; tone?: 'neutral' | 'positive' | 'warning' | 'danger'; onPress?: () => void }) {
  const theme = useTheme();
  const background =
    tone === 'positive'
      ? theme.colors.success + '22'
      : tone === 'warning'
        ? theme.colors.warning + '22'
        : tone === 'danger'
          ? theme.colors.danger + '22'
          : theme.colors.surfaceSubtle;
  const color = tone === 'positive' ? theme.colors.success : tone === 'warning' ? theme.colors.warning : tone === 'danger' ? theme.colors.danger : theme.colors.textSecondary;

  const content = (
    <View style={[styles.pill, { backgroundColor: background, borderWidth: StyleSheet.hairlineWidth, borderColor: color + '33' }]}>
      <Text style={[theme.typography.caption, { color }]}>{cleanDisplayText(label)}</Text>
    </View>
  );

  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={`${label}. Show explanation`} onPress={onPress}>{content}</Pressable> : content;
}

export function BottomSheet({ visible, title, children, onClose }: { visible: boolean; title: string; children: ReactNode; onClose: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const maxSheetHeight = Math.max(320, height - insets.top - insets.bottom - 24);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.sheetScrim, { paddingTop: insets.top + theme.spacing.sm, paddingBottom: insets.bottom + theme.spacing.md }]}>
        <Surface variant="raised" radius="xl" style={{ gap: theme.spacing.md, marginTop: 'auto', maxHeight: maxSheetHeight }}>
          <View style={styles.rowBetween}>
            <Text style={[theme.typography.headline, { color: theme.colors.textPrimary }]}>{cleanDisplayText(title)}</Text>
            <IconButton icon={<Feather name="x" size={18} color={theme.colors.textPrimary} />} label="Close" onPress={onClose} />
          </View>
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}
          >
            {children}
          </ScrollView>
        </Surface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  segmented: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 5,
    gap: 5,
  },
  segment: {
    minHeight: 38,
    minWidth: 74,
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  sheetScrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingHorizontal: 16,
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
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
