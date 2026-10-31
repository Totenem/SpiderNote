import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ColorValue,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { router } from "expo-router";
import { C, ui } from "@/theme/tokens";

export type IconName =
  | "mic"
  | "notes"
  | "search"
  | "settings"
  | "plus"
  | "arrow"
  | "back"
  | "check"
  | "shield"
  | "folder"
  | "pin"
  | "play"
  | "pause"
  | "stop"
  | "trash"
  | "export"
  | "close"
  | "headphones";
const paths: Record<IconName, string> = {
  mic: "M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5Zm-3 6v1a6 6 0 0 0 12 0v-1M12 18v4M8 22h8",
  notes: "M6 3h9l4 4v14H6V3Zm8 0v5h5M9 12h7M9 16h5",
  search: "M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM16 16l5 5",
  settings:
    "M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  plus: "M12 5v14M5 12h14",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  back: "m14 5-7 7 7 7",
  check: "m5 12 4 4L19 6",
  shield: "M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Zm-4 9 3 3 5-6",
  folder: "M3 7V4h7l2 3h9v13H3V7Z",
  pin: "m8 3 8 0-1 6 3 4H6l3-4-1-6Zm4 10v8",
  play: "m8 4 12 8-12 8V4Z",
  pause: "M8 5v14M16 5v14",
  stop: "M6 6h12v12H6V6Z",
  trash: "M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7",
  export: "M12 15V3m-4 4 4-4 4 4M5 13v8h14v-8",
  close: "m6 6 12 12M6 18 18 6",
  headphones: "M4 13v-2a8 8 0 0 1 16 0v2M4 12h4v8H4v-8Zm12 0h4v8h-4v-8Z",
};
export function Icon({
  name,
  color = C.ink,
  size = 22,
}: {
  name: IconName;
  color?: ColorValue;
  size?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={paths[name]}
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
export function Brand({ size = 46 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect width="64" height="64" rx="19" fill={C.midnight} />
      <Path
        d="M32 0v17m-8 5-8-5m8 11-10 2m10 4-8 7m24-19 8-5m-8 11 10 2m-10 4 8 7"
        stroke={C.lavender}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <Circle cx="32" cy="27" r="10" fill={C.lavender} />
      <Circle cx="29" cy="25" r="1.5" fill={C.midnight} />
      <Circle cx="35" cy="25" r="1.5" fill={C.midnight} />
      <Path
        d="M32 37v9h16l-5 8H23v-8h9"
        stroke="white"
        strokeWidth="2.4"
        fill="none"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
export function Button({
  label,
  onPress,
  icon,
  secondary,
  danger,
  disabled,
  busy,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        danger && styles.danger,
        { opacity: disabled || busy ? 0.5 : pressed ? 0.75 : 1 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? C.violet : C.white} />
      ) : (
        icon && (
          <Icon name={icon} size={19} color={secondary ? C.violet : C.white} />
        )
      )}
      <Text style={[styles.buttonText, secondary && { color: C.violet }]}>
        {label}
      </Text>
    </Pressable>
  );
}
export function IconButton({
  name,
  label,
  onPress,
  color = C.ink,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { opacity: pressed ? 0.5 : 1 },
      ]}
    >
      <Icon name={name} color={color} />
    </Pressable>
  );
}
export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: IconName;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.selected]}
    >
      {icon && (
        <Icon name={icon} size={16} color={selected ? C.white : C.muted} />
      )}
      <Text
        style={{
          color: selected ? C.white : C.muted,
          fontWeight: "600",
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Screen({
  children,
  scroll = true,
  style,
}: PropsWithChildren<{ scroll?: boolean; style?: StyleProp<ViewStyle> }>) {
  return (
    <SafeAreaView style={[ui.page, style]} edges={["top", "left", "right"]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={ui.content}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </SafeAreaView>
  );
}
export function Header({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={[ui.between, { paddingTop: 8 }]}>
      <View style={ui.row}>
        <IconButton
          name="back"
          label="Go back"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
        />
        <Text style={ui.heading}>{title}</Text>
      </View>
      {right}
    </View>
  );
}
export function Notice({
  children,
  error,
}: PropsWithChildren<{ error?: boolean }>) {
  return (
    <View
      accessibilityRole={error ? "alert" : undefined}
      style={{
        backgroundColor: error ? C.coralPale : C.pale,
        padding: 16,
        borderRadius: 16,
      }}
    >
      <Text style={[ui.body, { color: error ? C.coral : C.ink }]}>
        {children}
      </Text>
    </View>
  );
}
export function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name="notes" color={C.violet} size={30} />
      </View>
      <Text style={[ui.heading, { textAlign: "center" }]}>{title}</Text>
      <Text style={[ui.body, { textAlign: "center" }]}>{body}</Text>
      {action}
    </View>
  );
}
const styles = StyleSheet.create({
  button: {
    backgroundColor: C.violet,
    minHeight: 52,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  buttonText: { color: C.white, fontWeight: "700", fontSize: 14 },
  secondary: { backgroundColor: C.pale },
  danger: { backgroundColor: C.coral },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 24,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
  },
  selected: { backgroundColor: C.midnight, borderColor: C.midnight },
  empty: {
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 46,
    gap: 14,
  },
  emptyIcon: {
    padding: 21,
    backgroundColor: C.pale,
    borderRadius: 27,
    marginBottom: 8,
  },
});
