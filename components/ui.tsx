import React from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  TextStyle,
  ViewStyle,
  Platform,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useApp } from "../lib/context";
import { money } from "../lib/domain";
import { t } from "../lib/ar";
export type IconName = React.ComponentProps<typeof Ionicons>["name"];
export function T({
  children,
  style,
  bold = false,
  medium = false,
  number = false,
  ...props
}: React.ComponentProps<typeof Text> & {
  bold?: boolean;
  medium?: boolean;
  number?: boolean;
}) {
  const { theme } = useApp();
  return (
    <Text
      {...props}
      style={[
        {
          fontFamily: bold
            ? "Tajawal-Bold"
            : medium
              ? "Tajawal-Medium"
              : "Tajawal",
          fontSize: 14,
          color: theme.text,
          textAlign: "right",
          writingDirection: number ? "ltr" : "rtl",
          lineHeight: 22,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Icon({
  name,
  size = 20,
  color,
  style,
}: {
  name: IconName;
  size?: number;
  color?: string;
  style?: any;
}) {
  const { theme } = useApp();
  return (
    <Ionicons
      name={name}
      size={size}
      color={color || theme.secondary}
      style={style}
    />
  );
}
export function Row({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  return (
    <View
      style={[{ flexDirection: "row-reverse", alignItems: "center" }, style]}
    >
      {children}
    </View>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  const { theme } = useApp();
  return (
    <View
      style={[
        {
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 15,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Button({
  label,
  icon,
  onPress,
  variant = "primary",
  small = false,
  disabled = false,
  loading = false,
  style,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  variant?: "primary" | "outline" | "soft" | "ghost" | "danger" | "white";
  small?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: any;
}) {
  const { theme } = useApp();
  const color =
    variant === "primary"
      ? "#fff"
      : variant === "danger"
        ? theme.error
        : variant === "white"
          ? "#26553F"
          : theme.primary;
  const bg =
    variant === "primary"
      ? theme.primary
      : variant === "soft"
        ? theme.primarySoft
        : variant === "danger"
          ? theme.redSoft
          : variant === "white"
            ? "#fff"
            : "transparent";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed, hovered }: any) => [
        {
          minHeight: small ? 36 : 46,
          paddingHorizontal: small ? 13 : 19,
          borderRadius: 8,
          backgroundColor: bg,
          flexDirection: "row-reverse",
          gap: 8,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: variant === "outline" ? 1 : 0,
          borderColor: theme.border,
          opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
          ...(Platform.OS === "web"
            ? {
                cursor: "pointer",
                transition: "all .15s",
                transform: hovered ? [{ translateY: -1 }] : [],
              }
            : {}),
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} size="small" />
      ) : icon ? (
        <Icon name={icon} size={small ? 16 : 18} color={color} />
      ) : null}
      <T bold style={{ color, fontSize: small ? 12 : 14, lineHeight: 21 }}>
        {label}
      </T>
    </Pressable>
  );
}
export function IconButton({
  icon,
  onPress,
  label,
  size = 38,
  color,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  size?: number;
  color?: string;
}) {
  const { theme } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed, hovered }: any) => ({
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 10,
        backgroundColor: pressed || hovered ? theme.primarySoft : "transparent",
      })}
    >
      <Icon name={icon} size={20} color={color} />
    </Pressable>
  );
}
export function Money({
  value,
  size = 26,
  color,
  currency = true,
}: {
  value: number;
  size?: number;
  color?: string;
  currency?: boolean;
}) {
  const { theme } = useApp();
  return (
    <Row style={{ gap: 7, justifyContent: "flex-start", flexWrap: "wrap" }}>
      <T
        number
        bold
        style={{
          fontSize: size,
          lineHeight: size + 8,
          color: color || theme.text,
          fontVariant: ["tabular-nums"],
        }}
      >
        {money(value)}
      </T>
      {currency && (
        <T style={{ fontSize: 11, color: color || theme.muted, marginTop: 5 }}>
          {t("currency")}
        </T>
      )}
    </Row>
  );
}
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  multiline = false,
  error,
  style,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  keyboardType?: React.ComponentProps<typeof TextInput>["keyboardType"];
  multiline?: boolean;
  error?: string;
  style?: any;
  editable?: boolean;
}) {
  const { theme } = useApp();
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={[{ gap: 7, flex: 1, minWidth: 0 }, style]}>
      <T medium style={{ fontSize: 13 }}>
        {label}
      </T>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        placeholder={placeholder || ""}
        placeholderTextColor={theme.muted}
        keyboardType={keyboardType}
        returnKeyType={multiline ? "default" : "next"}
        multiline={multiline}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          fontFamily: "Tajawal",
          fontSize: 15,
          color: theme.text,
          backgroundColor: theme.surface2,
          borderWidth: 1,
          borderColor: error
            ? theme.error
            : focused
              ? theme.primary
              : theme.border,
          borderRadius: 9,
          paddingHorizontal: 14,
          paddingVertical: 12,
          minHeight: 47,
          textAlign: "right",
          writingDirection:
            keyboardType === "decimal-pad" || keyboardType === "phone-pad"
              ? "ltr"
              : "rtl",
          ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
          ...(multiline ? { minHeight: 85, textAlignVertical: "top" } : {}),
        }}
      />
      {error && <T style={{ fontSize: 11, color: theme.error }}>{error}</T>}
    </View>
  );
}
export function Chips<TValue extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: TValue }[];
  value: TValue;
  onChange: (v: TValue) => void;
}) {
  const { theme } = useApp();
  return (
    <Row style={{ gap: 7, flexWrap: "wrap" }}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          onPress={() => onChange(option.value)}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 7,
            backgroundColor:
              value === option.value ? theme.primarySoft : theme.surface,
            borderWidth: 1,
            borderColor:
              value === option.value ? theme.primarySoft : theme.border,
          }}
        >
          <T
            medium
            style={{
              fontSize: 12,
              color: value === option.value ? theme.primary : theme.secondary,
            }}
          >
            {option.label}
          </T>
        </Pressable>
      ))}
    </Row>
  );
}
export function Empty({
  icon = "file-tray-outline",
  title,
  description,
  action,
  compact = false,
}: {
  icon?: IconName;
  title: string;
  description: string;
  action?: { label: string; onPress: () => void };
  compact?: boolean;
}) {
  const { theme } = useApp();
  return (
    <View style={{ alignItems: "center", padding: compact ? 20 : 42, gap: 8 }}>
      <View
        style={{
          width: compact ? 48 : 65,
          height: compact ? 48 : 65,
          borderRadius: compact ? 16 : 22,
          backgroundColor: theme.primarySoft,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 5,
        }}
      >
        <Icon name={icon} size={compact ? 24 : 30} color={theme.primary} />
      </View>
      <T bold style={{ fontSize: compact ? 15 : 18, textAlign: "center" }}>
        {title}
      </T>
      <T
        style={{
          fontSize: 12,
          color: theme.muted,
          textAlign: "center",
          maxWidth: 340,
        }}
      >
        {description}
      </T>
      {action && (
        <Button
          small
          variant="soft"
          label={action.label}
          icon="add"
          onPress={action.onPress}
          style={{ marginTop: 10 }}
        />
      )}
    </View>
  );
}
export function Badge({
  label,
  tone = "green",
}: {
  label: string;
  tone?: "green" | "amber" | "red" | "neutral";
}) {
  const { theme } = useApp();
  const colors = {
    green: [theme.primarySoft, theme.primary],
    amber: [theme.amberSoft, theme.amber],
    red: [theme.redSoft, theme.error],
    neutral: [theme.surface2, theme.muted],
  };
  return (
    <View
      style={{
        backgroundColor: colors[tone][0],
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: 6,
        alignSelf: "flex-start",
      }}
    >
      <T
        medium
        style={{ fontSize: 11, lineHeight: 20, color: colors[tone][1] }}
      >
        {label}
      </T>
    </View>
  );
}
export function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}) {
  const { theme } = useApp();
  return (
    <Row style={{ justifyContent: "space-between", gap: 12 }}>
      <View style={{ flex: 1 }}>
        <T bold style={{ fontSize: 16 }}>
          {title}
        </T>
        {subtitle && (
          <T style={{ fontSize: 12, color: theme.muted, marginTop: 3 }}>
            {subtitle}
          </T>
        )}
      </View>
      {action && (
        <Pressable onPress={action.onPress}>
          <Row style={{ gap: 5 }}>
            <T medium style={{ color: theme.primary, fontSize: 12 }}>
              {action.label}
            </T>
            <Icon name="chevron-back" size={13} color={theme.primary} />
          </Row>
        </Pressable>
      )}
    </Row>
  );
}
export function SearchBox({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
}) {
  const { theme } = useApp();
  return (
    <Row
      style={{
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 9,
        paddingHorizontal: 13,
        gap: 9,
        height: 43,
        minWidth: 150,
        flex: 1,
        maxWidth: 360,
      }}
    >
      <Icon name="search-outline" size={18} color={theme.muted} />
      <TextInput
        accessibilityLabel={t("searchList")}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || t("searchList")}
        placeholderTextColor={theme.muted}
        style={{
          flex: 1,
          fontFamily: "Tajawal",
          fontSize: 13,
          color: theme.text,
          textAlign: "right",
          height: 42,
          ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
        }}
      />
      {!!value && (
        <IconButton
          icon="close"
          size={28}
          label={t("close")}
          onPress={() => onChangeText("")}
        />
      )}
    </Row>
  );
}
