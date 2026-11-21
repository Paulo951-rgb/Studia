import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { usePalette, radius, spacing, type Palette } from '@/ui/theme/theme';

export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { palette } = usePalette();
  return <View style={[{ flex: 1, backgroundColor: palette.background }, style]}>{children}</View>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { palette } = usePalette();
  return (
    <View
      style={[
        {
          backgroundColor: palette.surface,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: palette.border,
          padding: spacing.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

type TextVariant = 'title' | 'heading' | 'body' | 'caption' | 'mono';

export function AppText({
  children,
  variant = 'body',
  color,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  variant?: TextVariant;
  color?: keyof Palette;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const { palette } = usePalette();
  const base: Record<TextVariant, TextStyle> = {
    title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.4 },
    heading: { fontSize: 17, fontWeight: '600' },
    body: { fontSize: 15, lineHeight: 21 },
    caption: { fontSize: 12.5, lineHeight: 17 },
    mono: { fontSize: 13, fontFamily: 'Menlo' },
  };
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[base[variant], { color: palette[color ?? 'text'] }, style]}
    >
      {children}
    </Text>
  );
}

export function Muted({
  children,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <AppText variant="caption" color="textMuted" style={style} {...(numberOfLines !== undefined ? { numberOfLines } : {})}>
      {children}
    </AppText>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { palette } = usePalette();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: palette.border }, style]} />;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { palette } = usePalette();
  const background =
    variant === 'primary' ? palette.accent : variant === 'danger' ? palette.danger : variant === 'secondary' ? palette.surfaceElevated : 'transparent';
  const textColor = variant === 'primary' ? palette.accentText : variant === 'danger' ? '#FFFFFF' : palette.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || loading) }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: background,
          borderRadius: radius.md,
          paddingVertical: 12,
          paddingHorizontal: spacing.lg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          borderWidth: variant === 'ghost' ? StyleSheet.hairlineWidth : 0,
          borderColor: palette.border,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={textColor} /> : icon}
      <Text style={{ color: textColor, fontWeight: '600', fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  tone = 'neutral',
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'accent';
}) {
  const { palette } = usePalette();
  const toneColor =
    tone === 'success' ? palette.success : tone === 'warning' ? palette.warning : tone === 'danger' ? palette.danger : tone === 'accent' ? palette.accent : palette.textMuted;
  const content = (
    <View
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        borderRadius: radius.pill,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: selected ? palette.accent : palette.border,
        backgroundColor: selected ? palette.accentSoft : 'transparent',
      }}
    >
      <Text style={{ color: selected ? palette.accent : toneColor, fontSize: 12.5, fontWeight: '600' }}>{label}</Text>
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content;
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  multiline,
  hint,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'url';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  multiline?: boolean;
  hint?: string;
  editable?: boolean;
}) {
  const { palette } = usePalette();
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="caption" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {label}
      </AppText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.textFaint}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        multiline={multiline}
        editable={editable}
        style={{
          backgroundColor: palette.surfaceElevated,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: palette.border,
          borderRadius: radius.md,
          color: palette.text,
          paddingHorizontal: spacing.md,
          paddingVertical: 12,
          fontSize: 15,
          minHeight: multiline ? 96 : undefined,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
      {hint ? <Muted>{hint}</Muted> : null}
    </View>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  const { palette } = usePalette();
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: palette.surfaceElevated,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppText variant="heading" color="textMuted">
          ∅
        </AppText>
      </View>
      <AppText variant="heading">{title}</AppText>
      {description ? (
        <Muted style={{ textAlign: 'center', maxWidth: 320 }}>
          {description}
        </Muted>
      ) : null}
      {action}
    </View>
  );
}

export function Row({
  title,
  subtitle,
  right,
  onPress,
  accessory,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  accessory?: React.ReactNode;
}) {
  const { palette } = usePalette();
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
      <View style={{ flex: 1, gap: 3 }}>
        {typeof title === 'string' ? <AppText variant="body">{title}</AppText> : title}
        {subtitle ? (typeof subtitle === 'string' ? <Muted>{subtitle}</Muted> : subtitle) : null}
      </View>
      {right}
      {accessory ?? (onPress ? <AppText color="textFaint">›</AppText> : null)}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, borderBottomColor: palette.border, borderBottomWidth: StyleSheet.hairlineWidth })}>
      {content}
    </Pressable>
  ) : (
    <View style={{ borderBottomColor: palette.border, borderBottomWidth: StyleSheet.hairlineWidth }}>{content}</View>
  );
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: 'accent' | 'success' | 'warning' | 'danger' }) {
  const { palette } = usePalette();
  const color = tone ? palette[tone] : palette.text;
  return (
    <View style={{ gap: 2 }}>
      <AppText variant="heading" style={{ color, fontSize: 20 }}>
        {value}
      </AppText>
      <Muted>{label}</Muted>
    </View>
  );
}

export function Spinner({ label }: { label?: string }) {
  const { palette } = usePalette();
  return (
    <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl }}>
      <ActivityIndicator color={palette.accent} />
      {label ? <Muted>{label}</Muted> : null}
    </View>
  );
}

export function Banner({ tone, title, description }: { tone: 'warning' | 'danger' | 'info'; title: string; description?: string }) {
  const { palette } = usePalette();
  const color = tone === 'danger' ? palette.danger : tone === 'warning' ? palette.warning : palette.accent;
  return (
    <View
      style={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: color,
        backgroundColor: palette.surface,
        borderRadius: radius.md,
        padding: spacing.md,
        gap: 4,
      }}
    >
      <AppText variant="body" style={{ color, fontWeight: '600' }}>
        {title}
      </AppText>
      {description ? <Muted>{description}</Muted> : null}
    </View>
  );
}
